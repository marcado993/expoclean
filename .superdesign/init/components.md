# Components

Stack: Svelte 5 (runes) + Vite 8, vanilla scoped CSS, no component library. Icons: Tabler outline SVGs imported as raw strings (`src/lib/iconos.js`). Fonts self-hosted via @fontsource (Source Sans 3 UI, Archivo/Archivo Black for the nutrition-style label).

- `Icono` — renders a Tabler outline icon by Spanish name. Props: nombre, size=24, trazo=1.75.
- `Recipiente` — flat measuring-vessel SVG (balde 8 L / botella 1 L / spray "chisguete" 500 mL) with fill level and volume marks. Props: tipo, nivel 0..1, objetivo 0..1, liquido color, abierto, marcas.
- `Orbe` — flat colored circle with white glyph (used for check/alert). Props: color, glifo, size.
- `Ficha` — "Nutrition Facts"-style label. Props: titulo, subtitulo, filas[{k,v,fuerte,sangria,regla}], pie.
- `Logo` — drop+leaf mark + "Smart**Dose**" wordmark. Props: claro.

### `src/components/Icono.svelte`

```svelte
<script>
  import { ICONOS } from '../lib/iconos.js';

  let { nombre, size = 24, trazo = 1.75 } = $props();
  const svg = $derived(
    (ICONOS[nombre] ?? '')
      .replace(/width="24"/, `width="${size}"`)
      .replace(/height="24"/, `height="${size}"`)
      .replace(/stroke-width="2"/, `stroke-width="${trazo}"`)
      .replace('<svg', '<svg aria-hidden="true" focusable="false"')
  );
</script>

<span class="icono" style="width:{size}px; height:{size}px">{@html svg}</span>

<style>
  .icono { display: inline-grid; place-items: center; flex: none; line-height: 0; }
</style>

```
### `src/lib/iconos.js`

```js
// Íconos de Tabler (un solo set profesional, trazo uniforme). Nombre en español → SVG.
import i_menu from '@tabler/icons/outline/menu-2.svg?raw';
import i_bandeja from '@tabler/icons/outline/inbox.svg?raw';
import i_buscar from '@tabler/icons/outline/search.svg?raw';
import i_inicio from '@tabler/icons/outline/home.svg?raw';
import i_lugar from '@tabler/icons/outline/map-pin.svg?raw';
import i_gota from '@tabler/icons/outline/droplet.svg?raw';
import i_voz from '@tabler/icons/outline/volume.svg?raw';
import i_microfono from '@tabler/icons/outline/microphone.svg?raw';
import i_cerrar from '@tabler/icons/outline/x.svg?raw';
import i_subir from '@tabler/icons/outline/upload.svg?raw';
import i_regla from '@tabler/icons/outline/ruler-measure.svg?raw';
import i_cuadro from '@tabler/icons/outline/square.svg?raw';
import i_ajustes from '@tabler/icons/outline/settings.svg?raw';
import i_lista from '@tabler/icons/outline/list.svg?raw';
import i_mapa from '@tabler/icons/outline/map.svg?raw';
import i_izquierda from '@tabler/icons/outline/chevron-left.svg?raw';
import i_derecha from '@tabler/icons/outline/chevron-right.svg?raw';
import i_mas from '@tabler/icons/outline/plus.svg?raw';
import i_check from '@tabler/icons/outline/check.svg?raw';
import i_alerta from '@tabler/icons/outline/alert-triangle.svg?raw';
import i_piso from '@tabler/icons/outline/bucket-droplet.svg?raw';
import i_bano from '@tabler/icons/outline/toilet-paper.svg?raw';
import i_vidrio from '@tabler/icons/outline/window.svg?raw';
import i_mesa from '@tabler/icons/outline/desk.svg?raw';
import i_balde from '@tabler/icons/outline/bucket.svg?raw';
import i_spray from '@tabler/icons/outline/spray.svg?raw';
import i_botella from '@tabler/icons/outline/bottle.svg?raw';
import i_sanitario from '@tabler/icons/outline/wash-hand.svg?raw';
import i_tocar from '@tabler/icons/outline/hand-finger.svg?raw';

export const ICONOS = {
  tocar: i_tocar,
  botella: i_botella,
  sanitario: i_sanitario,
  menu: i_menu,
  bandeja: i_bandeja,
  buscar: i_buscar,
  inicio: i_inicio,
  lugar: i_lugar,
  gota: i_gota,
  voz: i_voz,
  microfono: i_microfono,
  cerrar: i_cerrar,
  subir: i_subir,
  regla: i_regla,
  cuadro: i_cuadro,
  ajustes: i_ajustes,
  lista: i_lista,
  mapa: i_mapa,
  izquierda: i_izquierda,
  derecha: i_derecha,
  mas: i_mas,
  check: i_check,
  alerta: i_alerta,
  piso: i_piso,
  bano: i_bano,
  vidrio: i_vidrio,
  mesa: i_mesa,
  balde: i_balde,
  spray: i_spray,
};

```
### `src/components/Recipiente.svelte`

