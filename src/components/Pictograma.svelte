<script>
  // Pictograma GHS simplificado: rombo blanco con borde rojo y el símbolo en negro.
  import { NOMBRE_GHS } from '../lib/catalogo.js';
  let { codigo = '07', size = 44 } = $props();
</script>

<svg class="ghs" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Peligro: {NOMBRE_GHS[codigo]}">
  <title>{NOMBRE_GHS[codigo]}</title>
  <rect x="17" y="17" width="66" height="66" transform="rotate(45 50 50)" fill="#fff" stroke="#E53935" stroke-width="7" stroke-linejoin="round" />
  <g fill="#0F1E3A" stroke="#0F1E3A" stroke-linejoin="round" stroke-linecap="round">
    {#if codigo === '07'}
      <rect x="45" y="27" width="10" height="32" rx="4" stroke="none" />
      <circle cx="50" cy="69" r="6" stroke="none" />
    {:else if codigo === '02'}
      <path d="M50 24 C58 36 66 42 64 56 C63 66 57 72 50 72 C43 72 36 66 36 57 C36 48 42 44 44 36 C47 42 48 45 50 46 C52 40 52 32 50 24 Z" stroke="none" />
      <rect x="32" y="74" width="36" height="4" stroke="none" />
    {:else if codigo === '03'}
      <circle cx="50" cy="60" r="11" fill="none" stroke-width="5" />
      <path d="M50 22 C56 30 61 34 60 42 C59 48 55 50 50 50 C45 50 40 47 40 41 C40 35 44 33 45 28 C47 32 48 34 50 34 C51 30 51 26 50 22 Z" stroke="none" />
      <rect x="32" y="75" width="36" height="4" stroke="none" />
    {:else if codigo === '05'}
      <path d="M30 28 L40 24 L48 40 L38 44 Z" stroke="none" />
      <path d="M58 24 L68 28 L60 44 L50 40 Z" stroke="none" />
      <circle cx="40" cy="50" r="2.8" stroke="none" /><circle cx="42" cy="58" r="2.4" stroke="none" />
      <circle cx="58" cy="50" r="2.8" stroke="none" /><circle cx="56" cy="58" r="2.4" stroke="none" />
      <path d="M26 66 h20 l-3 6 h-17 Z" stroke="none" />
      <path d="M54 68 c4 -3 10 -3 14 0 l4 6 h-22 Z" stroke="none" />
    {:else if codigo === '09'}
      <path d="M36 70 V42 M36 46 L28 38 M36 52 L44 42 M36 58 L28 52" fill="none" stroke-width="4" />
      <path d="M50 64 C56 56 66 56 72 64 C66 72 56 72 50 64 Z M72 64 L78 58 V70 Z" stroke="none" />
      <path d="M26 74 h50" fill="none" stroke-width="3" />
    {/if}
  </g>
</svg>

<style>
  .ghs { display: block; flex: none; }
</style>
