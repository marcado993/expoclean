<script>
  // Notificaciones: las zonas que el administrador me mandó a limpiar.
  import Icono from '../../components/Icono.svelte';
  import { datos, sesion, espacioPorId } from '../../lib/nube.svelte.js';
  import { api } from '../../lib/api.js';

  const mias = $derived(datos.tareas.filter((t) => t.operarioId === sesion.operarioId).reverse());
  const pendientes = $derived(mias.filter((t) => t.estado === 'pendiente'));
  const hechas = $derived(mias.filter((t) => t.estado === 'hecha').slice(0, 3));

  const hace = (iso) => {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return min < 1 ? 'ahora' : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} d`;
  };

  let marcando = $state(null);
  async function hecha(t) {
    marcando = t.id;
    try { await api.cambiarTarea(t.id, 'hecha'); } finally { marcando = null; }
  }
</script>

<div class="notis">
  <div>
    <h1 class="titulo">Notificaciones</h1>
    <p class="bajada">{pendientes.length ? `Tienes ${pendientes.length} zona${pendientes.length > 1 ? 's' : ''} por limpiar.` : 'No tienes zonas pendientes.'}</p>
  </div>

  <div class="lista">
    {#each pendientes.slice(0, 3) as t (t.id)}
      <div class="tarea">
        <span class="icono"><Icono nombre="peligro" size={24} trazo={2} /></span>
        <div class="t-cuerpo">
          <strong>Limpiar {espacioPorId(t.espacioId)?.nombre ?? 'espacio borrado'}</strong>
          <small>{t.nota || 'Asignada por el administrador'}, {hace(t.fecha)}</small>
          <div class="t-botones">
            <a class="boton verde" href="#op/escanear?e={t.espacioId}&t={t.id}">Empezar</a>
            <button class="boton secundario" onclick={() => hecha(t)} disabled={marcando === t.id}>Ya la hice</button>
          </div>
        </div>
      </div>
    {/each}
    {#each hechas as t (t.id)}
      <div class="tarea hecha">
        <span class="icono"><Icono nombre="check" size={24} trazo={2.4} /></span>
        <div class="t-cuerpo">
          <strong>{espacioPorId(t.espacioId)?.nombre ?? 'Espacio borrado'}</strong>
          <small>Hecha {t.hechaEn ? hace(t.hechaEn) : ''}</small>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .notis { height: 100%; display: flex; flex-direction: column; gap: 12px; }
  .lista { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 10px; }
  .tarea { display: flex; gap: 12px; padding: 14px; border-radius: var(--radio-tarjeta); background: var(--t-rojo); }
  .tarea.hecha { background: var(--superficie-2); padding: 10px 14px; }
  .icono { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--blanco); color: var(--alerta); }
  .hecha .icono { width: 36px; height: 36px; color: var(--verde-marca); }
  .t-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .t-cuerpo strong { font-size: 1.1rem; font-weight: 700; }
  .t-cuerpo small { color: var(--tinta-suave); }
  .t-botones { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
  .t-botones .boton { height: 46px; font-size: 0.95rem; }
</style>
