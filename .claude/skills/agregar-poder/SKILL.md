---
name: agregar-poder
description: Añadir o cambiar un poder del juego (como Bomba, Hielo, Ola o Doble). Úsala cuando pidan un poder nuevo, cambiar su coste o su efecto.
---

# Añadir un poder

Los poderes se definen en el motor y la interfaz los pinta sola a partir de `Engine.POWERS`.

## Pasos

1. **Definición** en `js/engine.js`, objeto `POWERS`:
   ```js
   shield: { key: '5', icon: '🛡️', name: 'Escudo', cost: 3, desc: 'Qué hace, en una frase para el jugador.' },
   ```
   - `key` es la tecla rápida. `cost` entre 2 y 6 (el máximo de cargas es `MAX_CHARGE`).
   - `desc` aparece en el botón y en «Cómo se juega»: frase corta, en tuteo, sin jerga.
2. **Validación** en `powerTargetError(s, power, r, c)`: devuelve un texto de error para el jugador si el objetivo no vale, o `null`.
3. **Efecto** en `applyPower(s, power, r, c)`:
   - Ya descuenta el coste y marca `powerUsedThisTurn`.
   - Si mueves o quitas fichas, termina con `settle(s)` y devuelve las quitadas en `removed` (para que exploten en pantalla).
   - Si el poder dura turnos, guárdalo en el estado (como `frozen` o `doubleArmed`), nunca en la interfaz.
4. **Poder sin objetivo** (como Doble): en `App.arm` de `js/components/game.js` aplícalo directamente igual que `double`.
5. **Animación y sonido** en `App.applyPowerFx`: elige un sonido de `Sound.play` (`bomb`, `freeze`, `whoosh`, `charge`…) y, si quieres, `this.view.jolt('shake' | 'spin' | 'flip')`.
6. **Teclado y móvil** si es el quinto poder o más:
   - `js/components/game.js`: amplía la lista `['1', '2', '3', '4']` del manejador de teclado.
   - `css/game.css`: la rejilla `.powers` en móvil usa `repeat(4, 1fr)`; ajústala y revisa a 390 px.
   - `html/game.html`: el texto de ayuda de teclas (`kbd-hint`).
7. **IA** (opcional) en `aiDecide`: úsalo solo en normal o difícil y solo con una condición clara.
8. **Pruebas** en `tests/unit/engine.test.js`, bloque «turnos y poderes»: objetivo válido e inválido, efecto en el tablero con `board()`/`draw()`, coste descontado y que no queda nada flotando (`floating(s) === null`).
9. Si tiene objetivo en el tablero, añade un caso a `tests/e2e/game.spec.js` como el de la Bomba.

## Comprobar

- `npm run check`
- Receta `revisar-ui`: botón en escritorio y en móvil, estado deshabilitado sin cargas, estado armado.
- En online: el efecto llega al rival (lo garantiza `seq++` + `push()` en `usePower`; no lo saltes).
