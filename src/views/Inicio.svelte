<script>
  // Quién usa este celular. Se elige una vez; se recuerda en el dispositivo.
  import Icono from '../components/Icono.svelte';
  import { datos, sesion } from '../lib/nube.svelte.js';

  function soy(id) {
    sesion.rol = 'operario';
    sesion.operarioId = id;
    location.hash = '#op';
  }
  function admin() {
    sesion.rol = 'admin';
    sesion.operarioId = null;
    location.hash = '#admin';
  }
  const iniciales = (n) => n.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();
</script>

<div class="inicio">
  <div>
    <h1 class="titulo">¿Quién eres?</h1>
    <p class="bajada">Toca tu nombre para empezar.</p>
  </div>

  {#if !datos.cargado}
    <p class="aviso">{datos.conectado ? 'Cargando…' : 'Conectando con el servidor…'}</p>
  {:else if datos.operarios.length === 0}
    <p class="aviso">Todavía no hay operarios. El administrador los agrega en Máquina y operarios.</p>
  {:else}
    <div class="operarios" class:muchos={datos.operarios.length > 6}>
      {#each datos.operarios as o (o.id)}
        <button class="operario" onclick={() => soy(o.id)}>
          <span class="inicial">{iniciales(o.nombre)}</span>
          <span class="nombre">{o.nombre}</span>
        </button>
      {/each}
    </div>
  {/if}

  <button class="boton secundario admin" onclick={admin}>
    <Icono nombre="ajustes" size={20} /> Soy administrador
  </button>
</div>

<style>
  .inicio { height: 100%; display: flex; flex-direction: column; gap: 16px; }
  .aviso { margin: 0; font-size: 1.1rem; color: var(--tinta-suave); }
  .operarios { flex: 1; min-height: 0; overflow: hidden; display: grid; grid-template-columns: 1fr 1fr; align-content: start; gap: 14px; }
  .operario {
    height: 116px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 8px; cursor: pointer;
    border: 0; border-radius: var(--radio-tarjeta); background: var(--t-verde); color: var(--tinta);
  }
  .operario:active { filter: brightness(0.97); }
  .muchos .operario { height: 76px; flex-direction: row; justify-content: flex-start; padding: 0 12px; }
  .inicial {
    display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; flex: none;
    background: var(--blanco); color: var(--verde-oscuro); font-weight: 800; font-size: 1.05rem;
  }
  .nombre { font-size: 1.1rem; font-weight: 800; line-height: 1.15; text-align: center; }
  .muchos .nombre { text-align: left; }
  .admin { flex: none; width: 100%; margin-top: auto; }
</style>
