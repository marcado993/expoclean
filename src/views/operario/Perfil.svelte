<script>
  import Icono from '../../components/Icono.svelte';
  import { datos, sesion, operarioActual } from '../../lib/nube.svelte.js';

  const yo = $derived(operarioActual());
  const mias = $derived(datos.registros.filter((r) => r.operarioId === sesion.operarioId));
  const hechas = $derived(datos.tareas.filter((t) => t.operarioId === sesion.operarioId && t.estado === 'hecha').length);

  function salir() {
    sesion.rol = null;
    sesion.operarioId = null;
    location.hash = '#inicio';
  }
</script>

<div class="perfil">
  <div class="cabeza">
    <span class="avatar">{yo?.nombre.split(' ').slice(0, 2).map((p) => p[0]).join('') ?? ''}</span>
    <div>
      <h1 class="titulo">{yo?.nombre}</h1>
      <p class="bajada">Operario</p>
    </div>
  </div>

  <dl class="datos">
    <div><dt>Dosis registradas</dt><dd>{mias.length}</dd></div>
    <div><dt>Tareas hechas</dt><dd>{hechas}</dd></div>
    <div><dt>Máquina</dt><dd class:ok={datos.maquina.enLinea}>{datos.maquina.enLinea ? 'Conectada' : 'Desconectada'}</dd></div>
  </dl>

  <button class="boton secundario salir" onclick={salir}><Icono nombre="salir" size={20} /> Cambiar de usuario</button>
</div>

<style>
  .perfil { height: 100%; display: flex; flex-direction: column; gap: 18px; }
  .cabeza { display: flex; align-items: center; gap: 14px; }
  .avatar { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: var(--t-azul); color: var(--azul); font-size: 1.4rem; font-weight: 800; }
  .datos { margin: 0; display: flex; flex-direction: column; border: 1px solid var(--linea); border-radius: var(--radio-tarjeta); }
  .datos div { display: flex; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--linea); }
  .datos div:last-child { border-bottom: 0; }
  dt { color: var(--tinta-suave); }
  dd { margin: 0; font-weight: 800; color: var(--alerta); }
  dd:not(.ok):first-child, .datos div:not(:last-child) dd { color: var(--tinta); }
  dd.ok { color: var(--verde-oscuro); }
  .salir { width: 100%; margin-top: auto; }
</style>
