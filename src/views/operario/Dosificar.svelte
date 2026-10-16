<script>
  // Dosificación CleanDose: tocar el lugar → la máquina llena. Nada más.
  // La receta (compartimento, recipiente y mL) sale sola del lugar (lib/catalogo.js → recomendar).
  // Si llega desde Escanear área (?e=<lugar>&tl=<tipo de limpieza>), empieza a llenar de una vez.
  import Icono from '../../components/Icono.svelte';
  import Recipiente from '../../components/Recipiente.svelte';
  import { datos, sesion, ui, espacioPorId, refrescar } from '../../lib/nube.svelte.js';
  import { api, dosificar, NoSePudo } from '../../lib/api.js';
  import { PRODUCTOS, RECIPIENTES, COLOR_COMPARTIMENTO, mlProducto, recomendar, liquidoDe } from '../../lib/catalogo.js';
  import { ZONAS, zonaDe } from '../../lib/ui.js';

  let { params = {} } = $props();
  const tareaId = params.t ?? null;

  let lugar = $state(null);   // espacio elegido
  let receta = $state(null);  // { compartimento, productoId, recipiente, ml_producto, ml_agua }
  let fase = $state('elegir'); // elegir | esperando | dosificando | hecho | error
  let progreso = $state(0);
  let restaMs = $state(0);
  let problema = $state(null);

  /** Receta del lugar; si no hay el producto ideal, usa el primer compartimento que tenga algo. */
  function recetaPara(e, tipo = 'diaria') {
    const r = recomendar(e, tipo, datos.compartimentos);
    if (r.compartimento) return r;
    const i = datos.compartimentos.findIndex((c) => c.producto && c.nivel_ml > 0);
    if (i < 0) return null;
    const productoId = datos.compartimentos[i].producto;
    const ml = mlProducto(productoId, r.recipiente);
    return { ...r, compartimento: i + 1, productoId, ml_producto: ml, ml_agua: RECIPIENTES[r.recipiente].capacidad - ml };
  }

  function hablar(texto) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-ES';
    speechSynthesis.speak(u);
  }

  async function llenar(e, tipo) {
    if (ui.ocupado) return; // doble toque: la segunda vez no hace nada
    const r = recetaPara(e, tipo);
    lugar = e;
    receta = r;
    problema = null;
    progreso = 0;
    if (!r) {
      problema = new NoSePudo('sin producto');
      fase = 'error';
      return;
    }
    ui.ocupado = true;
    fase = 'esperando';
    try {
      await dosificar(
        { compartimento: r.compartimento, espacioId: e.id, operarioId: sesion.operarioId, recipiente: r.recipiente, ml_producto: r.ml_producto, tipoLimpieza: tipo ?? 'diaria' },
        (a) => {
          if (a.fase === 'dosificando' && fase !== 'dosificando') hablar('Llenando. No muevas el recipiente.');
          fase = a.fase;
          progreso = a.progreso;
          restaMs = a.restaMs ?? 0;
        }
      );
      fase = 'hecho';
      hablar('Listo. Ya puedes ir a limpiar.');
      refrescar().catch(() => {});
    } catch (err) {
      problema = err instanceof NoSePudo ? err : new NoSePudo('error');
      fase = 'error';
    } finally {
      ui.ocupado = false;
    }
  }

  // Desde Escanear área: empieza solo.
  let arrancado = false;
  $effect(() => {
    if (arrancado || !params.e || !datos.cargado) return;
    const e = espacioPorId(params.e);
    if (!e) return;
    arrancado = true;
    llenar(e, params.tl);
  });

  let marcando = $state(false);
  async function terminarTarea() {
    marcando = true;
    try {
      await api.cambiarTarea(tareaId, 'hecha');
      location.hash = '#op';
    } catch {
      marcando = false;
    }
  }
  const tarea = $derived(tareaId ? datos.tareas.find((t) => t.id === tareaId) : null);

  function otraVez() {
    fase = 'elegir';
    lugar = null;
  }

  const MENSAJES = {
    ocupado: (p) => `La máquina está llenando otro recipiente.${p.restaMs ? ` Espera ${Math.ceil(p.restaMs / 1000)} s.` : ''}`,
    desconectada: () => 'La máquina no está conectada. Avisa al administrador.',
    vacio: () => 'Ese producto se acabó. Recárgalo en Configuración.',
    'sin producto': () => 'No hay producto cargado. Configura los compartimentos.',
    red: () => 'No hay conexión con el servidor. Revisa el Wi-Fi.',
    error: () => 'La máquina no respondió. Intenta otra vez.',
  };
  const ml = (x) => (x >= 1000 ? `${x / 1000} L` : `${x} ml`);
  const liquido = $derived(receta ? liquidoDe(receta.productoId) : '#BBD9F2');
  const nivel = $derived(fase === 'hecho' ? 0.92 : fase === 'dosificando' ? progreso * 0.92 : 0);
</script>

