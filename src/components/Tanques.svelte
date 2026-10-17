<script>
  // Los 4 compartimentos de la máquina dibujados como tanques: el número es el del compartimento
  // físico, el líquido es del color del tipo de producto y su altura es lo que queda.
  import { PRODUCTOS, TIPOS, liquidoDe } from '../lib/catalogo.js';

  let { compartimentos = [], onelegir = null, deshabilitar = () => false, alto = 150 } = $props();

  const estado = (c) => (!c.producto ? 'sin' : c.nivel_ml <= 0 ? 'vacio' : c.nivel_ml / c.capacidad_ml < 0.2 ? 'bajo' : 'ok');
</script>

<div class="tanques" style="--alto:{alto}px">
  {#each compartimentos as c, i}
    {@const e = estado(c)}
    {@const pct = c.capacidad_ml ? Math.max(0, Math.min(1, c.nivel_ml / c.capacidad_ml)) : 0}
    <svelte:element this={onelegir ? 'button' : 'div'} class="tanque" class:sin={e === 'sin'} class:vacio={e === 'vacio'}
      disabled={onelegir ? deshabilitar(c, i) : undefined} onclick={onelegir ? () => onelegir(c, i) : undefined}
      aria-label="Compartimento {i + 1}: {PRODUCTOS[c.producto]?.nombre ?? 'sin producto'}{e === 'vacio' ? ', vacío' : `, queda ${Math.round(pct * 100)} por ciento`}">
      <span class="num">{i + 1}</span>
      <span class="cuerpo">
        <span class="liquido" style="height:{pct * 100}%; background:{liquidoDe(c.producto)}"></span>
        {#if e !== 'sin'}<span class="pct">{e === 'vacio' ? 'Vacío' : `${Math.round(pct * 100)} %`}</span>{/if}
      </span>
      <span class="nombre">{PRODUCTOS[c.producto]?.nombre ?? 'Sin producto'}</span>
      {#if c.producto}<span class="tipo">{TIPOS[PRODUCTOS[c.producto].tipo].nombre}</span>{/if}
    </svelte:element>
  {/each}
</div>

<style>
  .tanques { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .tanque {
    display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 0; padding: 0;
    border: 0; background: none; color: var(--tinta); font: inherit; text-align: center;
  }
  button.tanque { cursor: pointer; }
  button.tanque:disabled { cursor: default; opacity: 0.45; }
  .num { font-size: 1.05rem; font-weight: 700; line-height: 1; }
  .cuerpo {
    position: relative; width: 100%; height: var(--alto); overflow: hidden;
    border: 3px solid var(--tinta); border-radius: 10px 10px 14px 14px; background: var(--blanco);
  }
  button.tanque:active:not(:disabled) .cuerpo { transform: translateY(2px); }
  .liquido { position: absolute; left: 0; right: 0; bottom: 0; border-top: 2px solid rgb(20 32 43 / 0.25); transition: height 0.3s linear; }
  .pct { position: absolute; left: 0; right: 0; top: 6px; font-size: 0.85rem; font-weight: 700; }
  .vacio .cuerpo { border-color: var(--alerta); }
  .vacio .pct { color: var(--alerta); }
  .sin .cuerpo { border-style: dashed; border-color: var(--tinta-tenue); }
  .nombre {
    width: 100%; font-size: 0.85rem; font-weight: 700; line-height: 1.15; min-height: 2.3em;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .sin .nombre { color: var(--tinta-tenue); font-weight: 500; }
  .tipo { margin-top: -4px; font-size: 0.75rem; font-weight: 500; color: var(--tinta-suave); }
  @media (prefers-reduced-motion: reduce) { .liquido { transition: none; } }
</style>
