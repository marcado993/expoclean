<script>
  // Menú del operario: lo que más se usa (Dosificar) es lo más grande. Íconos y una palabra.
  import { fly } from 'svelte/transition';
  import Icono from '../../components/Icono.svelte';
  import { datos, sesion, operarioActual, espacioPorId } from '../../lib/nube.svelte.js';
  import { maquina } from '../../lib/ble.svelte.js';
  import { dur, tic } from '../../lib/movimiento.js';

  const yo = $derived(operarioActual());
  const tarea = $derived(datos.tareas.findLast((t) => t.operarioId === sesion.operarioId && t.estado === 'pendiente'));

  const OTRAS = [
    { ruta: 'op/escanear', titulo: 'Escanear', icono: 'escanear', tinte: 'verde' },
    { ruta: 'op/config', titulo: 'Configurar', icono: 'ajustes', tinte: 'azul' },
    { ruta: 'op/historial', titulo: 'Historial', icono: 'historial', tinte: 'morado' },
  ];
</script>

<div class="menu">
  <h1 class="titulo saludo" in:fly={{ y: -8, duration: dur(250) }}>Hola, {yo?.nombre.split(' ')[0] ?? ''}</h1>

  {#if tarea}
    <a class="tarea" href="#op/escanear?e={tarea.espacioId}&t={tarea.id}" onclick={() => tic()} in:fly={{ y: 10, duration: dur(260) }}>
      <span class="campana"><Icono nombre="campana" size={22} trazo={2.2} /></span>
      <strong>{espacioPorId(tarea.espacioId)?.nombre ?? 'Tarea'}</strong>
      <Icono nombre="derecha" size={22} trazo={2.4} />
    </a>
  {/if}

  <a class="principal" href="#op/dosificar" onclick={() => tic()} in:fly={{ y: 16, delay: dur(60), duration: dur(300) }}>
    <span class="burbujas" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="gota"><Icono nombre="gota" size={54} trazo={1.9} /></span>
    <strong>Dosificar</strong>
    <span class="estado-maq" class:lista={maquina.conectada}>
      <Icono nombre={maquina.conectada ? 'bt-conectado' : 'bluetooth'} size={16} trazo={2.2} />
      {maquina.conectada ? 'Máquina lista' : 'Sin conectar'}
    </span>
  </a>

  <nav class="otras">
    {#each OTRAS as o, i}
      <a class="otra" href="#{o.ruta}" onclick={() => tic()} style="--t:var(--t-{o.tinte}); --i:var(--i-{o.tinte})"
        in:fly={{ y: 16, delay: dur(120 + i * 60), duration: dur(300) }}>
        <span class="icono"><Icono nombre={o.icono} size={32} trazo={1.9} /></span>
        <strong>{o.titulo}</strong>
      </a>
    {/each}
  </nav>
</div>

<style>
  .menu { height: 100%; display: flex; flex-direction: column; gap: 14px; }
  .saludo { font-size: 2rem; }
  .tarea {
    flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--radio-tarjeta);
    background: var(--t-rojo); color: #8A1F1F; text-decoration: none;
  }
  .tarea strong { flex: 1; font-weight: 800; color: var(--tinta); }
  .campana { display: grid; animation: timbre 1.6s ease-in-out infinite; transform-origin: top center; }

  .principal {
    position: relative; overflow: hidden; flex: 1; min-height: 0; max-height: 340px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    border-radius: 24px; text-decoration: none; color: var(--tinta); background: linear-gradient(160deg, #FDECF1, #FAD6E2);
    transition: transform 0.12s ease;
  }
  .principal:active { transform: scale(0.98); }
  .gota { position: relative; z-index: 1; display: grid; place-items: center; width: 108px; height: 108px; border-radius: 50%; background: var(--blanco); color: var(--i-rosa); box-shadow: 0 10px 30px rgb(236 77 130 / 0.25); }
  .principal strong { position: relative; z-index: 1; font-size: 1.9rem; font-weight: 800; letter-spacing: -0.02em; }
  .estado-maq { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: rgb(255 255 255 / 0.75); font-size: 0.85rem; font-weight: 700; color: var(--tinta-suave); }
  .estado-maq.lista { color: var(--verde-oscuro); }
  .burbujas i { position: absolute; bottom: -30px; width: 22px; height: 22px; border-radius: 50%; background: rgb(255 255 255 / 0.55); animation: subir 6s linear infinite; }
  .burbujas i:nth-child(1) { left: 14%; animation-delay: 0s; }
  .burbujas i:nth-child(2) { left: 72%; width: 14px; height: 14px; animation-delay: 2s; }
  .burbujas i:nth-child(3) { left: 44%; width: 10px; height: 10px; animation-delay: 4s; }

  .otras { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .otra {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; height: 118px;
    border-radius: var(--radio-tarjeta); background: var(--t); color: var(--tinta); text-decoration: none; transition: transform 0.12s ease;
  }
  .otra:active { transform: scale(0.95); }
  .icono { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 16px; background: color-mix(in srgb, var(--i) 18%, white); color: var(--i); }
  .otra strong { font-size: 0.98rem; font-weight: 800; }

  @keyframes subir { from { transform: translateY(0); opacity: 0; } 15% { opacity: 1; } to { transform: translateY(-380px); opacity: 0; } }
  @keyframes timbre { 0%, 70%, 100% { transform: rotate(0); } 75% { transform: rotate(14deg); } 85% { transform: rotate(-12deg); } 92% { transform: rotate(6deg); } }
  @media (prefers-reduced-motion: reduce) { .burbujas i, .campana { animation: none; } .principal, .otra { transition: none; } }
</style>
