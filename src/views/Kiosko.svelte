<script>
  import Icono from '../components/Icono.svelte';
  // Pantalla del dispensador para quien limpia.
  // Un solo toque: pone su recipiente debajo, toca su lugar y la máquina hace todo.
  // Nunca hay scroll ni botones de más. Al terminar vuelve sola al inicio.
  import { db, ui } from '../lib/store.svelte.js';
  import { calcularDosis, RECIPIENTES } from '../lib/dosis.js';
  import { dispensar } from '../lib/smartdose.js';
  import { CATEGORIAS, ZONAS, zonaDe, colorDe, palabraColor } from '../lib/ui.js';
  import { buscarLugar, crearOyente } from '../lib/intencion.js';
  import Orbe from '../components/Orbe.svelte';
  import Recipiente from '../components/Recipiente.svelte';

  const ALTO_FILA = 62; // mínimo cómodo para el dedo
  const VOLVER_EN = 6;

  let area = $state(null);
  let paso = $state('llenando'); // llenando | listo | error
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
  const altoAsignado = $derived(asignados.length > 3 ? 70 : 84);

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
  const ETIQUETA = 30, BOTON = 52, ESP = 8, TITULO = 26, MAS = 52;
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
  const nivel = $derived(paso === 'llenando' ? progreso * objetivo : objetivo);
  const faltan = $derived(dosis ? dosis.cargas - carga : 0);

  $effect(() => {
    ui.enfoque = !!area;
    return () => (ui.enfoque = false);
  });

  // ── Vuelve sola al inicio al terminar (o tras un error, con más tiempo para leerlo).
  $effect(() => {
    if (!area || paso === 'llenando') return;
    // Si falta otra carga, más tiempo para leer el aviso.
    cuenta = paso === 'listo' ? (faltan > 0 ? 10 : VOLVER_EN) : 20;
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

  async function elegir(a) {
    const d = calcularDosis(a);
    const pend = db.pendientes[a.id];
    area = a;
    filtro = null;
    carga = pend && pend < d.cargas ? d.cargas - pend + 1 : 1;
    paso = 'llenando';
    progreso = 0;
    hablar('Llenando. No lo muevas.');
    try {
      await dispensar(d.porCarga, db.dispositivo, (p) => (progreso = p));
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
    } catch {
      paso = 'error';
      hablar('La máquina no respondió. Avisa a tu supervisor.');
    }
  }

  function inicio() {
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
        <span class="avance-dia" aria-label="{listos} de {asignados.length} lugares listos">{listos} de {asignados.length} listos</span>
      </div>
      {#if hayVoz}
        <button class="mic" class:activo={escuchando} onclick={escuchar} aria-label={escuchando ? 'Dejar de escuchar' : 'Decir el lugar en voz alta'}>
          <Icono nombre="microfono" size={24} />
        </button>
      {/if}
    </div>
    <p class="apoyo solo">Pon tu recipiente debajo y toca tu lugar.</p>

    {#if escuchando}
      <div class="voz-estado"><span>{oido || 'Te escucho. Di dónde vas a limpiar.'}</span></div>
    {/if}

    <div class="asignados">
      {#each asignados as a (a.id)}
        {@const d = calcularDosis(a)}
        {@const e = estado(a)}
        {@const z = ZONAS[zonaDe(a)]}
        <button class="asignado" class:hecho={e === 'listo'} style="--rc:{z.color}; height:{altoAsignado}px" onclick={() => elegir(a)}
          aria-label="{a.nombre}. Trae {RECIPIENTES[d.recipiente].nombre.toLowerCase()} {palabraColor(zonaDe(a), d.recipiente)}.{e === 'listo' ? ' Ya está listo.' : ''}">
          <span class="rec"><Icono nombre={d.recipiente} size={36} trazo={1.8} /></span>
          <span class="texto">
            <span class="nombre-grande">{a.nombre}</span>
            <span class="sub">{RECIPIENTES[d.recipiente].nombre} {palabraColor(zonaDe(a), d.recipiente)}</span>
          </span>
          {#if e === 'listo'}
            <span class="hecho-marca"><Icono nombre="check" size={22} trazo={2.4} />Listo</span>
          {:else if e === 'falta'}
            <span class="falta">Falta {db.pendientes[a.id]}</span>
          {:else}
            <span class="chev"><Icono nombre="derecha" size={24} /></span>
          {/if}
        </button>
      {/each}
    </div>

    <div class="otros" bind:this={cajaOtros}>
      {#if otros.hay}
        <p class="otros-titulo">Otros lugares</p>
        {#each otros.grupos as g (g.z)}
          <p class="zona" style="--rc:{ZONAS[g.z].color}"><span class="muestra"></span>{ZONAS[g.z].nombre}</p>
          <div class="rejilla-otros">
            {#each g.items as a (a.id)}
              {@const d = calcularDosis(a)}
              <button class="otro" style="--rc:{ZONAS[g.z].color}" onclick={() => elegir(a)}
                aria-label="{a.nombre}. Trae {RECIPIENTES[d.recipiente].nombre.toLowerCase()} {palabraColor(g.z, d.recipiente)}.">
                <span class="rec"><Icono nombre={d.recipiente} size={22} trazo={1.9} /></span>
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
      <div>
        <h1 class="pregunta">{asignados.length && !filtro ? 'Todos los lugares' : 'Toca tu lugar'}</h1>
        <p class="apoyo">Antes, pon tu recipiente debajo de la máquina.</p>
      </div>
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
        <button class="fila" style="--rc:{colorDe(l)}; height:{alto}px" onclick={() => elegir(l)}
          aria-label="{l.nombre}. Trae {RECIPIENTES[d.recipiente].nombre.toLowerCase()} {palabraColor(zonaDe(l), d.recipiente)}.">
          <span class="rec"><Icono nombre={d.recipiente} size={30} trazo={1.8} /></span>
          <span class="nombre">{l.nombre}</span>
          {#if db.pendientes[l.id]}<span class="falta">Falta {db.pendientes[l.id]}</span>{/if}
        </button>
      {:else}
        <p class="vacio">Todavía no hay lugares. El supervisor los agrega en Lugares.</p>
      {/each}
    </div>

    {#if paginas > 1}
      <div class="paginador">
        <button class="boton flecha" onclick={() => pagina--} disabled={pagina === 0} aria-label="Lugares anteriores">
          <Icono nombre="izquierda" size={28} />
        </button>
        <span class="puntos" aria-label="Página {pagina + 1} de {paginas}">
          {#each Array(paginas) as _, i}<span class:actual={i === pagina}></span>{/each}
        </span>
        <button class="boton flecha" onclick={() => pagina++} disabled={pagina === paginas - 1} aria-label="Más lugares">
          <Icono nombre="derecha" size={28} />
        </button>
      </div>
    {/if}
  </div>
{:else}
  <!-- Tocar en cualquier parte cuando ya terminó = volver antes. -->
  <div class="dispensar" style="--rc:{colorRec}" onclick={() => paso !== 'llenando' && inicio()} role="presentation">
    <div class="cabeza">
      <span class="foto chica"><Icono nombre={area.superficie} size={30} trazo={1.5} /></span>
      <h1>{area.nombre}</h1>
      <span class="trae" style="--rc:{colorRec}; color:{zona.tinta}"><Icono nombre={dosis.recipiente} size={20} trazo={2} />{RECIPIENTES[dosis.recipiente].nombre} {palabraColor(zonaDe(area), dosis.recipiente)}</span>
      {#if dosis.cargas > 1}
        <span class="cargas" aria-label="Carga {carga} de {dosis.cargas}">
          {#each Array(dosis.cargas) as _, i}
            <span class="mini" class:llena={i < carga - 1 || (i === carga - 1 && paso === 'listo')} class:actual={i === carga - 1}>
              <Icono nombre={dosis.recipiente} size={24} />
            </span>
          {/each}
        </span>
      {/if}
    </div>

    <div class="escena" class:fluye={paso === 'llenando'} style="--liquido:{cat.liquido}">
      <svg class="boquilla" viewBox="0 0 120 54" aria-hidden="true">
        <rect x="20" y="1" width="80" height="20" rx="3" fill="#e6ebe8" stroke="#3b4641" stroke-width="2" />
        <path d="M49 21 h22 l-3 21 h-16 z" fill="#e6ebe8" stroke="#3b4641" stroke-width="2" stroke-linejoin="round" />
        <rect x="51" y="42" width="18" height="7" rx="1.5" fill="#3b4641" />
        <circle cx="32" cy="11" r="3.5" fill={paso === 'llenando' ? '#1B8A63' : '#b7c1bc'} />
      </svg>
      <div class="chorro" aria-hidden="true"></div>
      <div class="vaso">
        <Recipiente tipo={dosis.recipiente} {nivel} {objetivo} liquido={cat.liquido} color={colorRec} abierto />
        {#if paso === 'error'}
          <div class="sello">
            <Orbe color={paso === 'listo' ? '#1A7A49' : '#C2410C'} glifo={paso === 'listo' ? 'check' : 'alerta'} size={92} />
          </div>
        {/if}
      </div>
    </div>

    <div class="estado" aria-live="polite">
      {#if paso === 'llenando'}
        <p>Llenando. No lo muevas.</p>
        <div class="barra-avance" role="progressbar" aria-valuenow={Math.round(progreso * 100)} aria-valuemin="0" aria-valuemax="100">
          <span style="width:{progreso * 100}%"></span>
        </div>
      {:else if paso === 'listo'}
        <p>Recipiente lleno</p>
      {:else}
        <p>La máquina no respondió. Avisa a tu supervisor.</p>
        <button class="boton reintentar" style="--c:var(--alerta)" onclick={(e) => { e.stopPropagation(); elegir(area); }}>Intentar otra vez</button>
      {/if}
    </div>
  </div>

  {#if paso === 'listo'}
    <div class="fondo-modal">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-titulo" aria-describedby="modal-texto">
        <span class="modal-check"><Icono nombre="check" size={44} trazo={2.5} /></span>
        <h2 id="modal-titulo">{faltan > 0 ? 'Primera carga lista' : 'Listo'}</h2>
        <p id="modal-texto">
          {faltan > 0 ? `Ya puedes ir a limpiar. Cuando se acabe, vuelve y toca ${area.nombre} otra vez.` : 'Ya puedes ir a limpiar.'}
        </p>
        <button class="boton cerrar-modal" onclick={inicio}>Cerrar</button>
        <div class="barra-avance vuelta" aria-label="Se cierra solo en {cuenta} segundos"><span style="width:{(cuenta / total) * 100}%"></span></div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .inicio, .dispensar { height: 100%; display: flex; flex-direction: column; gap: 12px; }

  .titulos { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .apoyo.solo { flex: none; margin: -6px 2px 0; }
  .avance-dia { flex: none; font-size: 1rem; font-weight: 600; color: var(--verde-600); white-space: nowrap; }
  .volver-hoy { flex: none; display: flex; align-items: center; gap: 4px; height: 48px; padding: 0 14px 0 8px; font-size: 1rem; }

  .asignados { flex: none; display: flex; flex-direction: column; gap: 10px; }
  .asignado {
    display: flex; align-items: center; gap: 14px; width: 100%; padding: 0 16px; cursor: pointer; text-align: left;
    background: #fff; border: 1px solid var(--linea); border-radius: 12px; box-shadow: var(--sombra);
  }
  .asignado:active { background: var(--verde-50); }
  .asignado .rec { color: var(--rc); }
  .asignado .texto { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .nombre-grande { font-size: 1.3rem; font-weight: 700; line-height: 1.3; color: var(--tinta); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 1rem; color: var(--tinta-suave); }
  .asignado.hecho { background: #f7f9f8; box-shadow: none; }
  .asignado.hecho .rec, .asignado.hecho .nombre-grande { color: #8b9792; }
  .hecho-marca { flex: none; display: flex; align-items: center; gap: 4px; font-weight: 600; color: var(--verde-600); }
  .chev { flex: none; display: grid; color: #9aa6a0; }

  .otros { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
  .otros-titulo { flex: none; margin: 4px 0 0; height: 22px; font-size: 1rem; font-weight: 600; color: var(--tinta-suave); }
  .zona { flex: none; display: flex; align-items: center; gap: 8px; height: 30px; margin: 0; font-size: 1rem; font-weight: 700; color: var(--tinta); }
  .muestra { width: 14px; height: 14px; border-radius: 4px; background: var(--rc); }
  .rejilla-otros { flex: none; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .otro {
    display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 10px; cursor: pointer; text-align: left; min-width: 0;
    background: #fff; border: 1px solid var(--linea); border-radius: 10px;
  }
  .otro:active { background: var(--verde-50); }
  .otro .rec { color: var(--rc); }
  .nombre-otro {
    min-width: 0; font-size: 1rem; font-weight: 600; line-height: 1.25; color: var(--tinta);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; hyphens: none;
  }
  .ver-todos { flex: none; height: 52px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 1.05rem; margin-top: auto; }

  .titulo-inicio { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 2px 0; }
  .pregunta { margin: 0; font-size: 1.75rem; font-weight: 700; line-height: 1.1; color: var(--tinta); letter-spacing: -0.01em; }
  .apoyo { margin: 4px 0 0; font-size: 1rem; color: var(--tinta-suave); }
  .mic {
    flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; cursor: pointer;
    border: 1px solid var(--linea); background: #fff; color: var(--verde-700);
  }
  .mic.activo { background: var(--alerta); border-color: var(--alerta); color: #fff; }

  .voz-estado {
    flex: none; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px;
    background: var(--verde-100); color: var(--verde-900); font-weight: 600; font-size: 0.95rem;
  }
  .voz-estado > span:not(.ondas) { flex: 1; }
  .chico { padding: 6px 12px; font-size: 0.85rem; border-radius: 10px; }

  .lista {
    flex: 1; min-height: 0; overflow: hidden; align-self: stretch;
    display: flex; flex-direction: column; justify-content: flex-start;
    background: #fff; border: 1px solid var(--linea); border-radius: 12px;
  }
  .fila {
    flex: none; display: flex; align-items: center; gap: 14px; width: 100%; padding: 0 16px;
    border: 0; border-bottom: 1px solid var(--linea); background: none; cursor: pointer; text-align: left;
  }
  .fila:last-child { border-bottom: 0; }
  .fila:active { background: var(--verde-50); }
  .rec { flex: none; display: grid; color: var(--rc); }
  .nombre { flex: 1; min-width: 0; font-size: 1.2rem; font-weight: 600; color: var(--tinta); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foto { flex: none; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 8px; background: var(--verde-50); color: var(--verde-700); }
  .trae {
    display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px 5px 8px; border-radius: 999px;
    font-size: 1rem; font-weight: 600; color: #fff; background: var(--rc);
  }
  .falta { flex: none; padding: 2px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 600; color: #7a2e08; background: #fde9d7; }
  .vacio { margin: auto; padding: 16px; text-align: center; color: var(--tinta-suave); }

  .paginador { flex: none; display: flex; align-items: center; justify-content: space-between; }
  .flecha { width: 64px; height: 48px; display: grid; place-items: center; }
  .puntos { display: flex; gap: 8px; }
  .puntos span { width: 10px; height: 10px; border-radius: 50%; background: var(--linea); }
  .puntos span.actual { background: var(--verde-600); width: 26px; border-radius: 5px; }

  .dispensar { cursor: default; }
  .cabeza { flex: none; display: flex; align-items: center; gap: 10px; }
  h1 { flex: 1; margin: 0; font-size: 1.5rem; line-height: 1.15; font-weight: 600; letter-spacing: -0.01em; color: var(--tinta); }
  .cargas { display: flex; gap: 6px; }
  .mini { display: grid; color: var(--tinta-suave); opacity: 0.4; }
  .mini.llena, .mini.actual { opacity: 1; color: var(--verde-700); }

  .escena { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; }
  .boquilla { flex: none; width: 104px; height: auto; z-index: 1; }
  .chorro {
    position: absolute; top: 42px; left: 50%; width: 10px; height: 46%; margin-left: -5px; border-radius: 5px;
    width: 6px; margin-left: -3px; border-radius: 0; background: var(--liquido);
    display: none;
  }
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

  .estado { flex: none; display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 92px; }
  .estado p { margin: 0; text-align: center; font-size: 1.35rem; font-weight: 600; line-height: 1.25; color: var(--tinta); text-wrap: balance; }
  .barra-avance { width: 100%; height: 10px; border-radius: 5px; background: #e3e8e5; overflow: hidden; }
  .barra-avance span { display: block; height: 100%; border-radius: 7px; background: var(--rc, var(--agua)); transition: width 0.3s linear; }
  .barra-avance.vuelta { height: 6px; }
  .barra-avance.vuelta span { background: var(--verde-600); }
  .reintentar { width: 100%; height: 60px; font-size: 1.3rem; }

  .fondo-modal {
    position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; padding: 20px;
    background: rgb(23 35 30 / 0.45);
  }
  .modal {
    width: 100%; max-width: 340px; display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 28px 22px 18px; border-radius: 16px; background: #fff; text-align: center;
    box-shadow: 0 20px 50px rgb(23 35 30 / 0.3); animation: aparece 0.2s ease-out;
  }
  .modal-check { display: grid; place-items: center; width: 76px; height: 76px; border-radius: 50%; background: var(--verde-600); color: #fff; }
  .modal h2 { margin: 4px 0 0; font-size: 1.6rem; font-weight: 700; color: var(--tinta); }
  .modal p { margin: 0; font-size: 1.2rem; line-height: 1.35; color: var(--tinta); text-wrap: balance; }
  .cerrar-modal { width: 100%; height: 60px; margin-top: 6px; font-size: 1.3rem; }
  .modal .barra-avance { margin-top: 2px; }

  @media (prefers-reduced-motion: reduce) {
    .fluye .chorro, .sello, .modal { animation: none; }
    .barra-avance span { transition: none; }
  }
</style>
