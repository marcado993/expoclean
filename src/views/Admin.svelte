<script>
  // Admin: prueba de conexión con el ESP32 y prueba del relé (GPIO 22, 3 s).
  // Revisa el ESP32 cada 3 s mientras esta pantalla está abierta.
  import Icono from '../components/Icono.svelte';
  import { db, ui } from '../lib/store.svelte.js';
  import { ping, activarRele, probarMotor, Ocupado } from '../lib/smartdose.js';

  const PULSO_S = 3;
  const CADA_MS = 3000;

  let info = $state(null);       // última respuesta de /ping
  let conectado = $state(null);  // null = sin probar todavía
  let probando = $state(false);
  let registro = $state([]);     // { hora, texto, ok }

  const hora = () => new Date().toLocaleTimeString('es-EC', { hour12: false });
  function anotar(texto, ok) {
    registro = [{ hora: hora(), texto, ok }, ...registro].slice(0, 6);
  }

  async function probar(manual = false) {
    if (probando) return;
    probando = true;
    try {
      info = await ping(db.dispositivo);
      if (manual || conectado !== true) anotar(`Conectado en ${info.ms} ms`, true);
      conectado = true;
    } catch {
      if (manual || conectado !== false) anotar(`Sin respuesta de ${db.dispositivo.ip}`, false);
      conectado = false;
    } finally {
      probando = false;
    }
  }

  $effect(() => {
    db.dispositivo.ip; // volver a probar si cambia la IP
    probar();
    const t = setInterval(probar, CADA_MS);
    return () => clearInterval(t);
  });

  // ── Relé: el ESP32 lo prende y lo apaga solo a los 3 s; aquí solo se muestra la cuenta.
  let releResta = $state(0);
  let reloj;
  async function pulsoRele() {
    try {
      await activarRele({ ...db.dispositivo, simular: false }, PULSO_S);
      anotar(`Relé ON (pin ${info?.rele_pin ?? 22}), se apaga en ${PULSO_S} s`, true);
      clearInterval(reloj);
      releResta = PULSO_S;
      reloj = setInterval(() => {
        if (--releResta <= 0) { clearInterval(reloj); anotar('Relé OFF', true); }
      }, 1000);
    } catch (e) {
      anotar(e instanceof Ocupado ? `Ocupado: está llenando (faltan ${Math.ceil(e.restaMs / 1000)} s)` : 'No se pudo prender el relé', false);
    }
  }
  $effect(() => () => clearInterval(reloj));

  async function moverServo() {
    try {
      await probarMotor({ ...db.dispositivo, simular: false });
      anotar('Servo movido a 90° y de vuelta', true);
    } catch {
      anotar('El servo no respondió (¿firmware de prueba?)', false);
    }
  }

  const tiempo = (s) => (s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
</script>

<div class="admin">
  <section class="estado tarjeta" class:ok={conectado} class:mal={conectado === false}>
    <span class="icono-estado"><Icono nombre={conectado === false ? 'sinwifi' : 'wifi'} size={30} trazo={2} /></span>
    <div class="texto">
      <h2 >{conectado === null ? 'Probando…' : conectado ? 'ESP32 conectado' : 'Sin conexión'}</h2>
      <p>
        {#if conectado && info}
          Responde en {info.ms} ms · firmware {info.version}
        {:else if conectado === false}
          Conéctate a la red Wi-Fi <b>SmartDose</b> y revisa la IP.
        {:else}
          Buscando el ESP32 en {db.dispositivo.ip}
        {/if}
      </p>
    </div>
    <span class="luz" aria-hidden="true"></span>
  </section>

  <div class="fila-ip">
    <label class="campo">IP del ESP32
      <input bind:value={db.dispositivo.ip} inputmode="decimal" spellcheck="false" />
    </label>
    <button class="boton secundario probar" onclick={() => probar(true)} disabled={probando}>
      <Icono nombre="refresh" size={20} /> Probar
    </button>
  </div>

  <dl class="datos">
    <div><dt>Encendido hace</dt><dd>{info && conectado ? tiempo(info.uptime_s) : '—'}</dd></div>
    <div><dt>Equipos en la red</dt><dd>{info && conectado ? info.clientes : '—'}</dd></div>
    <div><dt>Memoria libre</dt><dd>{info && conectado ? `${Math.round(info.memoria_libre / 1024)} KB` : '—'}</dd></div>
    <div><dt>Máquina</dt><dd>{info && conectado ? info.estado : '—'}</dd></div>
  </dl>

  <div class="pruebas">
    <button class="boton rele" style="--c:{releResta ? 'var(--alerta)' : 'var(--acento)'}" onclick={pulsoRele} disabled={!conectado || releResta > 0 || ui.ocupado}>
      <Icono nombre="rayo" size={22} trazo={2} />
      {releResta ? `Relé encendido · ${releResta} s` : `Probar relé (pin ${info?.rele_pin ?? 22}, ${PULSO_S} s)`}
    </button>
    <button class="boton secundario" onclick={moverServo} disabled={!conectado}>Probar servo</button>
  </div>

  <ol class="registro" aria-live="polite">
    {#each registro as r}
      <li class:mal={!r.ok}><time>{r.hora}</time>{r.texto}</li>
    {:else}
      <li class="vacio">Aquí aparece lo que va pasando.</li>
    {/each}
  </ol>
</div>

<style>
  .admin { height: 100%; display: flex; flex-direction: column; gap: 12px; }

  .estado { flex: none; display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-left: 5px solid var(--tinta-tenue); }
  .estado.ok { border-left-color: var(--acento); }
  .estado.mal { border-left-color: var(--alerta); }
  .icono-estado { display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: var(--superficie-2); color: var(--tinta-suave); }
  .ok .icono-estado { color: var(--acento); background: var(--acento-fantasma); }
  .mal .icono-estado { color: var(--alerta); background: #FBEDE6; }
  .texto { flex: 1; min-width: 0; }
  h2 { margin: 0; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.015em; line-height: 1.1; color: var(--tinta); }
  .texto p { margin: 4px 0 0; font-size: 0.92rem; color: var(--tinta-suave); }
  .luz { flex: none; width: 12px; height: 12px; border-radius: 50%; background: var(--tinta-tenue); }
  .ok .luz { background: var(--acento-vivo); }
  .mal .luz { background: var(--alerta); }

  .fila-ip { flex: none; display: flex; align-items: flex-end; gap: 8px; }
  .campo { flex: 1; display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 0.82rem; color: var(--tinta-suave); }
  .campo input { height: 48px; padding: 0 12px; border: 1.5px solid var(--linea-fuerte); border-radius: var(--radio); background: #fff; font-size: 1.05rem; font-weight: 700; color: var(--tinta); }
  .campo input:focus { border-color: var(--acento); outline: none; }
  .probar { height: 48px; display: flex; align-items: center; gap: 6px; padding: 0 16px; }

  .datos { flex: none; margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--linea); border: 1px solid var(--linea); }
  .datos div { padding: 10px 12px; background: #fff; }
  dt { font-size: 0.78rem; font-weight: 700; color: var(--tinta-suave); }
  dd { margin: 2px 0 0; font-size: 1.25rem; font-weight: 800; color: var(--tinta); }

  .pruebas { flex: none; display: grid; grid-template-columns: 1fr; gap: 8px; }
  .pruebas .boton { height: 52px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1rem; }
  .rele { height: 60px !important; font-size: 1.1rem !important; }

  .registro {
    flex: 1; min-height: 0; overflow: hidden; margin: 0; padding: 8px 12px; list-style: none;
    border-radius: var(--radio); background: var(--tinta); color: #D7E3EE; font-size: 0.85rem;
  }
  .registro li { padding: 3px 0; border-bottom: 1px solid rgb(255 255 255 / 0.06); }
  .registro li.mal { color: #FFB59A; }
  .registro time { display: inline-block; width: 74px; color: var(--acento-vivo); font-variant-numeric: tabular-nums; }
  .registro .vacio { color: #8494A8; border: 0; }
</style>
