<script>
  import Icono3D from '../../components/Icono3D.svelte';
  // Zonas: los espacios que creó el administrador. Tocar uno = escanear esa área.
  import Icono from '../../components/Icono.svelte';
  import { datos, sesion } from '../../lib/nube.svelte.js';
  import { ZONAS, zonaDe, SUPERFICIE_3D, RECIPIENTE_3D } from '../../lib/ui.js';

  const POR_PAGINA = 7;
  let pagina = $state(0);
  const paginas = $derived(Math.max(1, Math.ceil(datos.espacios.length / POR_PAGINA)));
  const mia = (id) => datos.tareas.some((t) => t.espacioId === id && t.operarioId === sesion.operarioId && t.estado === 'pendiente');
</script>

<div class="zonas">
  <div>
    <h1 class="titulo">Zonas</h1>
    <p class="bajada">Toca una zona para ver su dosificación.</p>
  </div>
  <div class="lista">
    {#each datos.espacios.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA) as e (e.id)}
      {@const z = ZONAS[zonaDe(e)]}
      <a class="fila" href="#op/escanear?e={e.id}">
        <span class="cuadro" style="background:color-mix(in srgb, {z.color} 16%, white)"><Icono3D nombre={SUPERFICIE_3D[e.superficie]} size={30} /></span>
        <span class="f-texto"><strong>{e.nombre}</strong><small>{e.area_m2} m², {z.nombre}</small></span>
        {#if mia(e.id)}<span class="marca">Tarea</span>{/if}
        <Icono nombre="derecha" size={20} trazo={2} />
      </a>
    {:else}
      <p class="vacio">No hay zonas registradas todavía.</p>
    {/each}
  </div>
  {#if paginas > 1}
    <div class="paginador">
      <button class="boton secundario flecha" onclick={() => pagina--} disabled={pagina === 0} aria-label="Anteriores"><Icono nombre="izquierda" size={22} /></button>
      <span>{pagina + 1} de {paginas}</span>
      <button class="boton secundario flecha" onclick={() => pagina++} disabled={pagina === paginas - 1} aria-label="Siguientes"><Icono nombre="derecha" size={22} /></button>
    </div>
  {/if}
</div>

<style>
  .zonas { height: 100%; display: flex; flex-direction: column; gap: 12px; }
  .lista { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; border: 1px solid var(--linea); border-radius: var(--radio-tarjeta); }
  .fila { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--linea); color: var(--tinta); text-decoration: none; }
  .fila:last-child { border-bottom: 0; }
  .cuadro { flex: none; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; }
  .f-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .f-texto strong { font-weight: 700; }
  .f-texto small { font-size: 0.82rem; color: var(--tinta-suave); }
  .marca { padding: 2px 8px; border-radius: 999px; background: var(--t-rojo); color: var(--alerta); font-size: 0.75rem; font-weight: 700; }
  .vacio { margin: 0; padding: 16px; color: var(--tinta-suave); }
  .paginador { flex: none; display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: var(--tinta-suave); }
  .flecha { width: 56px; height: 44px; padding: 0; }
</style>
