<script>
  import Icono from './components/Icono.svelte';
  import Logo from './components/Logo.svelte';
  import Inicio from './views/Inicio.svelte';
  import Menu from './views/operario/Menu.svelte';
  import Escanear from './views/operario/Escanear.svelte';
  import Configurar from './views/operario/Configurar.svelte';
  import Dosificar from './views/operario/Dosificar.svelte';
  import Historial from './views/operario/Historial.svelte';
  import Zonas from './views/operario/Zonas.svelte';
  import Notificaciones from './views/operario/Notificaciones.svelte';
  import Perfil from './views/operario/Perfil.svelte';
  import Panel from './views/admin/Panel.svelte';
  import Espacios from './views/admin/Espacios.svelte';
  import Asignar from './views/admin/Asignar.svelte';
  import Equipo from './views/admin/Equipo.svelte';
  import Maquina from './components/Maquina.svelte';
  import { fly } from 'svelte/transition';
  import { datos, sesion, ui, conectar, operarioActual, espacioPorId } from './lib/nube.svelte.js';
  import { reconectarSola, vaciarCola } from './lib/ble.svelte.js';
  import { dur } from './lib/movimiento.js';

  conectar();
  reconectarSola();
  vaciarCola();

  const RUTAS = {
    inicio: Inicio,
    op: Menu,
    'op/escanear': Escanear,
    'op/config': Configurar,
    'op/dosificar': Dosificar,
    'op/historial': Historial,
    'op/zonas': Zonas,
    'op/notificaciones': Notificaciones,
    'op/perfil': Perfil,
    admin: Panel,
    'admin/espacios': Espacios,
    'admin/asignar': Asignar,
    'admin/equipo': Equipo,
  };
  const PRINCIPALES = new Set(['op', 'op/zonas', 'op/notificaciones', 'op/perfil', 'admin', 'inicio']);

  function leerHash() {
    const [r, q = ''] = location.hash.slice(1).split('?');
    let ruta = r in RUTAS ? r : sesion.rol === 'admin' ? 'admin' : sesion.rol === 'operario' ? 'op' : 'inicio';
    if (!sesion.rol) ruta = 'inicio';
    else if (sesion.rol === 'operario' && ruta.startsWith('admin')) ruta = 'op';
    return { ruta, params: Object.fromEntries(new URLSearchParams(q)), clave: location.hash };
  }
  let actual = $state(leerHash());
  const Vista = $derived(RUTAS[actual.ruta]);
  const esAdmin = $derived(actual.ruta.startsWith('admin'));
  const esOperario = $derived(actual.ruta.startsWith('op'));
  let cajon = $state(false);

  function cambiar() {
    // Mientras la máquina dosifica no se sale de la pantalla: la orden ya está en camino.
    if (ui.ocupado) {
      history.replaceState(null, '', actual.clave || '#');
      return;
    }
    cajon = false;
    actual = leerHash();
  }

  function salir() {
    sesion.rol = null;
    sesion.operarioId = null;
    location.hash = '#inicio';
  }

  // Si quitaron al operario de este celular, vuelve a elegir quién es.
  $effect(() => {
    if (datos.cargado && sesion.rol === 'operario' && !operarioActual()) salir();
  });

  const pendientes = $derived(datos.tareas.filter((t) => t.operarioId === sesion.operarioId && t.estado === 'pendiente').length);

  // ── Aviso de tarea nueva para el operario de este celular (sonido, vibración y voz)
  const VISTAS = 'cleandose:tareas-vistas';
  let vistas = new Set((() => { try { return JSON.parse(localStorage.getItem(VISTAS)) ?? []; } catch { return []; } })());
  let aviso = $state(null);
  $effect(() => {
    if (sesion.rol !== 'operario') return;
    const nueva = datos.tareas.findLast((t) => t.operarioId === sesion.operarioId && t.estado === 'pendiente' && !vistas.has(t.id));
    if (nueva && nueva.id !== aviso?.id) {
      aviso = nueva;
      sonar();
      hablar(`Tienes una tarea nueva: limpiar ${espacioPorId(nueva.espacioId)?.nombre ?? 'un espacio'}.`);
    }
  });
  function verAviso(ir) {
    vistas.add(aviso.id);
    try { localStorage.setItem(VISTAS, JSON.stringify([...vistas].slice(-200))); } catch {}
    if (ir) location.hash = `#op/escanear?e=${aviso.espacioId}&t=${aviso.id}`;
    aviso = null;
  }
  function sonar() {
    try {
      navigator.vibrate?.([300, 150, 300]);
      const ctx = new AudioContext();
      [0, 0.25].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.25, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.2);
      });
    } catch {}
  }
  function hablar(texto) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-ES';
    speechSynthesis.speak(u);
  }
