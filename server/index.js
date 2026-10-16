// CleanDose — servidor (Node, sin dependencias).
//
// Guarda todo lo que no es "prender la bomba": compartimentos, espacios, tareas y el registro
// de cada dosis. El ESP32 solo pregunta si hay una orden, prende la bomba y avisa al terminar.
// También sirve la app ya compilada (dist/), así la app y la API están en el mismo origen.
//
//   PORT=8080 CLEANDOSE_TOKEN=<secreto> node server/index.js
//
// App:
//   GET  /api/estado                       todo menos la imagen del croquis
//   GET  /api/eventos?v=N                  espera (hasta 25 s) a que cambie algo; devuelve el estado
//   PUT  /api/compartimentos               { compartimentos: [{ producto, nivel_ml }] }
//   POST /api/espacios                     { espacio }  (crea o actualiza por id)
//   DELETE /api/espacios/:id
//   GET|PUT /api/croquis                   { croquis }
//   POST /api/tareas                       { id, espacioId, operarioId | 'auto', nota }
//   PATCH /api/tareas/:id                  { estado: 'pendiente' | 'hecha' }
//   POST /api/dosis                        { id, compartimento, operarioId, espacioId, recipiente, ml_producto?, tipoLimpieza?, prueba?, segundos? }
//                                          los segundos de bomba salen de ml_producto y el caudal (CAUDAL_ML_S)
//                                          una a la vez (409 ocupado), idempotente por id
//   GET  /api/dosis/:id                    { estado, resta_ms }
//   POST /api/operarios                    { nombre }  ·  DELETE /api/operarios/:id
// ESP32 (cabecera X-Token):
//   GET  /api/esp32/orden?espera=20        204 sin orden, o { id, compartimento, segundos }
//   POST /api/esp32/estado                 { id, estado: 'dosificando' | 'hecha' | 'error' }

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTOS, RECIPIENTES, mlProducto, segundosPara, N_COMPARTIMENTOS, CAPACIDAD_ML } from '../src/lib/catalogo.js';
import { operarioMasLibre } from '../src/lib/traza.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.CLEANDOSE_TOKEN ?? 'cambiar-token';
const DATOS = process.env.CLEANDOSE_DATOS ?? path.join(AQUI, 'datos', 'estado.json');
const DIST = path.join(AQUI, '..', 'dist');

const MAQUINA_EN_LINEA_MS = 30000;   // el ESP32 pregunta cada ≤ 20 s
const SIN_RESPUESTA_MS = 15000;      // orden que el ESP32 no tomó → error
const MAX_REGISTROS = 5000;

// ── Estado persistente ──────────────────────────────────────────────
// Arranca vacío: el administrador crea operarios y espacios; el operario configura los compartimentos.
const estadoVacio = () => ({
  version: 1,
  operarios: [],
  espacios: [],
  compartimentos: Array.from({ length: N_COMPARTIMENTOS }, () => ({ producto: null, nivel_ml: 0, capacidad_ml: CAPACIDAD_ML })),
  tareas: [],
  registros: [],
  maquina: { visto: 0, dosis: null },
});
let estado;
try {
  estado = JSON.parse(fs.readFileSync(DATOS, 'utf8'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err; // un archivo dañado no se pisa: mejor no arrancar
  estado = estadoVacio();
}
let croquis = estado.croquis ?? null;
delete estado.croquis;

let guardando = null;
function guardar() {
  clearTimeout(guardando);
  guardando = setTimeout(() => {
    fs.mkdirSync(path.dirname(DATOS), { recursive: true });
    const tmp = DATOS + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ ...estado, croquis }));
    fs.renameSync(tmp, DATOS);
  }, 200);
}

// Quien espera cambios (app con /api/eventos, ESP32 con /api/esp32/orden).
const esperando = new Set();
function cambio() {
  estado.version++;
  guardar();
  for (const avisar of esperando) avisar();
}
function esperar(ms, listo) {
  return new Promise((resolve) => {
    const fin = () => { clearTimeout(t); esperando.delete(revisar); resolve(); };
    const revisar = () => listo() && fin();
    const t = setTimeout(fin, ms);
    esperando.add(revisar);
    revisar();
  });
}

const maquinaEnLinea = () => Date.now() - (estado.maquina.visto ?? 0) < MAQUINA_EN_LINEA_MS;
const resumen = () => ({ ...estado, maquina: { ...estado.maquina, enLinea: maquinaEnLinea() }, registros: estado.registros.slice(-1500) });

