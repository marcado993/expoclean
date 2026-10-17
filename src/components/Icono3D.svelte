<script>
  // Ícono realista (PNG 3D de public/iconos3d, Microsoft Fluent, licencia MIT).
  // Para cosas reales (lugares, recipientes, equipo); los botones de la interfaz usan Icono (línea).
  let { nombre, size = 40, alt = '' } = $props();
</script>

<img class="icono3d" src="/iconos3d/{nombre}.png" width={size} height={size} {alt} draggable="false" decoding="async" />

<style>
  .icono3d { display: block; flex: none; object-fit: contain; user-select: none; pointer-events: none; }
</style>
