// Catálogo de productos que se pueden cargar en los 4 compartimentos de CleanDose.
// Lo usan la app y el servidor (server/index.js). Diluciones de partida: reemplazar
// con la ficha técnica de cada producto real.

/** Tipo de producto: es lo primero que elige el operario ("¿qué vas a usar?"). */
export const TIPOS = {
  cloro:         { nombre: 'Cloro',          liquido: '#E4EFA8' },
  desinfectante: { nombre: 'Desinfectante',  liquido: '#E2CBEE' },
  desengrasante: { nombre: 'Desengrasante',  liquido: '#F7CB9C' },
  detergente:    { nombre: 'Detergente',     liquido: '#BBD9F2' },
  vidrios:       { nombre: 'Limpiavidrios',  liquido: '#BDEAF3' },
  aceite:        { nombre: 'Aceite',         liquido: '#EBCB8B' },
};

/** dilucion = partes de agua por 1 de producto (1:50 → 50). 0 = se usa puro. */
export const PRODUCTOS = {
  cloro5:     { nombre: 'Cloro 5 %',                tipo: 'cloro',         dilucion: 50 },
  hipo10:     { nombre: 'Hipoclorito 10 %',         tipo: 'cloro',         dilucion: 100 },
  amonio:     { nombre: 'Amonio cuaternario',       tipo: 'desinfectante', dilucion: 200 },
  peroxido:   { nombre: 'Peróxido de hidrógeno',    tipo: 'desinfectante', dilucion: 30 },
  desengr:    { nombre: 'Desengrasante industrial', tipo: 'desengrasante', dilucion: 20 },
  citrico:    { nombre: 'Multiusos cítrico',        tipo: 'desengrasante', dilucion: 40 },
  neutro:     { nombre: 'Detergente neutro',        tipo: 'detergente',    dilucion: 100 },
  enzimatico: { nombre: 'Detergente enzimático',    tipo: 'detergente',    dilucion: 80 },
  vidrios:    { nombre: 'Limpiavidrios',            tipo: 'vidrios',       dilucion: 10 },
  aceite:     { nombre: 'Aceite para madera',       tipo: 'aceite',        dilucion: 0 },
};

/** Recipiente que se pone debajo de la máquina. */
export const RECIPIENTES = {
  spray:   { nombre: 'Chisguete', capacidad: 500 },
  botella: { nombre: 'Botella',   capacidad: 1000 },
  balde:   { nombre: 'Balde',     capacidad: 8000 },
};

export const N_COMPARTIMENTOS = 4;
export const CAPACIDAD_ML = 5000;
/** Segundos que se prende la bomba en cada dosis (relé). */
export const DOSIS_SEG = 30;

/** mL de producto concentrado para llenar ese recipiente. El aceite (puro) se sirve en poca cantidad. */
export function mlProducto(productoId, recipienteId) {
  const p = PRODUCTOS[productoId];
  const r = RECIPIENTES[recipienteId];
  if (!p || !r) return 0;
  if (p.dilucion === 0) return Math.min(250, r.capacidad);
  return Math.round(r.capacidad / (p.dilucion + 1));
}

export const liquidoDe = (productoId) => TIPOS[PRODUCTOS[productoId]?.tipo]?.liquido ?? '#DDE3E7';

/** Colores fijos de los 4 compartimentos (los tubos de la máquina). */
export const COLOR_COMPARTIMENTO = ['#EC4D82', '#2F9BEA', '#2DB46A', '#F5B800'];

/** Caudal de la bomba peristáltica en mL de producto por segundo. CALIBRAR: 10 s a un vaso medidor. */
export const CAUDAL_ML_S = 1.6;
export const segundosPara = (ml) => Math.min(120, Math.max(1, Math.ceil(ml / CAUDAL_ML_S)));

/** Tipo de limpieza → qué tipos de producto sirven (en orden de preferencia) y cuánto más concentrado. */
export const TIPOS_LIMPIEZA = {
  diaria:       { nombre: 'Limpieza diaria',   icono: 'brillo', tipos: ['detergente', 'desengrasante', 'desinfectante'], factor: 1 },
  profunda:     { nombre: 'Limpieza profunda', icono: 'spray',  tipos: ['desengrasante', 'detergente'], factor: 2 },
  desinfeccion: { nombre: 'Desinfección',      icono: 'escudo', tipos: ['cloro', 'desinfectante'], factor: 1 },
};

