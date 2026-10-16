<script>
  import Icono from '../components/Icono.svelte';
  // Pantalla del dispensador para quien limpia.
  // Toca su lugar, pone el recipiente debajo y presiona Llenar (relé 30 s). Una orden a la vez.
  // Nunca hay scroll ni botones de más. Al terminar vuelve sola al inicio.
  import { db, ui } from '../lib/store.svelte.js';
  import { calcularDosis, RECIPIENTES } from '../lib/dosis.js';
  import { llenar, LLENAR_SEG, Ocupado } from '../lib/smartdose.js';
  import { CATEGORIAS, ZONAS, zonaDe, colorDe, palabraColor } from '../lib/ui.js';
  import { buscarLugar, crearOyente } from '../lib/intencion.js';
  import Orbe from '../components/Orbe.svelte';
  import Recipiente from '../components/Recipiente.svelte';

  const ALTO_FILA = 62; // mínimo cómodo para el dedo
  const VOLVER_EN = 6;

  let area = $state(null);
  let paso = $state('preparar'); // preparar | llenando | listo | ocupado | error
  let esperaOcupado = $state(0);  // segundos que le faltan al otro llenado
  let carga = $state(1);
  let progreso = $state(0);
  let cuenta = $state(VOLVER_EN);
  let total = $state(VOLVER_EN);

  // ── Rejilla sin scroll: caben las que caben; el resto en páginas con flechas grandes.
  let rejilla = $state();
  let filas = $state(4);
  let altoCaja = $state(0);
  let pagina = $state(0);
  let filtro = $state(null); // ids sugeridos por voz
  $effect(() => {
    if (!rejilla) return;
    const medir = () => {
      altoCaja = rejilla.getBoundingClientRect().height;
      filas = Math.max(1, Math.floor(altoCaja / ALTO_FILA));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(rejilla);
    addEventListener('resize', medir);
    return () => { ro.disconnect(); removeEventListener('resize', medir); };
  });
  // Agrupadas por zona de color (código de la industria): el ojo encuentra su grupo sin leer.
  const ORDEN_ZONA = ['sanitario', 'lavabo', 'general', 'cocina'];
  const ordenadas = $derived(
    db.areas.map((a, i) => ({ a, i, z: ORDEN_ZONA.indexOf(zonaDe(a)) }))
      .sort((x, y) => x.z - y.z || x.i - y.i)
      .map((x) => x.a)
  );

  // ── "Hoy te toca": pocos lugares grandes arriba (ley de Hick), el resto agrupado abajo.
  let modo = $state('hoy'); // hoy | todos
  const asignados = $derived((db.hoy ?? []).map((id) => db.areas.find((a) => a.id === id)).filter(Boolean));
  const usarHoy = $derived(modo === 'hoy' && asignados.length > 0 && !filtro);
  const esHoy = (iso) => new Date(iso).toDateString() === new Date().toDateString();
  // El estado se calcula solo con lo dispensado hoy: nadie tiene que marcarlo.
  const estado = (a) => (db.pendientes[a.id] ? 'falta' : db.historial.some((h) => h.areaId === a.id && esHoy(h.fecha)) ? 'listo' : 'pendiente');
  const listos = $derived(asignados.filter((a) => estado(a) === 'listo').length);
  const altoAsignado = $derived(asignados.length > 3 ? 72 : 84);

  let cajaOtros = $state();
  let altoOtros = $state(0);
  $effect(() => {
    if (!cajaOtros) return;
    // Medición inmediata + al cambiar tamaño: no depende solo de ResizeObserver.
    const medir = () => (altoOtros = cajaOtros.getBoundingClientRect().height);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cajaOtros);
    addEventListener('resize', medir);
    return () => { ro.disconnect(); removeEventListener('resize', medir); };
  });
  // Mete en la pantalla tantos "otros" como quepan; si no caben todos, ofrece "Ver todos".
  const ETIQUETA = 30, BOTON = 53, ESP = 10, TITULO = 26, MAS = 52;
  const otros = $derived.by(() => {
    const resto = ordenadas.filter((a) => !(db.hoy ?? []).includes(a.id));
    const grupos = ORDEN_ZONA.map((z) => ({ z, items: resto.filter((a) => zonaDe(a) === z) })).filter((g) => g.items.length);
    const necesario = TITULO + grupos.reduce((t, g) => t + ETIQUETA + Math.ceil(g.items.length / 2) * (BOTON + ESP), 0);
    let h = altoOtros - TITULO;
    const cortado = necesario > altoOtros;
    if (cortado) h -= MAS + ESP;
    const visiblesOtros = [];
    for (const g of grupos) {
      if (h < ETIQUETA + BOTON) break;
      h -= ETIQUETA;
      const f = Math.min(Math.floor((h + ESP) / (BOTON + ESP)), Math.ceil(g.items.length / 2));
      visiblesOtros.push({ z: g.z, items: g.items.slice(0, f * 2) });
      h -= f * (BOTON + ESP);
    }
    return { grupos: visiblesOtros, cortado, hay: resto.length > 0 };
  });
  const lista = $derived(filtro ? ordenadas.filter((a) => filtro.includes(a.id)) : ordenadas);
  const paginas = $derived(Math.max(1, Math.ceil(lista.length / filas)));
  const visibles = $derived(lista.slice(pagina * filas, (pagina + 1) * filas));
  $effect(() => { if (pagina > paginas - 1) pagina = paginas - 1; });
  // Si sobra espacio, las filas crecen un poco (blanco más grande), sin pasar de 84 px.
  const alto = $derived(Math.min(84, Math.max(ALTO_FILA, altoCaja / Math.max(1, visibles.length))));

  // ── Dosis del lugar elegido
  const dosis = $derived(area ? calcularDosis(area) : null);
  const cat = $derived(area ? CATEGORIAS[area.superficie] : null);
  const capacidad = $derived(dosis ? RECIPIENTES[dosis.recipiente].capacidad : 1);
  const zona = $derived(area ? ZONAS[zonaDe(area)] : ZONAS.general);
  const colorRec = $derived(zona.color);
  const objetivo = $derived(dosis ? (dosis.porCarga.agua_ml + dosis.porCarga.quimico_ml) / capacidad : 0);
  const nivel = $derived(paso === 'llenando' ? progreso * objetivo : paso === 'listo' ? objetivo : 0);
  const faltan = $derived(dosis ? dosis.cargas - carga : 0);

  $effect(() => {
    ui.enfoque = !!area;
    return () => (ui.enfoque = false);
  });

  // ── Vuelve sola al inicio al terminar (o tras un error, con más tiempo para leerlo).
  $effect(() => {
    if (!area || paso === 'llenando') return;
    // Si falta otra carga, más tiempo para leer el aviso.
    cuenta = paso === 'listo' ? (faltan > 0 ? 10 : VOLVER_EN) : paso === 'preparar' ? 30 : 20;
    total = cuenta;
    const i = setInterval(() => { if (--cuenta <= 0) inicio(); }, 1000);
    return () => clearInterval(i);
  });

  function hablar(texto) {
    if (!db.voz || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-ES';
    speechSynthesis.speak(u);
  }

  function elegir(a) {
    if (ui.ocupado) return;
    const d = calcularDosis(a);
    const pend = db.pendientes[a.id];
    area = a;
    filtro = null;
    carga = pend && pend < d.cargas ? d.cargas - pend + 1 : 1;
    paso = 'preparar';
    progreso = 0;
    hablar('Pon tu recipiente debajo y presiona Llenar.');
  }

  async function llenarAhora(e) {
    e?.stopPropagation();
    if (ui.ocupado || !area) return; // doble toque: la segunda vez no hace nada
    const a = area;
    const d = calcularDosis(a);
    ui.ocupado = true;
    paso = 'llenando';
    progreso = 0;
    hablar('Llenando. No lo muevas.');
    try {
      await llenar(db.dispositivo, LLENAR_SEG, (p) => (progreso = p));
      db.historial.push({
        fecha: new Date().toISOString(),
        areaId: a.id,
        agua_ml: d.porCarga.agua_ml,
        quimico_ml: d.porCarga.quimico_ml,
        base_agua_ml: d.lineaBase.agua_ml / d.cargas,
        base_quimico_ml: d.lineaBase.quimico_ml / d.cargas,
      });
      const resto = d.cargas - carga;
      if (resto > 0) db.pendientes[a.id] = resto;
      else delete db.pendientes[a.id];
      paso = 'listo';
      hablar(resto > 0 ? 'Listo. Cuando se acabe, vuelve por más.' : 'Listo. Ya puedes ir a limpiar.');
    } catch (err) {
      if (err instanceof Ocupado) {
        esperaOcupado = Math.ceil((err.restaMs ?? 0) / 1000);
        paso = 'ocupado';
        hablar('La máquina está llenando otro recipiente. Espera.');
      } else {
        paso = 'error';
        hablar('La máquina no respondió. Avisa a tu supervisor.');
      }
    } finally {
      ui.ocupado = false;
    }
  }

  function inicio() {
    if (ui.ocupado) return;
    area = null;
    modo = 'hoy';
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // ── Modo voz: "voy a limpiar el baño del segundo piso"
  let escuchando = $state(false);
  let oido = $state('');
  let oyente = null;
  const hayVoz = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  function escuchar() {
    if (escuchando) { oyente?.stop(); return; }
    oido = '';
    filtro = null;
    let final = '';
    oyente = crearOyente({
      alEscuchar: (t, esFinal) => { oido = t; if (esFinal) final = t; },
      alError: () => {},
      alTerminar: () => {
        escuchando = false;
        const texto = final || oido;
        if (!texto) return;
        const { candidatos, seguro } = buscarLugar(texto, db.areas);
        if (seguro) elegir(candidatos[0].area);
        else if (candidatos.length) {
          filtro = candidatos.slice(0, 4).map((c) => c.area.id);
          pagina = 0;
          hablar('¿Cuál de estos? Tócalo.');
        } else hablar('No te entendí. Toca tu lugar.');
      },
    });
    escuchando = true;
    oyente.start();
  }

</script>

{#if !area && usarHoy}
  <div class="inicio">
    <div class="titulo-inicio">
      <div class="titulos">
        <h1 class="pregunta">Hoy te toca</h1>
        <span class="avance-dia" aria-label="{listos} de {asignados.length} lugares listos">
          <span class="medidor" aria-hidden="true">
            {#each asignados as a (a.id)}<span class:lleno={estado(a) === 'listo'}></span>{/each}
          </span>
          {listos} de {asignados.length} listos
        </span>
      </div>
      {#if hayVoz}
        <button class="mic" class:activo={escuchando} onclick={escuchar} aria-label={escuchando ? 'Dejar de escuchar' : 'Decir el lugar en voz alta'}>
          <Icono nombre="microfono" size={24} />
        </button>
      {/if}
    </div>

    {#if escuchando}
      <div class="voz-estado"><span>{oido || 'Te escucho. Di dónde vas a limpiar.'}</span></div>
    {/if}

    <div class="asignados">
      {#each asignados as a (a.id)}
        {@const d = calcularDosis(a)}
        {@const e = estado(a)}
        {@const z = ZONAS[zonaDe(a)]}
        <button class="tecla asignado" class:hecho={e === 'listo'} style="--c:{z.color}; --t:{z.tinta}; height:{altoAsignado}px" onclick={() => elegir(a)}
          aria-label="{a.nombre}. Trae {RECIPIENTES[d.recipiente].nombre.toLowerCase()} {palabraColor(zonaDe(a), d.recipiente)}.{e === 'listo' ? ' Ya está listo.' : ''}">
          <span class="disco"><Icono nombre={d.recipiente} size={30} trazo={2} /></span>
          <span class="texto">
            <span class="nombre-grande">{a.nombre}</span>
            <span class="sub">{RECIPIENTES[d.recipiente].nombre} {palabraColor(zonaDe(a), d.recipiente)}</span>
          </span>
          {#if e === 'listo'}
            <span class="hecho-marca"><Icono nombre="check" size={20} trazo={2.6} />Listo</span>
          {:else if e === 'falta'}
            <span class="falta">Falta {db.pendientes[a.id]}</span>
          {:else}
            <span class="chev"><Icono nombre="derecha" size={26} trazo={2.2} /></span>
          {/if}
        </button>
      {/each}
    </div>

    <div class="otros" bind:this={cajaOtros}>
      {#if otros.hay}
        <p class="otros-titulo">Otros lugares</p>
        {#each otros.grupos as g (g.z)}
          <p class="zona">{ZONAS[g.z].nombre}</p>
          <div class="rejilla-otros">
            {#each g.items as a (a.id)}
              {@const d = calcularDosis(a)}
              <button class="tecla otro" style="--c:{ZONAS[g.z].color}; --t:{ZONAS[g.z].tinta}" onclick={() => elegir(a)}
                aria-label="{a.nombre}. Trae {RECIPIENTES[d.recipiente].nombre.toLowerCase()} {palabraColor(g.z, d.recipiente)}.">
                <span class="cuadro chico-cuadro"><Icono nombre={d.recipiente} size={20} trazo={2} /></span>
                <span class="nombre-otro">{a.nombre}</span>
              </button>
            {/each}
          </div>
        {/each}
        {#if otros.cortado}
          <button class="boton secundario ver-todos" onclick={() => (modo = 'todos')}>
            <Icono nombre="lista" size={22} /> Ver todos los lugares
          </button>
        {/if}
      {/if}
    </div>
  </div>
{:else if !area}
  <div class="inicio">
    <div class="titulo-inicio">
      <h1 class="pregunta">{asignados.length && !filtro ? 'Todos los lugares' : 'Toca tu lugar'}</h1>
      {#if asignados.length && !filtro}
        <button class="boton secundario volver-hoy" onclick={() => (modo = 'hoy')}>
          <Icono nombre="izquierda" size={22} /> Hoy
        </button>
      {:else if hayVoz}
        <button class="mic" class:activo={escuchando} onclick={escuchar} aria-label={escuchando ? 'Dejar de escuchar' : 'Decir el lugar en voz alta'}>
          <Icono nombre="microfono" size={24} />
        </button>
      {/if}
    </div>

    {#if escuchando || filtro}
      <div class="voz-estado">
        {#if escuchando}
          <span>{oido || 'Te escucho. Di dónde vas a limpiar.'}</span>
        {:else}
          <span>Encontré estos lugares</span>
          <button class="boton secundario chico" onclick={() => (filtro = null)}>Ver todos</button>
        {/if}
      </div>
    {/if}

    <div class="lista" bind:this={rejilla}>
      {#each visibles as l (l.id)}
        {@const d = calcularDosis(l)}
        {@const z = ZONAS[zonaDe(l)]}
        <button class="fila" style="height:{alto}px" onclick={() => elegir(l)}
          aria-label="{l.nombre}. Trae {RECIPIENTES[d.recipiente].nombre.toLowerCase()} {palabraColor(zonaDe(l), d.recipiente)}.">
          <span class="cuadro" style="--c:{z.color}; --t:{z.tinta}"><Icono nombre={d.recipiente} size={24} trazo={2} /></span>
          <span class="nombre">{l.nombre}</span>
          {#if db.pendientes[l.id]}<span class="falta">Falta {db.pendientes[l.id]}</span>{/if}
          <span class="chev"><Icono nombre="derecha" size={22} /></span>
        </button>
      {:else}
        <p class="vacio">Todavía no hay lugares. El supervisor los agrega en Lugares.</p>
      {/each}
    </div>

    {#if paginas > 1}
      <div class="paginador">
        <button class="boton secundario flecha" onclick={() => pagina--} disabled={pagina === 0} aria-label="Lugares anteriores">
          <Icono nombre="izquierda" size={28} />
        </button>
        <span class="puntos" aria-label="Página {pagina + 1} de {paginas}">
          {#each Array(paginas) as _, i}<span class:actual={i === pagina}></span>{/each}
        </span>
        <button class="boton secundario flecha" onclick={() => pagina++} disabled={pagina === paginas - 1} aria-label="Más lugares">
          <Icono nombre="derecha" size={28} />
        </button>
      </div>
    {/if}
  </div>
{:else}
  <!-- Tocar en cualquier parte cuando ya terminó = volver antes. -->
  <div class="dispensar" onclick={() => (paso === 'listo' || paso === 'error') && inicio()} role="presentation">
    <div class="cabeza">
      <h1>{area.nombre}</h1>
      <span class="trae" style="--c:{colorRec}; --t:{zona.tinta}"><Icono nombre={dosis.recipiente} size={20} trazo={2.2} />{RECIPIENTES[dosis.recipiente].nombre} {palabraColor(zonaDe(area), dosis.recipiente)}</span>
      {#if dosis.cargas > 1}
        <span class="cargas" aria-label="Carga {carga} de {dosis.cargas}">
          {#each Array(dosis.cargas) as _, i}
            <span class="mini" class:llena={i < carga - 1 || (i === carga - 1 && paso === 'listo')} class:actual={i === carga - 1}></span>
          {/each}
          <span class="cargas-txt">Carga {carga} de {dosis.cargas}</span>
        </span>
      {/if}
    </div>

    <div class="escena" class:fluye={paso === 'llenando'} style="--liquido:{cat.liquido}">
      <svg class="boquilla" viewBox="0 0 120 54" aria-hidden="true">
        <rect x="20" y="1" width="80" height="20" rx="4" fill="#E3E8EB" stroke="#14202B" stroke-width="2" />
        <path d="M49 21 h22 l-3 21 h-16 z" fill="#E3E8EB" stroke="#14202B" stroke-width="2" stroke-linejoin="round" />
        <rect x="51" y="42" width="18" height="7" rx="1.5" fill="#14202B" />
        <circle cx="32" cy="11" r="3.5" fill={paso === 'llenando' ? '#0096C7' : '#B4BEC5'} />
      </svg>
      <div class="chorro" aria-hidden="true"></div>
      <div class="vaso">
        <Recipiente tipo={dosis.recipiente} {nivel} {objetivo} liquido={cat.liquido} color={colorRec} abierto />
        {#if paso === 'error'}
          <div class="sello">
            <Orbe color="#C2410C" glifo="alerta" size={92} />
          </div>
        {/if}
      </div>
    </div>

    <div class="estado" aria-live="polite">
      {#if paso === 'preparar'}
        <button class="tecla llenar" onclick={llenarAhora}>
          <Icono nombre="gota" size={30} trazo={2.2} /> Llenar
        </button>
        <button class="volver-lugar" onclick={(e) => { e.stopPropagation(); inicio(); }}>
          <Icono nombre="izquierda" size={20} /> Elegir otro lugar
        </button>
      {:else if paso === 'llenando'}
        <div class="cuenta-llenado">
          <span class="numero">{Math.max(0, Math.ceil(LLENAR_SEG * (1 - progreso)))}</span><span class="unidad">s</span>
          <span class="cuenta-txt">Llenando.<br />No lo muevas.</span>
        </div>
        <div class="barra-avance" role="progressbar" aria-valuenow={Math.round(progreso * 100)} aria-valuemin="0" aria-valuemax="100">
          <span style="width:{progreso * 100}%"></span>
        </div>
      {:else if paso === 'listo'}
        <p>Recipiente lleno</p>
      {:else if paso === 'ocupado'}
        <p>La máquina está llenando otro recipiente.{esperaOcupado ? ` Espera ${esperaOcupado} s.` : ''}</p>
        <button class="tecla reintentar" onclick={(e) => { e.stopPropagation(); paso = 'preparar'; }}>Intentar otra vez</button>
      {:else}
        <p>La máquina no respondió. Avisa a tu supervisor.</p>
        <button class="tecla reintentar" style="--c:var(--alerta)" onclick={(e) => { e.stopPropagation(); paso = 'preparar'; }}>Intentar otra vez</button>
      {/if}
    </div>
  </div>

  {#if paso === 'listo'}
    <div class="fondo-modal">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-titulo" aria-describedby="modal-texto">
        <span class="modal-check"><Icono nombre="check" size={44} trazo={2.6} /></span>
        <h2 id="modal-titulo">{faltan > 0 ? 'Primera carga lista' : 'Listo'}</h2>
        <p id="modal-texto">
          {faltan > 0 ? `Ya puedes ir a limpiar. Cuando se acabe, vuelve y toca ${area.nombre} otra vez.` : 'Ya puedes ir a limpiar.'}
        </p>
        <button class="tecla cerrar-modal" onclick={inicio}>Cerrar</button>
        <div class="barra-avance vuelta" aria-label="Se cierra solo en {cuenta} segundos"><span style="width:{(cuenta / total) * 100}%"></span></div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .inicio, .dispensar { height: 100%; display: flex; flex-direction: column; gap: 14px; }

  /* ── Encabezado */
  .titulo-inicio { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .titulos { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .pregunta { margin: 0; font-size: 2rem; font-weight: 800; line-height: 1; letter-spacing: -0.025em; color: var(--tinta); }
  .avance-dia { display: flex; align-items: center; gap: 8px; font-size: 0.95rem; font-weight: 600; color: var(--tinta-suave); }
  .medidor { display: flex; gap: 3px; }
  .medidor span { width: 18px; height: 6px; border-radius: 3px; background: var(--linea-fuerte); }
  .medidor span.lleno { background: var(--agua); }
  .mic {
    flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; cursor: pointer;
    border: 1.5px solid var(--linea); background: var(--blanco); color: var(--tinta);
  }
  .mic.activo { background: var(--alerta); border-color: var(--alerta); color: #fff; }
  .volver-hoy { flex: none; display: flex; align-items: center; gap: 4px; height: 48px; padding: 0 14px 0 8px; font-size: 1rem; }

  .voz-estado {
    flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--radio);
    background: var(--blanco); border: 1.5px solid var(--agua); color: var(--tinta); font-weight: 600; font-size: 0.95rem;
  }
  .voz-estado > span { flex: 1; }
  .chico { padding: 6px 12px; font-size: 0.85rem; }

  /* ── Teclas de hoy: el color de la zona ES la tecla. */
  .asignados { flex: none; display: flex; flex-direction: column; gap: 14px; padding-bottom: 4px; }
  .asignado { display: flex; align-items: center; gap: 14px; width: 100%; padding: 0 14px 0 12px; text-align: left; color: var(--t); }
  .disco {
    flex: none; display: grid; place-items: center; width: 50px; height: 50px; border-radius: 50%;
    background: rgb(255 255 255 / 0.95); color: var(--c);
  }
  .texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .nombre-grande { font-size: 1.3rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 1rem; font-weight: 600; opacity: 0.88; }
  .chev { flex: none; display: grid; opacity: 0.85; }
  /* Ya lleno hoy: la tecla queda "hundida" y blanca, con el color solo en el borde. */
  .asignado.hecho {
    background: var(--blanco); color: var(--tinta-suave); transform: translateY(4px);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--c) 45%, white);
  }
  .asignado.hecho .disco { background: var(--superficie-2); }
  .asignado.hecho .nombre-grande { color: var(--tinta); }
  .hecho-marca { flex: none; display: flex; align-items: center; gap: 4px; font-weight: 800; color: var(--agua-oscura); }
  .falta { flex: none; padding: 3px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 800; color: var(--tinta); background: var(--blanco); }

  /* ── Otros lugares: teclas chicas, agrupadas por zona. */
  .otros { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .otros-titulo { flex: none; margin: 2px 0 0; height: 24px; font-size: 1.05rem; font-weight: 800; color: var(--tinta); }
  .zona { flex: none; display: flex; align-items: center; height: 30px; margin: 0; font-size: 0.92rem; font-weight: 600; color: var(--tinta-suave); }
  .rejilla-otros { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  /* Otros: tecla blanca; el color de la zona queda solo en el cuadro del recipiente. */
  .otro {
    --radio-tecla: 10px;
    display: flex; align-items: center; gap: 10px; height: 50px; padding: 0 10px 0 8px; text-align: left; min-width: 0;
    background: var(--blanco); color: var(--tinta); box-shadow: 0 3px 0 #C9D2D8;
  }
  .chico-cuadro { width: 34px; height: 34px; border-radius: 8px; }
  .otro:active:not(:disabled) { transform: translateY(3px); box-shadow: none; }
  .nombre-otro {
    min-width: 0; font-size: 0.98rem; font-weight: 800; line-height: 1.15;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; hyphens: none;
  }
  .ver-todos { flex: none; height: 52px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1.05rem; margin-top: auto; }

  /* ── Todos los lugares */
  .lista {
    flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;
    background: var(--blanco); border: 1px solid var(--linea); border-radius: var(--radio-tecla);
  }
  .fila {
    flex: none; display: flex; align-items: center; gap: 14px; width: 100%; padding: 0 12px;
    border: 0; border-bottom: 1px solid var(--linea); background: none; cursor: pointer; text-align: left;
  }
  .fila:last-child { border-bottom: 0; }
  .fila:active { background: var(--superficie-2); }
  .cuadro { flex: none; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; background: var(--c); color: var(--t); }
  .nombre { flex: 1; min-width: 0; font-size: 1.2rem; font-weight: 800; color: var(--tinta); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fila .chev { color: var(--tinta-tenue); }
  .fila .falta { background: var(--superficie-2); }
  .vacio { margin: auto; padding: 16px; text-align: center; color: var(--tinta-suave); }

  .paginador { flex: none; display: flex; align-items: center; justify-content: space-between; }
  .flecha { width: 64px; height: 52px; display: grid; place-items: center; }
  .puntos { display: flex; gap: 8px; }
  .puntos span { width: 10px; height: 10px; border-radius: 50%; background: var(--linea-fuerte); }
  .puntos span.actual { background: var(--tinta); width: 26px; border-radius: 5px; }

  /* ── Llenado */
  .dispensar { cursor: default; }
  .cabeza { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
  h1 { flex: 1 1 100%; margin: 0; font-size: 1.75rem; line-height: 1.05; font-weight: 800; letter-spacing: -0.02em; color: var(--tinta); }
  .trae {
    display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px 6px 9px; border-radius: 999px;
    font-size: 1rem; font-weight: 800; color: var(--t); background: var(--c);
  }
  .cargas { display: flex; align-items: center; gap: 4px; }
  .mini { width: 14px; height: 14px; border-radius: 4px; border: 2px solid var(--tinta-tenue); }
  .mini.llena { background: var(--agua); border-color: var(--agua); }
  .mini.actual:not(.llena) { border-color: var(--tinta); }
  .cargas-txt { margin-left: 4px; font-size: 0.9rem; font-weight: 600; color: var(--tinta-suave); }

  .escena { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; }
  .boquilla { flex: none; width: 104px; height: auto; z-index: 1; }
  .chorro { position: absolute; top: 42px; left: 50%; height: 46%; width: 6px; margin-left: -3px; display: none; }
  .fluye .chorro {
    display: block;
    background: repeating-linear-gradient(to bottom, var(--liquido) 0 12px, color-mix(in srgb, var(--liquido) 55%, white) 12px 18px);
    animation: correr 0.5s linear infinite;
  }
  @keyframes correr { to { background-position: 0 18px; } }
  .vaso { position: relative; flex: 1; min-height: 0; width: 100%; display: flex; justify-content: center; }
  .vaso :global(svg.recipiente) { height: 100%; width: auto; max-width: 100%; }
  .sello { position: absolute; inset: 0; display: grid; place-items: center; animation: aparece 0.2s ease-out; }
  @keyframes aparece { from { transform: scale(0.6); opacity: 0; } }

  .estado { flex: none; display: flex; flex-direction: column; align-items: center; gap: 12px; min-height: 120px; justify-content: flex-end; }
  .estado p { margin: 0; text-align: center; font-size: 1.35rem; font-weight: 800; line-height: 1.2; color: var(--tinta); text-wrap: balance; }
  .llenar {
    width: 100%; height: 84px; display: flex; align-items: center; justify-content: center; gap: 10px;
    font-size: 2.1rem; font-weight: 800; letter-spacing: -0.01em;
  }
  .volver-lugar {
    display: flex; align-items: center; gap: 4px; border: 0; background: none; cursor: pointer;
    color: var(--tinta-suave); font-weight: 600; font-size: 1rem; padding: 6px 10px; border-radius: var(--radio);
  }
  /* La cuenta regresiva es lo único grande mientras llena. */
  .cuenta-llenado { width: 100%; display: flex; align-items: baseline; gap: 4px; }
  .numero { font-size: 4.2rem; font-weight: 800; line-height: 0.9; letter-spacing: -0.04em; color: var(--agua-oscura); }
  .unidad { font-size: 1.6rem; font-weight: 800; color: var(--agua-oscura); }
  .cuenta-txt { margin-left: auto; text-align: right; font-size: 1.15rem; font-weight: 800; line-height: 1.2; color: var(--tinta); }
  .barra-avance { width: 100%; height: 12px; border-radius: 6px; background: #DCE3E7; overflow: hidden; }
  .barra-avance span { display: block; height: 100%; border-radius: 6px; background: var(--agua); transition: width 0.3s linear; }
  .barra-avance.vuelta { height: 6px; }
  .barra-avance.vuelta span { background: var(--tinta-tenue); }
  .reintentar { width: 100%; height: 64px; font-size: 1.3rem; font-weight: 800; }

  .fondo-modal { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; padding: 20px; background: rgb(20 32 43 / 0.5); }
  .modal {
    width: 100%; max-width: 340px; display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 28px 22px 18px; border-radius: 18px; background: var(--blanco); text-align: center;
    box-shadow: 0 20px 50px rgb(20 32 43 / 0.3); animation: aparece 0.2s ease-out;
  }
  .modal-check { display: grid; place-items: center; width: 80px; height: 80px; border-radius: 50%; background: var(--agua); color: #fff; }
  .modal h2 { margin: 4px 0 0; font-size: 2rem; font-weight: 800; letter-spacing: -0.02em; color: var(--tinta); }
  .modal p { margin: 0; font-size: 1.2rem; line-height: 1.35; color: var(--tinta); text-wrap: balance; }
  .cerrar-modal { width: 100%; height: 64px; margin-top: 6px; font-size: 1.3rem; font-weight: 800; }
  .modal .barra-avance { margin-top: 6px; }

  @media (prefers-reduced-motion: reduce) {
    .fluye .chorro, .sello, .modal { animation: none; }
    .barra-avance span { transition: none; }
  }
</style>
