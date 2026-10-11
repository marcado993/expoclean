// Utilidades del croquis (plano del edificio).

/** Reduce la foto del plano para que quepa en el almacenamiento del navegador. */
export function cargarImagen(archivo, max = 1600) {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onerror = () => mal(new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => mal(new Error('El archivo no es una imagen'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        ok({ imagen: c.toDataURL('image/jpeg', 0.85), ancho: c.width, alto: c.height, mpp: null });
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

/** Plano de ejemplo para la demo: 1000 × 700 px a 3 cm por pixel (30 × 21 m). */
export function planoEjemplo() {
  const muro = 'stroke="#33413a" stroke-width="8" fill="none" stroke-linecap="square"';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700">
    <rect width="1000" height="700" fill="#fbfcfb"/>
    <g stroke="#e3e9e5" stroke-width="1">${Array.from({ length: 30 }, (_, i) => `<path d="M${i * 33.3} 0V700"/>`).join('')}${Array.from({ length: 21 }, (_, i) => `<path d="M0 ${i * 33.3}H1000"/>`).join('')}</g>
    <rect x="40" y="40" width="920" height="620" ${muro}/>
    <path d="M40 300H300M300 40V180M300 240V300M640 40V300M640 300H960M300 420V660M300 420H520M580 420H640M640 420V660M640 420H700M760 420H960" ${muro}/>
    <path d="M460 660v-10M520 660v-10" stroke="#fbfcfb" stroke-width="12"/>
    <g fill="#8a9a92" font-family="Arial" font-size="20">
      <text x="60" y="80">Sala</text><text x="320" y="80">Oficinas</text><text x="660" y="80">Comedor</text>
      <text x="60" y="340">Recepción</text><text x="320" y="340">Pasillo</text><text x="320" y="460">Baño</text><text x="660" y="460">Baño</text>
    </g>
  </svg>`;
  return { imagen: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), ancho: 1000, alto: 700, mpp: 0.03 };
}

/** Punto del puntero en coordenadas del SVG. */
export function puntoSvg(svg, e) {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
