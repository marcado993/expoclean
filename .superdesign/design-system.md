# SmartDose — Design System

## Product context
SmartDose is a wall-mounted dispenser kiosk (tablet/phone screen on an ESP32 machine) for building cleaning crews. Hackathon "Hack the Water", Reto 4: exact dosing of biodegradable cleaners + greywater recirculation (EcoLoop).

**Primary user (kiosk):** cleaning staff, at most high-school education, low reading fluency, in a hurry (~10 s per task), often wearing gloves, standing at arm's length.
**JTBD:** "I put my bucket/bottle/sprayer under the machine, tap where I'm going to clean, and it gets filled with the right mix."
**Secondary user:** supervisor (registers places, floor plan, sees impact metrics).

## Kiosk flow (1 tap)
1. Worker places container (balde = bucket, botella = squeeze bottle, chisguete = trigger sprayer) under the nozzle.
2. Taps their place in a list → machine fills automatically (no confirm, no stop button).
3. Screen shows the vessel filling with a progress bar → modal "Listo — Ya puedes ir a limpiar — [Cerrar]", auto-closes.

## Usability rules (hard constraints)
- NO SCROLL on any screen, ever. Paginate with large arrows if items don't fit.
- One tap per task. Recognition over reading: icons + color carry the meaning, text is short.
- No information overload: ONE icon per list item, never encode the same fact twice (no color border + tinted tile + pill for the same thing).
- Touch targets ≥ 48px (prefer 60px+ rows). Body text ≥ 17px, item names ≥ 19px.
- Place names never break mid-word; single line.
- Spanish, sentence case, plain verbs ("Toca tu lugar", "Cerrar").

## Visual style
Serious, professional cleaning-industry tool. NOT cartoonish, NOT playful, NOT glossy. No emojis, no illustrations with gradients, no decorative animation (no bubbles, waves, bounces, entrance staggers).

- **Font:** 'Source Sans 3' (400/600/700) for all UI. 'Archivo Black'/'Archivo' only for the nutrition-facts label (supervisor screens).
- **Icons:** Tabler Icons outline only (stroke 1.5–2): bucket, bottle, spray, toilet-paper, window, desk, microphone, settings, chevrons, check.
- **Colors:**
  - Brand pine #0D4F3C, primary button #146B50, light green surfaces #F0F5F2 / #E2EEE8
  - Text #17231E, secondary text #5B6762, borders #E0E5E2, app background #F1F3F2, white cards #FFFFFF
  - Container semantic colors (fixed, the only "colorful" element): balde #1D6FB8 blue, botella #1B8A63 green, chisguete #D9661F orange
  - Alert #B4410C. Progress/water #0A7EA4.
- **Shape:** cards/lists radius 12px, buttons 10px, pills fully rounded. Subtle shadow 0 1px 2px rgba(23,35,30,.06). Hairline borders #E0E5E2.
- **Header (kiosk):** white 60px bar, logo (pine drop with white leaf + "Smart**Dose**") left, 24h clock + 44px settings button right.
- **Vessel graphic:** flat outlined measuring container (3px dark #3B4641 stroke), flat liquid fill, volume tick marks with labels (L / mL).

## Motion
Only functional: liquid level rising (0.3s linear), progress bar, nozzle stream, modal appearing (0.2s). Respect prefers-reduced-motion.

## Layout
Mobile portrait, 412×860 reference (also must work at 412×778). Content padding 14px. Screens are vertical stacks that exactly fill the viewport.