// ── Dosis ───────────────────────────────────────────────────────────
function terminarDosis(d, resultado) {
  d.estado = resultado;
  d.fin = Date.now();
  if (resultado === 'hecha' && !d.prueba) {
    const c = estado.compartimentos[d.compartimento - 1];
    c.nivel_ml = Math.max(0, c.nivel_ml - d.ml_producto);
    estado.registros.push({
      id: d.id, fecha: new Date().toISOString(), operarioId: d.operarioId, espacioId: d.espacioId,
      productoId: d.productoId, compartimento: d.compartimento, recipiente: d.recipiente,
      ml_producto: d.ml_producto, tipoLimpieza: d.tipoLimpieza, estado: 'hecha', ...(d.sinConfirmar ? { sinConfirmar: true } : {}),
    });
    if (estado.registros.length > MAX_REGISTROS) estado.registros.splice(0, estado.registros.length - MAX_REGISTROS);
  }
  estado.maquina.ultima = d;
  estado.maquina.dosis = null;
  cambio();
}

// Vigila la dosis en curso: si el ESP32 no la toma, o no avisa que terminó.
setInterval(() => {
  const d = estado.maquina.dosis;
  if (!d) return;
  const ahora = Date.now();
  if ((d.estado === 'pendiente' || d.estado === 'enviada') && ahora - d.creada > SIN_RESPUESTA_MS) {
    terminarDosis(d, 'error');
  } else if (d.estado === 'dosificando' && ahora - d.inicio > d.segundos * 1000 + SIN_RESPUESTA_MS) {
    // El ESP32 apaga la bomba solo; si no avisó, se da por hecha pero se marca.
    d.sinConfirmar = true;
    terminarDosis(d, 'hecha');
  }
}, 1000);

function buscarDosis(id) {
  if (estado.maquina.dosis?.id === id) return estado.maquina.dosis;
  if (estado.maquina.ultima?.id === id) return estado.maquina.ultima;
  const r = estado.registros.findLast((x) => x.id === id);
  return r ? { id, estado: 'hecha' } : null;
}

// ── HTTP ────────────────────────────────────────────────────────────
function responder(res, codigo, cuerpo) {
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(cuerpo === undefined ? '' : JSON.stringify(cuerpo));
}
const fallo = (res, codigo, motivo, extra = {}) => responder(res, codigo, { error: motivo, ...extra });

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.on('data', (c) => {
      datos += c;
      if (datos.length > 8e6) { reject(new Error('muy grande')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(datos ? JSON.parse(datos) : {}); } catch { reject(new Error('json')); }
    });
  });
}

const TIPOS_MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function servirApp(req, res) {
  const pedido = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let archivo = path.normalize(path.join(DIST, pedido));
  if (!archivo.startsWith(DIST)) return fallo(res, 403, 'prohibido');
  if (!fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) archivo = path.join(DIST, 'index.html');
  if (!fs.existsSync(archivo)) return fallo(res, 404, 'Compila la app primero: pnpm build');
  res.writeHead(200, { 'Content-Type': TIPOS_MIME[path.extname(archivo)] ?? 'application/octet-stream' });
  fs.createReadStream(archivo).pipe(res);
}

