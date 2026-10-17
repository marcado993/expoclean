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
  registrar: (r) => pedir('POST', '/api/registros', r, { limiteMs: 8000 }),
};
