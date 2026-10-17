<script>
  // Máquina (Bluetooth) y lista de operarios.
  import Icono from '../../components/Icono.svelte';
  import Maquina from '../../components/Maquina.svelte';
  import { datos, ui } from '../../lib/nube.svelte.js';
  import { api } from '../../lib/api.js';
  import { maquina, dosificarBLE, NoSePudo } from '../../lib/ble.svelte.js';
  import { tic } from '../../lib/movimiento.js';

  let nombre = $state('');
  let error = $state('');
  let probando = $state(false);
  let prueba = $state('');

  async function agregar(e) {
    e.preventDefault();
    error = '';
    try {
      await api.agregarOperario(nombre);
      nombre = '';
    } catch (err) {
      error = err.message;
    }
  }

  async function quitar(o) {
    if (!confirm(`¿Quitar a ${o.nombre}? Sus tareas pendientes pasan a otro operario.`)) return;
    await api.quitarOperario(o.id).catch((err) => (error = err.message));
  }

  // Prueba del relé: 3 s en el compartimento 1, sin registrar ni descontar producto.
  async function probar() {
    tic(20);
    probando = true;
    ui.ocupado = true;
    prueba = 'Bomba encendida…';
    try {
      await dosificarBLE({ compartimento: 1, segundos: 3 });
      prueba = 'La bomba se prendió 3 s y se apagó.';
    } catch (e) {
      prueba = e instanceof NoSePudo && e.motivo === 'ocupado' ? 'La máquina está ocupada.' : 'La máquina no respondió.';
    } finally {
      probando = false;
      ui.ocupado = false;
    }
  }
</script>

<div class="equipo">
  <h1 class="titulo">Máquina y operarios</h1>
  <Maquina grande />
  <button class="boton probar" onclick={probar} disabled={probando || !maquina.conectada}>
    <Icono nombre="rayo" size={22} trazo={2.2} /> Probar bomba 3 s
  </button>
  {#if prueba}<p class="prueba">{prueba}</p>{/if}

  <h2 class="titulo">Operarios</h2>
  <form class="agregar" onsubmit={agregar}>
    <input bind:value={nombre} maxlength="40" placeholder="Nombre y apellido" aria-label="Nombre del operario" />
    <button class="boton" disabled={!nombre.trim()}><Icono nombre="mas" size={20} /> Agregar</button>
  </form>
  {#if error}<p class="error">{error}</p>{/if}
  <div class="filas">
    {#each datos.operarios as o (o.id)}
      {@const n = datos.tareas.filter((t) => t.operarioId === o.id && t.estado === 'pendiente').length}
      <div class="fila">
        <span class="o-nombre">{o.nombre}</span>
        <span class="o-dato">{n ? `${n} pendiente${n > 1 ? 's' : ''}` : ''}</span>
        <button class="quitar" onclick={() => quitar(o)} aria-label="Quitar a {o.nombre}"><Icono nombre="cerrar" size={20} /></button>
      </div>
    {:else}
      <p class="vacio-txt">Agrega a las personas que usan la máquina. Aparecerán en la pantalla de inicio.</p>
    {/each}
  </div>
</div>

<style>
  .equipo { display: flex; flex-direction: column; gap: 10px; padding-bottom: 8px; }
  .maquina { flex: none; display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 12px; background: var(--blanco); border: 1px solid var(--linea); border-left: 6px solid var(--alerta); }
  .maquina.ok { border-left-color: var(--verde-marca); }
  .luz { flex: none; width: 14px; height: 14px; border-radius: 50%; background: var(--alerta); }
  .ok .luz { background: var(--verde-marca); }
  h2 { margin: 0; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.015em; }
  .m-texto p { margin: 2px 0 0; color: var(--tinta-suave); font-size: 0.95rem; }
  .probar { flex: none; width: 100%; }
  .prueba { flex: none; margin: 0; font-weight: 700; color: var(--tinta-suave); }
  .titulo { margin-top: 6px; }
  .agregar { flex: none; display: flex; gap: 8px; }
  .agregar input { flex: 1; min-width: 0; height: 50px; padding: 0 12px; border: 1.5px solid var(--linea-fuerte); border-radius: var(--radio); font-size: 1rem; }
  .agregar input:focus { outline: none; border-color: var(--azul); }
  .agregar .boton { height: 50px; padding: 0 16px; }
  .error { margin: 0; color: var(--alerta); font-weight: 700; }
  .filas { display: flex; flex-direction: column; background: var(--blanco); border: 1px solid var(--linea); border-radius: 12px; }
  .fila { display: flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 6px 0 14px; border-bottom: 1px solid var(--linea); }
  .o-nombre { flex: 1; font-weight: 800; }
  .o-dato { font-size: 0.85rem; color: var(--tinta-suave); font-weight: 600; }
  .quitar { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: none; color: var(--tinta-tenue); cursor: pointer; border-radius: var(--radio); }
  .vacio-txt { margin: 0; padding: 14px; color: var(--tinta-suave); }
</style>
