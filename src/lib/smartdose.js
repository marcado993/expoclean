// Cliente del dispensador SmartDose (ESP32, ver firmware/smartdose/smartdose.ino).
//
// Contrato HTTP:
//   POST /dispensar  { agua_ml, quimico_ml }  → 200 { ok: true }
//   POST /detener                             → apaga las bombas
//   GET  /estado                              → { estado: 'libre'|'dispensando'|'error', progreso: 0..1, agua_ml, quimico_ml }
//   GET  /ecoloop                             → { litros: number }   (sensor de flujo del EcoLoop)
//   POST /servo      { angulo }               → mueve el servo SG90 (0–180°)
//   POST /rele       { segundos, id }         → prende el relé y se apaga solo (0 = apagar)
//                                               409 { error: 'ocupado', rele_ms } si ya hay otro llenado
//                                               mismo id otra vez → 200 { repetido: true } sin volver a llenar
//   GET  /ping                                → { ok, version, uptime_s, clientes, memoria_libre, rele, rele_pin, estado }
//
// Con `simular: true` no hace falta hardware: útil para la demo y para el pitch.

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export class Detenido extends Error {}
/** La máquina ya está llenando otro recipiente. `restaMs` = cuánto le falta. */
export class Ocupado extends Error {
  constructor(restaMs = 0) {
    super('ocupado');
    this.restaMs = restaMs;
  }
}

/** Botón Llenar: cuánto tiempo queda prendido el relé (bomba). */
export const LLENAR_SEG = 30;

// Id corto para que el ESP32 reconozca una orden repetida (crypto.randomUUID no existe fuera de https).
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

async function postRele(ip, cuerpo) {
  const r = await fetch(`http://${ip}/rele`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(3000),
  });
  if (r.status === 409) throw new Ocupado((await r.json().catch(() => ({}))).rele_ms);
  if (!r.ok) throw new Error(`El dispensador respondió ${r.status}`);
  return r.json().catch(() => ({}));
}

/**
 * Llena con el relé: lo prende `segundos` y espera a que el ESP32 lo apague.
 * Si se pierde la señal al mandar la orden, la reintenta con el MISMO id: el ESP32 no llena dos veces.
 */
export async function llenar({ ip, simular }, segundos = LLENAR_SEG, onProgreso = () => {}, detenido = () => false) {
  const totalMs = segundos * 1000;
  if (simular) {
    const inicio = Date.now();
    while (Date.now() - inicio < totalMs) {
      if (detenido()) throw new Detenido();
      onProgreso((Date.now() - inicio) / totalMs);
      await espera(100);
    }
    onProgreso(1);
    return;
  }

  const id = nuevoId();
  for (let intento = 0; ; intento++) {
    try {
      await postRele(ip, { segundos, id });
      break;
    } catch (e) {
      if (e instanceof Ocupado || intento >= 2) throw e;
      await espera(500);
    }
  }

  const limite = Date.now() + totalMs + 15000;
  while (Date.now() < limite) {
    await espera(500);
    if (detenido()) {
      await postRele(ip, { segundos: 0 }).catch(() => {});
      throw new Detenido();
    }
    try {
      const e = await (await fetch(`http://${ip}/estado`, { signal: AbortSignal.timeout(2000), cache: 'no-store' })).json();
      if (e.trabajo_id && e.trabajo_id !== id) throw new Error('El dispensador atendió otra orden');
      onProgreso(1 - (e.rele_ms ?? 0) / totalMs);
      if (!e.rele_ms) return onProgreso(1);
    } catch (err) {
      if (err.message === 'El dispensador atendió otra orden') throw err;
      // Un sondeo perdido no importa: el ESP32 apaga el relé solo.
    }
  }
  throw new Error('El dispensador no terminó a tiempo');
}

/** `detenido()` se consulta durante el llenado: si devuelve true, se apagan las bombas. */
export async function dispensar({ agua_ml, quimico_ml }, { ip, simular }, onProgreso = () => {}, detenido = () => false) {
  if (simular) {
    // Duración proporcional al volumen, acotada para que la demo no aburra.
    const duracion = Math.min(8000, 1500 + agua_ml * 0.6);
    const inicio = Date.now();
    while (Date.now() - inicio < duracion) {
      if (detenido()) throw new Detenido();
      onProgreso((Date.now() - inicio) / duracion);
      await espera(100);
    }
    onProgreso(1);
    return;
  }

  const base = `http://${ip}`;
  const r = await fetch(`${base}/dispensar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agua_ml, quimico_ml }),
  });
  if (!r.ok) throw new Error(`El dispensador respondió ${r.status}`);

  const limite = Date.now() + 10 * 60 * 1000;
  while (Date.now() < limite) {
    await espera(400);
    if (detenido()) {
      await fetch(`${base}/detener`, { method: 'POST' }).catch(() => {});
      throw new Detenido();
    }
    const e = await (await fetch(`${base}/estado`)).json();
    onProgreso(e.progreso ?? 0);
    if (e.estado === 'libre') return;
    if (e.estado === 'error') throw new Error('El dispensador reportó un error');
  }
  throw new Error('El dispensador no terminó a tiempo');
}

/** Mueve el servo a `angulo` y lo regresa a 0°: sirve para comprobar el cableado desde Ajustes. */
export async function probarMotor({ ip, simular }, angulo = 90) {
  if (simular) return;
  const mover = async (a) => {
    const r = await fetch(`http://${ip}/servo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ angulo: a }),
    });
    if (!r.ok) throw new Error(`El dispensador respondió ${r.status}`);
  };
  await mover(angulo);
  await espera(1000);
  await mover(0);
}

/** Prende el relé `segundos` (el ESP32 lo apaga solo); 0 lo apaga de inmediato. */
export async function activarRele({ ip, simular }, segundos = 3) {
  if (simular) return;
  await postRele(ip, { segundos, id: nuevoId() });
}

/** Prueba de conexión del módulo Admin: devuelve los datos del ESP32 y cuánto tardó en responder. */
export async function ping({ ip }, limiteMs = 2500) {
  const inicio = performance.now();
  const r = await fetch(`http://${ip}/ping`, { signal: AbortSignal.timeout(limiteMs), cache: 'no-store' });
  if (!r.ok) throw new Error(`El ESP32 respondió ${r.status}`);
  const datos = await r.json();
  return { ...datos, ms: Math.round(performance.now() - inicio) };
}

export async function leerEcoloop({ ip, simular }) {
  if (simular) return null;
  const r = await fetch(`http://${ip}/ecoloop`);
  return (await r.json()).litros;
}
