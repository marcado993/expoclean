# SmartDose + EcoLoop — Reto 4 (Hack the Water)

Dispensador que entrega el balde o spray **ya mezclado** con la dosis exacta de producto biodegradable para cada lugar, conectado al módulo EcoLoop que recupera agua gris para un segundo uso.

## Flujo de quien limpia: 1 toque, ~10 segundos, sin scroll

1. Pone su balde o botella debajo de la máquina.
2. Toca la tarjeta de su lugar (ilustración + nombre). La máquina llena sola: no hay botón "Llenar" ni "Detener".
3. Ve el recipiente llenarse, escucha "Listo" y la pantalla vuelve sola al inicio en 5 s.

- **Ninguna pantalla tiene scroll** (ni kiosko, ni supervisor). Si no caben los lugares, hay flechas grandes; si sobra espacio, las tarjetas crecen.
- **Voz:** el botón del micrófono entiende frases como "voy a limpiar el baño del segundo piso" (`src/lib/intencion.js`, sin internet ni llaves de API; la transcripción la hace Chrome/Edge). Si hay dudas, muestra solo los lugares posibles.
- **Cargas múltiples:** si un lugar necesita 2 baldes, la tarjeta muestra "Falta 1" para que nadie tenga que recordarlo.
- El supervisor entra manteniendo presionado el engrane 1.5 s, así quien limpia no entra sin querer.

## Supervisor: lugares y croquis

- **Dictar o describir:** "baño del segundo piso, 25 metros, muy sucio" llena nombre, m², tipo y suciedad.
- **Croquis:** se sube una foto del plano del edificio, se marca una pared de medida conocida (escala) y se dibuja cada cuarto: los m² salen solos. Hay un plano de ejemplo para la demo.
- **Impacto:** etiqueta tipo "Nutrition Facts" con el ahorro frente a llenar "a ojo" y el agua recuperada por EcoLoop.

## Cálculo de consumo recomendado por área

Archivo: `src/lib/dosis.js` (con tests en `dosis.test.js`).

```
solución   = max(área_m² × tasa_del_método, mínimo_del_recipiente)
cargas     = ⌈ solución / capacidad_del_recipiente ⌉
químico    = solución_por_carga / (dilución + 1)
agua       = solución_por_carga − químico
```

| Superficie | Recipiente | Tasa (mL/m²) | Dilución poca / normal / mucha suciedad |
|---|---|---|---|
| Piso | balde 8 L (mín. 3 L) | 50 | 1:200 / 1:100 / 1:50 |
| Baño | balde 8 L | 70 | 1:100 / 1:50 / 1:25 |
| Vidrios | spray 500 mL (mín. 250) | 20 | 1:200 / 1:150 / 1:100 |
| Mesas | spray 500 mL | 25 | 1:150 / 1:80 / 1:40 |

- **El área define cuánta solución; la suciedad define qué tan concentrada.** Así un lugar sucio no recibe más agua, solo más producto.
- Los valores son de partida. **Hay que reemplazarlos** con la ficha técnica del producto biodegradable que se use y calibrarlos en el piloto.

### Métrica para la validación

La pantalla **Impacto** compara lo dispensado contra la *línea base* (cómo se llena hoy "a ojo": balde lleno + un chorro). Esa línea base (`LINEA_BASE` en `dosis.js`) **hay que medirla en el sitio**: antes de instalar, anotar cuántos litros y mL usa el personal en 5–10 limpiezas reales. Con eso el % de ahorro es evidencia, no supuesto.

Ojo: con la línea base de ejemplo, un pasillo de 120 m² da casi el mismo químico que "a ojo" (59 vs 60 mL) y 26 % menos agua. El ahorro grande aparece en áreas pequeñas y en sprays, donde hoy se sobredosifica más.

## Prototipo de hardware recomendado

Para el hackathon, **un solo ESP32** hace de SmartDose y además lee el sensor de flujo del EcoLoop:

| Pieza | Para qué |
|---|---|
| ESP32 | Wi-Fi + control. Crea su propia red (`SmartDose`, IP 192.168.4.1) |
| Bomba peristáltica 12 V | Concentrado. Muy precisa por tiempo, el químico no toca la bomba |
| Bomba 12 V o electroválvula | Agua desde el tanque de agua recuperada del EcoLoop |
| Sensor de flujo YF-S201 (×2) | Mide el agua dispensada y el agua recuperada por EcoLoop |
| 2 MOSFET (IRLZ44N) o módulo relé | Prender/apagar bombas desde el ESP32 |
| Fuente 12 V + regulador a 5 V | Alimentación |

Firmware: `firmware/smartdose/smartdose.ino` (requiere librería ArduinoJson v7). Calibrar `QUIMICO_ML_POR_SEG` y `PULSOS_POR_LITRO` con un vaso medidor antes de la demo.

Recomendación: para la demo, dispensar solo **sprays de 500 mL** (rápido de mostrar en vivo) y dejar el balde en modo simulación.

## Stack: ¿Svelte o microfrontends?

Svelte 5 + Vite, una sola app. **Microfrontends no vale la pena aquí**: son 3 pantallas, un equipo pequeño y 48 horas; añaden configuración (Module Federation / single-spa) sin ningún beneficio para la demo. El código ya está separado por módulos (`views/` + `lib/`) para poder partirlo más adelante si crece.

## Correr

```bash
pnpm install
pnpm dev        # http://localhost:5173  (también en la red local, para abrirlo en una tablet)
pnpm test       # tests del cálculo de dosis
```

Pantallas: `#kiosko` (tablet del dispensador), `#areas` (lugares y croquis), `#impacto` (métricas y ajustes del ESP32 / modo demostración).

Stack: Svelte 5 + Vite. Sin animaciones decorativas: solo cambia lo que informa (nivel del líquido y barra de progreso).