```svelte
<script>
  // Recipiente dibujado como un vaso medidor: contorno, marcas de volumen y nivel plano.
  // nivel y objetivo van de 0 a 1 respecto a la capacidad.
  import { mezclar } from '../lib/ui.js';

  let { tipo = 'spray', nivel = 0, objetivo = 0, liquido = '#9fd0c0', abierto = false, marcas = true } = $props();
  const id = $props.id();

  const FORMAS = {
    spray: {
      cuerpo: 'M80 94 L80 106 C80 118 54 124 54 148 L54 250 C54 259 61 265 70 265 L130 265 C139 265 146 259 146 250 L146 148 C146 124 120 118 120 106 L120 94 Z',
      arriba: 130, abajo: 262, capacidad: 500, paso: 100, unidad: 'mL',
      der: () => 146,
    },
    botella: {
      cuerpo: 'M86 72 L86 86 C86 94 64 98 64 114 L64 252 C64 260 70 265 78 265 L122 265 C130 265 136 260 136 252 L136 114 C136 98 114 94 114 86 L114 72 Z',
      arriba: 112, abajo: 262, capacidad: 1000, paso: 250, unidad: 'mL',
      der: () => 136,
    },
    balde: {
      cuerpo: 'M30 92 L170 92 L154 258 C153.5 262 150 265 145 265 L55 265 C50 265 46.5 262 46 258 Z',
      arriba: 100, abajo: 262, capacidad: 8, paso: 1, unidad: 'L',
      der: (y) => 170 - ((y - 92) / 166) * 16,
    },
  };

  const f = $derived(FORMAS[tipo]);
  const y = (n) => f.abajo - (f.abajo - f.arriba) * Math.min(1, Math.max(0, n));
  const ySup = $derived(y(nivel));
  const yObj = $derived(y(objetivo));
  const linea = $derived(mezclar(liquido, '#000000', 0.25));
  const MARCAS = $derived(Array.from({ length: Math.round(f.capacidad / f.paso) }, (_, i) => (i + 1) * f.paso));
</script>

<svg viewBox="{marcas ? -26 : 0} 0 {marcas ? 252 : 200} 285" class="recipiente" role="img"
  aria-label="{tipo === 'balde' ? 'Balde' : 'Botella'} lleno al {Math.round(nivel * 100)} por ciento">
  <defs><clipPath id="int-{id}"><path d={f.cuerpo} /></clipPath></defs>

  {#if tipo === 'balde'}
    <path d="M36 96 C40 52 160 52 164 96" fill="none" stroke="#8a958f" stroke-width="2.5" />
  {/if}

  <path d={f.cuerpo} fill="#ffffff" />

  <g clip-path="url(#int-{id})">
    <g class="nivel" style="transform: translateY({ySup}px)" opacity={nivel > 0.001 ? 1 : 0}>
      <rect x="0" y="0" width="200" height="300" fill={liquido} />
      <line x1="0" x2="200" y1="0" y2="0" stroke={linea} stroke-width="2" />
    </g>
    {#if marcas}
      {#each MARCAS as v}
        {@const ym = y(v / f.capacidad)}
        <line x1={f.der(ym) - (v % (f.paso * 2) === 0 ? 18 : 10)} x2={f.der(ym)} y1={ym} y2={ym} stroke="#3b4641" stroke-width="1.5" opacity="0.6" />
      {/each}
    {/if}
    {#if objetivo > 0 && nivel < objetivo - 0.01}
      <line x1="0" x2="200" y1={yObj} y2={yObj} stroke="#56635d" stroke-width="1.5" stroke-dasharray="5 4" />
    {/if}
  </g>

  {#if marcas}
    {#each MARCAS as v}
      {#if v % (f.paso * 2) === 0}
        {@const ym = y(v / f.capacidad)}
        <text x={f.der(ym) + 8} y={ym + 4} text-anchor="start" font-size="13" fill="#56635d" font-family="Source Sans 3, sans-serif">{v} {f.unidad}</text>
      {/if}
    {/each}
  {/if}

  <path d={f.cuerpo} fill="none" stroke="#3b4641" stroke-width="3" stroke-linejoin="round" />

  {#if tipo === 'balde'}
    <rect x="24" y="86" width="152" height="10" rx="3" fill="#ffffff" stroke="#3b4641" stroke-width="3" />
  {:else if tipo === 'botella'}
    <rect x="82" y="58" width="36" height="16" rx="3" fill="#ffffff" stroke="#3b4641" stroke-width="3" />
    {#if !abierto}<path d="M94 58 V48 H106 V58" fill="#ffffff" stroke="#3b4641" stroke-width="3" />{/if}
  {:else}
    <rect x="76" y="82" width="48" height="14" rx="2" fill="#ffffff" stroke="#3b4641" stroke-width="3" />
    {#if !abierto}
      <path d="M126 82 V54 Q126 42 114 42 H52 Q44 42 46 50 L52 58 H76 V82" fill="#56635d" />
      <path d="M78 62 Q72 76 82 92" fill="none" stroke="#56635d" stroke-width="5" stroke-linecap="round" />
    {/if}
  {/if}
</svg>

<style>
  .recipiente { width: 100%; height: auto; display: block; overflow: visible; }
  /* El nivel sube suave mientras llena: es la única animación, porque informa. */
  .nivel { transition: transform 0.3s linear; }
  @media (prefers-reduced-motion: reduce) { .nivel { transition: none; } }
</style>

```
### `src/components/Orbe.svelte`

