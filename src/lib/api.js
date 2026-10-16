// Cliente del servidor CleanDose (server/index.js). La app compilada la sirve el mismo servidor,
// así que por defecto usa el mismo origen. Para desarrollo: VITE_API=http://149.130.170.232:8080
const BASE = (import.meta.env?.VITE_API ?? '').replace(/\/$/, '');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export class ErrorServidor extends Error {
  constructor(codigo, datos) {
    super(datos?.error ?? `El servidor respondió ${codigo}`);
    this.codigo = codigo;
    this.datos = datos ?? {};
  }
}

async function pedir(metodo, ruta, cuerpo, { limiteMs = 10000 } = {}) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(limiteMs),
    cache: 'no-store',
  });
  const datos = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ErrorServidor(r.status, datos);
  return datos;
}

// Id corto para que el servidor reconozca una orden repetida (crypto.randomUUID no existe fuera de https).
export const nuevoId = (prefijo = '') => prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const api = {
  estado: () => pedir('GET', '/api/estado'),
  eventos: (v) => pedir('GET', `/api/eventos?v=${v}`, null, { limiteMs: 35000 }),
  compartimentos: (compartimentos) => pedir('PUT', '/api/compartimentos', { compartimentos }),
  guardarEspacio: (espacio) => pedir('POST', '/api/espacios', { espacio }),
  borrarEspacio: (id) => pedir('DELETE', `/api/espacios/${encodeURIComponent(id)}`),
  croquis: () => pedir('GET', '/api/croquis').then((r) => r.croquis),
  guardarCroquis: (croquis) => pedir('PUT', '/api/croquis', { croquis }, { limiteMs: 30000 }),
  crearTarea: (t) => pedir('POST', '/api/tareas', t),
  cambiarTarea: (id, estado) => pedir('PATCH', `/api/tareas/${encodeURIComponent(id)}`, { estado }),
  agregarOperario: (nombre) => pedir('POST', '/api/operarios', { nombre }),
  quitarOperario: (id) => pedir('DELETE', `/api/operarios/${encodeURIComponent(id)}`),
};

/** Por qué no se pudo dosificar, en palabras para el operario. */
export class NoSePudo extends Error {
  constructor(motivo, restaMs = 0) {
    super(motivo);
    this.motivo = motivo; // 'ocupado' | 'desconectada' | 'vacio' | 'sin producto' | 'error' | 'red'
    this.restaMs = restaMs;
  }
}

/**
 * Pide una dosis al servidor y espera a que el ESP32 termine.
 * onAvance({ fase: 'esperando' | 'dosificando', progreso, restaMs }).
 * Si se pierde la señal al pedirla, reintenta con el MISMO id: el servidor no la duplica.
 */
export async function dosificar(pedido, onAvance = () => {}) {
  const id = nuevoId('d-');
  for (let intento = 0; ; intento++) {
    try {
      await pedir('POST', '/api/dosis', { ...pedido, id }, { limiteMs: 6000 });
      break;
    } catch (e) {
      if (e instanceof ErrorServidor) {
        const motivo = e.codigo === 503 ? 'desconectada' : e.datos.error ?? 'error';
        throw new NoSePudo(motivo, e.datos.resta_ms ?? 0);
      }
      if (intento >= 2) throw new NoSePudo('red');
      await espera(800);
    }
  }

  onAvance({ fase: 'esperando', progreso: 0 });
  const limite = Date.now() + 3 * 60 * 1000;
  while (Date.now() < limite) {
    await espera(400);
    let d;
    try {
      d = await pedir('GET', `/api/dosis/${id}`, null, { limiteMs: 4000 });
    } catch {
      continue; // un sondeo perdido no importa: el ESP32 apaga la bomba solo
    }
    if (d.estado === 'hecha') return onAvance({ fase: 'dosificando', progreso: 1, restaMs: 0 });
    if (d.estado === 'error') throw new NoSePudo('error');
    if (d.estado === 'dosificando') {
      const total = d.segundos * 1000;
      onAvance({ fase: 'dosificando', progreso: 1 - d.resta_ms / total, restaMs: d.resta_ms });
    } else {
      onAvance({ fase: 'esperando', progreso: 0 });
    }
  }
  throw new NoSePudo('error');
}

/** Prueba del relé desde Equipo: 3 s, sin registro ni descuento de producto. */
export const probarBomba = (compartimento, segundos = 3) =>
  dosificar({ compartimento, segundos, prueba: true });
