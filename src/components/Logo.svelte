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
