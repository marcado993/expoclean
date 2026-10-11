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
