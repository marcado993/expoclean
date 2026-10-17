<script>
  // Rombo de seguridad NFPA 704: azul = salud, rojo = inflamabilidad, amarillo = reactividad,
  // blanco = riesgo especial (OX comburente, COR corrosivo). Números de 0 (nada) a 4 (extremo).
  let { nfpa = [0, 0, 0, ''], size = 64 } = $props();
  const [salud, fuego, reac, especial] = $derived(nfpa);
</script>

<svg class="rombo" viewBox="0 0 100 100" width={size} height={size} role="img"
  aria-label="Rombo NFPA: salud {salud}, inflamabilidad {fuego}, reactividad {reac}{especial ? `, especial ${especial}` : ''}">
  <g transform="rotate(45 50 50)" stroke="#0F1E3A" stroke-width="2.5" stroke-linejoin="round">
    <rect x="20" y="20" width="30" height="30" fill="#E53935" />
    <rect x="50" y="20" width="30" height="30" fill="#FDD835" />
    <rect x="20" y="50" width="30" height="30" fill="#1E6FD9" />
    <rect x="50" y="50" width="30" height="30" fill="#FFFFFF" />
  </g>
  <g font-family="Figtree, sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central">
    <text x="50" y="22" font-size="19" fill="#fff">{fuego}</text>
    <text x="28" y="50" font-size="19" fill="#fff">{salud}</text>
    <text x="72" y="50" font-size="19" fill="#0F1E3A">{reac}</text>
    <text x="50" y="78" font-size={especial.length > 2 ? 11 : 14} fill="#0F1E3A">{especial}</text>
  </g>
</svg>

<style>
  .rombo { display: block; flex: none; overflow: visible; }
</style>
