// Identidad visual por tipo de superficie.
// banda = franja superior de la tarjeta (como en los mockups), orbe = esfera brillante del ícono.
export const CATEGORIAS = {
  piso:   { banda: '#22985A', orbe: '#22985A', liquido: '#9BD8A9', glifo: 'trapeador' },
  bano:   { banda: '#2563A8', orbe: '#2563A8', liquido: '#8DB8E8', glifo: 'inodoro' },
  sanitario: { banda: '#2563A8', orbe: '#2563A8', liquido: '#8DB8E8', glifo: 'inodoro' },
  vidrio: { banda: '#1E9BB5', orbe: '#1E9BB5', liquido: '#A8E0EA', glifo: 'ventana' },
  mesa:   { banda: '#B7791F', orbe: '#B7791F', liquido: '#F0CF9A', glifo: 'mesa' },
};

/**
 * Código de colores de la industria de la limpieza (estilo BICSc): el color marca la ZONA,
 * y el balde, el paño y el chisguete de esa zona son de ese color. El personal ya lo conoce.
 */
export const ZONAS = {
  sanitario: { nombre: 'Sanitarios', color: '#C62828', palabra: 'rojo', tinta: '#fff' },          // inodoros, urinarios, piso del baño
  lavabo:    { nombre: 'Lavamanos y espejos', color: '#B88600', palabra: 'amarillo', tinta: '#fff' }, // amarillo: superficies del baño
  general:   { nombre: 'Áreas generales', color: '#1D6FB8', palabra: 'azul', tinta: '#fff' },     // oficinas, pasillos, vidrios
  cocina:    { nombre: 'Cocina y comedor', color: '#2E7D32', palabra: 'verde', tinta: '#fff' },    // donde hay alimentos
};
const ZONA_POR_SUPERFICIE = { sanitario: 'sanitario', bano: 'sanitario', piso: 'general', vidrio: 'general', mesa: 'general' };
export const zonaDe = (area) => area.zona ?? ZONA_POR_SUPERFICIE[area.superficie] ?? 'general';
export const colorDe = (area) => ZONAS[zonaDe(area)].color;
/** "Balde rojo", "Botella roja": el color concuerda con el recipiente. */
const FEMENINO = { botella: true };
export const palabraColor = (zona, recipiente) => {
  const w = ZONAS[zona].palabra;
  return FEMENINO[recipiente] ? w.replace(/o$/, 'a') : w;
};

export const SUCIEDAD_COLOR = { ligera: '#22985A', normal: '#B7791F', pesada: '#C2410C' };

/** Mezcla dos colores hex. t=0 → a, t=1 → b. */
export function mezclar(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Glifos de línea (24×24) que se pintan en blanco sobre las esferas.
export const GLIFOS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  bandeja: 'M3.5 6.5a2 2 0 012-2h13a2 2 0 012 2v11a2 2 0 01-2 2h-13a2 2 0 01-2-2zM3.5 13h5l1.5 2.5h4l1.5-2.5h5',
  buscar: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20.5 20.5l-4.5-4.5',
  inicio: 'M3 11.5L12 3.5l9 8M5.5 9.5V20.5h13V9.5M10 20.5v-6h4v6',
  lugar: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 7.2a2.4 2.4 0 100 4.8 2.4 2.4 0 000-4.8z',
  gota: 'M12 3s6.5 7.2 6.5 11.5a6.5 6.5 0 01-13 0C5.5 10.2 12 3 12 3zM9 15a3 3 0 003 3',
  voz: 'M4 9.5h3.5L12.5 5.5v13l-5-4H4zM16 9a4.2 4.2 0 010 6M18.6 6.4a8 8 0 010 11.2',
  trapeador: 'M15.5 2.5L11 13.5M6 13.5h10l2.5 7.5h-15zM8 17v4M12 17v4M16 17v4',
  inodoro: 'M6 3h5v7H6zM3.5 10h17c0 4-3.2 6.5-7 6.5V21h-5v-4.5c-3 0-5-2.5-5-6.5z',
  ventana: 'M4.5 3h15v18h-15zM12 3v18M4.5 12h15',
  mesa: 'M2.5 8.5h19M5.5 8.5V20M18.5 8.5V20M5.5 14h13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alerta: 'M12 4v9M12 18v.5',
  mas: 'M12 5v14M5 12h14',
  microfono: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5.5 11.5a6.5 6.5 0 0013 0M12 18v3',
  cerrar: 'M6 6l12 12M18 6L6 18',
  subir: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  regla: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
  cuadro: 'M4 4h16v16H4z',
  ajustes: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.2-.8.2-1.2z',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  mapa: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  izquierda: 'M15 5l-7 7 7 7',
  derecha: 'M9 5l7 7-7 7',
};
