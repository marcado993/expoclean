<script>
  // Seguridad de un producto en un vistazo: rombo NFPA, pictogramas de peligro y qué ponerse.
  import { scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import Rombo from './Rombo.svelte';
  import Pictograma from './Pictograma.svelte';
  import Icono from './Icono.svelte';
  import { SEGURIDAD } from '../lib/catalogo.js';
  import { dur } from '../lib/movimiento.js';

  let { producto, compacto = false } = $props();
  const s = $derived(SEGURIDAD[producto]);
  const EPP = { guantes: ['guantes', 'Guantes'], gafas: ['gafas', 'Gafas'], mascarilla: ['mascarilla', 'Mascarilla'] };
</script>

{#if s}
  <div class="seguridad" class:compacto>
    <span in:scale={{ start: 0.5, duration: dur(320), easing: backOut }}><Rombo nfpa={s.nfpa} size={compacto ? 40 : 58} /></span>
    {#each s.ghs as g, i}
      <span in:scale={{ start: 0.5, delay: dur(80 + i * 70), duration: dur(320), easing: backOut }}><Pictograma codigo={g} size={compacto ? 34 : 46} /></span>
    {/each}
    {#if !compacto}
      <span class="separa" aria-hidden="true"></span>
      {#each s.epp as e, i}
        <span class="epp" title={EPP[e][1]} in:scale={{ start: 0.5, delay: dur(200 + i * 70), duration: dur(300), easing: backOut }}>
          <Icono nombre={EPP[e][0]} size={22} trazo={2} /><small>{EPP[e][1]}</small>
        </span>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .seguridad { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .seguridad > span { display: grid; }
  .separa { width: 1px; height: 36px; margin: 0 4px; background: var(--linea); }
  .epp { display: flex !important; flex-direction: column; align-items: center; gap: 1px; padding: 4px 6px; border-radius: 10px; background: var(--t-azul); color: var(--azul); }
  .epp small { font-size: 0.66rem; font-weight: 700; color: var(--tinta-suave); }
</style>