/** mL de solución por m² según la superficie (mismo criterio que lib/dosis.js). */
const TASA = { piso: 50, bano: 70, sanitario: 25, vidrio: 20, mesa: 25 };

/**
 * Dosis recomendada para un espacio: elige el compartimento con el producto adecuado, el recipiente
 * más chico donde entra la solución, y cuánto producto y agua lleva.
 * Devuelve { compartimento (1..4) | null, productoId, recipiente, ml_producto, ml_agua, total_ml, cargas, falta }.
 */
export function recomendar(espacio, tipoLimpieza, compartimentos) {
  const tl = TIPOS_LIMPIEZA[tipoLimpieza];
  const preferidos = espacio.superficie === 'vidrio' && tipoLimpieza === 'diaria' ? ['vidrios', ...tl.tipos] : tl.tipos;
  let compartimento = null;
  for (const tipo of preferidos) {
    const i = compartimentos.findIndex((c) => c.producto && PRODUCTOS[c.producto].tipo === tipo && c.nivel_ml > 0);
    if (i >= 0) { compartimento = i + 1; break; }
  }
  const solucion = Math.max(250, (espacio.area_m2 || 1) * (TASA[espacio.superficie] ?? 40));
  const recipiente = solucion <= 500 ? 'spray' : solucion <= 1000 ? 'botella' : 'balde';
  const capacidad = RECIPIENTES[recipiente].capacidad;
  const cargas = Math.max(1, Math.ceil(solucion / capacidad));
  const productoId = compartimento ? compartimentos[compartimento - 1].producto : null;
  const p = productoId ? PRODUCTOS[productoId] : null;
  const ml_producto = !p ? 0 : p.dilucion === 0 ? Math.min(250, capacidad) : Math.round((capacidad / (p.dilucion + 1)) * tl.factor);
  return {
    compartimento, productoId, recipiente, cargas, ml_producto,
    ml_agua: p ? capacidad - ml_producto : 0, total_ml: capacidad,
    falta: compartimento ? null : TIPOS[preferidos[0]].nombre,
  };
}

/**
 * Seguridad de cada producto (VALORES DE REFERENCIA para productos de limpieza típicos:
 * confirmar con la hoja de seguridad SDS del proveedor real).
 *   nfpa: rombo NFPA 704 [salud, inflamabilidad, reactividad, especial] (0–4; especial: 'OX', 'COR' o '')
 *   ghs:  pictogramas GHS (02 inflamable, 03 comburente, 05 corrosivo, 07 irritante, 09 medio ambiente)
 *   epp:  equipo de protección para servirlo: guantes, gafas, mascarilla
 */
export const SEGURIDAD = {
  cloro5:     { nfpa: [2, 0, 1, ''],    ghs: ['05', '09'],       epp: ['guantes', 'gafas'] },
  hipo10:     { nfpa: [3, 0, 1, 'OX'],  ghs: ['05', '09'],       epp: ['guantes', 'gafas', 'mascarilla'] },
  amonio:     { nfpa: [2, 0, 0, ''],    ghs: ['05', '09'],       epp: ['guantes', 'gafas'] },
  peroxido:   { nfpa: [2, 0, 1, 'OX'],  ghs: ['03', '05', '07'], epp: ['guantes', 'gafas'] },
  desengr:    { nfpa: [2, 0, 0, 'COR'], ghs: ['05'],             epp: ['guantes', 'gafas'] },
  citrico:    { nfpa: [1, 1, 0, ''],    ghs: ['07'],             epp: ['guantes'] },
  neutro:     { nfpa: [1, 0, 0, ''],    ghs: [],                 epp: ['guantes'] },
  enzimatico: { nfpa: [1, 0, 0, ''],    ghs: ['07'],             epp: ['guantes'] },
  vidrios:    { nfpa: [1, 2, 0, ''],    ghs: ['02', '07'],       epp: ['guantes'] },
  aceite:     { nfpa: [1, 1, 0, ''],    ghs: [],                 epp: ['guantes'] },
};

export const NOMBRE_GHS = {
  '02': 'Inflamable', '03': 'Comburente', '05': 'Corrosivo', '07': 'Irritante', '09': 'Daña el medio ambiente',
};
