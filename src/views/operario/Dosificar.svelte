<script>
  // Dosificación CleanDose: compartimento + cantidad + zona → Dispensar.
  // Es la única pantalla que manda la orden a la máquina (app → servidor → ESP32 → bomba).
  // Llega con la receta de Escanear área (?e=<espacio>&tl=<tipo de limpieza>&t=<tarea>) o se elige a mano.
  import Icono from '../../components/Icono.svelte';
  import Recipiente from '../../components/Recipiente.svelte';
  import { datos, sesion, ui, espacioPorId, refrescar } from '../../lib/nube.svelte.js';
  import { api, dosificar, NoSePudo } from '../../lib/api.js';
  import { PRODUCTOS, RECIPIENTES, TIPOS_LIMPIEZA, COLOR_COMPARTIMENTO, mlProducto, recomendar, liquidoDe, segundosPara } from '../../lib/catalogo.js';

  let { params = {} } = $props();

  const receta = params.e && params.tl ? recomendar(espacioPorId(params.e) ?? {}, params.tl, datos.compartimentos) : null;
  let espacioId = $state(params.e ?? '');
  let comp = $state(receta?.compartimento ?? null);
  let recipiente = $state(receta?.recipiente ?? 'botella');
  const tareaId = params.t ?? null;

  const compartimento = $derived(comp ? datos.compartimentos[comp - 1] : null);
  const productoId = $derived(compartimento?.producto ?? null);
  const mlP = $derived(
    receta && comp === receta.compartimento && recipiente === receta.recipiente ? receta.ml_producto : productoId ? mlProducto(productoId, recipiente) : 0
  );
  const listo = $derived(!!(comp && productoId && compartimento.nivel_ml > 0 && espacioId));

  let fase = $state('elegir'); // elegir | esperando | dosificando | hecho | error
  let progreso = $state(0);
  let restaMs = $state(0);
  let problema = $state(null);

  function hablar(texto) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-ES';
    speechSynthesis.speak(u);
  }

  async function dispensar() {
    if (ui.ocupado || !listo) return; // doble toque: la segunda vez no hace nada
    ui.ocupado = true;
    fase = 'esperando';
    problema = null;
    try {
      await dosificar(
        { compartimento: comp, espacioId, operarioId: sesion.operarioId, recipiente, ml_producto: mlP, tipoLimpieza: params.tl ?? null },
        (a) => {
          if (a.fase === 'dosificando' && fase !== 'dosificando') hablar('Dispensando. No muevas el recipiente.');
          fase = a.fase;
          progreso = a.progreso;
          restaMs = a.restaMs ?? 0;
        }
      );
      fase = 'hecho';
      hablar('Listo. Completa con agua y ya puedes limpiar.');
      refrescar().catch(() => {});
    } catch (e) {
      problema = e instanceof NoSePudo ? e : new NoSePudo('error');
      fase = 'error';
    } finally {
      ui.ocupado = false;
    }
  }

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

  const MENSAJES = {
    ocupado: (p) => `La máquina está dispensando para otra persona.${p.restaMs ? ` Espera ${Math.ceil(p.restaMs / 1000)} s.` : ''}`,
    desconectada: () => 'La máquina no está conectada. Avisa al administrador.',
    vacio: () => `El compartimento ${comp} está vacío. Recárgalo en Configuración.`,
    'sin producto': () => `El compartimento ${comp} no tiene producto. Configúralo primero.`,
    red: () => 'No hay conexión con el servidor. Revisa el Wi-Fi.',
    error: () => 'La máquina no respondió. Intenta otra vez o avisa al administrador.',
  };
  const tarea = $derived(tareaId ? datos.tareas.find((t) => t.id === tareaId) : null);
  const ml = (x) => (x >= 1000 ? `${x / 1000} L` : `${x} ml`);
</script>