```svelte
<script>
  // Ícono de categoría: círculo sólido con un degradado sutil y glifo blanco.
  import { GLIFOS, mezclar } from '../lib/ui.js';

  let { color, glifo, size = 48 } = $props();
  const id = $props.id();
  const claro = $derived(mezclar(color, '#ffffff', 0.22));
  const oscuro = $derived(mezclar(color, '#000000', 0.18));
</script>

<svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
  <circle cx="50" cy="50" r="48" fill={color} />
  <g transform="translate(26 26) scale(2)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d={GLIFOS[glifo]} />
  </g>
</svg>

```
### `src/components/Ficha.svelte`

```svelte
<script>
  // Etiqueta al estilo "Nutrition Facts" del mockup, con datos de dosis o de impacto.
  // filas: { k, v, fuerte?, sangria?, regla?: 'gruesa' | 'media' }
  let { titulo, subtitulo = '', filas = [], pie = '' } = $props();
</script>

<div class="ficha">
  <h3>{titulo}</h3>
  {#if subtitulo}<p class="sub">{subtitulo}</p>{/if}
  <div class="regla gruesa"></div>
  {#each filas as f}
    {#if f.regla}<div class="regla {f.regla}"></div>{/if}
    <div class="fila" class:fuerte={f.fuerte} class:sangria={f.sangria}>
      <span>{f.k}</span><span>{f.v}</span>
    </div>
  {/each}
  {#if pie}<div class="regla media"></div><p class="pie">{pie}</p>{/if}
</div>

<style>
  .ficha {
    background: #fff; color: #000; border: 2px solid #000; padding: 6px 7px 7px;
    font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif; font-size: 0.72rem; line-height: 1.25;
    box-shadow: 0 10px 22px rgb(10 50 70 / 0.28), 0 1px 0 #fff inset;
  }
  h3 { margin: 0; font-family: 'Archivo Black', 'Archivo', sans-serif; font-weight: 900; font-size: 1.32rem; line-height: 1; letter-spacing: -0.01em; }
  .sub { margin: 3px 0 0; font-size: 0.68rem; }
  .regla { border-top: 1px solid #000; margin: 2px 0; }
  .regla.gruesa { border-top-width: 7px; }
  .regla.media { border-top-width: 3px; }
  .fila { display: flex; justify-content: space-between; gap: 8px; padding: 1.5px 0; border-bottom: 1px solid #000; }
  .fila:last-of-type { border-bottom: 0; }
  .fila span:last-child { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .fuerte { font-weight: 800; font-size: 0.8rem; }
  .sangria { padding-left: 10px; }
  .pie { margin: 2px 0 0; font-size: 0.62rem; }
</style>

```
### `src/components/Logo.svelte`

