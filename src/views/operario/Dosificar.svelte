<script>
  import Icono3D from '../../components/Icono3D.svelte';
  // Dosificación: tocar el lugar → la máquina llena (por Bluetooth). Se puede detener.
  // La receta (compartimento, recipiente y mL) sale sola del lugar (lib/catalogo.js → recomendar).
  // Desde Escanear área (?e=<lugar>&tl=<tipo>) arranca sola si la máquina ya está conectada.
  import { fly, scale, fade } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import Icono from '../../components/Icono.svelte';
  import Recipiente from '../../components/Recipiente.svelte';
  import Maquina from '../../components/Maquina.svelte';
  import Seguridad from '../../components/Seguridad.svelte';
  import { datos, sesion, ui, espacioPorId } from '../../lib/nube.svelte.js';
  import { api } from '../../lib/api.js';
  import { maquina, dosificarBLE, detener, registrar, NoSePudo } from '../../lib/ble.svelte.js';
  import { PRODUCTOS, RECIPIENTES, COLOR_COMPARTIMENTO, mlProducto, recomendar, liquidoDe, segundosPara } from '../../lib/catalogo.js';
  import { ZONAS, zonaDe, SUPERFICIE_3D, RECIPIENTE_3D } from '../../lib/ui.js';
  import { dur, tic } from '../../lib/movimiento.js';

  let { params = {} } = $props();
  const inicial = { e: params.e, tl: params.tl, t: params.t };

  let lugar = $state(null);
  let receta = $state(null);
  let fase = $state('elegir'); // elegir | llenando | hecho | parado | error
  let progreso = $state(0);
  let restaMs = $state(0);
  let problema = $state(null);

  function recetaPara(e, tipo = 'diaria') {
    const r = recomendar(e, tipo, datos.compartimentos);
    if (r.compartimento) return r;
    const i = datos.compartimentos.findIndex((c) => c.producto && c.nivel_ml > 0);
    if (i < 0) return null;
    const productoId = datos.compartimentos[i].producto;
    const ml = mlProducto(productoId, r.recipiente);
    return { ...r, compartimento: i + 1, productoId, ml_producto: ml, ml_agua: RECIPIENTES[r.recipiente].capacidad - ml };
  }

  async function llenar(e, tipo) {
    if (ui.ocupado || !maquina.conectada) return;
    tic(20);
    const r = recetaPara(e, tipo);
    lugar = e;
    receta = r;
    problema = null;
    progreso = 0;
    restaMs = 0;
    if (!r) {
      problema = new NoSePudo('sin producto');
      fase = 'error';
      return;
    }
    const segundos = segundosPara(r.ml_producto);
    ui.ocupado = true;
    fase = 'llenando';
    try {
      const { id, parada } = await dosificarBLE({ compartimento: r.compartimento, segundos }, (a) => {
        progreso = Math.max(progreso, a.progreso);
        restaMs = a.restaMs;
      });
      const ml = parada ? Math.round(r.ml_producto * progreso) : r.ml_producto;
      fase = parada ? 'parado' : 'hecho';
      navigator.vibrate?.(parada ? 80 : [60, 60, 120]);
      if (ml > 0) {
        registrar({
          id, fecha: new Date().toISOString(), compartimento: r.compartimento, operarioId: sesion.operarioId, espacioId: e.id,
          recipiente: r.recipiente, ml_producto: ml, tipoLimpieza: tipo ?? 'diaria', ...(parada ? { parcial: true } : {}),
        });
      }
    } catch (err) {
      problema = err instanceof NoSePudo ? err : new NoSePudo('error');
      fase = 'error';
      navigator.vibrate?.([200, 80, 200]);
    } finally {
      ui.ocupado = false;
    }
  }

  // Desde Escanear área: arranca sola apenas haya datos y máquina.
  let arrancado = false;
  $effect(() => {
    if (arrancado || !inicial.e || !datos.cargado || !maquina.conectada) return;
    const e = espacioPorId(inicial.e);
    if (!e) return;
    arrancado = true;
    llenar(e, inicial.tl);
  });

  const tarea = $derived(inicial.t ? datos.tareas.find((t) => t.id === inicial.t) : null);
  let marcando = $state(false);
  async function terminarTarea() {
    marcando = true;
    try {
      await api.cambiarTarea(inicial.t, 'hecha');
      location.hash = '#op';
    } catch {
      marcando = false;
    }
  }

  function otro() {
    tic();
    fase = 'elegir';
    lugar = null;
  }

  const MENSAJES = {
    ocupado: (p) => `Máquina ocupada${p.restaMs ? `, espera ${Math.ceil(p.restaMs / 1000)} s` : ''}`,
    desconectada: () => 'Se perdió la conexión con la máquina',
    'sin producto': () => 'No hay producto cargado',
    error: () => 'La máquina no respondió',
  };
  const ml = (x) => (x >= 1000 ? `${+(x / 1000).toFixed(1)} L` : `${x} ml`);
  // Sin scroll: los lugares se reparten el alto disponible (2 columnas; 3 si son muchos).
  const columnas = $derived(datos.espacios.length > 10 ? 3 : 2);
  const filas = $derived(Math.max(1, Math.ceil(datos.espacios.length / columnas)));
  const liquido = $derived(receta ? liquidoDe(receta.productoId) : '#BBD9F2');
  const nivel = $derived(fase === 'hecho' ? 0.92 : fase === 'llenando' || fase === 'parado' ? progreso * 0.92 : 0);
