// Conexión Bluetooth con la máquina (ESP32, firmware/cleandose/cleandose.ino).
// El celular le manda la orden por Bluetooth y guarda el registro en el servidor con su internet.
// Si no hay internet en ese momento, el registro queda en una cola y se manda después.
import { api } from './api.js';

const SERVICIO = '7f3a0001-5c2e-4b8a-9f1d-3c6e2a1b4d00';
const ORDEN = '7f3a0002-5c2e-4b8a-9f1d-3c6e2a1b4d00';
const ESTADO = '7f3a0003-5c2e-4b8a-9f1d-3c6e2a1b4d00';

export const maquina = $state({
  soportado: typeof navigator !== 'undefined' && !!navigator.bluetooth,
  conectada: false,
  conectando: false,
  error: '',
});

let dispositivo = null;
let chOrden = null;
let oyentes = new Set();      // reciben cada mensaje del ESP32
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const codificar = (s) => new TextEncoder().encode(s);

function alRecibir(e) {
  const texto = new TextDecoder().decode(e.target.value);
  for (const o of oyentes) o(texto);
}

async function enlazar(d) {
  dispositivo = d;
  d.removeEventListener('gattserverdisconnected', alDesconectar);
  d.addEventListener('gattserverdisconnected', alDesconectar);
  const gatt = await d.gatt.connect();
  const servicio = await gatt.getPrimaryService(SERVICIO);
  chOrden = await servicio.getCharacteristic(ORDEN);
  const chEstado = await servicio.getCharacteristic(ESTADO);
  chEstado.removeEventListener('characteristicvaluechanged', alRecibir);
  chEstado.addEventListener('characteristicvaluechanged', alRecibir);
  await chEstado.startNotifications();
  maquina.conectada = true;
  maquina.error = '';
  navigator.vibrate?.(60);
}

function alDesconectar() {
  maquina.conectada = false;
  chOrden = null;
  // Reintenta solo unas veces: si la máquina se reinició o el celular se alejó un momento.
  (async () => {
    for (let i = 0; i < 5 && dispositivo && !maquina.conectada; i++) {
      await espera(1500 * (i + 1));
      try { await enlazar(dispositivo); } catch {}
    }
  })();
}

/** Abre el selector de Bluetooth del navegador. Tiene que llamarse desde un toque del usuario. */
export async function conectarMaquina() {
  if (!maquina.soportado) {
    maquina.error = 'Este navegador no tiene Bluetooth. Usa Chrome en Android.';
    return false;
  }
  maquina.conectando = true;
  maquina.error = '';
  try {
    const d = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICIO] }, { name: 'CleanDose' }], optionalServices: [SERVICIO] });
    await enlazar(d);
    return true;
  } catch (e) {
    if (e?.name !== 'NotFoundError') maquina.error = 'No se pudo conectar. Acerca el celular a la máquina y prueba otra vez.';
    return false;
  } finally {
    maquina.conectando = false;
  }
}

/** Si el navegador recuerda la máquina, se reconecta sin preguntar (Chrome lo permite en algunos equipos). */
export async function reconectarSola() {
  try {
    const conocidos = (await navigator.bluetooth?.getDevices?.()) ?? [];
    const d = conocidos.find((x) => x.name === 'CleanDose');
    if (d) await enlazar(d);
  } catch {}
}

export class NoSePudo extends Error {
  constructor(motivo, restaMs = 0) {
    super(motivo);
    this.motivo = motivo; // 'desconectada' | 'ocupado' | 'error'
    this.restaMs = restaMs;
  }
}

// Id de 8 caracteres: los mensajes Bluetooth tienen que caber en 20 bytes.
const idCorto = () => (Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5));

let actual = null; // { id } de la dosis en curso, para poder detenerla

/**
 * Manda la dosis por Bluetooth y espera a que termine.
 * onAvance({ progreso 0..1, restaMs }). Devuelve { id, parada: boolean }.
 */
export async function dosificarBLE({ compartimento, segundos }, onAvance = () => {}) {
  if (!maquina.conectada || !chOrden) throw new NoSePudo('desconectada');
  const id = idCorto();
  const totalMs = segundos * 1000;
  actual = { id };
  return new Promise((resolve, reject) => {
    let terminado = false;
    let ultimo = Date.now();
    const fin = (fn, v) => {
      if (terminado) return;
      terminado = true;
      oyentes.delete(oyente);
      clearInterval(vigia);
      actual = null;
      fn(v);
    };
    const oyente = (m) => {
      const [t, a, b] = m.split(';');
      ultimo = Date.now();
      if (t === 'D' && a === id) onAvance({ progreso: 1 - Number(b) / totalMs, restaMs: Number(b) });
      else if (t === 'H' && a === id) { onAvance({ progreso: 1, restaMs: 0 }); fin(resolve, { id, parada: false }); }
      else if (t === 'P' && a === id) fin(resolve, { id, parada: true });
      else if (t === 'O') fin(reject, new NoSePudo('ocupado', Number(a)));
      else if (t === 'E' && a === id) fin(reject, new NoSePudo('error'));
    };
    oyentes.add(oyente);
    // Si no llega nada en un buen rato, se reenvía la MISMA orden (el ESP32 no la repite).
    const vigia = setInterval(async () => {
      if (Date.now() - ultimo > totalMs + 8000) fin(reject, new NoSePudo('error'));
      else if (Date.now() - ultimo > 3000 && maquina.conectada) chOrden?.writeValue(codificar(`G;${id};${compartimento};${segundos}`)).catch(() => {});
    }, 1500);
    chOrden.writeValue(codificar(`G;${id};${compartimento};${segundos}`)).catch(() => fin(reject, new NoSePudo('desconectada')));
  });
}

/** Detiene la dosis en curso (el ESP32 apaga la bomba de inmediato). */
export async function detener() {
  if (!actual || !chOrden) return;
  await chOrden.writeValue(codificar(`S;${actual.id}`)).catch(() => {});
}

// ── Registros: al servidor; si no hay internet, a una cola en el celular.
const COLA = 'cleandose:cola';
const leerCola = () => { try { return JSON.parse(localStorage.getItem(COLA)) ?? []; } catch { return []; } };
const guardarCola = (c) => { try { localStorage.setItem(COLA, JSON.stringify(c)); } catch {} };
export const cola = $state({ pendientes: leerCola().length });

export async function registrar(registro) {
  const c = leerCola();
  c.push(registro);
  guardarCola(c);
  cola.pendientes = c.length;
  await vaciarCola();
}

let vaciando = false;
export async function vaciarCola() {
  if (vaciando) return;
  vaciando = true;
  try {
    let c = leerCola();
    while (c.length) {
      await api.registrar(c[0]); // si falla, sale y se reintenta luego
      c = leerCola().slice(1);
      guardarCola(c);
      cola.pendientes = c.length;
    }
  } catch {
  } finally {
    vaciando = false;
  }
}
if (typeof window !== 'undefined') {
  setInterval(vaciarCola, 15000);
  window.addEventListener('online', vaciarCola);
}
