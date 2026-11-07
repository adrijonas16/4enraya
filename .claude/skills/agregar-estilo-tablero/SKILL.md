---
name: agregar-estilo-tablero
description: Añadir o retocar un estilo de tablero (Clásico, Madera, Neón, Cristal, Noche y oro, Lava, Caramelo). Úsala cuando pidan un tablero con otro aspecto o tema.
---

# Añadir un estilo de tablero

Un estilo solo cambia variables CSS; la forma del tablero, los agujeros y las fichas son comunes. Lee la tabla de variables de `docs/DESIGN.md`.

## Pasos

1. **Variables** en `css/skins.css`, copiando un bloque existente:
   ```css
   [data-skin="jade"] {
       --sk-frame: …;   --sk-plate: …;
       --sk-hole: …;    --sk-hole-shade: …;
       --sk-rim-dark: …; --sk-rim-light: …;
       --sk-hi: …; --sk-outline: …; --sk-edge: …;
       --sk-feet: …; --sk-glow: …;
   }
   ```
   - Texturas: reutiliza `--wood`, `--rock` o `--noise`, o define una nueva en `:root` de `skins.css` como SVG en `data:`.
   - Efectos de fichas solo con `filter` y solo bajo `[data-skin="jade"] .piece.red` / `.yellow`.
   - Fichas siempre rojas y amarillas: no cambies su color.
2. **Registro** en `js/components/game.js`, lista `SKINS`: `{ id: 'jade', name: 'Jade', desc: 'Piedra verde pulida' }`. El nombre va en minúscula inicial salvo nombre propio; la descripción, corta.
3. La miniatura del selector, la portada y la partida usan el estilo automáticamente.

## Comprobar

- Receta `revisar-ui` con el estilo activo: portada, partida con fichas, columna congelada, línea ganadora; escritorio y móvil.
- Contraste: se distinguen agujero vacío, ficha roja y ficha amarilla.
- `npm run check` (el E2E de estilos usa `lava`; no hace falta uno nuevo por estilo).
