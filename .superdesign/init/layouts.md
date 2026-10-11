# Layouts

Single app shell `src/App.svelte`: phone-sized column (full screen < 520px; 412px framed device on desktop). Kiosk mode (`#kiosko`): white top bar with Logo (left), 24h clock + settings button held 1.5 s for supervisor (right); no bottom nav. Supervisor modes (`#areas`, `#impacto`): pine-green top bar with back arrow, Logo (light) and "Supervisor" tag; white bottom nav (Dispensador / Lugares / Impacto) with active top indicator. `main` never scrolls (each view fits 100% height).

### `src/App.svelte`

```svelte
<script>
  import Icono from './components/Icono.svelte';
  import Kiosko from './views/Kiosko.svelte';
  import Areas from './views/Areas.svelte';
  import Impacto from './views/Impacto.svelte';
  import Logo from './components/Logo.svelte';

  // Cada vista es un módulo independiente (views/ + lib/): se puede separar en microfrontends después.
  const vistas = {
    kiosko: { nombre: 'Dispensador', glifo: 'inicio', comp: Kiosko },
    areas: { nombre: 'Lugares', glifo: 'lugar', comp: Areas },
    impacto: { nombre: 'Impacto', glifo: 'gota', comp: Impacto },
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
        <Icono nombre="izquierda" size={24} />
      </a>
      <Logo claro />
      <span class="rol">Supervisor</span>
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
    width: 100%; height: 100dvh; background: var(--fondo);
  }
  @media (min-width: 520px) {
    .telefono {
      width: 412px; height: min(880px, calc(100dvh - 28px)); margin: 14px auto;
      border-radius: 36px; border: 9px solid #1d2b24;
      box-shadow: 0 30px 60px rgb(11 61 42 / 0.25);
    }
  }

  .barra {
    flex: none; display: flex; justify-content: space-between; align-items: center;
    height: 60px; padding: 0 10px 0 16px; color: var(--tinta-suave);
    background: #fff; border-bottom: 1px solid var(--linea);
  }
  .barra:has(.rol) { color: #fff; background: var(--verde-700); border-bottom-color: var(--verde-900); padding-left: 6px; }
  .derecha { display: flex; align-items: center; gap: 4px; }
  .hora { font-size: 1.05rem; font-weight: 500; color: var(--tinta); font-variant-numeric: tabular-nums; }
  .supervisor { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--linea); border-radius: 10px; background: #fff; color: var(--tinta-suave); cursor: pointer; touch-action: none; user-select: none; }
  .volver { width: 44px; height: 44px; display: grid; place-items: center; color: #fff; border-radius: 12px; }
  .rol { font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgb(255 255 255 / 0.14); }

  main { position: relative; flex: 1; min-height: 0; overflow: hidden; padding: 14px 14px 12px; }

  .inferior {
    flex: none; display: flex; justify-content: space-around; padding: 6px 8px 10px;
    background: #fff; border-top: 1px solid var(--linea);
  }
  .inferior a {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 90px; padding-top: 8px;
    color: var(--tinta-suave); text-decoration: none; font-size: 0.78rem; font-weight: 600;
  }
  .inferior a.activo { color: var(--verde-700); }
  .inferior a.activo::before {
    content: ''; position: absolute; top: -7px; width: 36px; height: 3px; border-radius: 0 0 3px 3px; background: var(--verde-600);
  }
</style>

```
### `index.html`

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0D4F3C" />
    <title>SmartDose</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>

```
### `src/main.js`

```js
import { mount } from 'svelte';
// Fuentes dentro del proyecto: el kiosko funciona sin internet.
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo-black/400.css';
import App from './App.svelte';
import './app.css';

export default mount(App, { target: document.getElementById('app') });

```
