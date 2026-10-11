<script>
  import Icono from '../components/Icono.svelte';
  // Supervisor: registra los lugares una vez. Tres formas: escribir, dictar, o dibujar sobre el croquis.
  // Sin scroll: lista paginada, croquis que se ajusta a la pantalla y una hoja que se abre encima.
  import { db } from '../lib/store.svelte.js';
  import { calcularDosis, SUPERFICIES, SUCIEDAD, PRODUCTOS, RECIPIENTES } from '../lib/dosis.js';
  import { CATEGORIAS, SUCIEDAD_COLOR, ZONAS, zonaDe } from '../lib/ui.js';
  import { interpretarLugar, crearOyente } from '../lib/intencion.js';
  import { cargarImagen, planoEjemplo, puntoSvg } from '../lib/croquis.js';
  import Ficha from '../components/Ficha.svelte';

  let pestaña = $state('lista');

  // ── Lista paginada
  const ALTO_FILA = 62;
  let caja = $state();
  let porPagina = $state(6);
  let pagina = $state(0);
  $effect(() => {
    if (!caja) return;
    const ro = new ResizeObserver(([e]) => (porPagina = Math.max(1, Math.floor(e.contentRect.height / ALTO_FILA))));
    ro.observe(caja);
    return () => ro.disconnect();
  });
  const paginas = $derived(Math.max(1, Math.ceil(db.areas.length / porPagina)));
  const visibles = $derived(db.areas.slice(pagina * porPagina, (pagina + 1) * porPagina));
  $effect(() => { if (pagina > paginas - 1) pagina = paginas - 1; });

  const ml = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2).replace(/\.?0+$/, '')} L` : `${x} mL`);
  const resumen = (a) => {
    const d = calcularDosis(a);
    const rec = RECIPIENTES[d.recipiente].nombre.toLowerCase();
    return `${a.area_m2} m², ${d.cargas} ${rec}${d.cargas > 1 ? 's' : ''}`;
  };

  // ── Hoja de edición
  const vacio = () => ({ nombre: '', area_m2: 20, superficie: 'piso', suciedad: 'normal', zona: 'general' });
  let hoja = $state(null); // null | { form, id?, croquis? }
  const vista = $derived.by(() => { try { return hoja ? calcularDosis(hoja.form) : null; } catch { return null; } });

  function abrir(area, extra = {}) {
    hoja = area
      ? { id: area.id, form: { nombre: area.nombre, area_m2: area.area_m2, superficie: area.superficie, suciedad: area.suciedad, zona: zonaDe(area) }, croquis: area.croquis }
      : { form: { ...vacio(), ...extra.form }, croquis: extra.croquis };
    descripcion = '';
  }

  function guardar(e) {
    e.preventDefault();
    if (!hoja.form.nombre.trim() || !vista) return;
    const datos = { ...hoja.form, ...(hoja.croquis ? { croquis: hoja.croquis } : {}) };
    if (hoja.id) Object.assign(db.areas.find((a) => a.id === hoja.id), datos);
    else db.areas.push({ ...datos, id: crypto.randomUUID() });
    hoja = null;
  }

  function alternarHoy(id) {
    const hoy = db.hoy ?? [];
    db.hoy = hoy.includes(id) ? hoy.filter((x) => x !== id) : [...hoy, id];
  }

  function borrar() {
    if (!confirm(`¿Borrar "${hoja.form.nombre}"? Desaparece del dispensador.`)) return;
    db.areas = db.areas.filter((a) => a.id !== hoja.id);
    delete db.pendientes[hoja.id];
    db.hoy = (db.hoy ?? []).filter((x) => x !== hoja.id);
    hoja = null;
  }

  // ── Describir o dictar: rellena el formulario mientras se habla o escribe
  let descripcion = $state('');
  let escuchando = $state(false);
  let oyente = null;
  const hayVoz = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function aplicar(texto) {
    descripcion = texto;
    if (hoja) Object.assign(hoja.form, interpretarLugar(texto));
  }
  function dictar() {
    if (escuchando) { oyente?.stop(); return; }
    oyente = crearOyente({ alEscuchar: (t) => aplicar(t), alTerminar: () => (escuchando = false), alError: () => (escuchando = false) });
    escuchando = true;
    oyente.start();
  }
  function nuevoDictado() {
    abrir(null);
    if (hayVoz) dictar();
  }

  // ── Croquis
  let svg = $state();
  let modo = $state('ver'); // ver | escala | dibujar
  let trazo = $state(null); // { x1, y1, x2, y2 }
  let escala = $state(null); // { px } esperando los metros
  let metros = $state(5);
  let errorPlano = $state('');
  const c = $derived(db.croquis);
  const conCroquis = $derived(db.areas.filter((a) => a.croquis));

  async function subir(e) {
    const archivo = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!archivo) return;
    try {
      db.croquis = await cargarImagen(archivo);
      errorPlano = '';
      modo = 'escala';
    } catch (err) {
      errorPlano = `${err.message}. Sube una foto o captura del plano (JPG o PNG).`;
    }
  }

  function bajar(e) {
    if (modo === 'ver' || !svg) return;
    const p = puntoSvg(svg, e);
    trazo = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    svg.setPointerCapture(e.pointerId);
  }
  function mover(e) {
    if (!trazo) return;
    const p = puntoSvg(svg, e);
    trazo.x2 = p.x;
    trazo.y2 = p.y;
  }
  function soltar() {
    if (!trazo) return;
    const { x1, y1, x2, y2 } = trazo;
    trazo = null;
    if (modo === 'escala') {
      const px = Math.hypot(x2 - x1, y2 - y1);
      if (px > 10) escala = { px };
    } else if (modo === 'dibujar') {
      const r = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
      if (r.w < 10 || r.h < 10) return;
      abrir(null, { form: { area_m2: Math.max(1, Math.round(r.w * r.h * c.mpp ** 2)) }, croquis: r });
    }
  }
  function fijarEscala(e) {
    e.preventDefault();
    if (!(metros > 0)) return;
    db.croquis.mpp = metros / escala.px;
    escala = null;
    modo = 'dibujar';
  }

  const ayuda = $derived(
    !c ? '' :
    modo === 'escala' ? 'Arrastra sobre una pared que conozcas su medida.' :
    modo === 'dibujar' ? 'Arrastra para marcar un cuarto. Los m² se calculan solos.' :
    'Toca un cuarto para editarlo.'
  );
</script>

<div class="lugares">
  <div class="pestañas" role="tablist">
    <button role="tab" aria-selected={pestaña === 'lista'} class:activa={pestaña === 'lista'} onclick={() => (pestaña = 'lista')}>
      <Icono nombre="lista" size={20} /> Lista
    </button>
    <button role="tab" aria-selected={pestaña === 'croquis'} class:activa={pestaña === 'croquis'} onclick={() => (pestaña = 'croquis')}>
      <Icono nombre="mapa" size={20} /> Croquis
    </button>
  </div>

  {#if pestaña === 'lista'}
    <div class="lista tarjeta" bind:this={caja}>
      {#each visibles as a, i (a.id)}
        {@const k = CATEGORIAS[a.superficie]}
        {@const deHoy = (db.hoy ?? []).includes(a.id)}
        <div class="fila-caja" style="height:{ALTO_FILA}px">
        <button class="fila" onclick={() => abrir(a)}>
          <span class="azulejo"><Icono nombre={a.superficie} size={24} trazo={1.5} /></span>
          <span class="dato"><strong>{a.nombre}</strong><span>{resumen(a)}</span></span>
          {#if a.croquis}<span class="etiqueta-mapa" title="Dibujado en el croquis"><Icono nombre="mapa" size={16} /></span>{/if}
          <span class="chevron"><Icono nombre="derecha" size={20} /></span>
        </button>
        <button class="hoy" class:activo={deHoy} aria-pressed={deHoy} onclick={() => alternarHoy(a.id)}
          aria-label={deHoy ? `Quitar ${a.nombre} de hoy` : `Asignar ${a.nombre} para hoy`}>
          <Icono nombre="hoy" size={20} />Hoy
        </button>
        </div>
      {:else}
        <p class="vacio">Todavía no hay lugares. Agrega el primero o dibújalo en el croquis.</p>
      {/each}
    </div>

    <div class="pie">
      {#if paginas > 1}
        <button class="boton secundario flecha" onclick={() => pagina--} disabled={pagina === 0} aria-label="Anteriores">
          <Icono nombre="izquierda" size={22} />
        </button>
        <span class="pagina">{pagina + 1} / {paginas}</span>
        <button class="boton secundario flecha" onclick={() => pagina++} disabled={pagina === paginas - 1} aria-label="Siguientes">
          <Icono nombre="derecha" size={22} />
        </button>
      {/if}
    </div>
    <div class="acciones">
      <button class="boton secundario" onclick={nuevoDictado}>
        <Icono nombre={hayVoz ? 'microfono' : 'lista'} size={20} />
        {hayVoz ? 'Dictar' : 'Describir'}
      </button>
      <button class="boton" onclick={() => abrir(null)}>
        <Icono nombre="mas" size={20} />
        Agregar lugar
      </button>
    </div>
  {:else}
    <div class="visor tarjeta">
      {#if c}
        <svg bind:this={svg} role="application" aria-label="Croquis del edificio" viewBox="0 0 {c.ancho} {c.alto}" preserveAspectRatio="xMidYMid meet" class:dibujando={modo !== 'ver'}
          onpointerdown={bajar} onpointermove={mover} onpointerup={soltar} onpointercancel={() => (trazo = null)}>
          <image href={c.imagen} width={c.ancho} height={c.alto} />
          {#each conCroquis as a (a.id)}
            {@const k = CATEGORIAS[a.superficie]}
            <g class="cuarto" role="button" tabindex="0" aria-label="Editar {a.nombre}"
              onclick={() => modo === 'ver' && abrir(a)} onkeydown={(e) => e.key === 'Enter' && abrir(a)}>
              <rect x={a.croquis.x} y={a.croquis.y} width={a.croquis.w} height={a.croquis.h} fill={k.orbe} fill-opacity="0.18" stroke={k.orbe} stroke-width={c.ancho / 250} rx={c.ancho / 200} />
              <text x={a.croquis.x + a.croquis.w / 2} y={a.croquis.y + a.croquis.h / 2} text-anchor="middle" font-size={c.ancho / 36} font-weight="800" fill={k.orbe}>{a.nombre}</text>
              <text x={a.croquis.x + a.croquis.w / 2} y={a.croquis.y + a.croquis.h / 2 + c.ancho / 30} text-anchor="middle" font-size={c.ancho / 46} fill="#33413a">{a.area_m2} m²</text>
            </g>
          {/each}
          {#if trazo}
            {#if modo === 'escala'}
              <line x1={trazo.x1} y1={trazo.y1} x2={trazo.x2} y2={trazo.y2} stroke="#C2410C" stroke-width={c.ancho / 200} stroke-dasharray="{c.ancho / 80} {c.ancho / 120}" />
            {:else}
              <rect x={Math.min(trazo.x1, trazo.x2)} y={Math.min(trazo.y1, trazo.y2)} width={Math.abs(trazo.x2 - trazo.x1)} height={Math.abs(trazo.y2 - trazo.y1)}
                fill="#22985A" fill-opacity="0.2" stroke="#1A7A49" stroke-width={c.ancho / 250} stroke-dasharray="{c.ancho / 80} {c.ancho / 120}" />
              {#if c.mpp}
                <text x={(trazo.x1 + trazo.x2) / 2} y={(trazo.y1 + trazo.y2) / 2} text-anchor="middle" font-size={c.ancho / 30} font-weight="800" fill="#0B3D2A">
                  {Math.round(Math.abs(trazo.x2 - trazo.x1) * Math.abs(trazo.y2 - trazo.y1) * c.mpp ** 2)} m²
                </text>
              {/if}
            {/if}
          {/if}
        </svg>
      {:else}
        <div class="sin-plano">
          <Icono nombre="mapa" size={44} />
          <p>Sube una foto del croquis del edificio. Marca una medida conocida y dibuja cada cuarto: los m² salen solos.</p>
          {#if errorPlano}<p class="error">{errorPlano}</p>{/if}
          <button class="boton secundario" onclick={() => (db.croquis = planoEjemplo())}>Usar plano de ejemplo</button>
        </div>
      {/if}
    </div>

    <p class="ayuda">{ayuda}</p>
    <div class="herramientas">
      <label class="boton secundario herramienta">
        <input type="file" accept="image/*" onchange={subir} />
        <Icono nombre="subir" size={20} />
        Subir plano
      </label>
      <button class="boton herramienta" class:secundario={modo !== 'escala'} disabled={!c} onclick={() => (modo = modo === 'escala' ? 'ver' : 'escala')}>
        <Icono nombre="regla" size={20} />
        Escala
      </button>
      <button class="boton herramienta" class:secundario={modo !== 'dibujar'} disabled={!c?.mpp} onclick={() => (modo = modo === 'dibujar' ? 'ver' : 'dibujar')}>
        <Icono nombre="cuadro" size={20} />
        Dibujar
      </button>
    </div>
  {/if}

  {#if escala}
    <form class="hoja chica" onsubmit={fijarEscala}>
      <h2>¿Cuánto mide esa línea?</h2>
      <label class="campo">Metros reales
        <input type="number" min="0.1" step="0.1" inputmode="decimal" bind:value={metros} />
      </label>
      <div class="botones">
        <button type="button" class="boton secundario" onclick={() => (escala = null)}>Cancelar</button>
        <button type="submit" class="boton">Fijar escala</button>
      </div>
    </form>
  {/if}

  {#if hoja}
    <form class="hoja" onsubmit={guardar}>
      <div class="hoja-cabeza">
        <h2>{hoja.id ? 'Editar lugar' : 'Nuevo lugar'}</h2>
        <button type="button" class="cerrar" onclick={() => { oyente?.stop(); hoja = null; }} aria-label="Cerrar">
          <Icono nombre="cerrar" size={22} />
        </button>
      </div>

      <div class="describir" class:oyendo={escuchando}>
        <input value={descripcion} oninput={(e) => aplicar(e.currentTarget.value)} placeholder="Describe: baño 2do piso, 25 m², muy sucio" aria-label="Describir el lugar" />
        {#if hayVoz}
          <button type="button" class="mic" class:activo={escuchando} onclick={dictar} aria-label={escuchando ? 'Dejar de dictar' : 'Dictar'}>
            <Icono nombre="microfono" size={20} />
          </button>
        {/if}
      </div>

      <div class="dos">
        <label class="campo">Nombre <input bind:value={hoja.form.nombre} placeholder="Baño 2do piso" required /></label>
        <label class="campo m2">m² <input type="number" min="1" step="1" inputmode="numeric" bind:value={hoja.form.area_m2} required /></label>
      </div>

      <div class="tipos" role="radiogroup" aria-label="Qué se limpia">
        {#each Object.entries(SUPERFICIES) as [k, s]}
          <label class="tipo" class:activo={hoja.form.superficie === k}>
            <input type="radio" bind:group={hoja.form.superficie} value={k} />
            <Icono nombre={k} size={26} trazo={1.5} />
            <span>{s.nombre}</span>
          </label>
        {/each}
      </div>

      <span class="leyenda">Zona (color del balde y del paño)</span>
      <div class="zonas" role="radiogroup" aria-label="Zona de color">
        {#each Object.entries(ZONAS) as [k, z]}
          <label class="zona-op" class:activo={hoja.form.zona === k} style="--zc:{z.color}">
            <input type="radio" bind:group={hoja.form.zona} value={k} /><span class="muestra"></span>{z.nombre}
          </label>
        {/each}
      </div>

      <span class="leyenda">¿Qué tan sucio suele estar?</span>
      <div class="suciedad" role="radiogroup" aria-label="Qué tan sucio suele estar">
        {#each Object.entries(SUCIEDAD) as [k, s]}
          <label class="nivel" class:activo={hoja.form.suciedad === k} style="--c:{SUCIEDAD_COLOR[k]}">
            <input type="radio" bind:group={hoja.form.suciedad} value={k} />{s.nombre}
          </label>
        {/each}
      </div>

      {#if vista}
        <p class="linea-dosis"><strong>Por carga:</strong> {ml(vista.porCarga.agua_ml)} de agua + {ml(vista.porCarga.quimico_ml)} de producto{vista.cargas > 1 ? `, ${vista.cargas} cargas` : ''}</p>
        <div class="etiqueta">
          <Ficha
            titulo="Dosis por carga"
            subtitulo="{PRODUCTOS[vista.producto].nombre}, mezcla 1 : {vista.dilucion}"
            filas={[
              { k: 'Agua', v: ml(vista.porCarga.agua_ml), fuerte: true },
              { k: 'Producto', v: ml(vista.porCarga.quimico_ml), fuerte: true },
              { k: `Cargas (${RECIPIENTES[vista.recipiente].nombre.toLowerCase()})`, v: `${vista.cargas}`, regla: 'media' },
            ]}
          />
        </div>
      {/if}

      <div class="botones">
        {#if hoja.id}<button type="button" class="boton secundario borrar" onclick={borrar}>Borrar</button>{/if}
        <button type="submit" class="boton">Guardar</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .lugares { position: relative; height: 100%; display: flex; flex-direction: column; gap: 10px; }

  .pestañas { flex: none; display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 14px; background: #e3ebe6; }
  .pestañas button {
    display: flex; align-items: center; justify-content: center; gap: 6px; height: 42px; border: 0; border-radius: 10px;
    background: none; cursor: pointer; font-weight: 700; color: var(--tinta-suave);
  }
  .pestañas button.activa { background: #fff; color: var(--verde-700); box-shadow: 0 1px 3px rgb(11 61 42 / 0.15); }

  .lista { flex: 1; min-height: 0; padding: 0 12px; }
  .fila-caja { display: flex; align-items: stretch; border-bottom: 1px solid var(--linea); }
  .fila-caja .fila { border-bottom: 0; }
  .hoy {
    flex: none; align-self: center; display: flex; align-items: center; gap: 4px; height: 40px; padding: 0 10px; margin-left: 6px;
    border: 1px solid var(--linea); border-radius: 999px; background: #fff; color: var(--tinta-suave); font-weight: 600; font-size: 0.85rem; cursor: pointer;
  }
  .hoy.activo { background: var(--verde-600); border-color: var(--verde-600); color: #fff; }
  .zonas { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .zona-op {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; cursor: pointer;
    border: 1.5px solid var(--linea); font-size: 0.85rem; font-weight: 600; color: var(--tinta);
  }
  .zona-op .muestra { flex: none; width: 14px; height: 14px; border-radius: 4px; background: var(--zc); }
  .zona-op.activo { border-color: var(--zc); background: color-mix(in srgb, var(--zc) 8%, white); }
  .zona-op:has(input:focus-visible) { outline: 3px solid var(--agua); }
  .fila {
    position: relative; overflow: hidden; width: 100%; display: flex; align-items: center; gap: 12px; padding: 0 2px;
    border: 0; border-bottom: 1px solid var(--linea); background: none; cursor: pointer; text-align: left;
  }
  .dato { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .dato strong { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dato span { font-size: 0.82rem; color: var(--tinta-suave); }
  .azulejo {
    flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 8px;
    background: var(--verde-50); color: var(--verde-700);
  }
  .etiqueta-mapa { color: var(--agua); display: grid; }
  .chevron { color: #9fb0a8; flex: none; }
  .vacio { color: var(--tinta-suave); text-align: center; padding: 24px 8px; }

  .pie { flex: none; display: flex; align-items: center; justify-content: center; gap: 16px; min-height: 0; }
  .pie:empty { display: none; }
  .flecha { width: 56px; height: 42px; display: grid; place-items: center; }
  .pagina { font-weight: 700; color: var(--tinta-suave); font-size: 0.9rem; }
  .acciones { flex: none; display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; }
  .acciones .boton, .herramienta { height: 50px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.98rem; }

  .visor { flex: 1; min-height: 0; display: grid; place-items: center; padding: 6px; background: #fbfcfb; }
  .visor > svg { width: 100%; height: 100%; touch-action: none; }
  .visor > svg.dibujando { cursor: crosshair; }
  .cuarto { cursor: pointer; }
  .sin-plano { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 16px; max-width: 32ch; }
  .sin-plano p { margin: 0; color: var(--tinta-suave); line-height: 1.45; }
  .error { color: var(--alerta) !important; font-weight: 600; }
  .ayuda { flex: none; margin: 0; min-height: 1.3em; font-size: 0.88rem; font-weight: 600; color: var(--verde-700); text-align: center; }
  .herramientas { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .herramienta { padding: 0 6px; font-size: 0.88rem; cursor: pointer; }
  .herramienta input { position: absolute; opacity: 0; width: 0; height: 0; }

  /* Hoja: cubre toda el área de trabajo; su contenido se acomoda al alto disponible. */
  .hoja {
    position: absolute; inset: 0; z-index: 2; container-type: size;
    display: flex; flex-direction: column; gap: 10px; padding: 14px;
    background: #fff; border-radius: 18px; border: 1px solid var(--linea); box-shadow: 0 20px 40px rgb(11 61 42 / 0.2);
  }
  .hoja.chica { inset: auto 0 0 0; container-type: normal; }
  .hoja-cabeza { flex: none; display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--verde-900); }
  .cerrar { width: 40px; height: 40px; border: 0; border-radius: 10px; background: var(--verde-50); display: grid; place-items: center; cursor: pointer; }

  .describir { flex: none; display: flex; align-items: center; gap: 6px; padding: 4px 4px 4px 12px; border-radius: 12px; background: var(--verde-50); border: 1.5px dashed #a9cdb8; }
  .describir.oyendo { border-style: solid; border-color: var(--alerta); }
  .describir input { flex: 1; min-width: 0; border: 0; background: none; outline: none; font-size: 0.9rem; padding: 8px 0; }
  .mic { position: relative; width: 40px; height: 40px; border-radius: 10px; border: 0; display: grid; place-items: center; cursor: pointer; color: #fff; background: var(--verde-600); }
  .mic.activo { background: var(--alerta); }

  .dos { flex: none; display: grid; grid-template-columns: 1fr 84px; gap: 8px; }
  .campo { display: flex; flex-direction: column; gap: 3px; font-weight: 700; font-size: 0.8rem; color: var(--tinta-suave); }
  .campo input { height: 44px; padding: 0 12px; border-radius: 10px; font-size: 1rem; font-weight: 600; color: var(--tinta); border: 1.5px solid var(--linea); background: #fff; }
  .campo input:focus { border-color: var(--verde-500); outline: none; }

  input[type='radio'] { position: absolute; opacity: 0; pointer-events: none; }
  .tipos { flex: none; display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
  .tipo { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--verde-700); padding: 6px 1px; border-radius: 10px; cursor: pointer; font-size: 0.72rem; font-weight: 700; border: 1.5px solid var(--linea); }
  .tipo.activo { border-color: var(--verde-600); background: var(--verde-50); }
  .tipo:has(input:focus-visible), .nivel:has(input:focus-visible) { outline: 3px solid var(--agua); }
  .leyenda { flex: none; margin-bottom: -4px; font-weight: 600; font-size: 0.8rem; color: var(--tinta-suave); }
  .suciedad { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .nivel { text-align: center; padding: 9px 2px; border-radius: 10px; cursor: pointer; font-size: 0.92rem; font-weight: 700; border: 1.5px solid var(--linea); color: var(--tinta-suave); }
  .nivel.activo { border-color: var(--c); color: #fff; background: var(--c); }

  .etiqueta { flex: 1; min-height: 0; display: none; align-items: center; justify-content: center; overflow: hidden; }
  .linea-dosis { flex: none; margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--verde-50); font-size: 0.88rem; color: var(--verde-900); }
  @container (min-height: 560px) {
    .etiqueta { display: flex; }
    .linea-dosis { display: none; }
  }
  .etiqueta :global(.ficha) { width: min(100%, 270px); }
  
  .botones { flex: none; display: flex; gap: 8px; margin-top: auto; }
  .botones .boton { flex: 1; height: 50px; font-size: 1rem; }
  .borrar { color: var(--alerta) !important; flex: 0 0 auto !important; padding: 0 18px; }
</style>