<div class="dosificar">
  {#if fase === 'elegir'}
    <div>
      <h1 class="titulo">Dosificación CleanDose</h1>
      <p class="bajada">Pon el recipiente debajo y toca el lugar.</p>
    </div>
    {#if !datos.maquina.enLinea && datos.cargado}<p class="aviso">La máquina no está conectada. Avisa al administrador.</p>{/if}
    <div class="lugares">
      {#each datos.espacios as e (e.id)}
        {@const z = ZONAS[zonaDe(e)]}
        <button class="lugar" onclick={() => llenar(e)} disabled={!datos.maquina.enLinea}>
          <span class="cuadro" style="background:{z.color}; color:{z.tinta}"><Icono nombre={e.superficie} size={26} trazo={1.9} /></span>
          <span class="l-nombre">{e.nombre}</span>
        </button>
      {:else}
        <p class="aviso">No hay lugares. Pide al administrador que los cree.</p>
      {/each}
    </div>
  {:else}
    <div class="cabeza">
      <h1 class="titulo">{lugar?.nombre}</h1>
      {#if receta}<p class="bajada">{PRODUCTOS[receta.productoId]?.nombre}, {RECIPIENTES[receta.recipiente].nombre.toLowerCase()} de {ml(RECIPIENTES[receta.recipiente].capacidad)}</p>{/if}
    </div>

    <div class="escena" class:fluye={fase === 'dosificando'} style="--liquido:{liquido}">
      <svg class="boquilla" viewBox="0 0 120 54" aria-hidden="true">
        <rect x="16" y="1" width="88" height="22" rx="8" fill="#F5F7FA" stroke="#CBD3DF" stroke-width="2" />
        <rect x="50" y="23" width="20" height="16" rx="3" fill="#2B3445" />
        <rect x="56" y="39" width="8" height="9" fill="#9AA6B8" />
        <circle cx="30" cy="12" r="4" fill={fase === 'dosificando' ? (receta ? COLOR_COMPARTIMENTO[receta.compartimento - 1] : '#2F9BEA') : '#CBD3DF'} />
      </svg>
      <div class="chorro" aria-hidden="true"></div>
      <div class="vaso">
        <Recipiente tipo={receta?.recipiente ?? 'botella'} {nivel} objetivo={0.92} liquido={liquido} color="#2F9BEA" abierto marcas={false} />
      </div>
    </div>

    <div class="estado" aria-live="polite">
      {#if fase === 'esperando'}
        <p class="grande">Esperando a la máquina…</p>
        <div class="barra"><span style="width:3%"></span></div>
      {:else if fase === 'dosificando'}
        <div class="cuenta"><span class="numero">{Math.ceil(restaMs / 1000)}</span><span class="unidad">s</span><span class="c-txt">Llenando.<br />No lo muevas.</span></div>
        <div class="barra"><span style="width:{progreso * 100}%"></span></div>
      {:else if fase === 'hecho'}
        <p class="grande ok"><Icono nombre="check" size={28} trazo={2.6} /> Listo{receta?.ml_agua ? `: completa con ${ml(receta.ml_agua)} de agua` : ''}</p>
        {#if tarea && tarea.estado === 'pendiente'}
          <button class="boton verde ancho" onclick={terminarTarea} disabled={marcando}>Terminé de limpiar</button>
        {/if}
        <button class="boton secundario ancho" onclick={otraVez}>Llenar otro</button>
      {:else}
        <p class="grande mal">{(MENSAJES[problema?.motivo] ?? MENSAJES.error)(problema ?? {})}</p>
        <button class="boton ancho" onclick={otraVez}>Volver</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dosificar { height: 100%; display: flex; flex-direction: column; gap: 12px; }
  .aviso { flex: none; margin: 0; padding: 10px 12px; border-radius: var(--radio); background: var(--t-rojo); color: #8A1F1F; font-weight: 600; }
  .lugares { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 104px; align-content: start; gap: 12px; padding-bottom: 4px; }
  .lugar {
    display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; padding: 12px; cursor: pointer; text-align: left;
    border: 0; border-radius: var(--radio-tarjeta); background: var(--t-rosa); color: var(--tinta);
  }
  .lugar:active:not(:disabled) { transform: scale(0.98); }
  .lugar:disabled { opacity: 0.5; cursor: default; }
  .cuadro { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; }
  .l-nombre { font-size: 1.05rem; font-weight: 800; line-height: 1.15; }

  .cabeza { flex: none; }
  .escena { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; }
  .boquilla { flex: none; width: 112px; height: auto; z-index: 1; }
  .chorro { position: absolute; top: 46px; left: 50%; width: 7px; margin-left: -3.5px; height: 55%; display: none; border-radius: 3px; }
  .fluye .chorro {
    display: block;
    background: repeating-linear-gradient(to bottom, var(--liquido) 0 12px, color-mix(in srgb, var(--liquido) 50%, white) 12px 18px);
    animation: correr 0.45s linear infinite;
  }
  @keyframes correr { to { background-position: 0 18px; } }
  .vaso { flex: 1; min-height: 0; width: 100%; display: flex; justify-content: center; }
  .vaso :global(svg.recipiente) { height: 100%; width: auto; max-width: 100%; }

  .estado { flex: none; display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 120px; justify-content: flex-end; }
  .grande { margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1.2rem; font-weight: 800; text-align: center; text-wrap: balance; }
  .ok { color: var(--verde-oscuro); }
  .mal { color: var(--alerta); }
  .cuenta { width: 100%; display: flex; align-items: baseline; gap: 4px; }
  .numero { font-size: 3.8rem; font-weight: 800; line-height: 0.9; letter-spacing: -0.04em; color: var(--azul); }
  .unidad { font-size: 1.5rem; font-weight: 800; color: var(--azul); }
  .c-txt { margin-left: auto; text-align: right; font-weight: 700; color: var(--tinta-suave); line-height: 1.25; }
  .barra { width: 100%; height: 10px; border-radius: 5px; background: var(--superficie-2); overflow: hidden; }
  .barra span { display: block; height: 100%; background: var(--azul); border-radius: 5px; transition: width 0.3s linear; }
  .ancho { width: 100%; }
  @media (prefers-reduced-motion: reduce) { .barra span { transition: none; } .fluye .chorro { animation: none; } }
</style>
