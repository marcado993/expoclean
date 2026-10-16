<script>
  // Menú principal del operario: las 4 funciones.
  import Icono from '../../components/Icono.svelte';
  import { datos, sesion, operarioActual, espacioPorId } from '../../lib/nube.svelte.js';

  const yo = $derived(operarioActual());
  const tarea = $derived(datos.tareas.findLast((t) => t.operarioId === sesion.operarioId && t.estado === 'pendiente'));

  const OPCIONES = [
    { ruta: 'op/escanear', titulo: 'Escanear área', texto: 'Escanea el piso o selecciona la zona para obtener la dosificación recomendada.', icono: 'escanear', tinte: 'verde' },
    { ruta: 'op/config', titulo: 'Configuración CleanDose', texto: 'Define qué producto contiene cada compartimento del dosificador.', icono: 'ajustes', tinte: 'azul' },
    { ruta: 'op/dosificar', titulo: 'Dosificación CleanDose', texto: 'Selecciona el producto y dispensa la cantidad necesaria.', icono: 'gota', tinte: 'rosa' },
    { ruta: 'op/historial', titulo: 'Historial personal', texto: 'Revisa tus limpiezas realizadas.', icono: 'historial', tinte: 'morado' },
  ];
</script>

<div class="menu">
  <div>
    <h1 class="titulo saludo">Hola, {yo?.nombre.split(' ')[0] ?? ''}</h1>
    <p class="bajada">Selecciona una opción para continuar.</p>
  </div>

  {#if tarea}
    <a class="tarea" href="#op/escanear?e={tarea.espacioId}&t={tarea.id}">
      <Icono nombre="campana" size={22} trazo={2} />
      <span>Te toca limpiar <strong>{espacioPorId(tarea.espacioId)?.nombre ?? 'un espacio'}</strong></span>
      <Icono nombre="derecha" size={20} trazo={2.2} />
    </a>
  {/if}

  <nav class="opciones">
    {#each OPCIONES as o}
      <a class="opcion" href="#{o.ruta}" style="--t:var(--t-{o.tinte}); --i:var(--i-{o.tinte})">
        <span class="icono"><Icono nombre={o.icono} size={34} trazo={1.9} /></span>
        <span class="texto"><strong>{o.titulo}</strong><span>{o.texto}</span></span>
        <Icono nombre="derecha" size={22} trazo={2} />
      </a>
    {/each}
  </nav>
</div>

<style>
  .menu { height: 100%; display: flex; flex-direction: column; gap: 16px; }
  .saludo { font-size: 1.95rem; }
  .tarea {
    flex: none; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--radio);
    background: var(--t-rojo); color: #8A1F1F; text-decoration: none; font-weight: 600;
  }
  .tarea span { flex: 1; }
  .opciones { flex: 1; min-height: 0; display: grid; grid-template-rows: repeat(4, minmax(0, 132px)); gap: 14px; }
  .opcion {
    display: flex; align-items: center; gap: 16px; padding: 0 14px 0 16px; border-radius: var(--radio-tarjeta);
    background: var(--t); color: var(--tinta); text-decoration: none;
  }
  .opcion:active { filter: brightness(0.97); }
  .icono { flex: none; display: grid; place-items: center; width: 66px; height: 66px; border-radius: 14px; background: color-mix(in srgb, var(--i) 18%, white); color: var(--i); }
  .texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .texto strong { font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.2; }
  .texto span { font-size: 0.92rem; color: var(--tinta-suave); line-height: 1.3; }
</style>
