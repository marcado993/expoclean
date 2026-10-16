<script>
  // Configuración CleanDose: qué producto contiene cada uno de los 4 compartimentos.
  // En la lista, los productos están agrupados por tipo (cloro, desengrasante, aceite…).
  import Icono from '../../components/Icono.svelte';
  import { datos, ui, refrescar } from '../../lib/nube.svelte.js';
  import { api } from '../../lib/api.js';
  import { TIPOS, PRODUCTOS, COLOR_COMPARTIMENTO } from '../../lib/catalogo.js';

  // Borrador local: se edita aquí y se guarda todo junto.
  let borrador = $state(datos.compartimentos.map((c) => ({ ...c })));
  let guardando = $state(false);
  let mensaje = $state('');
  let error = $state('');
  $effect(() => {
    if (!borrador.length && datos.compartimentos.length) borrador = datos.compartimentos.map((c) => ({ ...c }));
  });

  const cambiado = $derived(borrador.some((c, i) => c.producto !== datos.compartimentos[i]?.producto || c.nivel_ml !== datos.compartimentos[i]?.nivel_ml));
  const porTipo = Object.entries(TIPOS).map(([k, t]) => [t.nombre, Object.entries(PRODUCTOS).filter(([, p]) => p.tipo === k)]);

  function elegir(i, producto) {
    borrador[i].producto = producto || null;
    // Si se cambia el producto, se asume que se cargó lleno.
    borrador[i].nivel_ml = producto ? borrador[i].capacidad_ml : 0;
    mensaje = '';
  }
  const rellenar = (i) => (borrador[i].nivel_ml = borrador[i].capacidad_ml);

  async function guardar() {
    guardando = true;
    error = '';
    try {
      await api.compartimentos(borrador.map((c) => ({ producto: c.producto, nivel_ml: c.nivel_ml })));
      await refrescar();
      borrador = datos.compartimentos.map((c) => ({ ...c }));
      mensaje = 'Configuración guardada.';
    } catch (e) {
      error = e.codigo === 409 ? 'La máquina está dosificando. Espera a que termine.' : 'No se pudo guardar. Revisa la conexión.';
    } finally {
      guardando = false;
    }
  }
</script>

<div class="config">
  <div>
    <h1 class="titulo">Configuración CleanDose</h1>
    <p class="bajada">Selecciona qué producto contiene cada compartimento del dosificador.</p>
  </div>

  <svg class="maquina" viewBox="0 0 220 150" aria-hidden="true">
    <defs>
      <linearGradient id="caja" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" /><stop offset="1" stop-color="#E9EDF3" /></linearGradient>
    </defs>
    <rect x="30" y="6" width="160" height="96" rx="22" fill="url(#caja)" stroke="#D5DCE6" stroke-width="1.5" />
    {#each [0, 1, 2, 3] as i}
      {@const x = 72 + i * 25}
      <rect x={x - 3} y="24" width="6" height="56" rx="3" fill={COLOR_COMPARTIMENTO[i]} opacity={borrador[i]?.producto ? 1 : 0.25} />
      <rect x={x - 7} y="100" width="14" height="12" rx="3" fill="#2B3445" />
      <rect x={x - 2} y="112" width="4" height="8" fill="#9AA6B8" />
      <rect x={x - 8} y="124" width="16" height="18" rx="4" fill="#fff" stroke="#D5DCE6" />
      <text x={x} y="137" text-anchor="middle" font-size="11" font-weight="800" fill="#0F1E3A">{i + 1}</text>
    {/each}
  </svg>

  <div class="filas">
    {#each borrador as c, i}
      <div class="fila">
        <span class="num">{i + 1}</span>
        <span class="punto" style="background:{COLOR_COMPARTIMENTO[i]}"></span>
        <span class="botella" style="color:{COLOR_COMPARTIMENTO[i]}"><Icono nombre="botella" size={26} trazo={1.8} /></span>
        <label class="eleccion">
          <span class="e-nombre">{PRODUCTOS[c.producto]?.nombre ?? 'Sin producto'}</span>
          <span class="e-sub">
            {c.producto ? `${TIPOS[PRODUCTOS[c.producto].tipo].nombre}, queda ${Math.round((c.nivel_ml / c.capacidad_ml) * 100)} %` : 'Toca para elegir'}
          </span>
          <select value={c.producto ?? ''} onchange={(e) => elegir(i, e.currentTarget.value)} disabled={ui.ocupado} aria-label="Producto del compartimento {i + 1}">
            <option value="">Sin producto</option>
            {#each porTipo as [tipo, productos]}
              <optgroup label={tipo}>
                {#each productos as [k, p]}<option value={k}>{p.nombre}</option>{/each}
              </optgroup>
            {/each}
          </select>
          <Icono nombre="abajo" size={20} trazo={2} />
        </label>
        {#if c.producto && c.nivel_ml < c.capacidad_ml}
          <button class="rellenar" onclick={() => rellenar(i)}>Lo llené</button>
        {/if}
      </div>
    {/each}
  </div>

  <p class="info"><Icono nombre="info" size={22} trazo={2} /> Esta configuración se guarda en el servidor: todos ven lo mismo.</p>
  {#if error}<p class="error">{error}</p>{:else if mensaje}<p class="ok">{mensaje}</p>{/if}
  <button class="boton guardar" onclick={guardar} disabled={!cambiado || guardando || !!datos.maquina.dosis}>
    {guardando ? 'Guardando…' : 'Guardar configuración'}
  </button>
</div>

<style>
  .config { height: 100%; display: flex; flex-direction: column; gap: 10px; }
  .maquina { flex: 1 1 120px; min-height: 90px; max-height: 170px; width: 100%; }
  .filas { flex: none; display: flex; flex-direction: column; gap: 8px; }
  .fila { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--linea); border-radius: var(--radio); background: var(--blanco); }
  .num { flex: none; display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid var(--linea); border-radius: 8px; font-weight: 800; }
  .punto { flex: none; width: 16px; height: 16px; border-radius: 50%; }
  .botella { flex: none; display: grid; }
  .eleccion { position: relative; flex: 1; min-width: 0; display: grid; grid-template-columns: 1fr auto; align-items: center; column-gap: 6px; cursor: pointer; color: var(--tinta-suave); }
  .e-nombre { grid-column: 1; font-weight: 800; color: var(--tinta); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .e-sub { grid-column: 1; font-size: 0.8rem; }
  .eleccion :global(.icono) { grid-column: 2; grid-row: 1 / 3; }
  .eleccion select { position: absolute; inset: 0; opacity: 0; cursor: pointer; font-size: 16px; }
  .rellenar { flex: none; height: 34px; padding: 0 10px; border: 1.5px solid var(--linea-fuerte); border-radius: 999px; background: var(--blanco); font-size: 0.8rem; font-weight: 700; cursor: pointer; }
  .info { flex: none; display: flex; align-items: center; gap: 10px; margin: 0; padding: 12px 14px; border-radius: var(--radio); background: var(--t-azul); color: var(--tinta); font-size: 0.9rem; }
  .info :global(.icono) { color: var(--azul); }
  .error { margin: 0; color: var(--alerta); font-weight: 700; }
  .ok { margin: 0; color: var(--verde-oscuro); font-weight: 700; }
  .guardar { flex: none; width: 100%; height: 56px; margin-top: auto; }
</style>
