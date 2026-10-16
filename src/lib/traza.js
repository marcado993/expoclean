// Trazabilidad para el administrador: cuánto producto queda, dónde se gasta y quién gasta de más o de menos.
import { PRODUCTOS } from './catalogo.js';

const DIA = 86400000;
export const BAJO = 0.2; // menos del 20 % = por acabarse

/** Estado de cada compartimento. estado: 'sin' (sin producto) | 'vacio' | 'bajo' | 'ok' */
export function stock(compartimentos) {
  return compartimentos.map((c, i) => {
    const pct = c.capacidad_ml ? c.nivel_ml / c.capacidad_ml : 0;
    const estado = !c.producto ? 'sin' : c.nivel_ml <= 0 ? 'vacio' : pct < BAJO ? 'bajo' : 'ok';
    return { n: i + 1, producto: c.producto, nombre: PRODUCTOS[c.producto]?.nombre ?? 'Sin producto', pct, nivel_ml: c.nivel_ml, estado };
  });
}

const recientes = (registros, dias, ahora) =>
  registros.filter((r) => r.estado === 'hecha' && ahora - new Date(r.fecha).getTime() <= dias * DIA);

/**
 * Por espacio: producto gastado, cuántas veces se limpió y cuándo fue la última.
 * sinProducto = productos que se usan ahí y que ya se acabaron o están por acabarse.
 */
export function porEspacio(registros, espacios, compartimentos, { dias = 7, ahora = Date.now() } = {}) {
  const falta = new Set(stock(compartimentos).filter((s) => s.estado === 'vacio' || s.estado === 'bajo').map((s) => s.producto));
  const rs = recientes(registros, dias, ahora);
  return espacios
    .map((e) => {
      const mios = rs.filter((r) => r.espacioId === e.id);
      const productos = [...new Set(mios.map((r) => r.productoId))];
      const ultima = mios.reduce((m, r) => (r.fecha > m ? r.fecha : m), '');
      return {
        espacio: e,
        ml: mios.reduce((t, r) => t + r.ml_producto, 0),
        limpiezas: new Set(mios.map((r) => `${r.operarioId}|${r.fecha.slice(0, 10)}`)).size,
        ultima: ultima || null,
        sinProducto: productos.filter((p) => falta.has(p)),
      };
    })
    .sort((a, b) => b.ml - a.ml);
}

/**
 * Por operario: mL de producto por limpieza (un espacio, un día) comparado con el promedio del equipo.
 * veredicto: 'mucho' (gasta 30 % más o más), 'poco' (30 % menos o menos: no usa lo necesario), 'normal'.
 */
export function porOperario(registros, operarios, { dias = 7, ahora = Date.now(), margen = 0.3 } = {}) {
  const rs = recientes(registros, dias, ahora);
  const filas = operarios.map((o) => {
    const mios = rs.filter((r) => r.operarioId === o.id);
    const limpiezas = new Set(mios.map((r) => `${r.espacioId}|${r.fecha.slice(0, 10)}`)).size;
    const ml = mios.reduce((t, r) => t + r.ml_producto, 0);
    return { operario: o, dosis: mios.length, limpiezas, ml, mlPorLimpieza: limpiezas ? ml / limpiezas : 0 };
  });
  const activos = filas.filter((f) => f.limpiezas > 0);
  const promedio = activos.length ? activos.reduce((t, f) => t + f.mlPorLimpieza, 0) / activos.length : 0;
  return filas
    .map((f) => {
      const relacion = promedio && f.limpiezas ? f.mlPorLimpieza / promedio : 0;
      const veredicto = !f.limpiezas ? 'sin' : relacion >= 1 + margen ? 'mucho' : relacion <= 1 - margen ? 'poco' : 'normal';
      return { ...f, relacion, veredicto, promedio };
    })
    .sort((a, b) => b.relacion - a.relacion);
}

/** Operario a quien mandar una tarea "automático": el que tiene menos tareas pendientes (empate: el primero). */
export function operarioMasLibre(operarios, tareas) {
  const pendientes = (id) => tareas.filter((t) => t.operarioId === id && t.estado === 'pendiente').length;
  return [...operarios].sort((a, b) => pendientes(a.id) - pendientes(b.id))[0] ?? null;
}
