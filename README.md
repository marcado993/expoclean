# CleanDose — Reto 4 (Hack the Water)

Dosificador de productos de limpieza con 4 compartimentos. El operario elige la zona y el tipo de limpieza, la app calcula cuánto producto y agua lleva, y la máquina sirve la dosis exacta. El administrador ve la trazabilidad y manda operarios a limpiar zonas.

```
 ESP32 (firmware/cleandose) ◄──Bluetooth──  Celular del operario (app)  ──HTTPS──►  Servidor (server/index.js)
 prende la bomba N segundos                 manda la orden y guarda           guarda registros, tareas,
                                            el registro (cola sin internet)   espacios; avisa al instante
```

Instalación en el servidor: **[DESPLIEGUE.md](DESPLIEGUE.md)**.

## Operario

| Función | Qué hace |
|---|---|
| **Escanear área** | Foto del lugar + zona + tipo de limpieza (diaria, profunda, desinfección) → dosificación recomendada: producto, agua y recipiente. Los m² son los que registró el administrador para esa zona. |
| **Configuración CleanDose** | Qué producto tiene cada compartimento (lista agrupada por tipo: cloro, desinfectante, desengrasante, detergente, limpiavidrios, aceite) y "Lo llené" cuando se recarga. |
| **Dosificación CleanDose** | La única que manda la orden a la máquina. Una dosis a la vez: si otro operario está dispensando, avisa cuánto falta. Si se cae la señal, reintenta sin dispensar dos veces. |
| **Historial personal** | Sus dosis registradas. |

Abajo: **Zonas**, **Notificaciones** (tareas que mandó el admin, con sonido, vibración y voz) y **Perfil**.

## Administrador

- **Panel:** zonas limpiadas, producto usado (contra el periodo anterior), consumo por operario, zonas sin limpiar y la tabla de trazabilidad. Pestañas por zona, por operario (quién gasta de más o se queda corto frente al promedio) y alertas (compartimentos vacíos o por acabarse).
- **Asignación de espacios:** crear zonas escribiendo, dictando o dibujando sobre el croquis del edificio (los m² salen solos).
- **Asignar operario a zona:** "se regó algo en el Laboratorio 2" → elegir zona → *Mandar a limpiar*. En automático va al operario con menos tareas; le llega el aviso al instante.
- **Máquina y operarios:** si el ESP32 está conectado, probar la bomba, y agregar o quitar operarios.

## Código

| Archivo | |
|---|---|
| `server/index.js` | API + archivos de la app. Node sin dependencias. Datos en un JSON. |
| `firmware/cleandose/cleandose.ino` | ESP32: long polling al servidor, una bomba por compartimento (hoy todos en GPIO 22). |
| `firmware/prueba_rele/prueba_rele.ino` | Prueba aislada del relé en GPIO 22. |
| `src/lib/catalogo.js` | Productos, tipos, diluciones, receta recomendada y caudal de la bomba. |
| `src/lib/traza.js` | Análisis de trazabilidad (con tests). |
| `src/lib/api.js`, `src/lib/nube.svelte.js` | Cliente del servidor y estado compartido en tiempo real. |
| `src/views/operario/*`, `src/views/admin/*` | Pantallas. |

## Desarrollo

```bash
pnpm install
node server/index.js   # servidor en :8080
pnpm dev               # app en :5173; /api va al servidor de producción (CLEANDOSE_API para otro)
pnpm test
```

Las diluciones y el caudal (`CAUDAL_ML_S`) son valores de partida: reemplazarlos con la ficha técnica de cada producto y calibrar la bomba con un vaso medidor.
