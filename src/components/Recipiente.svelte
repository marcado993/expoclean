<script>
  // Recipiente dibujado como un vaso medidor: contorno, marcas de volumen y nivel plano.
  // nivel y objetivo van de 0 a 1 respecto a la capacidad.
  import { mezclar } from '../lib/ui.js';

  // ola = el líquido se mueve (mientras se llena): superficie ondulada y burbujas que suben.
  let { tipo = 'spray', nivel = 0, objetivo = 0, liquido = '#9fd0c0', abierto = false, marcas = true, color = '#3b4641', ola = false } = $props();
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

<svg viewBox="{marcas ? -26 : 0} 0 {marcas ? 252 : 200} 285" preserveAspectRatio="xMidYMin meet" class="recipiente" role="img"
  aria-label="{tipo === 'balde' ? 'Balde' : 'Botella'} lleno al {Math.round(nivel * 100)} por ciento">
  <defs><clipPath id="int-{id}"><path d={f.cuerpo} /></clipPath></defs>

  {#if tipo === 'balde'}
    <path d="M36 96 C40 52 160 52 164 96" fill="none" stroke="#8a958f" stroke-width="2.5" />
  {/if}

  <path d={f.cuerpo} fill="#ffffff" />

  <g clip-path="url(#int-{id})">
    <g class="nivel" style="transform: translateY({ySup}px)" opacity={nivel > 0.001 ? 1 : 0}>
      {#if ola}
        <path class="ola atras" d="M-200 0 q25 -7 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V300 H-200 Z" fill={linea} opacity="0.35" />
        <path class="ola" d="M-200 4 q25 -9 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V300 H-200 Z" fill={liquido} />
        {#each [[70, 0], [100, 0.7], [125, 1.3], [88, 1.9], [112, 2.4]] as [x, retraso]}
          <circle class="burbuja" cx={x} cy="120" r="3.5" fill="#fff" opacity="0.7" style="animation-delay:{retraso}s" />
        {/each}
      {:else}
        <rect x="0" y="0" width="200" height="300" fill={liquido} />
        <line x1="0" x2="200" y1="0" y2="0" stroke={linea} stroke-width="2" />
      {/if}
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
        <text x={f.der(ym) + 8} y={ym + 4} text-anchor="start" font-size="13" font-weight="600" fill="#4D5A66" font-family="Overpass, sans-serif">{v} {f.unidad}</text>
      {/if}
    {/each}
  {/if}

  <path d={f.cuerpo} fill="none" stroke={color} stroke-width="3.5" stroke-linejoin="round" />

  {#if tipo === 'balde'}
    <rect x="24" y="86" width="152" height="10" rx="3" fill={color} stroke={color} stroke-width="3" />
  {:else if tipo === 'botella'}
    <rect x="82" y="58" width="36" height="16" rx="3" fill={color} stroke={color} stroke-width="3" />
    {#if !abierto}<path d="M94 58 V48 H106 V58" fill="#ffffff" stroke="#3b4641" stroke-width="3" />{/if}
  {:else}
    <rect x="76" y="82" width="48" height="14" rx="2" fill={color} stroke={color} stroke-width="3" />
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
  .ola { animation: ola 1.6s linear infinite; }
  .ola.atras { animation-duration: 2.4s; animation-direction: reverse; }
  @keyframes ola { to { transform: translateX(100px); } }
  .burbuja { animation: sube 2.6s ease-in infinite; }
  @keyframes sube { from { transform: translateY(0); opacity: 0.8; } to { transform: translateY(-110px); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .nivel { transition: none; } .ola, .burbuja { animation: none; } }
</style>
