<script>
  // Asignar operario a una zona: "se regó algo en el Laboratorio 2" → elegir el espacio,
  // tocar Mandar a limpiar, y el operario más libre recibe el aviso en su celular.
  import Icono from '../../components/Icono.svelte';
  import { datos, espacioPorId, operarioPorId } from '../../lib/nube.svelte.js';
  import { api, nuevoId } from '../../lib/api.js';
  import { operarioMasLibre } from '../../lib/traza.js';
  import { ZONAS, zonaDe } from '../../lib/ui.js';

  let { params = {} } = $props();
  let pestaña = $state('nueva');
  let espacioId = $state(params.e ?? null);
  let operarioId = $state('auto');
  let nota = $state('');
  let enviando = $state(false);
  let resultado = $state('');
  let error = $state('');

  const POR_PAGINA = 6;
  let pagina = $state(0);
  const paginas = $derived(Math.max(1, Math.ceil(datos.espacios.length / POR_PAGINA)));
  const visibles = $derived(datos.espacios.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA));

  const libre = $derived(operarioMasLibre(datos.operarios, datos.tareas));
  const pendientesDe = (id) => datos.tareas.filter((t) => t.operarioId === id && t.estado === 'pendiente').length;
  const recientes = $derived([...datos.tareas].reverse().slice(0, 6));

  async function mandar() {
    enviando = true;
    error = '';
    try {
      const t = await api.crearTarea({ id: nuevoId('t-'), espacioId, operarioId, nota: nota.trim() });
      resultado = `Se avisó a ${operarioPorId(t.operarioId)?.nombre ?? 'el operario'}: limpiar ${espacioPorId(espacioId)?.nombre}.`;
      espacioId = null;
      nota = '';
      operarioId = 'auto';
    } catch (e) {
      error = e.message ?? 'No se pudo mandar. Revisa la conexión.';
    } finally {
      enviando = false;
    }
  }

  const hace = (iso) => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return min < 1 ? 'ahora' : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} d`;
  };
</script>

<div class="asignar">
  <div>
    <h1 class="titulo">Asignar operario a zona</h1>
    <p class="bajada">El operario recibe el aviso en su celular al instante.</p>
  </div>
  <div class="pestañas" role="tablist">
    <button role="tab" aria-selected={pestaña === 'nueva'} class:activa={pestaña === 'nueva'} onclick={() => (pestaña = 'nueva')}>Mandar a limpiar</button>
    <button role="tab" aria-selected={pestaña === 'enviadas'} class:activa={pestaña === 'enviadas'} onclick={() => (pestaña = 'enviadas')}>Enviadas</button>
  </div>

  {#if pestaña === 'nueva'}
    {#if resultado}
      <p class="ok"><Icono nombre="check" size={22} trazo={2.6} />{resultado}</p>
    {/if}

    <p class="paso">¿Qué espacio?</p>
    {#if datos.espacios.length === 0}
      <p class="vacio-txt">No hay espacios. <a href="#admin/espacios">Crea uno en Espacios.</a></p>
    {:else}
      <div class="espacios">
        {#each visibles as e (e.id)}
          {@const z = ZONAS[zonaDe(e)]}
          <button class="espacio" class:elegido={espacioId === e.id} aria-pressed={espacioId === e.id} onclick={() => { espacioId = e.id; resultado = ''; }}>
            <span class="cuadro" style="background:{z.color}; color:{z.tinta}"><Icono nombre={e.superficie} size={18} trazo={2} /></span>
            <span class="e-nombre">{e.nombre}</span>
          </button>
        {/each}
      </div>
      {#if paginas > 1}
        <div class="paginador">
          <button class="boton secundario flecha" onclick={() => pagina--} disabled={pagina === 0} aria-label="Anteriores"><Icono nombre="izquierda" size={22} /></button>
          <span>{pagina + 1} de {paginas}</span>
          <button class="boton secundario flecha" onclick={() => pagina++} disabled={pagina === paginas - 1} aria-label="Siguientes"><Icono nombre="derecha" size={22} /></button>
        </div>
      {/if}
    {/if}

    <p class="paso">¿Quién?</p>
    <div class="quien">
      <button class="chip" class:elegido={operarioId === 'auto'} onclick={() => (operarioId = 'auto')}>
        Automático{libre ? ` (${libre.nombre.split(' ')[0]})` : ''}
      </button>
      {#each datos.operarios as o (o.id)}
        <button class="chip" class:elegido={operarioId === o.id} onclick={() => (operarioId = o.id)}>
          {o.nombre.split(' ')[0]}{pendientesDe(o.id) ? ` (${pendientesDe(o.id)})` : ''}
        </button>
      {/each}
    </div>

    <input class="nota" bind:value={nota} maxlength="140" placeholder="Nota opcional: se regó un reactivo en el mesón" />
    {#if error}<p class="error">{error}</p>{/if}
    <button class="boton verde mandar" disabled={!espacioId || enviando || !datos.operarios.length} onclick={mandar}>
      {enviando ? 'Mandando…' : 'Mandar a limpiar'}
    </button>
  {:else}
    <div class="filas">
      {#each recientes as t (t.id)}
        <div class="fila">
          <span class="estado" class:hecha={t.estado === 'hecha'}>{t.estado === 'hecha' ? 'Hecha' : 'Pendiente'}</span>
          <span class="f-texto">
            <strong>{espacioPorId(t.espacioId)?.nombre ?? 'Espacio borrado'}</strong>
            <span>{operarioPorId(t.operarioId)?.nombre ?? 'Sin operario'}, {hace(t.fecha)}{t.nota ? `, ${t.nota}` : ''}</span>
          </span>
        </div>
      {:else}
        <p class="vacio-txt">Todavía no has mandado tareas.</p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .asignar { display: flex; flex-direction: column; gap: 10px; padding-bottom: 8px; }
  .pestañas { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .pestañas button { height: 42px; border: 0; border-radius: 9px; background: none; cursor: pointer; font-weight: 700; color: var(--tinta-suave); }
  .pestañas button.activa { background: var(--azul); color: #fff; font-weight: 700; }
  .ok { flex: none; display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; border-radius: var(--radio); background: var(--t-verde); color: var(--verde-oscuro); font-weight: 700; }
  .paso { flex: none; margin: 4px 0 0; font-size: 1.05rem; font-weight: 700; }
  .espacios { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .espacio {
    display: flex; align-items: center; gap: 8px; height: 54px; padding: 0 10px; cursor: pointer; text-align: left; min-width: 0;
    border: 2px solid var(--linea); border-radius: 12px; background: var(--blanco); color: var(--tinta);
  }
  .espacio.elegido { border-color: var(--azul); background: var(--t-azul); }
  .cuadro { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; }
  .e-nombre { min-width: 0; font-size: 0.95rem; font-weight: 700; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .paginador { flex: none; display: flex; align-items: center; justify-content: space-between; font-weight: 700; color: var(--tinta-suave); }
  .flecha { width: 56px; height: 40px; display: grid; place-items: center; }
  .quien { flex: none; display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { height: 42px; padding: 0 14px; border: 2px solid var(--linea); border-radius: 999px; background: var(--blanco); font-weight: 700; cursor: pointer; color: var(--tinta); }
  .chip.elegido { border-color: var(--azul); background: var(--azul); color: #fff; }
  .nota { flex: none; height: 48px; padding: 0 12px; border: 1.5px solid var(--linea-fuerte); border-radius: var(--radio); background: var(--blanco); font-size: 0.95rem; }
  .nota:focus { outline: none; border-color: var(--tinta); }
  .error { margin: 0; color: var(--alerta); font-weight: 700; }
  .mandar { flex: none; width: 100%; height: 58px; margin-top: 6px; font-size: 1.15rem; }
  .vacio-txt { margin: 0; color: var(--tinta-suave); }
  .filas { display: flex; flex-direction: column; background: var(--blanco); border: 1px solid var(--linea); border-radius: 12px; }
  .fila { display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--linea); }
  .fila:last-child { border-bottom: 0; }
  .estado { flex: none; width: 88px; text-align: center; padding: 4px 0; border-radius: 999px; font-size: 0.8rem; font-weight: 700; background: #FFF4D6; color: #6B4E00; }
  .estado.hecha { background: #E6F4FA; color: var(--agua-oscura); }
  .f-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .f-texto strong { font-weight: 700; }
  .f-texto span { font-size: 0.85rem; color: var(--tinta-suave); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
