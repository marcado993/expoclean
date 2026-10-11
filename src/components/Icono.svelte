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
