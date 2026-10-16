// Datos fijos con los que arranca la máquina si el servidor está vacío.
// El administrador puede cambiarlos después desde la app (Espacios, Máquina y operarios).

export const LUGARES_FIJOS = [
  { id: 'l-bano-pb',   nombre: 'Baño planta baja',   area_m2: 20, superficie: 'bano',   suciedad: 'normal', zona: 'sanitario' },
  { id: 'l-bano-p2',   nombre: 'Baño 2.º piso',      area_m2: 16, superficie: 'bano',   suciedad: 'normal', zona: 'sanitario' },
  { id: 'l-lab1',      nombre: 'Laboratorio 1',      area_m2: 12.5, superficie: 'mesa', suciedad: 'normal', zona: 'general' },
  { id: 'l-lab2',      nombre: 'Laboratorio 2',      area_m2: 15, superficie: 'mesa',   suciedad: 'normal', zona: 'general' },
  { id: 'l-oficina',   nombre: 'Oficinas',           area_m2: 30, superficie: 'piso',   suciedad: 'ligera', zona: 'general' },
  { id: 'l-pasillo',   nombre: 'Pasillo principal',  area_m2: 60, superficie: 'piso',   suciedad: 'normal', zona: 'general' },
  { id: 'l-vidrios',   nombre: 'Ventanales',         area_m2: 20, superficie: 'vidrio', suciedad: 'ligera', zona: 'general' },
  { id: 'l-comedor',   nombre: 'Comedor',            area_m2: 18, superficie: 'mesa',   suciedad: 'normal', zona: 'cocina' },
];

/** Qué producto tiene cada compartimento al arrancar (hoy los 4 salen por la misma bomba, GPIO 22). */
export const COMPARTIMENTOS_FIJOS = ['neutro', 'cloro5', 'desengr', 'vidrios'];

export const OPERARIOS_FIJOS = [
  { id: 'op-1', nombre: 'Operario 1' },
  { id: 'op-2', nombre: 'Operario 2' },
  { id: 'op-3', nombre: 'Operario 3' },
];
