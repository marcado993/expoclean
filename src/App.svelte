<script>
  import Icono from './components/Icono.svelte';
  import Kiosko from './views/Kiosko.svelte';
  import Areas from './views/Areas.svelte';
  import Impacto from './views/Impacto.svelte';
  import Admin from './views/Admin.svelte';
  import Logo from './components/Logo.svelte';
  import { ui } from './lib/store.svelte.js';

  // Cada vista es un módulo independiente (views/ + lib/): se puede separar en microfrontends después.
  const vistas = {
    kiosko: { nombre: 'Dispensador', glifo: 'inicio', comp: Kiosko },
    areas: { nombre: 'Lugares', glifo: 'lugar', comp: Areas },
    impacto: { nombre: 'Impacto', glifo: 'gota', comp: Impacto },
    admin: { nombre: 'Admin', glifo: 'chip', comp: Admin },
  };

  const desdeHash = () => (location.hash.slice(1) in vistas ? location.hash.slice(1) : 'kiosko');
  let actual = $state(desdeHash());
  const Vista = $derived(vistas[actual].comp);
  const kiosko = $derived(actual === 'kiosko');

  function cambiar() {
    actual = desdeHash();
  }

  // Acceso del supervisor desde el dispensador: mantener presionado 1.5 s (quien limpia no entra sin querer).
  let temporizador;
  function presionar() {
    if (ui.ocupado) return; // mientras llena no se sale del kiosko
    temporizador = setTimeout(() => (location.hash = '#areas'), 1500);
  }
  function soltar() {
    clearTimeout(temporizador);
  }

  // Hora visible en el kiosko, como en cualquier equipo de pared.
  const hora = () => new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
  let ahora = $state(hora());
  $effect(() => {
    const t = setInterval(() => (ahora = hora()), 15000);
    return () => clearInterval(t);
  });
</script>

<svelte:window onhashchange={cambiar} />

<div class="telefono">
  <header class="barra">
    {#if kiosko}
      <Logo />
      <span class="derecha">
      <span class="hora">{ahora}</span>
      <button class="supervisor" aria-label="Mantén presionado para entrar como supervisor"
        onpointerdown={presionar} onpointerup={soltar} onpointerleave={soltar} oncontextmenu={(e) => e.preventDefault()}>
        <Icono nombre="ajustes" size={22} />
      </button>
      </span>
    {:else}
      <a href="#kiosko" class="volver" aria-label="Volver al dispensador">
        <Icono nombre="izquierda" size={22} trazo={2.4} /><span>Volver</span>
      </a>
      <span class="separador" aria-hidden="true"></span>
      <span class="rol">{vistas[actual].nombre}</span>
    {/if}
  </header>

  <main>
    <Vista />
  </main>

  {#if !kiosko}
    <nav class="inferior">
      {#each Object.entries(vistas) as [k, v]}
        <a href="#{k}" class:activo={actual === k} aria-current={actual === k ? 'page' : undefined}>
          <Icono nombre={v.glifo} size={24} />
          <span>{v.nombre}</span>
        </a>
      {/each}
    </nav>
  {/if}
</div>

<style>
  .telefono {
    position: relative; isolation: isolate; overflow: hidden;
    display: flex; flex-direction: column;
    width: 100%; height: 100dvh; background: var(--pared);
  }
  @media (min-width: 520px) {
    .telefono {
      width: 412px; height: min(880px, calc(100dvh - 28px)); margin: 14px auto;
      border-radius: 36px; border: 9px solid #1B2630;
      box-shadow: 0 30px 60px rgb(20 32 43 / 0.25);
    }
  }

  .barra {
    flex: none; display: flex; justify-content: space-between; align-items: center;
    height: 60px; padding: 0 10px 0 16px; background: var(--blanco); border-bottom: 1px solid var(--linea);
  }
  .barra:has(.rol) { justify-content: flex-start; gap: 12px; padding-left: 6px; }
  .derecha { display: flex; align-items: center; gap: 6px; }
  .hora { font-weight: 600; font-size: 1.1rem; color: var(--tinta-suave); }
  .supervisor {
    width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: var(--radio);
    background: none; color: var(--tinta-tenue); cursor: pointer; touch-action: none; user-select: none;
  }
  .volver {
    height: 44px; display: flex; align-items: center; gap: 2px; padding: 0 8px 0 4px; text-decoration: none;
    color: var(--tinta-suave); font-weight: 600; font-size: 1rem; border-radius: var(--radio);
  }
  .separador { width: 1px; height: 28px; background: var(--linea); }
  .rol { font-weight: 800; font-size: 1.3rem; letter-spacing: -0.01em; color: var(--tinta); }

  main { position: relative; flex: 1; min-height: 0; overflow: hidden; padding: 16px 16px 14px; }

  .inferior {
    flex: none; display: flex; justify-content: space-around; padding: 6px 8px 10px;
    background: var(--blanco); border-top: 1px solid var(--linea);
  }
  .inferior a {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 72px; padding-top: 8px;
    color: var(--tinta-tenue); text-decoration: none; font-size: 0.8rem; font-weight: 600;
  }
  .inferior a.activo { color: var(--tinta); font-weight: 800; }
  .inferior a.activo::before {
    content: ''; position: absolute; top: -7px; width: 40px; height: 3px; border-radius: 0 0 3px 3px; background: var(--tinta);
  }
</style>
