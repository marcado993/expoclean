// Cliente del dispensador SmartDose (ESP32, ver firmware/smartdose/smartdose.ino).
//
// Contrato HTTP:
//   POST /dispensar  { agua_ml, quimico_ml }  → 200 { ok: true }
//   POST /detener                             → apaga las bombas
//   GET  /estado                              → { estado: 'libre'|'dispensando'|'error', progreso: 0..1, agua_ml, quimico_ml }
//   GET  /ecoloop                             → { litros: number }   (sensor de flujo del EcoLoop)
//
// Con `simular: true` no hace falta hardware: útil para la demo y para el pitch.

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export class Detenido extends Error {}

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

export async function leerEcoloop({ ip, simular }) {
  if (simular) return null;
  const r = await fetch(`http://${ip}/ecoloop`);
  return (await r.json()).litros;
}
