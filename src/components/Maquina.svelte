<script>
  // Estado de la máquina siempre a la vista: gris y palpitando = tocar para conectar; verde = lista.
  import Icono from './Icono.svelte';
  import { maquina, conectarMaquina } from '../lib/ble.svelte.js';
  import { tic } from '../lib/movimiento.js';

  let { grande = false, fila = false } = $props();
</script>

{#if fila}
  <button class="fila" class:lista={maquina.conectada} onclick={() => { tic(); conectarMaquina(); }} disabled={maquina.conectando || maquina.conectada}>
    <span class="f-icono"><span class="onda chica" aria-hidden="true"></span><Icono nombre={maquina.conectando ? 'cargando' : 'bluetooth'} size={26} trazo={2.2} /></span>
    <strong>{maquina.conectando ? 'Buscando…' : 'Conectar máquina'}</strong>
    {#if maquina.error}<small>{maquina.error}</small>{/if}
  </button>
{:else if grande}
  <button class="grande" class:lista={maquina.conectada} onclick={() => { tic(); conectarMaquina(); }} disabled={maquina.conectando || maquina.conectada}>
    <span class="onda" aria-hidden="true"></span>
    <span class="icono"><Icono nombre={maquina.conectada ? 'bt-conectado' : 'bluetooth'} size={44} trazo={2} /></span>
    <strong>{maquina.conectada ? 'Máquina lista' : maquina.conectando ? 'Buscando…' : 'Conectar máquina'}</strong>
    {#if maquina.error}<small>{maquina.error}</small>{/if}
  </button>
{:else}
  <button class="chip" class:lista={maquina.conectada} class:buscando={maquina.conectando}
    onclick={() => { tic(); if (!maquina.conectada) conectarMaquina(); }}
    aria-label={maquina.conectada ? 'Máquina conectada por Bluetooth' : 'Conectar la máquina por Bluetooth'}>
    <Icono nombre={maquina.conectada ? 'bt-conectado' : maquina.conectando ? 'cargando' : 'bluetooth'} size={20} trazo={2.2} />
    <span class="punto"></span>
  </button>
{/if}

<style>
  .chip {
    position: relative; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; cursor: pointer;
    border: 1.5px solid var(--linea); background: var(--superficie-2); color: var(--tinta-tenue);
  }
  .chip.lista { background: var(--t-verde); border-color: #BFE6CD; color: var(--verde-oscuro); }
  .punto { position: absolute; top: 2px; right: 2px; width: 10px; height: 10px; border-radius: 50%; background: var(--alerta); border: 2px solid var(--blanco); }
  .lista .punto { background: var(--verde-marca); }
  .chip:not(.lista) .punto { animation: late 1.4s ease-in-out infinite; }
  .buscando :global(.icono) { animation: gira 1s linear infinite; }

  .grande {
    position: relative; overflow: hidden; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 28px 16px; border: 0; border-radius: var(--radio-tarjeta); cursor: pointer; background: var(--t-azul); color: var(--azul);
  }
  .grande.lista { background: var(--t-verde); color: var(--verde-oscuro); cursor: default; }
  .grande strong { font-size: 1.3rem; font-weight: 700; color: var(--tinta); }
  .grande small { color: var(--alerta); font-weight: 500; text-align: center; }
  .grande .icono { position: relative; z-index: 1; display: grid; place-items: center; width: 84px; height: 84px; border-radius: 50%; background: var(--blanco); }
  .onda { position: absolute; top: 28px; left: 50%; width: 84px; height: 84px; margin-left: -42px; border-radius: 50%; background: currentColor; opacity: 0; }
  .grande:not(.lista) .onda { animation: onda 1.8s ease-out infinite; }

  .fila {
    width: 100%; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border: 0; cursor: pointer;
    border-radius: var(--radio-tarjeta); background: var(--azul); color: #fff; text-align: left;
  }
  .fila strong { font-size: 1.1rem; font-weight: 700; }
  .fila small { width: 100%; font-weight: 500; }
  .f-icono { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: rgb(255 255 255 / 0.18); }
  .onda.chica { top: 0; left: 0; width: 44px; height: 44px; margin: 0; background: #fff; animation: onda 1.8s ease-out infinite; }
  @keyframes late { 50% { transform: scale(1.35); } }
  @keyframes gira { to { transform: rotate(360deg); } }
  @keyframes onda { from { transform: scale(1); opacity: 0.35; } to { transform: scale(2.2); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .punto, .onda, .buscando :global(.icono) { animation: none !important; } }
</style>
