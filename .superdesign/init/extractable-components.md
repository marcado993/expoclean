# Extractable components

#### Layout Components
## KioskHeader
- Source: `src/App.svelte` (kiosk branch of `<header class="barra">`)
- Category: layout
- Description: White 60px top bar: Logo (drop+leaf mark + "SmartDose") left; 24h clock and 44px settings button right.
- Extractable props: hora (string, default: "09:48")
- Hardcoded: logo, settings icon, all CSS

## SupervisorNav
- Source: `src/App.svelte` (`<nav class="inferior">`)
- Category: layout
- Description: White bottom nav with Dispensador / Lugares / Impacto, active item green with top indicator.
- Extractable props: activeItem (string, default: "areas")
- Hardcoded: labels, icons, CSS

#### Basic Components
## Ficha
- Source: `src/components/Ficha.svelte`
- Category: basic
- Description: Nutrition-facts style data label.
- Extractable props: titulo (string), subtitulo (string)
- Hardcoded: typography, rules
