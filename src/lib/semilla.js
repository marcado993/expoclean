// Datos de ejemplo SOLO para los tests (traza.test.js). Producción arranca vacía.
import { mlProducto } from './catalogo.js';

export const OPERARIOS = [
  { id: 'op1', nombre: 'María Quishpe' },
  { id: 'op2', nombre: 'José Tipán' },
  { id: 'op3', nombre: 'Carmen Andrade' },
  { id: 'op4', nombre: 'Luis Guamán' },
];

export const ESPACIOS = [
  { id: 'a1',  nombre: 'Baños planta baja',    area_m2: 25,  superficie: 'bano',      suciedad: 'normal', zona: 'sanitario' },
  { id: 'a9',  nombre: 'Inodoros y urinarios', area_m2: 20,  superficie: 'sanitario', suciedad: 'pesada', zona: 'sanitario' },
  { id: 'a5',  nombre: 'Baños 2.º piso',       area_m2: 18,  superficie: 'bano',      suciedad: 'pesada', zona: 'sanitario' },
  { id: 'a10', nombre: 'Lavamanos y espejos',  area_m2: 8,   superficie: 'vidrio',    suciedad: 'normal', zona: 'lavabo' },
  { id: 'a2',  nombre: 'Pasillo principal',    area_m2: 120, superficie: 'piso',      suciedad: 'normal', zona: 'general' },
  { id: 'a6',  nombre: 'Recepción',            area_m2: 45,  superficie: 'piso',      suciedad: 'ligera', zona: 'general' },
  { id: 'a7',  nombre: 'Oficinas',             area_m2: 80,  superficie: 'piso',      suciedad: 'normal', zona: 'general' },
  { id: 'a11', nombre: 'Laboratorio 1',        area_m2: 40,  superficie: 'mesa',      suciedad: 'normal', zona: 'general' },
  { id: 'a12', nombre: 'Laboratorio 2',        area_m2: 35,  superficie: 'mesa',      suciedad: 'pesada', zona: 'general' },
  { id: 'a3',  nombre: 'Ventanales del lobby', area_m2: 30,  superficie: 'vidrio',    suciedad: 'ligera', zona: 'general' },
  { id: 'a4',  nombre: 'Comedor',              area_m2: 18,  superficie: 'mesa',      suciedad: 'pesada', zona: 'cocina' },
];

/** Qué producto y recipiente se usa normalmente en cada tipo de superficie (para la semana de ejemplo). */
const USO = {
  bano:      { productos: ['cloro5', 'amonio'], recipiente: 'balde' },
  sanitario: { productos: ['cloro5'],           recipiente: 'botella' },
  piso:      { productos: ['neutro'],           recipiente: 'balde' },
  vidrio:    { productos: ['vidrios'],          recipiente: 'spray' },
  mesa:      { productos: ['desengr', 'amonio'], recipiente: 'spray' },
};

// Compartimentos tal como estarían a mitad de semana: uno por acabarse y uno vacío, para que la
// trazabilidad tenga algo que mostrar.
const COMPARTIMENTOS = [
  { producto: 'cloro5',  nivel_ml: 3200 },
  { producto: 'desengr', nivel_ml: 700 },
  { producto: 'neutro',  nivel_ml: 4100 },
  { producto: 'vidrios', nivel_ml: 0 },
];

/** Generador pseudoaleatorio con semilla: la semana de ejemplo sale igual siempre. */
function aleatorio(semilla) {
  let s = semilla >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/**
 * Una semana de dosis. Cada operario limpia 3–5 espacios al día.
 * Luis vuelve por más producto en casi cada limpieza (gasta de más);
 * Carmen usa chisguete donde va balde (se queda corta). El resto, normal.
 */
export function semanaDeEjemplo(ahora = Date.now()) {
  const azar = aleatorio(20261016);
  const registros = [];
  const DIA = 86400000;
  for (let d = 6; d >= 0; d--) {
    for (const op of OPERARIOS) {
      const limpiezas = 3 + Math.floor(azar() * 3);
      for (let k = 0; k < limpiezas; k++) {
        const e = ESPACIOS[Math.floor(azar() * ESPACIOS.length)];
        const uso = USO[e.superficie];
        const productoId = uso.productos[Math.floor(azar() * uso.productos.length)];
        let recipiente = uso.recipiente;
        let veces = 1;
        if (op.id === 'op4') veces = azar() < 0.8 ? 2 : 3;
        if (op.id === 'op3' && recipiente === 'balde') recipiente = 'botella';
        const hora = 7 + Math.floor(azar() * 9);
        for (let v = 0; v < veces; v++) {
          const fecha = new Date(ahora - d * DIA);
          fecha.setHours(hora, Math.floor(azar() * 60) + v, 0, 0);
          if (fecha.getTime() > ahora) continue;
          registros.push({
            id: `ej-${registros.length}`,
            fecha: fecha.toISOString(),
            operarioId: op.id,
            espacioId: e.id,
            productoId,
            compartimento: COMPARTIMENTOS.findIndex((c) => c.producto === productoId) + 1 || 1,
            recipiente,
            ml_producto: mlProducto(productoId, recipiente),
            estado: 'hecha',
            ejemplo: true,
          });
        }
      }
    }
  }
  return registros.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
