// Estado compartido con el servidor. Todos los celulares ven lo mismo: cuando alguien cambia algo
// (una tarea, un compartimento, una dosis), el servidor avisa y aquí se actualiza solo.
import { api } from './api.js';

export const datos = $state({
  cargado: false,
  conectado: false,
  fallos: 0, // intentos seguidos sin respuesta del servidor
  version: 0,
  operarios: [],
  espacios: [],
  compartimentos: [],
  tareas: [],
  registros: [],
  maquina: { enLinea: false, dosis: null },
});

/** Quién usa este celular. Se recuerda en el dispositivo. */
const CLAVE = 'cleandose:sesion';
function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) ?? { rol: null, operarioId: null };
  } catch {
    return { rol: null, operarioId: null };
  }
}
export const sesion = $state(leerSesion());
$effect.root(() => {
  $effect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(sesion));
    } catch {}
  });
});

/** La máquina está dosificando: la app bloquea todo lo demás hasta que termine. */
export const ui = $state({ ocupado: false });

function aplicar(e) {
  for (const k of ['version', 'operarios', 'espacios', 'compartimentos', 'tareas', 'registros', 'maquina']) datos[k] = e[k];
  datos.cargado = true;
  datos.conectado = true;
  datos.fallos = 0;
}

/** Aplica de inmediato lo que respondió el servidor tras un cambio (sin esperar el siguiente aviso). */
export async function refrescar() {
  aplicar(await api.estado());
}

let iniciado = false;
export function conectar() {
  if (iniciado) return;
  iniciado = true;
  (async () => {
    let pausa = 1000;
    for (;;) {
      try {
        aplicar(datos.cargado ? await api.eventos(datos.version) : await api.estado());
        pausa = 1000;
      } catch {
        datos.conectado = false;
        datos.fallos++;
        await new Promise((r) => setTimeout(r, pausa));
        pausa = Math.min(pausa * 2, 10000);
      }
    }
  })();
}

export const operarioActual = () => datos.operarios.find((o) => o.id === sesion.operarioId) ?? null;
export const espacioPorId = (id) => datos.espacios.find((e) => e.id === id) ?? null;
export const operarioPorId = (id) => datos.operarios.find((o) => o.id === id) ?? null;
