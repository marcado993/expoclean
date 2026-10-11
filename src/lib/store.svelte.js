// Estado del prototipo, guardado en el navegador del kiosko.
// En producción esto pasaría a un backend; para la demo basta localStorage.

const CLAVE = 'smartdose:v5';

const inicial = {
  areas: [
    { id: 'a1',  nombre: 'Baños planta baja',    area_m2: 25,  superficie: 'bano',      suciedad: 'normal', zona: 'sanitario' },
    { id: 'a9',  nombre: 'Inodoros y urinarios', area_m2: 20,  superficie: 'sanitario', suciedad: 'pesada', zona: 'sanitario' },
    { id: 'a5',  nombre: 'Baños 2.º piso',       area_m2: 18,  superficie: 'bano',      suciedad: 'pesada', zona: 'sanitario' },
    { id: 'a10', nombre: 'Lavamanos y espejos',  area_m2: 8,   superficie: 'vidrio',    suciedad: 'normal', zona: 'lavabo' },
    { id: 'a2',  nombre: 'Pasillo principal',    area_m2: 120, superficie: 'piso',      suciedad: 'normal', zona: 'general' },
    { id: 'a6',  nombre: 'Recepción',            area_m2: 45,  superficie: 'piso',      suciedad: 'ligera', zona: 'general' },
    { id: 'a7',  nombre: 'Oficinas',             area_m2: 80,  superficie: 'piso',      suciedad: 'normal', zona: 'general' },
    { id: 'a3',  nombre: 'Ventanales del lobby', area_m2: 30,  superficie: 'vidrio',    suciedad: 'ligera', zona: 'general' },
    { id: 'a8',  nombre: 'Sala de reuniones',    area_m2: 12,  superficie: 'mesa',      suciedad: 'normal', zona: 'general' },
    { id: 'a4',  nombre: 'Comedor',              area_m2: 18,  superficie: 'mesa',      suciedad: 'pesada', zona: 'cocina' },
  ],
  hoy: ['a1', 'a10', 'a3'], // lugares asignados para hoy (los elige el supervisor)
  historial: [], // { fecha, areaId, agua_ml, quimico_ml, base_agua_ml, base_quimico_ml }
  croquis: null, // { imagen, ancho, alto, mpp } — plano del edificio; mpp = metros por pixel
  pendientes: {}, // areaId → cargas que faltan (para que nadie tenga que recordarlo)
  ecoloop_litros: 0,
  dispositivo: { ip: '192.168.4.1', simular: true },
  voz: true,
};

function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    return guardado ? { ...inicial, ...guardado } : structuredClone(inicial);
  } catch {
    return structuredClone(inicial);
  }
}

export const db = $state(cargar());

/** Estado de la interfaz que no se guarda. enfoque = pantalla de dispensar a pantalla completa. */
export const ui = $state({ enfoque: false });

$effect.root(() => {
  $effect(() => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(db));
    } catch {}
  });
});

export function reiniciar() {
  Object.assign(db, structuredClone(inicial));
}
