// Entiende frases habladas o escritas como "voy a limpiar el baño del segundo piso".
// Corre en el navegador, sin internet ni llaves de API: reglas + sinónimos + puntaje.
// (La transcripción de voz sí la hace el navegador.)

const ORDINALES = [
  [/\b(primer|primero|primera|1er|1ro|1ra|uno)\b/g, ' 1 '],
  [/\b(segundo|segunda|2do|2da|dos)\b/g, ' 2 '],
  [/\b(tercer|tercero|tercera|3er|3ro|3ra|tres)\b/g, ' 3 '],
  [/\b(4to|4ta|cuatro)\b/g, ' 4 '],
  [/\b(5to|5ta|quinto|quinta|cinco)\b/g, ' 5 '],
  [/\bplanta baja\b/g, ' pb '],
];

/** Palabras que delatan el tipo de superficie. */
export const SINONIMOS = {
  bano: ['bano', 'banos', 'servicio', 'servicios', 'wc', 'ducha', 'duchas'],
  sanitario: ['sanitario', 'sanitarios', 'inodoro', 'inodoros', 'urinario', 'urinarios', 'lavabo', 'lavabos', 'lavamanos', 'taza', 'tazas'],
  piso: ['suelo', 'pasillo', 'pasillos', 'corredor', 'trapear', 'barrer', 'recepcion', 'oficina', 'oficinas', 'hall', 'entrada', 'escalera', 'escaleras', 'lobby'],
  vidrio: ['vidrio', 'vidrios', 'ventana', 'ventanas', 'ventanal', 'ventanales', 'espejo', 'espejos', 'cristal', 'cristales', 'mampara'],
  mesa: ['mesa', 'mesas', 'escritorio', 'escritorios', 'comedor', 'superficie', 'superficies', 'mueble', 'muebles', 'mostrador', 'counter'],
};

const VACIAS = new Set('a al el la los las de del en voy vamos a limpiar limpio limpia limpiando quiero tengo que hay por para con un una y o este esta ese esa ahi aqui ahora hoy me toca toco necesito'.split(' '));

export function normalizar(texto) {
  let t = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  for (const [re, r] of ORDINALES) t = t.replace(re, r);
  return t.replace(/\s+/g, ' ').trim();
}

const palabras = (t) => normalizar(t).split(' ').filter((p) => p && !VACIAS.has(p));
const numeros = (ps) => ps.filter((p) => /^\d+$|^pb$/.test(p));

/** Tipo de superficie que se menciona, o null. "segundo piso" no cuenta como "piso". */
export function detectarSuperficie(texto) {
  const ps = normalizar(texto).split(' ');
  const puntos = { bano: 0, sanitario: 0, piso: 0, vidrio: 0, mesa: 0 };
  // El objeto que se limpia (ventana, inodoro, mesa) pesa más que el lugar (entrada, pasillo).
  ps.forEach((p, i) => {
    for (const [k, lista] of Object.entries(SINONIMOS)) if (lista.includes(p)) puntos[k] += k === 'piso' ? 1 : 2;
    if (p === 'piso' && !/^\d+$|^pb$/.test(ps[i - 1] ?? '')) puntos.piso++;
  });
  const [mejor, n] = Object.entries(puntos).sort((a, b) => b[1] - a[1])[0];
  return n > 0 ? mejor : null;
}

/**
 * Ordena los lugares por parecido con lo que dijo la persona.
 * @returns {{ candidatos: {area, puntos}[], seguro: boolean }}
 */
export function buscarLugar(texto, areas) {
  const dichas = palabras(texto);
  const numDichos = numeros(dichas);
  const tipo = detectarSuperficie(texto);

  const candidatos = areas
    .map((area) => {
      const delNombre = palabras(area.nombre);
      const numNombre = numeros(delNombre);
      let puntos = 0;
      for (const p of delNombre) {
        if (/^\d+$|^pb$/.test(p)) continue;
        if (dichas.includes(p)) puntos += 3;
        else if (p.length > 4 && dichas.some((d) => d.length > 4 && (d.startsWith(p.slice(0, 5)) || p.startsWith(d.slice(0, 5))))) puntos += 2;
      }
      if (tipo && tipo === area.superficie) puntos += 2;
      if (numDichos.length && numNombre.length) puntos += numDichos.some((n) => numNombre.includes(n)) ? 3 : -3;
      return { area, puntos };
    })
    .filter((c) => c.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos);

  const [a, b] = candidatos;
  return { candidatos, seguro: !!a && a.puntos >= 3 && (!b || a.puntos - b.puntos >= 2) };
}

/**
 * Para el supervisor: "baño del segundo piso, 25 metros, muy sucio" → datos del formulario.
 * Devuelve solo lo que pudo entender.
 */
export function interpretarLugar(texto) {
  const crudo = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const out = {};

  const conUnidad = crudo.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|mts?2?|metros?(?:\s+cuadrados)?)\b/);
  const suelto = [...crudo.matchAll(/\b(\d+(?:[.,]\d+)?)\b(?!\s*(?:do|da|er|ro|ra|to|ta)\b)/g)].at(-1);
  const m = conUnidad ?? suelto;
  if (m) out.area_m2 = Math.round(parseFloat(m[1].replace(',', '.')));

  if (/muy sucio|bastante sucio|muy cochino|mucha mugre|pesad|grasa|mucho trafico/.test(crudo)) out.suciedad = 'pesada';
  else if (/poco sucio|casi limpio|limpio|ligera|poca/.test(crudo)) out.suciedad = 'ligera';
  else if (/normal|regular|sucio/.test(crudo)) out.suciedad = 'normal';

  const tipo = detectarSuperficie(texto);
  if (tipo) out.superficie = tipo;

  const nombre = texto
    .replace(/,?\s*(?:de\s+|con\s+|mide\s+)?\d+(?:[.,]\d+)?\s*(?:m2|m²|mts?2?|metros?(?:\s+cuadrados)?)?\b(?!\s*(?:do|da|er|ro|ra|to|ta)\b)/gi, ' ')
    .replace(/,?\s*(?:y\s+|esta\s+|está\s+)?(?:muy |bastante |poco |casi )?(?:sucio|sucia|limpio|limpia|cochino|normal)\b/gi, ' ')
    .replace(/^\s*(?:el|la|los|las)\s+/i, '')
    .replace(/[,.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (nombre) out.nombre = nombre[0].toUpperCase() + nombre.slice(1);
  return out;
}

/** Reconocimiento de voz del navegador (Chrome/Edge). null si no hay. */
export function crearOyente({ alEscuchar, alTerminar, alError }) {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!SR) return null;
  const r = new SR();
  r.lang = 'es-EC';
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    const texto = [...e.results].map((x) => x[0].transcript).join(' ');
    alEscuchar?.(texto, e.results[e.results.length - 1].isFinal);
  };
  r.onerror = (e) => alError?.(e.error);
  r.onend = () => alTerminar?.();
  return r;
}
