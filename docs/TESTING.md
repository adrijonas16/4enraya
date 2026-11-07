# Pruebas

```bash
npm test            # unitarias del motor (node:test), unos segundos
npm run test:e2e    # extremo a extremo con Playwright, menos de un minuto
npm run check       # lint + unitarias + E2E
```

La primera vez que uses Playwright: `npx playwright install chromium`.

## Unitarias (`tests/unit/`)

Prueban `js/engine.js` y la compresión de `js/net.js` cargándolos en Node (`tests/unit/load.js`).

Utilidades:

- `board(['....', 'rr..'])` crea un estado a partir de un dibujo: `.` vacío, `r` rojo, `y` amarillo, `s` piedra. Fila 0 arriba.
- `draw(state)` devuelve el dibujo de un estado, para comparar.
- `floating(state)` devuelve la primera ficha que flota, o `null`.

Qué se espera:

- Toda regla nueva o cambiada tiene una prueba.
- Todo evento nuevo entra solo en la prueba «deja todas las fichas apoyadas», que recorre `Engine.EVENTS`.
- La IA: si cambias su lógica, mantén las pruebas de ganar y bloquear.

## Extremo a extremo (`tests/e2e/`)

Abren el juego en Chromium con un servidor local (`scripts/serve.mjs`, puerto 4173).

| Archivo | Cubre |
| --- | --- |
| `home.spec.js` | Portada, jugar contra la IA, volver atrás, estilos de tablero, sin desplazamiento horizontal en móvil |
| `game.spec.js` | Victoria y revancha, poder Bomba, eventos sin aviso |
| `online-room.spec.js` | Dos pestañas en una sala de la página de Claude: lista de jugadores, sincronía y salida |
| `friends.spec.js` | Solicitud, aceptar y retar a un amigo con Supabase |
| `site.spec.js` | Accesibilidad y contraste (axe) en todas las páginas y ventanas, metadatos y vista previa, enlaces rotos, sitemap, 404, sin desplazamiento horizontal, entrada directa con CTA, banner de cookies, validación de formularios y antispam |

Utilidades en `tests/e2e/helpers.js`: `offline(context)`, `fakeSupabase(context)`, `openGame(page, { user, settings, skin })`, `drop(page, col)`, `pieceCount`, `boardSignature`.

### Dobles

- `tests/fakes/fake-supabase.js` sustituye a la librería de Supabase. Guarda las tablas en `localStorage` y avisa a las otras pestañas con `BroadcastChannel`. Implementa solo lo que usa `api.js`: si añades una consulta nueva, añádela aquí.
- `tests/fakes/fake-room.js` imita la capacidad `room` de las páginas de Claude (presencia y salas con nombre).

Las pestañas de un mismo contexto comparten `localStorage`: en pruebas con dos jugadores, fija el usuario de cada pestaña después de cargarla (ver `friends.spec.js`).

## Pruebas a mano antes de un PR con cambios visibles

1. `npm start` y abre http://localhost:8080.
2. Escritorio (1280 px) y móvil (390 px, con las herramientas del navegador).
3. Juega una partida contra la IA y una a dos jugadores con eventos activados.
4. Activa «reducir movimiento» en el sistema y comprueba que todo se entiende igual.
5. Si tocaste el online: dos ventanas, una sala, unas tiradas, revancha y salir.

La receta `.claude/skills/revisar-ui` automatiza las capturas.