</script>

<div class="dosificar">
  {#if fase === 'elegir'}
    <h1 class="titulo">¿Dónde vas a limpiar?</h1>

    {#if !maquina.conectada}
      <div in:fade={{ duration: dur(200) }}><Maquina fila /></div>
    {/if}

    <div class="lugares" class:apagados={!maquina.conectada} class:tres={columnas === 3}
      style="grid-template-columns: repeat({columnas}, 1fr); grid-template-rows: repeat({filas}, minmax(0, 1fr))">
      {#each datos.espacios as e, i (e.id)}
        {@const z = ZONAS[zonaDe(e)]}
        <button class="lugar" style="--zc:{z.color}" onclick={() => llenar(e)} disabled={!maquina.conectada}
          in:fly={{ y: 18, delay: dur(i * 35), duration: dur(260) }}>
          <span class="cuadro"><Icono3D nombre={SUPERFICIE_3D[e.superficie]} size={38} /></span>
          <span class="l-nombre">{e.nombre}</span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="cabeza" in:fade={{ duration: dur(200) }}>
      <h1 class="titulo">{lugar?.nombre}</h1>
      {#if receta}
        <span class="chips">
          <span class="chip" style="--cc:{COLOR_COMPARTIMENTO[receta.compartimento - 1]}"><span class="pto"></span>{PRODUCTOS[receta.productoId]?.nombre}</span>
          <span class="chip"><Icono3D nombre={RECIPIENTE_3D[receta.recipiente]} size={20} />{ml(RECIPIENTES[receta.recipiente].capacidad)}</span>
        </span>
        <Seguridad producto={receta.productoId} />
      {/if}
    </div>

    <div class="escena" class:fluye={fase === 'llenando'} style="--liquido:{liquido}">
      <svg class="boquilla" viewBox="0 0 120 54" aria-hidden="true">
        <rect x="16" y="1" width="88" height="22" rx="8" fill="#F5F7FA" stroke="#CBD3DF" stroke-width="2" />
        <rect x="50" y="23" width="20" height="16" rx="3" fill="#2B3445" />
        <rect x="56" y="39" width="8" height="9" fill="#9AA6B8" />
        <circle class:luz={fase === 'llenando'} cx="30" cy="12" r="4" fill={fase === 'llenando' ? COLOR_COMPARTIMENTO[(receta?.compartimento ?? 1) - 1] : '#CBD3DF'} />
      </svg>
      <div class="chorro" aria-hidden="true"></div>
      <div class="vaso">
        <Recipiente tipo={receta?.recipiente ?? 'botella'} {nivel} objetivo={0.92} {liquido} color="#2F9BEA" abierto marcas={false} ola={fase === 'llenando'} />
        {#if fase === 'hecho'}
          <div class="exito" in:scale={{ start: 0.4, duration: dur(420), easing: backOut }}>
            <span class="anillo" aria-hidden="true"></span>
            <svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27 l8 8 l15 -17" /></svg>
          </div>
        {/if}
      </div>
    </div>

    <div class="estado" aria-live="polite">
      {#if fase === 'llenando'}
        <div class="cuenta">
          <span class="numero">{restaMs ? Math.ceil(restaMs / 1000) : '…'}</span><span class="unidad">{restaMs ? 's' : ''}</span>
          <div class="barra"><span style="width:{progreso * 100}%"></span></div>
        </div>
        <button class="boton peligro ancho" onclick={() => { tic(30); detener(); }}><Icono nombre="parar" size={22} trazo={2.2} /> Detener</button>
      {:else if fase === 'hecho' || fase === 'parado'}
        <p class="grande" in:fly={{ y: 10, duration: dur(250) }}>
          {fase === 'hecho' ? (receta?.ml_agua ? `+ ${ml(receta.ml_agua)} de agua` : 'Listo') : 'Detenido'}
        </p>
        {#if tarea && tarea.estado === 'pendiente' && fase === 'hecho'}
          <button class="boton verde ancho" onclick={terminarTarea} disabled={marcando}><Icono nombre="check" size={22} trazo={2.4} /> Terminé de limpiar</button>
        {/if}
        <button class="boton secundario ancho" onclick={otro}><Icono nombre="gota" size={20} trazo={2} /> Llenar otro</button>
      {:else}
        <p class="grande mal" in:fly={{ y: 10, duration: dur(250) }}><Icono nombre="peligro" size={26} trazo={2.2} /> {(MENSAJES[problema?.motivo] ?? MENSAJES.error)(problema ?? {})}</p>
        <button class="boton ancho" onclick={otro}>Volver</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dosificar { height: 100%; display: flex; flex-direction: column; gap: 14px; }

  .lugares { flex: 1; min-height: 0; max-height: 560px; overflow: hidden; display: grid; gap: 10px; padding: 2px; }
  .lugares.apagados { opacity: 0.45; }
  .lugar {
    position: relative; overflow: hidden; min-height: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 8px; padding: 8px 12px;
    cursor: pointer; text-align: left; border: 0; border-radius: var(--radio-tarjeta);
    background: color-mix(in srgb, var(--zc) 9%, white); color: var(--tinta);
    box-shadow: 0 1px 0 color-mix(in srgb, var(--zc) 25%, white);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .lugar:active:not(:disabled) { transform: scale(0.95); box-shadow: none; }
  .lugar:disabled { cursor: default; }
  .cuadro { flex: none; display: grid; place-items: center; width: 50px; height: 50px; border-radius: 14px; background: var(--blanco); }
  .l-nombre { font-size: 1rem; font-weight: 700; line-height: 1.15; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .tres .l-nombre { font-size: 0.88rem; }
  .tres .cuadro { width: 40px; height: 40px; }

  .cabeza { flex: none; display: flex; flex-direction: column; gap: 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 999px; background: var(--superficie-2); font-weight: 700; font-size: 0.88rem; }
  .pto { width: 10px; height: 10px; border-radius: 50%; background: var(--cc); }

  .escena { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; }
  .boquilla { flex: none; width: 112px; height: auto; z-index: 1; }
  .luz { animation: luz 0.8s ease-in-out infinite; }
  .chorro { position: absolute; top: 46px; left: 50%; width: 8px; margin-left: -4px; height: 55%; display: none; border-radius: 4px; }
  .fluye .chorro {
    display: block;
    background: repeating-linear-gradient(to bottom, var(--liquido) 0 12px, color-mix(in srgb, var(--liquido) 45%, white) 12px 18px);
    animation: correr 0.4s linear infinite;
  }
  .vaso { position: relative; flex: 1; min-height: 0; width: 100%; display: flex; justify-content: center; }
  .vaso :global(svg.recipiente) { height: 100%; width: auto; max-width: 100%; }

  .exito { position: absolute; inset: 0; display: grid; place-items: center; }
  .exito svg { width: 112px; height: 112px; filter: drop-shadow(0 10px 24px rgb(31 157 85 / 0.35)); }
  .exito circle { fill: var(--verde-marca); }
  .exito path { fill: none; stroke: #fff; stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: trazo 0.4s 0.2s ease-out forwards; }
  .anillo { position: absolute; width: 112px; height: 112px; border-radius: 50%; border: 4px solid var(--verde-marca); animation: anillo 0.9s ease-out forwards; }

  .estado { flex: none; display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 120px; justify-content: flex-end; }
  .grande { margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1.4rem; font-weight: 700; text-align: center; }
  .mal { color: var(--alerta); font-size: 1.15rem; }
  .cuenta { width: 100%; display: flex; align-items: center; gap: 12px; }
  .numero { font-size: 3.4rem; font-weight: 700; line-height: 1; letter-spacing: -0.04em; color: var(--azul); min-width: 1.4em; }
  .unidad { font-size: 1.4rem; font-weight: 700; color: var(--azul); margin-left: -8px; align-self: flex-end; padding-bottom: 6px; }
  .barra { flex: 1; height: 12px; border-radius: 6px; background: var(--superficie-2); overflow: hidden; }
  .barra span { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, var(--i-azul), var(--azul)); transition: width 0.4s linear; }
  .ancho { width: 100%; }

  @keyframes correr { to { background-position: 0 18px; } }
  @keyframes luz { 50% { opacity: 0.35; } }
  @keyframes trazo { to { stroke-dashoffset: 0; } }
  @keyframes anillo { from { transform: scale(0.8); opacity: 0.9; } to { transform: scale(1.8); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .fluye .chorro, .luz, .anillo { animation: none; }
    .exito path { animation: none; stroke-dashoffset: 0; }
    .barra span, .lugar { transition: none; }
  }
</style>
