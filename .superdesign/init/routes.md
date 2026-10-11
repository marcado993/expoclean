# Routes (hash-based, no router library)

| Hash | Component | Layout | Summary |
|---|---|---|---|
| `#kiosko` (default) | `src/views/Kiosko.svelte` | App shell, kiosk header, no nav | Worker kiosk. Home: title "Toca tu lugar" + helper line + mic button; single-column list of places (container icon in its color + place name), paged with arrows if needed. Tap → full-screen dispensing: place name + container pill, nozzle, measuring vessel filling, progress bar; then modal "Listo / Ya puedes ir a limpiar / Cerrar". |
| `#areas` | `src/views/Areas.svelte` | Supervisor header + bottom nav | Places list (paged) + Croquis (floor plan: upload, scale, draw rooms) + edit sheet with dictation, type picker, dirt level, dose label. |
| `#impacto` | `src/views/Impacto.svelte` | Supervisor header + bottom nav | "Datos de impacto" nutrition-style label, EcoLoop recovered water card, settings sheet. |

Routing code lives in `src/App.svelte` (`vistas` map + `hashchange`).