```svelte
<script>
  let { claro = false } = $props();
</script>

<span class="logo" class:claro>
  <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
    <path d="M16 2.5 C16 2.5 5.5 14 5.5 20.5 a10.5 10.5 0 0 0 21 0 C26.5 14 16 2.5 16 2.5z" fill="currentColor" />
    <path d="M16 27 V15 M16 21 l-4 -3.5 M16 18 l3.5 -3" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none" />
  </svg>
  <span class="nombre">Smart<b>Dose</b></span>
</span>

<style>
  .logo { display: inline-flex; align-items: center; gap: 8px; color: var(--verde-700); }
  .claro { color: #fff; }
  .claro svg path:last-child { stroke: var(--verde-700); }
  .nombre { font-size: 1.2rem; font-weight: 400; letter-spacing: -0.005em; }
  b { font-weight: 700; }
</style>

```
### `src/lib/ui.js`

```js
// Identidad visual por tipo de superficie.
// banda = franja superior de la tarjeta (como en los mockups), orbe = esfera brillante del ícono.
export const CATEGORIAS = {
  piso:   { banda: '#22985A', orbe: '#22985A', liquido: '#9BD8A9', glifo: 'trapeador' },
  bano:   { banda: '#2563A8', orbe: '#2563A8', liquido: '#8DB8E8', glifo: 'inodoro' },
  sanitario: { banda: '#2563A8', orbe: '#2563A8', liquido: '#8DB8E8', glifo: 'inodoro' },
  vidrio: { banda: '#1E9BB5', orbe: '#1E9BB5', liquido: '#A8E0EA', glifo: 'ventana' },
  mesa:   { banda: '#B7791F', orbe: '#B7791F', liquido: '#F0CF9A', glifo: 'mesa' },
};

/** Cada recipiente tiene su color: quien limpia reconoce qué agarrar sin leer. */
export const RECIPIENTE_COLOR = { balde: '#1D6FB8', botella: '#1B8A63', spray: '#D9661F' };

export const SUCIEDAD_COLOR = { ligera: '#22985A', normal: '#B7791F', pesada: '#C2410C' };

/** Mezcla dos colores hex. t=0 → a, t=1 → b. */
export function mezclar(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Glifos de línea (24×24) que se pintan en blanco sobre las esferas.
export const GLIFOS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  bandeja: 'M3.5 6.5a2 2 0 012-2h13a2 2 0 012 2v11a2 2 0 01-2 2h-13a2 2 0 01-2-2zM3.5 13h5l1.5 2.5h4l1.5-2.5h5',
  buscar: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20.5 20.5l-4.5-4.5',
  inicio: 'M3 11.5L12 3.5l9 8M5.5 9.5V20.5h13V9.5M10 20.5v-6h4v6',
  lugar: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 7.2a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8z',
  gota: 'M12 3s6.5 7.2 6.5 11.5a6.5 6.5 0 01-13 0C5.5 10.2 12 3 12 3zM9 15a3 3 0 003 3',
  voz: 'M4 9.5h3.5L12.5 5.5v13l-5-4H4zM16 9a4.2 4.2 0 010 6M18.6 6.4a8 8 0 010 11.2',
  trapeador: 'M15.5 2.5L11 13.5M6 13.5h10l2.5 7.5h-15zM8 17v4M12 17v4M16 17v4',
  inodoro: 'M6 3h5v7H6zM3.5 10h17c0 4-3.2 6.5-7 6.5V21h-5v-4.5c-3 0-5-2.5-5-6.5z',
  ventana: 'M4.5 3h15v18h-15zM12 3v18M4.5 12h15',
  mesa: 'M2.5 8.5h19M5.5 8.5V20M18.5 8.5V20M5.5 14h13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alerta: 'M12 4v9M12 18v.5',
  mas: 'M12 5v14M5 12h14',
  microfono: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5.5 11.5a6.5 6.5 0 0013 0M12 18v3',
  cerrar: 'M6 6l12 12M18 6L6 18',
  subir: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  regla: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  cuadro: 'M4 4h16v16H4z',
  ajustes: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  mapa: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  izquierda: 'M15 5l-7 7 7 7',
  derecha: 'M9 5l7 7-7 7',
};

```
