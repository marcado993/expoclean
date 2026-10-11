# Pages

## #kiosko (Worker kiosk — main target)
Entry: src/views/Kiosko.svelte
Dependencies:
- src/components/Icono.svelte
  - src/lib/iconos.js
- src/components/Orbe.svelte
  - src/lib/ui.js
- src/components/Recipiente.svelte
  - src/lib/ui.js
- src/lib/store.svelte.js
- src/lib/dosis.js
- src/lib/smartdose.js
- src/lib/intencion.js
- (shell) src/App.svelte
  - src/components/Logo.svelte
- src/app.css

## #areas (Supervisor: places + floor plan)
Entry: src/views/Areas.svelte
Dependencies:
- src/components/Icono.svelte
- src/components/Ficha.svelte
- src/lib/croquis.js
- src/lib/intencion.js
- src/lib/dosis.js, src/lib/ui.js, src/lib/store.svelte.js

## #impacto (Supervisor: impact metrics)
Entry: src/views/Impacto.svelte
Dependencies:
- src/components/Ficha.svelte
- src/components/Recipiente.svelte
- src/components/Icono.svelte
- src/lib/smartdose.js, src/lib/store.svelte.js
