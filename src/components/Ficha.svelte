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
