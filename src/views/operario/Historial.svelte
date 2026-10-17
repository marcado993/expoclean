<script>
  // Historial personal: mis dosis registradas en el servidor.
  import Icono from '../../components/Icono.svelte';
  import { datos, sesion, espacioPorId } from '../../lib/nube.svelte.js';
  import { PRODUCTOS, COLOR_COMPARTIMENTO } from '../../lib/catalogo.js';

  const mias = $derived(datos.registros.filter((r) => r.operarioId === sesion.operarioId).reverse());
  const hoy = $derived(mias.filter((r) => new Date(r.fecha).toDateString() === new Date().toDateString()));
  const semana = $derived(mias.filter((r) => Date.now() - new Date(r.fecha).getTime() < 7 * 86400000));
  const POR_PAGINA = 7;
  let pagina = $state(0);
  const paginas = $derived(Math.max(1, Math.ceil(mias.length / POR_PAGINA)));

  const fecha = (iso) => new Date(iso).toLocaleString('es-EC', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const ml = (x) => (x >= 1000 ? `${(x / 1000).toFixed(1)} L` : `${Math.round(x)} ml`);
</script>

<div class="historial">
  <div>
    <h1 class="titulo">Historial personal</h1>
    <p class="bajada">Tus limpiezas realizadas.</p>
  </div>

  <div class="kpis">
    <div class="kpi verde"><small>Hoy</small><strong>{hoy.length}</strong><span>dosis</span></div>
    <div class="kpi morado"><small>Esta semana</small><strong>{ml(semana.reduce((t, r) => t + r.ml_producto, 0))}</strong><span>de producto</span></div>
  </div>

  <div class="lista">
    {#each mias.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA) as r (r.id)}
      <div class="fila">
        <span class="punto" style="background:{COLOR_COMPARTIMENTO[(r.compartimento ?? 1) - 1]}"></span>
        <span class="f-texto"><strong>{espacioPorId(r.espacioId)?.nombre ?? 'Espacio borrado'}</strong><small>{PRODUCTOS[r.productoId]?.nombre ?? r.productoId}, {fecha(r.fecha)}</small></span>
        <span class="f-ml">{ml(r.ml_producto)}</span>
      </div>
    {:else}
      <p class="vacio">Todavía no tienes dosis registradas. Empieza en Escanear área.</p>
    {/each}
  </div>
  {#if paginas > 1}
    <div class="paginador">
      <button class="boton secundario flecha" onclick={() => pagina--} disabled={pagina === 0} aria-label="Más recientes"><Icono nombre="izquierda" size={22} /></button>
      <span>{pagina + 1} de {paginas}</span>
      <button class="boton secundario flecha" onclick={() => pagina++} disabled={pagina === paginas - 1} aria-label="Más antiguas"><Icono nombre="derecha" size={22} /></button>
    </div>
  {/if}
</div>

<style>
  .historial { height: 100%; display: flex; flex-direction: column; gap: 12px; }
  .kpis { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .kpi { display: flex; flex-direction: column; padding: 12px 14px; border-radius: var(--radio-tarjeta); }
  .kpi small { font-size: 0.85rem; color: var(--tinta-suave); }
  .kpi strong { font-size: 1.7rem; font-weight: 700; line-height: 1.15; }
  .kpi span { font-size: 0.85rem; color: var(--tinta-suave); }
  .verde { background: var(--t-verde); } .morado { background: var(--t-morado); }
  .lista { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; border: 1px solid var(--linea); border-radius: var(--radio-tarjeta); }
  .fila { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--linea); }
  .fila:last-child { border-bottom: 0; }
  .punto { flex: none; width: 12px; height: 12px; border-radius: 50%; }
  .f-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .f-texto strong { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .f-texto small { font-size: 0.8rem; color: var(--tinta-suave); }
  .f-ml { font-weight: 700; }
  .vacio { margin: 0; padding: 16px; color: var(--tinta-suave); }
  .paginador { flex: none; display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: var(--tinta-suave); }
  .flecha { width: 56px; height: 44px; padding: 0; }
</style>