</script>

<svelte:window onhashchange={cambiar} />

<div class="telefono">
  <header class="barra">
    {#if esAdmin}
      <button class="icono-btn" onclick={() => (cajon = !cajon)} aria-label="Menú" aria-expanded={cajon}><Icono nombre="menu" size={26} /></button>
    {:else if esOperario && !PRINCIPALES.has(actual.ruta)}
      <button class="icono-btn" onclick={() => history.back()} disabled={ui.ocupado} aria-label="Atrás"><Icono nombre="izquierda" size={26} trazo={2.2} /></button>
    {/if}
    <Logo />
    {#if sesion.rol}
      <Maquina />
      <button class="rol" onclick={() => (esAdmin ? (cajon = !cajon) : (location.hash = '#op/perfil'))} disabled={ui.ocupado}
        aria-label={esAdmin ? 'Administrador' : `Perfil de ${operarioActual()?.nombre ?? 'operario'}`}>
        <span class="avatar">{esAdmin ? 'A' : (operarioActual()?.nombre ?? '?').split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
      </button>
    {/if}
  </header>

  {#if !datos.conectado && datos.cargado && datos.fallos >= 2}
    <p class="sin-red">Sin conexión con el servidor. Reintentando…</p>
  {/if}

  <main class:desliza={esAdmin}>
    {#key actual.clave}
      <div class="vista" in:fly={{ x: 24, duration: dur(220) }}>
        <Vista params={actual.params} />
      </div>
    {/key}
  </main>

  {#if esOperario}
    <nav class="inferior">
      {#each [['op', 'Inicio', 'inicio'], ['op/zonas', 'Zonas', 'mapa'], ['op/notificaciones', 'Notificaciones', 'campana'], ['op/perfil', 'Perfil', 'usuario']] as [k, nombre, glifo]}
        <a href="#{k}" class:activo={actual.ruta === k} aria-current={actual.ruta === k ? 'page' : undefined}>
          <span class="nav-icono">
            <Icono nombre={glifo} size={26} trazo={1.9} />
            {#if k === 'op/notificaciones' && pendientes}<span class="globo">{pendientes}</span>{/if}
          </span>
          <span>{nombre}</span>
        </a>
      {/each}
    </nav>
  {/if}

  {#if cajon}
    <button class="velo" onclick={() => (cajon = false)} aria-label="Cerrar menú"></button>
    <nav class="cajon">
      <Logo />
      {#each [['admin', 'Panel y trazabilidad', 'portapapeles'], ['admin/espacios', 'Asignación de espacios', 'mapa'], ['admin/asignar', 'Asignar operario a zona', 'grupo'], ['admin/equipo', 'Máquina y operarios', 'chip']] as [k, nombre, glifo]}
        <a href="#{k}" class:activo={actual.ruta === k}><Icono nombre={glifo} size={22} /> {nombre}</a>
      {/each}
      <button class="salir" onclick={salir}><Icono nombre="salir" size={22} /> Cambiar de usuario</button>
    </nav>
  {/if}

  {#if aviso && !ui.ocupado}
    <div class="aviso" role="alertdialog" aria-labelledby="aviso-t">
      <span class="aviso-icono"><Icono nombre="campana" size={26} trazo={2} /></span>
      <p class="aviso-sup">Tarea nueva</p>
      <h2 id="aviso-t">Limpiar {espacioPorId(aviso.espacioId)?.nombre ?? 'un espacio'}</h2>
      {#if aviso.nota}<p class="aviso-nota">{aviso.nota}</p>{/if}
      <div class="aviso-botones">
        <button class="boton secundario" onclick={() => verAviso(false)}>Después</button>
        <button class="boton verde" onclick={() => verAviso(true)}>Ir ahora</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .telefono {
    position: relative; isolation: isolate; overflow: hidden;
    display: flex; flex-direction: column;
    width: 100%; height: 100dvh; background: var(--blanco);
  }
  @media (min-width: 520px) {
    .telefono {
      width: 412px; height: min(880px, calc(100dvh - 28px)); margin: 14px auto;
      border-radius: 36px; border: 9px solid #E4E9F0;
      box-shadow: 0 30px 60px rgb(15 30 58 / 0.18);
    }
  }

  .barra { flex: none; display: flex; align-items: center; gap: 8px; height: 68px; padding: 0 14px 0 16px; }
  .barra :global(.logo) { margin-right: auto; }
  .icono-btn { margin-left: -8px; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; color: var(--tinta); cursor: pointer; }
  .rol { padding: 0; border: 0; background: none; cursor: pointer; }
  .avatar { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 50%; background: var(--tinta); color: #fff; font-weight: 700; font-size: 0.95rem; }
  .vista { height: 100%; }

  .sin-red { flex: none; margin: 0; padding: 8px 16px; background: var(--t-rojo); color: #8A1F1F; font-weight: 700; font-size: 0.9rem; }

  main { position: relative; flex: 1; min-height: 0; overflow: hidden; padding: 6px 16px 14px; }
  main.desliza { overflow-y: auto; }

  .inferior { flex: none; display: flex; justify-content: space-around; padding: 8px 6px 12px; border-top: 1px solid var(--linea); background: var(--blanco); }
  .inferior a { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 76px; color: var(--tinta-suave); text-decoration: none; font-size: 0.78rem; font-weight: 600; }
  .inferior a.activo { color: var(--azul); font-weight: 700; }
  .nav-icono { position: relative; display: grid; }
  .globo { position: absolute; top: -6px; right: -10px; min-width: 20px; height: 20px; padding: 0 5px; display: grid; place-items: center; border-radius: 10px; background: var(--alerta); color: #fff; font-size: 0.72rem; font-weight: 700; border: 2px solid var(--blanco); }

  .velo { position: absolute; inset: 0; z-index: 8; border: 0; background: rgb(15 30 58 / 0.35); cursor: pointer; }
  .cajon {
    position: absolute; top: 0; bottom: 0; left: 0; z-index: 9; width: 82%; display: flex; flex-direction: column; gap: 4px;
    padding: 22px 14px; background: var(--blanco); box-shadow: 10px 0 30px rgb(15 30 58 / 0.15);
  }
  .cajon :global(.logo) { margin: 0 8px 18px; }
  .cajon a, .salir {
    display: flex; align-items: center; gap: 12px; padding: 14px 12px; border-radius: var(--radio); text-decoration: none;
    color: var(--tinta); font-weight: 700; border: 0; background: none; cursor: pointer; text-align: left;
  }
  .cajon a.activo { background: var(--t-azul); color: var(--azul); }
  .salir { margin-top: auto; color: var(--tinta-suave); }

  .aviso {
    position: absolute; left: 14px; right: 14px; top: 76px; z-index: 10; display: flex; flex-direction: column; gap: 4px;
    padding: 18px; border-radius: 20px; background: var(--blanco); border: 1px solid var(--linea);
    box-shadow: 0 24px 50px rgb(15 30 58 / 0.25); animation: baja 0.25s ease-out;
  }
  .aviso-icono { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 6px; border-radius: 14px; background: var(--t-rojo); color: var(--alerta); }
  .aviso-sup { margin: 0; font-weight: 700; color: var(--alerta); }
  .aviso h2 { margin: 0; font-size: 1.45rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
  .aviso-nota { margin: 0; font-size: 1rem; color: var(--tinta-suave); }
  .aviso-botones { display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px; margin-top: 12px; }
  @keyframes baja { from { transform: translateY(-16px); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .aviso { animation: none; } }
</style>
