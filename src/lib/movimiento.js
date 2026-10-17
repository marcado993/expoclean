// Efectos: si el celular pide "reducir movimiento", las transiciones duran 0.
export const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const dur = (ms) => (reducido ? 0 : ms);

/** Vibración corta al tocar (si el celular la tiene). */
export const tic = (ms = 12) => navigator.vibrate?.(ms);
