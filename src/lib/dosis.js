// Cálculo de dosis recomendada por área.
//
// Idea: el VOLUMEN de solución depende de cuánto hay que cubrir (m² × tasa de
// aplicación del método). La CONCENTRACIÓN depende de qué tan sucio está
// (dilución de la ficha técnica del producto). Así nunca se sobredosifica.
//
// Todos los números son valores de partida: reemplazar con la ficha técnica del
// producto biodegradable real y con lo medido en el piloto.

/** Dilución = partes de agua por 1 parte de concentrado (1:100 → 100). */
export const PRODUCTOS = {
  piso:     { nombre: 'Limpiador neutro de pisos', color: '#2f9e44', dilucion: { ligera: 200, normal: 100, pesada: 50 } },
  bano:     { nombre: 'Desinfectante para baños', color: '#1971c2', dilucion: { ligera: 100, normal: 50,  pesada: 25 } },
  vidrio:   { nombre: 'Limpiavidrios',           color: '#0c8599', dilucion: { ligera: 200, normal: 150, pesada: 100 } },
  multiuso: { nombre: 'Desengrasante multiuso',  color: '#e8590c', dilucion: { ligera: 150, normal: 80,  pesada: 40 } },
};

/** tasa = mL de solución que se gastan por m² con ese método. */
export const SUPERFICIES = {
  piso:   { nombre: 'Pisos',   producto: 'piso',     recipiente: 'balde', tasa: 50 },
  bano:   { nombre: 'Baños',   producto: 'bano',     recipiente: 'balde', tasa: 70 },
  sanitario: { nombre: 'Sanitarios', producto: 'bano', recipiente: 'botella', tasa: 25 },
  vidrio: { nombre: 'Vidrios', producto: 'vidrio',   recipiente: 'spray', tasa: 20 },
  mesa:   { nombre: 'Superficies',producto: 'multiuso', recipiente: 'spray', tasa: 25 },
};

/** Balde para trapear, botella para inodoros y lavamanos, chisguete (atomizador) para vidrios y superficies.
 *  minimo = lo mínimo con lo que se puede trabajar (un balde con 1 L no sirve para trapear). */
export const RECIPIENTES = {
  balde: { nombre: 'Balde',     capacidad: 8000, minimo: 3000 },
  botella: { nombre: 'Botella',  capacidad: 1000, minimo: 500 },
  spray: { nombre: 'Chisguete', capacidad: 500,  minimo: 250 },
};

export const SUCIEDAD = {
  ligera: { nombre: 'Poca' },
  normal: { nombre: 'Normal' },
  pesada: { nombre: 'Mucha' },
};

/**
 * Línea base: lo que se usa hoy llenando "a ojo" (balde lleno + un chorro).
 * MEDIR EN EL PILOTO y reemplazar: es la métrica que pide el reto.
 */
export const LINEA_BASE = {
  balde: { agua: 8000, quimico: 60 },
  botella: { agua: 1000, quimico: 40 },
  spray: { agua: 500,  quimico: 25 },
};

const redondear = (x, paso) => Math.round(x / paso) * paso;

/**
 * @param {{ area_m2: number, superficie: keyof SUPERFICIES, suciedad: keyof SUCIEDAD }} p
 */
export function calcularDosis({ area_m2, superficie, suciedad = 'normal' }) {
  const sup = SUPERFICIES[superficie];
  if (!sup) throw new Error(`Superficie desconocida: ${superficie}`);
  if (!(area_m2 > 0)) throw new Error('El área debe ser mayor a 0 m²');

  const prod = PRODUCTOS[sup.producto];
  const rec = RECIPIENTES[sup.recipiente];
  const dilucion = prod.dilucion[suciedad];

  const solucionNecesaria = Math.max(area_m2 * sup.tasa, rec.minimo);
  const cargas = Math.ceil(solucionNecesaria / rec.capacidad);
  const porCarga = redondear(solucionNecesaria / cargas, 10);

  const quimico = redondear(porCarga / (dilucion + 1), 0.5);
  const agua = porCarga - quimico;

  const base = LINEA_BASE[sup.recipiente];
  return {
    producto: sup.producto,
    recipiente: sup.recipiente,
    dilucion,
    cargas,
    porCarga: { agua_ml: agua, quimico_ml: quimico },
    total: { agua_ml: agua * cargas, quimico_ml: quimico * cargas },
    lineaBase: { agua_ml: base.agua * cargas, quimico_ml: base.quimico * cargas },
  };
}
