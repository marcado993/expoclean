<script>
  import Icono from '../components/Icono.svelte';
  // Evidencia para el Reto 4: cuánta agua y producto se ahorra frente a llenar "a ojo". Sin scroll.
  import { db, reiniciar } from '../lib/store.svelte.js';
  import { leerEcoloop } from '../lib/smartdose.js';
  import Ficha from '../components/Ficha.svelte';
  import Recipiente from '../components/Recipiente.svelte';

  const suma = (k) => db.historial.reduce((t, h) => t + h[k], 0);
  const agua = $derived(suma('agua_ml') / 1000);
  const aguaBase = $derived(suma('base_agua_ml') / 1000);
  const quimico = $derived(suma('quimico_ml'));
  const quimicoBase = $derived(suma('base_quimico_ml'));
  const pct = (u, b) => (b > 0 ? Math.max(0, Math.round((1 - u / b) * 100)) : 0);

  let ajustes = $state(false);
  let errorEco = $state('');
  async function actualizarEcoloop() {
    errorEco = '';
    try {
      const l = await leerEcoloop(db.dispositivo);
      if (l != null) db.ecoloop_litros = l;
    } catch {
      errorEco = `No hay respuesta del ESP32 en ${db.dispositivo.ip}. Revisa que esté encendido y en la misma red.`;
    }
  }
</script>

<div class="impacto">
  <div class="etiqueta">
    <Ficha
      titulo="Datos de impacto"
      subtitulo="{db.historial.length} recargas dispensadas"
      filas={[
        { k: 'Agua de lavado', v: `${agua.toFixed(1)} L`, fuerte: true },
        { k: 'A ojo hubiera sido', v: `${aguaBase.toFixed(1)} L`, sangria: true },
        { k: 'Ahorro de agua', v: `${pct(agua, aguaBase)} %`, sangria: true },
        { k: 'Producto químico', v: `${quimico.toFixed(0)} mL`, fuerte: true, regla: 'media' },
        { k: 'A ojo hubiera sido', v: `${quimicoBase.toFixed(0)} mL`, sangria: true },
        { k: 'Ahorro de producto', v: `${pct(quimico, quimicoBase)} %`, sangria: true },
        { k: 'Agua recuperada EcoLoop', v: `${db.ecoloop_litros.toFixed(1)} L`, fuerte: true, regla: 'gruesa' },
      ]}
      pie="Línea base “a ojo”: medir en el sitio antes del piloto."
    />
  </div>

  <div class="eco tarjeta franja" style="--banda:var(--agua)">
    <div class="tanque"><Recipiente tipo="balde" nivel={Math.min(1, db.ecoloop_litros / 40)} liquido="#bfe0ea" marcas={false} /></div>
    <div class="eco-dato">
      <span class="eco-titulo">Agua recuperada por EcoLoop</span>
      <span class="eco-valor">{db.ecoloop_litros.toFixed(1)} L</span>
      {#if db.dispositivo.simular}
        <label class="campo-linea">Litros medidos
          <input type="number" min="0" step="0.1" inputmode="decimal" bind:value={db.ecoloop_litros} />
        </label>
      {:else}
        <button class="boton chico" style="--c:var(--agua)" onclick={actualizarEcoloop}>Leer sensor</button>
      {/if}
    </div>
  </div>
  {#if errorEco}<p class="error">{errorEco}</p>{/if}

  <button class="boton secundario ajustes-btn" onclick={() => (ajustes = true)}>
    <Icono nombre="ajustes" size={20} />
    Ajustes del dispensador
  </button>

  {#if ajustes}
    <div class="hoja">
      <div class="hoja-cabeza">
        <h2>Ajustes del dispensador</h2>
        <button class="cerrar" onclick={() => (ajustes = false)} aria-label="Cerrar">
          <Icono nombre="cerrar" size={22} />
        </button>
      </div>
      <label class="interruptor">
        <input type="checkbox" bind:checked={db.dispositivo.simular} />
        <span class="riel"></span>
        <span><strong>Modo demostración</strong><small>Simula la máquina, sin ESP32 conectado</small></span>
      </label>
      <label class="campo">Dirección IP del ESP32
        <input bind:value={db.dispositivo.ip} disabled={db.dispositivo.simular} />
      </label>
      <label class="interruptor">
        <input type="checkbox" bind:checked={db.voz} />
        <span class="riel"></span>
        <span><strong>Instrucciones por voz</strong><small>La máquina dice en voz alta qué hacer</small></span>
      </label>
      <button class="boton secundario reiniciar"
        onclick={() => confirm('¿Borrar lugares, croquis e historial y volver a los datos de ejemplo?') && (reiniciar(), (ajustes = false))}>
        Volver a los datos de ejemplo
      </button>
    </div>
  {/if}
</div>

<style>
  .impacto { position: relative; height: 100%; display: flex; flex-direction: column; gap: 12px; }
  .etiqueta { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .etiqueta :global(.ficha) { width: min(100%, 360px); font-size: 0.9rem; }
  .etiqueta :global(.ficha h3) { font-size: 1.95rem; }

  .eco { flex: none; display: grid; grid-template-columns: 74px 1fr; gap: 12px; align-items: center; padding: 14px 14px 12px; }
  .tanque { width: 74px; }
  .eco-dato { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .eco-titulo { font-size: 0.85rem; font-weight: 600; color: var(--tinta-suave); }
  .eco-valor { font-size: 1.9rem; font-weight: 700; color: var(--agua); line-height: 1.1; letter-spacing: -0.01em; }
  .campo-linea { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 600; color: var(--tinta-suave); }
  .campo-linea input { width: 90px; height: 36px; padding: 0 10px; border-radius: 8px; border: 1.5px solid var(--linea); font-weight: 600; }
  .chico { height: 38px; padding: 0 14px; font-size: 0.9rem; align-self: flex-start; }
  .error { flex: none; margin: 0; color: var(--alerta); font-size: 0.85rem; font-weight: 600; }

  .ajustes-btn { flex: none; height: 50px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.98rem; }

  .hoja {
    position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; gap: 14px; padding: 16px;
    background: #fff; border-radius: 18px; border: 1px solid var(--linea); box-shadow: 0 20px 40px rgb(10 59 42 / 0.2);
  }
  .hoja-cabeza { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 1.2rem; font-weight: 700; color: var(--verde-900); }
  .cerrar { width: 40px; height: 40px; border: 0; border-radius: 10px; background: var(--verde-50); display: grid; place-items: center; cursor: pointer; }
  .campo { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 0.82rem; color: var(--tinta-suave); }
  .campo input { height: 44px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--linea); font-size: 1rem; color: var(--tinta); }
  .campo input:disabled { background: var(--fondo); color: var(--tinta-suave); }
  .reiniciar { margin-top: auto; height: 48px; color: var(--alerta); }

  .interruptor { display: flex; align-items: center; gap: 12px; cursor: pointer; }
  .interruptor input { position: absolute; opacity: 0; }
  .interruptor > span:last-child { display: flex; flex-direction: column; }
  .interruptor strong { font-weight: 700; }
  .interruptor small { color: var(--tinta-suave); font-size: 0.8rem; }
  .riel { flex: none; position: relative; width: 48px; height: 28px; border-radius: 999px; background: #cfd8d3; }
  .riel::after {
    content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
  }
  .interruptor input:checked + .riel { background: var(--verde-600); }
  .interruptor input:checked + .riel::after { transform: translateX(20px); }
  .interruptor input:focus-visible + .riel { outline: 3px solid var(--agua); outline-offset: 2px; }
</style>
