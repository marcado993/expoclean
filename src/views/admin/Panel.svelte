<script>
  // Administrador: trazabilidad de la limpieza. Resumen, zonas, operarios y alertas.
  import Icono from '../../components/Icono.svelte';
  import { datos, espacioPorId, operarioPorId } from '../../lib/nube.svelte.js';
  import { stock, porEspacio, porOperario } from '../../lib/traza.js';
  import { PRODUCTOS } from '../../lib/catalogo.js';
  import { ZONAS, zonaDe } from '../../lib/ui.js';

  let pestaña = $state('resumen');
  let dias = $state(7);
  let filasTabla = $state(5);

  const DIA = 86400000;
  const ahora = Date.now();
  const enRango = (r, desde, hasta) => r.estado === 'hecha' && new Date(r.fecha).getTime() > desde && new Date(r.fecha).getTime() <= hasta;
  const actuales = $derived(datos.registros.filter((r) => enRango(r, ahora - dias * DIA, ahora)));
  const anteriores = $derived(datos.registros.filter((r) => enRango(r, ahora - 2 * dias * DIA, ahora - dias * DIA)));

  const zonas = $derived(porEspacio(datos.registros, datos.espacios, datos.compartimentos, { dias }));
  const operarios = $derived(porOperario(datos.registros, datos.operarios, { dias }));
  const alertasStock = $derived(stock(datos.compartimentos).filter((s) => s.estado === 'vacio' || s.estado === 'bajo'));
  const sinLimpiar = $derived(zonas.filter((z) => !z.ultima));
  const limpiadas = $derived(zonas.length - sinLimpiar.length);
  const totalMl = $derived(actuales.reduce((t, r) => t + r.ml_producto, 0));
  const totalAntes = $derived(anteriores.reduce((t, r) => t + r.ml_producto, 0));
  const variacion = $derived(totalAntes ? Math.round(((totalMl - totalAntes) / totalAntes) * 100) : null);
  const activos = $derived(operarios.filter((o) => o.dosis > 0));
  const porOperarioSemana = $derived(activos.length ? (totalMl / activos.length) * (7 / dias) : 0);
  const gastones = $derived(operarios.filter((o) => o.veredicto === 'mucho' || o.veredicto === 'poco'));
  const nAlertas = $derived(alertasStock.length + sinLimpiar.length + gastones.length);
  const recientes = $derived([...actuales].reverse());

  const L = (ml) => (ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${Math.round(ml)} ml`);
  const fecha = (iso) => new Date(iso).toLocaleString('es-EC', { day: 'numeric', month: 'short' });
  const hora = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });
  const pct = (r) => `${Math.round(Math.abs(r - 1) * 100)} %`;
  const cuando = (iso) => {
    if (!iso) return 'Sin limpiar';
    const d = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / DIA);
    return d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `Hace ${d} días`;
  };
</script>

<div class="panel">
  <div class="pestañas" role="tablist">
    {#each [['resumen', 'Resumen'], ['zonas', 'Zonas'], ['operarios', 'Operarios'], ['alertas', 'Alertas']] as [k, n]}
      <button role="tab" aria-selected={pestaña === k} class:activa={pestaña === k} onclick={() => (pestaña = k)}>
        {n}{k === 'alertas' && nAlertas ? ` (${nAlertas})` : ''}
      </button>
    {/each}
  </div>

  <label class="rango">
    <Icono nombre="calendario" size={22} trazo={1.9} />
    <select bind:value={dias} aria-label="Periodo">
      <option value={1}>Hoy</option>
      <option value={7}>Últimos 7 días</option>
      <option value={30}>Últimos 30 días</option>
    </select>
    <Icono nombre="abajo" size={20} trazo={2} />
  </label>

  {#if pestaña === 'resumen'}
    <div class="kpis">
      <div class="kpi">
        <span class="k-icono verde"><Icono nombre="lugar" size={24} trazo={2} /></span>
        <small>Zonas limpiadas</small>
        <strong>{limpiadas} / {zonas.length}</strong>
        <span class="progreso"><span style="width:{zonas.length ? (limpiadas / zonas.length) * 100 : 0}%"></span></span>
      </div>
      <div class="kpi">
        <span class="k-icono azul"><Icono nombre="botella" size={24} trazo={2} /></span>
        <small>Producto utilizado</small>
        <strong>{L(totalMl)}</strong>
        {#if variacion !== null}<span class="var" class:sube={variacion > 0}>{variacion > 0 ? '↑' : '↓'} {Math.abs(variacion)} % vs periodo anterior</span>{/if}
      </div>
      <div class="kpi">
        <span class="k-icono azul"><Icono nombre="grupo" size={24} trazo={2} /></span>
        <small>Consumo por operario</small>
        <strong>{L(porOperarioSemana)}</strong>
        <span class="nota">Promedio por semana</span>
      </div>
      <button class="kpi roja" onclick={() => (pestaña = 'alertas')}>
        <span class="k-icono rojo"><Icono nombre="peligro" size={24} trazo={2} /></span>
        <small>Zonas sin limpiar</small>
        <strong class="rojo-txt">{sinLimpiar.length}</strong>
        <span class="enlace">Ver detalles</span>
      </button>
    </div>

    <div class="seccion">
      <h2>Trazabilidad de limpiezas</h2>
      {#if recientes.length > filasTabla}<button class="ver" onclick={() => (filasTabla += 10)}>Ver más</button>{/if}
    </div>
    <table class="tabla">
      <thead><tr><th>Fecha</th><th>Zona</th><th>Operario</th><th>Producto</th><th>Cant.</th></tr></thead>
      <tbody>
        {#each recientes.slice(0, filasTabla) as r (r.id)}
          <tr>
            <td>{fecha(r.fecha)}<br /><span class="tenue">{hora(r.fecha)}</span></td>
            <td>{espacioPorId(r.espacioId)?.nombre ?? '—'}</td>
            <td>{operarioPorId(r.operarioId)?.nombre.split(' ')[0] ?? '—'}</td>
            <td>{PRODUCTOS[r.productoId]?.nombre ?? '—'}</td>
            <td class="num">{L(r.ml_producto)}</td>
          </tr>
        {:else}
          <tr><td colspan="5" class="vacio">Todavía no hay dosis en este periodo.</td></tr>
        {/each}
      </tbody>
    </table>

    <div class="accesos">
      <a class="acceso" href="#admin/espacios">
        <Icono nombre="mapa" size={30} trazo={1.8} />
        <strong>Asignación de espacios</strong>
        <span>Crear y gestionar zonas del establecimiento.</span>
      </a>
      <a class="acceso" href="#admin/asignar">
        <Icono nombre="grupo" size={30} trazo={1.8} />
        <strong>Asignar operario a zona</strong>
        <span>Enviar tareas de limpieza a operarios.</span>
      </a>
    </div>
  {:else if pestaña === 'zonas'}
    <div class="lista">
      {#each zonas as z (z.espacio.id)}
        {@const zc = ZONAS[zonaDe(z.espacio)]}
        <div class="fila">
          <span class="cuadro" style="background:{zc.color}; color:{zc.tinta}"><Icono nombre={z.espacio.superficie} size={18} trazo={2} /></span>
          <span class="f-texto">
            <strong>{z.espacio.nombre}</strong>
            <small class:rojo-txt={!z.ultima}>{cuando(z.ultima)}, {z.limpiezas} limpiezas{z.sinProducto.length ? `, sin ${z.sinProducto.map((p) => PRODUCTOS[p]?.nombre).join(', ')}` : ''}</small>
          </span>
          <span class="f-valor">{L(z.ml)}</span>
        </div>
      {:else}
        <p class="vacio">No hay zonas. Créalas en Asignación de espacios.</p>
      {/each}
    </div>
  {:else if pestaña === 'operarios'}
    <p class="explica">Producto por limpieza comparado con el promedio del equipo (la línea).</p>
    <div class="lista">
      {#each operarios as o (o.operario.id)}
        {@const max = Math.max(1, ...operarios.map((x) => x.mlPorLimpieza))}
        <div class="fila">
          <span class="f-texto">
            <strong>{o.operario.nombre}</strong>
            <small>{o.limpiezas} limpiezas, {L(o.mlPorLimpieza)} por limpieza</small>
            <span class="comparada" style="--prom:{(o.promedio / max) * 100}%"><span class={o.veredicto} style="width:{(o.mlPorLimpieza / max) * 100}%"></span></span>
          </span>
          <span class="veredicto {o.veredicto}">{o.veredicto === 'mucho' ? `+${pct(o.relacion)}` : o.veredicto === 'poco' ? `−${pct(o.relacion)}` : o.veredicto === 'sin' ? 'Sin dosis' : 'Normal'}</span>
        </div>
      {:else}
        <p class="vacio">No hay operarios. Agrégalos en Máquina y operarios.</p>
      {/each}
    </div>
  {:else}
    <div class="lista alertas">
      {#each alertasStock as a}
        <div class="alerta"><Icono nombre="botella" size={22} trazo={2} /><span>Compartimento {a.n}: <strong>{a.nombre}</strong> {a.estado === 'vacio' ? 'se acabó' : `queda ${Math.round(a.pct * 100)} %`}</span></div>
      {/each}
      {#each sinLimpiar as z}
        <div class="alerta"><Icono nombre="lugar" size={22} trazo={2} /><span><strong>{z.espacio.nombre}</strong> no se limpió en este periodo</span><a href="#admin/asignar?e={z.espacio.id}">Asignar</a></div>
      {/each}
      {#each gastones as o}
        <div class="alerta amarilla"><Icono nombre="usuario" size={22} trazo={2} /><span><strong>{o.operario.nombre}</strong> {o.veredicto === 'mucho' ? `gasta ${pct(o.relacion)} más que el resto` : `usa ${pct(o.relacion)} menos de lo necesario`}</span></div>
      {/each}
      {#if !nAlertas}<p class="vacio">Todo en orden en este periodo.</p>{/if}
    </div>
  {/if}
</div>

<style>
  .panel { display: flex; flex-direction: column; gap: 12px; padding-bottom: 8px; }
  .pestañas { display: grid; grid-template-columns: repeat(4, auto); gap: 4px; }
  .pestañas button { height: 44px; padding: 0 8px; border: 0; border-radius: 10px; background: none; cursor: pointer; font-weight: 600; color: var(--tinta-suave); font-size: 0.92rem; }
  .pestañas button.activa { background: var(--azul); color: #fff; font-weight: 700; }
  .rango { position: relative; display: flex; align-items: center; gap: 10px; height: 48px; padding: 0 12px; border: 1px solid var(--linea); border-radius: var(--radio); color: var(--tinta); }
  .rango select { flex: 1; height: 100%; border: 0; background: none; appearance: none; font-weight: 600; cursor: pointer; }

  .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .kpi { display: flex; flex-direction: column; gap: 2px; padding: 14px; border: 1px solid var(--linea); border-radius: var(--radio-tarjeta); background: var(--blanco); text-align: left; font: inherit; color: var(--tinta); }
  button.kpi { cursor: pointer; }
  .kpi.roja { background: var(--t-rojo); border-color: transparent; }
  .k-icono { display: grid; place-items: center; width: 40px; height: 40px; margin-bottom: 6px; border-radius: 10px; }
  .k-icono.verde { background: var(--t-verde); color: var(--i-verde); }
  .k-icono.azul { background: var(--t-azul); color: var(--i-azul); }
  .k-icono.rojo { background: var(--blanco); color: var(--alerta); }
  .kpi small { font-size: 0.82rem; color: var(--tinta-suave); }
  .kpi strong { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; }
  .rojo-txt { color: var(--alerta) !important; }
  .progreso { height: 6px; margin-top: 6px; border-radius: 3px; background: var(--superficie-2); overflow: hidden; }
  .progreso span { display: block; height: 100%; background: var(--verde-marca); }
  .var { font-size: 0.8rem; font-weight: 700; color: var(--verde-oscuro); }
  .var.sube { color: var(--alerta); }
  .nota { font-size: 0.8rem; color: var(--tinta-suave); }
  .enlace { font-size: 0.85rem; font-weight: 700; color: var(--alerta); text-decoration: underline; }

  .seccion { display: flex; align-items: baseline; justify-content: space-between; margin-top: 6px; }
  h2 { margin: 0; font-size: 1.2rem; font-weight: 800; letter-spacing: -0.015em; }
  .ver { border: 0; background: none; color: var(--azul); font-weight: 700; cursor: pointer; }
  .tabla { width: 100%; border-collapse: collapse; font-size: 0.8rem; table-layout: fixed; }
  .tabla th { padding: 8px 4px; text-align: left; font-weight: 600; color: var(--tinta-suave); background: var(--superficie-2); }
  .tabla th:first-child, .tabla td:first-child { width: 22%; padding-left: 8px; }
  .tabla th:last-child { width: 15%; }
  .tabla td { padding: 9px 4px; border-bottom: 1px solid var(--linea); vertical-align: top; overflow-wrap: anywhere; }
  .tabla .num { font-weight: 700; }
  .tenue { color: var(--tinta-tenue); }

  .accesos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
  .acceso { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: var(--radio-tarjeta); background: var(--t-azul); color: var(--azul); text-decoration: none; }
  .acceso strong { font-size: 0.95rem; font-weight: 800; color: var(--tinta); }
  .acceso span { font-size: 0.82rem; color: var(--tinta-suave); }

  .explica { margin: 0; font-size: 0.9rem; color: var(--tinta-suave); }
  .lista { display: flex; flex-direction: column; border: 1px solid var(--linea); border-radius: var(--radio-tarjeta); }
  .fila { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-bottom: 1px solid var(--linea); }
  .fila:last-child { border-bottom: 0; }
  .cuadro { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; }
  .f-texto { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .f-texto strong { font-weight: 800; }
  .f-texto small { font-size: 0.8rem; color: var(--tinta-suave); }
  .f-valor { font-weight: 800; }
  .comparada { position: relative; height: 8px; margin-top: 4px; border-radius: 4px; background: var(--superficie-2); }
  .comparada span { display: block; height: 100%; border-radius: 4px; background: var(--azul); }
  .comparada span.mucho { background: var(--alerta); }
  .comparada span.poco { background: var(--amarillo); }
  .comparada::after { content: ''; position: absolute; top: -3px; bottom: -3px; left: var(--prom); width: 2px; background: var(--tinta); }
  .veredicto { flex: none; padding: 4px 10px; border-radius: 999px; font-size: 0.82rem; font-weight: 800; background: var(--superficie-2); color: var(--tinta-suave); }
  .veredicto.mucho { background: var(--t-rojo); color: var(--alerta); }
  .veredicto.poco { background: #FFF4D6; color: #7A5A00; }
  .alertas { border: 0; gap: 8px; }
  .alerta { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--radio); background: var(--t-rojo); color: var(--alerta); }
  .alerta span { flex: 1; color: var(--tinta); }
  .alerta a { font-weight: 800; color: var(--azul); }
  .alerta.amarilla { background: #FFF4D6; color: #7A5A00; }
  .vacio { margin: 0; padding: 14px; color: var(--tinta-suave); }
</style>