const rutas = [];
const ruta = (metodo, patron, fn) => rutas.push({ metodo, patron: new RegExp(`^${patron.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

ruta('GET', '/api/estado', (req, res) => responder(res, 200, resumen()));

ruta('GET', '/api/eventos', async (req, res, { url }) => {
  const v = Number(url.searchParams.get('v') ?? 0);
  await esperar(25000, () => estado.version > v);
  responder(res, 200, resumen());
});

ruta('PUT', '/api/compartimentos', async (req, res) => {
  const { compartimentos } = await leerCuerpo(req);
  if (!Array.isArray(compartimentos) || compartimentos.length !== N_COMPARTIMENTOS) return fallo(res, 400, 'Se esperan 4 compartimentos');
  if (estado.maquina.dosis) return fallo(res, 409, 'ocupado');
  estado.compartimentos = compartimentos.map((c, i) => {
    const antes = estado.compartimentos[i];
    const producto = c.producto && PRODUCTOS[c.producto] ? c.producto : null;
    const capacidad_ml = antes.capacidad_ml;
    const nivel_ml = Number.isFinite(c.nivel_ml) ? Math.min(capacidad_ml, Math.max(0, c.nivel_ml)) : antes.nivel_ml;
    return { producto, nivel_ml, capacidad_ml };
  });
  cambio();
  responder(res, 200, estado.compartimentos);
});

ruta('POST', '/api/espacios', async (req, res) => {
  const { espacio: e } = await leerCuerpo(req);
  if (!e?.nombre?.trim()) return fallo(res, 400, 'El espacio necesita nombre');
  const limpio = {
    id: e.id || `e-${Date.now().toString(36)}`, nombre: e.nombre.trim().slice(0, 60),
    area_m2: Math.max(1, Number(e.area_m2) || 1), superficie: e.superficie ?? 'piso', suciedad: e.suciedad ?? 'normal',
    zona: e.zona ?? 'general', ...(e.croquis ? { croquis: e.croquis } : {}),
  };
  const i = estado.espacios.findIndex((x) => x.id === limpio.id);
  if (i >= 0) estado.espacios[i] = limpio; else estado.espacios.push(limpio);
  cambio();
  responder(res, 200, limpio);
});

ruta('DELETE', '/api/espacios/:id', (req, res, { p }) => {
  estado.espacios = estado.espacios.filter((x) => x.id !== p.id);
  estado.tareas = estado.tareas.filter((t) => t.espacioId !== p.id || t.estado === 'hecha');
  cambio();
  responder(res, 200, { ok: true });
});

ruta('GET', '/api/croquis', (req, res) => responder(res, 200, { croquis }));
ruta('PUT', '/api/croquis', async (req, res) => {
  ({ croquis } = await leerCuerpo(req));
  cambio();
  responder(res, 200, { ok: true });
});

ruta('POST', '/api/tareas', async (req, res) => {
  const t = await leerCuerpo(req);
  if (!estado.espacios.some((e) => e.id === t.espacioId)) return fallo(res, 400, 'Ese espacio no existe');
  const ya = estado.tareas.find((x) => x.id === t.id);
  if (ya) return responder(res, 200, ya); // la misma orden dos veces no crea dos tareas
  const operario = t.operarioId === 'auto' || !t.operarioId
    ? operarioMasLibre(estado.operarios, estado.tareas)
    : estado.operarios.find((o) => o.id === t.operarioId);
  if (!operario) return fallo(res, 400, estado.operarios.length ? 'Ese operario no existe' : 'Primero agrega operarios en Máquina y operarios');
  const tarea = {
    id: t.id || `t-${Date.now().toString(36)}`, espacioId: t.espacioId, operarioId: operario.id,
    nota: String(t.nota ?? '').slice(0, 140), fecha: new Date().toISOString(), estado: 'pendiente',
  };
  estado.tareas.push(tarea);
  if (estado.tareas.length > 300) estado.tareas.splice(0, estado.tareas.length - 300);
  cambio();
  responder(res, 200, tarea);
});

ruta('PATCH', '/api/tareas/:id', async (req, res, { p }) => {
  const t = estado.tareas.find((x) => x.id === p.id);
  if (!t) return fallo(res, 404, 'Esa tarea no existe');
  const { estado: nuevo } = await leerCuerpo(req);
  if (!['pendiente', 'hecha'].includes(nuevo)) return fallo(res, 400, 'Estado inválido');
  t.estado = nuevo;
  t.hechaEn = nuevo === 'hecha' ? new Date().toISOString() : undefined;
  cambio();
  responder(res, 200, t);
});

ruta('POST', '/api/dosis', async (req, res) => {
  const b = await leerCuerpo(req);
  if (!b.id) return fallo(res, 400, 'Falta id');
  const ya = buscarDosis(b.id);
  if (ya) return responder(res, 200, { ...ya, repetida: true }); // idempotente

  const n = Number(b.compartimento);
  if (!(n >= 1 && n <= N_COMPARTIMENTOS)) return fallo(res, 400, 'Compartimento inválido');
  if (!maquinaEnLinea()) return fallo(res, 503, 'desconectada');
  if (estado.maquina.dosis) {
    const d = estado.maquina.dosis;
    const resta = d.estado === 'dosificando' ? Math.max(0, d.inicio + d.segundos * 1000 - Date.now()) : d.segundos * 1000;
    return fallo(res, 409, 'ocupado', { resta_ms: resta });
  }
  const c = estado.compartimentos[n - 1];
  if (!b.prueba && !c.producto) return fallo(res, 409, 'sin producto');
  if (!b.prueba && c.nivel_ml <= 0) return fallo(res, 409, 'vacio');

  const recipiente = RECIPIENTES[b.recipiente] ? b.recipiente : 'spray';
  const pedido = Number(b.ml_producto);
  const ml = b.prueba ? 0 : Math.min(c.nivel_ml, Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 2000) : mlProducto(c.producto, recipiente));
  const segundos = b.prueba ? Math.min(120, Math.max(1, Number(b.segundos) || 3)) : segundosPara(ml);
  estado.maquina.dosis = {
    id: String(b.id).slice(0, 40), compartimento: n, segundos, prueba: !!b.prueba,
    operarioId: b.operarioId ?? null, espacioId: b.espacioId ?? null, productoId: c.producto, recipiente,
    ml_producto: ml, tipoLimpieza: b.tipoLimpieza ?? null,
    estado: 'pendiente', creada: Date.now(),
  };
  cambio();
  responder(res, 200, estado.maquina.dosis);
});

ruta('GET', '/api/dosis/:id', (req, res, { p }) => {
  const d = buscarDosis(p.id);
  if (!d) return fallo(res, 404, 'Esa dosis no existe');
  const resta_ms = d.estado === 'dosificando' ? Math.max(0, d.inicio + d.segundos * 1000 - Date.now()) : d.estado === 'hecha' ? 0 : d.segundos * 1000;
  responder(res, 200, { id: d.id, estado: d.estado, segundos: d.segundos, resta_ms });
});

ruta('POST', '/api/operarios', async (req, res) => {
  const { nombre } = await leerCuerpo(req);
  const limpio = String(nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!limpio) return fallo(res, 400, 'Escribe el nombre del operario');
  if (estado.operarios.some((o) => o.nombre.toLowerCase() === limpio.toLowerCase())) return fallo(res, 409, 'Ya existe un operario con ese nombre');
  const o = { id: `op-${Date.now().toString(36)}`, nombre: limpio };
  estado.operarios.push(o);
  cambio();
  responder(res, 200, o);
});

ruta('DELETE', '/api/operarios/:id', (req, res, { p }) => {
  estado.operarios = estado.operarios.filter((o) => o.id !== p.id);
  // Sus tareas pendientes pasan al operario más libre, para que nada quede sin hacer.
  for (const t of estado.tareas) {
    if (t.operarioId === p.id && t.estado === 'pendiente') t.operarioId = operarioMasLibre(estado.operarios, estado.tareas)?.id ?? null;
  }
  cambio();
  responder(res, 200, { ok: true });
});

// ESP32
const esMaquina = (req) => req.headers['x-token'] === TOKEN;

ruta('GET', '/api/esp32/orden', async (req, res, { url }) => {
  if (!esMaquina(req)) return fallo(res, 401, 'token');
  estado.maquina.visto = Date.now();
  const hayOrden = () => estado.maquina.dosis?.estado === 'pendiente';
  const espera = Math.min(25, Number(url.searchParams.get('espera') ?? 20)) * 1000;
  await esperar(espera, hayOrden);
  estado.maquina.visto = Date.now();
  if (!hayOrden()) return responder(res, 204);
  const d = estado.maquina.dosis;
  d.estado = 'enviada';
  cambio();
  responder(res, 200, { id: d.id, compartimento: d.compartimento, segundos: d.segundos });
});

ruta('POST', '/api/esp32/estado', async (req, res) => {
  if (!esMaquina(req)) return fallo(res, 401, 'token');
  estado.maquina.visto = Date.now();
  const { id, estado: e } = await leerCuerpo(req);
  const d = estado.maquina.dosis;
  if (!d || d.id !== id) return responder(res, 200, { ok: true, ignorada: true });
  if (e === 'dosificando') { d.estado = 'dosificando'; d.inicio = Date.now(); cambio(); }
  else if (e === 'hecha' || e === 'error') terminarDosis(d, e);
  responder(res, 200, { ok: true });
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Token',
    });
    return res.end();
  }
  if (!url.pathname.startsWith('/api/')) return servirApp(req, res);
  for (const r of rutas) {
    const m = r.metodo === req.method && url.pathname.match(r.patron);
    if (!m) continue;
    try {
      return await r.fn(req, res, { url, p: m.groups ?? {} });
    } catch (err) {
      return fallo(res, 400, err.message);
    }
  }
  fallo(res, 404, 'No existe');
}).listen(PORT, () => console.log(`CleanDose en http://0.0.0.0:${PORT}`));