<div class="dosificar">
  {#if fase === 'elegir'}
    <div>
      <h1 class="titulo">Dosificación CleanDose</h1>
      <p class="bajada">{receta ? `Receta para ${espacioPorId(espacioId)?.nombre}, ${TIPOS_LIMPIEZA[params.tl].nombre}` : 'Selecciona el producto y la cantidad.'}</p>
    </div>

    <div class="comps" role="radiogroup" aria-label="Compartimento">
      {#each datos.compartimentos as c, i}
        {@const vacio = !c.producto || c.nivel_ml <= 0}
        <button class="comp" class:elegido={comp === i + 1} role="radio" aria-checked={comp === i + 1} disabled={vacio} onclick={() => (comp = i + 1)}
          style="--cc:{COLOR_COMPARTIMENTO[i]}">
          <span class="num">{i + 1}</span>
          <span class="c-texto"><strong>{PRODUCTOS[c.producto]?.nombre ?? 'Sin producto'}</strong>
            <small>{!c.producto ? 'Configúralo primero' : c.nivel_ml <= 0 ? 'Vacío' : `Queda ${Math.round((c.nivel_ml / c.capacidad_ml) * 100)} %`}</small></span>
          <span class="check"></span>
        </button>
      {/each}
    </div>

    <p class="sub">Cantidad</p>
    <div class="cantidades">
      {#each Object.entries(RECIPIENTES) as [k, r]}
        <button class="cant" class:elegido={recipiente === k} onclick={() => (recipiente = k)}>
          <Icono nombre={k} size={24} trazo={1.9} />
          <span>{r.nombre} {ml(r.capacidad)}</span>
        </button>
      {/each}
    </div>

    <label class="zona">
      <Icono nombre="lugar" size={22} trazo={2} />
      <select bind:value={espacioId} aria-label="Zona donde vas a limpiar">
        <option value="" disabled>¿Dónde vas a limpiar?</option>
        {#each datos.espacios as e (e.id)}<option value={e.id}>{e.nombre}</option>{/each}
      </select>
      <Icono nombre="abajo" size={20} trazo={2} />
    </label>

    {#if productoId}
      <div class="resumen">
        <div class="cifra rosa"><small>Producto</small><strong>{ml(mlP)}</strong></div>
        <div class="cifra azul"><small>Agua</small><strong>{ml(Math.max(0, RECIPIENTES[recipiente].capacidad - mlP))}</strong></div>
        <div class="cifra gris"><small>Bomba</small><strong>{segundosPara(mlP)} s</strong></div>
      </div>
    {/if}

    {#if !datos.maquina.enLinea}<p class="error">La máquina no está conectada. Avisa al administrador.</p>{/if}
    <button class="boton dispensar" onclick={dispensar} disabled={!listo || !datos.maquina.enLinea}>
      <Icono nombre="gota" size={24} trazo={2.2} /> Dispensar
    </button>
  {:else}
    <div>
      <h1 class="titulo">{fase === 'hecho' ? 'Listo' : fase === 'error' ? 'No se pudo dispensar' : 'Dispensando…'}</h1>
      <p class="bajada">{PRODUCTOS[productoId]?.nombre}, {espacioPorId(espacioId)?.nombre}</p>
    </div>
    <div class="vaso">
      <Recipiente tipo={recipiente} nivel={fase === 'hecho' ? 1 : progreso} objetivo={1} liquido={liquidoDe(productoId)} color={COLOR_COMPARTIMENTO[comp - 1]} abierto marcas={false} />
    </div>

    <div class="estado" aria-live="polite">
      {#if fase === 'esperando'}
        <p class="grande">Esperando a la máquina…</p>
      {:else if fase === 'dosificando'}
        <div class="cuenta"><span class="numero">{Math.ceil(restaMs / 1000)}</span><span class="unidad">s</span><span class="c-txt">No muevas el recipiente.</span></div>
        <div class="barra"><span style="width:{progreso * 100}%"></span></div>
      {:else if fase === 'hecho'}
        <p class="grande ok"><Icono nombre="check" size={28} trazo={2.6} /> Completa con {ml(Math.max(0, RECIPIENTES[recipiente].capacidad - mlP))} de agua.</p>
        {#if tarea && tarea.estado === 'pendiente'}
          <button class="boton verde ancho" onclick={terminarTarea} disabled={marcando}>Terminé de limpiar</button>
        {/if}
        <a class="boton secundario ancho" href="#op">Volver al inicio</a>
      {:else}
        <p class="grande mal">{(MENSAJES[problema?.motivo] ?? MENSAJES.error)(problema ?? {})}</p>
        <button class="boton ancho" onclick={() => (fase = 'elegir')}>Intentar otra vez</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .dosificar { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .comps { flex: none; display: flex; flex-direction: column; gap: 6px; }
  .comp {
    display: flex; align-items: center; gap: 10px; min-height: 54px; padding: 6px 12px; cursor: pointer; text-align: left;
    border: 1.5px solid var(--linea); border-radius: var(--radio); background: var(--blanco); color: var(--tinta);
  }
  .comp:disabled { cursor: default; opacity: 0.45; }
  .comp.elegido { border: 2px solid var(--cc); background: color-mix(in srgb, var(--cc) 8%, white); }
  .num { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--cc); color: #fff; font-weight: 800; }
  .c-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .c-texto strong { font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .c-texto small { font-size: 0.8rem; color: var(--tinta-suave); }
  .check { flex: none; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--linea-fuerte); }
  .elegido .check { border: 7px solid var(--cc); }
  .sub { flex: none; margin: 2px 0 0; font-weight: 800; }
  .cantidades { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cant {
    height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer;
    border: 1.5px solid var(--linea); border-radius: var(--radio); background: var(--blanco); color: var(--tinta-suave); font-weight: 700; font-size: 0.8rem;
  }
  .cant.elegido { border: 2px solid var(--azul); background: var(--t-azul); color: var(--azul-oscuro); }
  .zona { position: relative; flex: none; display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 12px; border: 1.5px solid var(--linea); border-radius: var(--radio); color: var(--azul); }
  .zona select { flex: 1; min-width: 0; height: 100%; border: 0; background: none; appearance: none; font-size: 1rem; font-weight: 700; color: var(--tinta); cursor: pointer; }
  .resumen { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .cifra { display: flex; flex-direction: column; padding: 8px 10px; border-radius: var(--radio); }
  .cifra small { font-size: 0.78rem; color: var(--tinta-suave); }
  .cifra strong { font-size: 1.25rem; font-weight: 800; }
  .rosa { background: var(--t-rosa); } .rosa strong { color: #B8285A; }
  .azul { background: var(--t-azul); } .azul strong { color: var(--azul-oscuro); }
  .gris { background: var(--superficie-2); }
  .error { flex: none; margin: 0; color: var(--alerta); font-weight: 700; }
  .dispensar { flex: none; width: 100%; height: 60px; margin-top: auto; font-size: 1.2rem; }

  .vaso { flex: 1; min-height: 0; display: flex; justify-content: center; padding: 10px 0; }
  .vaso :global(svg.recipiente) { height: 100%; width: auto; max-width: 100%; }
  .estado { flex: none; display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 130px; justify-content: flex-end; }
  .grande { margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1.2rem; font-weight: 800; text-align: center; text-wrap: balance; }
  .ok { color: var(--verde-oscuro); }
  .mal { color: var(--alerta); }
  .cuenta { width: 100%; display: flex; align-items: baseline; gap: 4px; }
  .numero { font-size: 3.8rem; font-weight: 800; line-height: 0.9; letter-spacing: -0.04em; color: var(--azul); }
  .unidad { font-size: 1.5rem; font-weight: 800; color: var(--azul); }
  .c-txt { margin-left: auto; font-weight: 700; color: var(--tinta-suave); }
  .barra { width: 100%; height: 10px; border-radius: 5px; background: var(--superficie-2); overflow: hidden; }
  .barra span { display: block; height: 100%; background: var(--azul); border-radius: 5px; transition: width 0.3s linear; }
  .ancho { width: 100%; }
  @media (prefers-reduced-motion: reduce) { .barra span { transition: none; } }
</style>
