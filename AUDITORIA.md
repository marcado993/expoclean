# Auditoría de usabilidad — SmartDose (kiosko dispensador)

**Usuario principal:** personal de limpieza, escolaridad máxima bachillerato, poco tiempo y atención (≈10 s por tarea).
**Método:** 10 heurísticas de Nielsen + criterios de accesibilidad para baja alfabetización (reconocer antes que leer, cero pasos ocultos).
**Severidad:** 4 = bloquea la tarea · 3 = la vuelve lenta o propensa a error · 2 = molestia · 1 = cosmético.

## Hallazgos y correcciones

| # | Hallazgo | Heurística | Sev. | Corrección aplicada |
|---|---|---|---|---|
| 1 | Hacer scroll para llegar al botón de llenar. Para este usuario, un scroll es un paso extra que se pierde. | Visibilidad del estado / Flexibilidad | 4 | Ninguna pantalla tiene scroll. Las tarjetas se adaptan al alto disponible; si no caben, flechas grandes. |
| 2 | Flujo de 4 pasos (categoría → lugar → scroll → "Llenar"). | Eficiencia de uso | 4 | 1 toque: pone el recipiente y toca su lugar; la máquina llena sola y vuelve al inicio. |
| 3 | Botones "Detener" y "Cancelar" exigían decidir en medio del llenado. | Prevención de errores | 3 | Eliminados. La máquina hace todo; el corte de seguridad queda en el firmware (`/detener`). |
| 4 | Buscador de texto: pide leer y escribir. | Reconocer antes que recordar | 3 | Reemplazado por tarjetas visuales + botón "Decirlo" (voz). |
| 5 | No se sabía qué recipiente traer. | Reconocer antes que recordar | 3 | Cada tarjeta dice y muestra el recipiente con su color fijo: **balde azul, botella verde, chisguete naranja**. El paso 1 muestra los tres. |
| 6 | Tarjetas mezcladas sin orden. | Estética y diseño minimalista | 2 | Agrupadas por recipiente (azules, verdes, naranjas): se busca por color, no leyendo. |
| 7 | Cargas múltiples dependían de la memoria ("vuelve por el segundo balde"). | Reconocer antes que recordar | 3 | La tarjeta muestra "Falta 1" y continúa en la carga correcta. Más tiempo en pantalla (10 s) cuando falta otra. |
| 8 | Ilustraciones tipo caricatura y degradados: poca credibilidad ante supervisores y jurado. | Consistencia y estándares | 2 | Un solo set de íconos profesionales (Tabler), trazo uniforme. Recipiente dibujado como vaso medidor con marcas de L/mL. |
| 9 | Animaciones decorativas (burbujas, olas, rebotes) distraen. | Estética y diseño minimalista | 2 | Eliminadas. Solo se mueve lo que informa: el nivel del líquido, el chorro y la barra de progreso. Respeta "reducir movimiento" del sistema. |
| 10 | Tipografía de Google Fonts: sin internet el kiosko cambiaba de letra. | Consistencia | 2 | Source Sans 3 y Archivo incluidas en el proyecto. Texto base 17 px; nombres de lugar 19 px. |
| 11 | El supervisor podía entrar sin querer desde el kiosko. | Prevención de errores | 3 | Engrane que se mantiene presionado 1,5 s; la barra inferior solo aparece en modo supervisor. |
| 12 | "Borrar lugar" sin confirmación. | Prevención de errores | 3 | Pide confirmar y explica la consecuencia ("desaparece del dispensador"). |
| 13 | Botón de voz de 40 px. | Accesibilidad (objetivo táctil) | 2 | 48 px mínimo en todo control táctil. |
| 15 | El "Listo" era una línea de texto fácil de pasar por alto. | Visibilidad del estado del sistema | 3 | Aviso al centro: check, "Ya puedes ir a limpiar" y botón grande "Cerrar"; se cierra solo en 6 s (10 s si falta otra carga). |
| 16 | Sobrecarga de información: cada tarjeta repetía el recipiente 3 veces (borde, recuadro y píldora de color) más un bloque de 2 pasos con 4 íconos; en pantallas bajas los nombres se partían a mitad de palabra. | Estética y diseño minimalista | 3 | Lista de una columna: un solo ícono por lugar (el recipiente, en su color) y el nombre completo en una línea. Título único "Toca tu lugar" con una línea de apoyo. |
| 17 | Colores inventados por tipo de recipiente (azul = balde…), distintos de lo que el personal aprende en capacitación. | Coincidencia con el mundo real | 3 | Código de colores de la industria por zona: rojo sanitarios, amarillo lavamanos y espejos, azul áreas generales, verde cocina y comedor. El texto dice el color ("Balde rojo") para quien no distingue colores. |
| 18 | Diez lugares con el mismo peso visual; la persona busca cada vez entre todos. | Ley de Hick / Eficiencia | 3 | "Hoy te toca": los lugares asignados por el supervisor van arriba en grande, con estado automático ("Listo", "Falta 1") y conteo "1 de 3 listos". El resto, agrupado por zona; si no caben, "Ver todos los lugares". |
| 14 | Error genérico si la máquina no responde. | Ayudar a reconocer y recuperarse de errores | 3 | "La máquina no respondió. Avisa a tu supervisor." + voz + botón "Intentar otra vez"; vuelve solo al inicio en 20 s. |

Fuentes del código de colores: [Arrow County](https://arrowcounty.com/news/post/the-importance-of-colour-coded-cleaning-explained), [Vileda Professional](https://export.vileda-professional.com/knowledge-section/infection-prevention/colour-coded-cleaning) (no hay norma internacional única; rojo = sanitarios y azul = áreas generales son lo más consistente).

## Lo que se mide en el piloto (para validar)

1. **Tiempo por recarga** (toque → "Listo"): meta ≤ 15 s incluyendo poner el recipiente.
2. **Toques por recarga:** meta 1.
3. **Errores de lugar** (tocó un lugar equivocado): registrar con el supervisor.
4. **Agua y producto vs. "a ojo":** pantalla Impacto; medir la línea base antes de instalar.

## Pendiente (no resuelto todavía)

- La voz depende de Chrome/Edge y de internet (el navegador envía el audio a su servicio de reconocimiento).
- El croquis no detecta cuartos automáticamente: se dibujan a mano. Detección automática requeriría un modelo de visión con servidor propio.
- Probar con 3–5 personas del personal real antes de la presentación; esta auditoría es experta, no con usuarios.
