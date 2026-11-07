# Arquitectura

## Capas

```
            ┌──────────────────────────────────────────────┐
 Navegador  │ html/game.html  (portada, partida, dialogs)  │
            └──────────────┬───────────────────────────────┘
                           │
  js/components/game.js ── App ──────────────┐
     │      │      │                         │
     │   BoardView DemoBoard            Social (amigos)
     │      │                                │
  js/engine.js  (reglas puras)        js/utils/api.js ── Supabase
     │                                       │
  js/net.js  (salas de la página de Claude)  │
  js/fx.js   (sonido y partículas)           │
  js/scene.js (fondo)                        │
```

- **Engine** (`window.Engine`): funciones puras sobre un objeto de estado. No sabe nada del DOM ni del tiempo.
- **App**: orquesta. Recibe la intención del jugador, llama al motor, pide a `BoardView` que anime el resultado, actualiza la interfaz y envía el estado al rival.
- **BoardView**: pinta el tablero a partir del estado. Cada ficha tiene un `id` estable, así que el render compara estado viejo y nuevo y anima: las nuevas caen, las movidas se deslizan, las desaparecidas estallan.
- **api**: único acceso a Supabase. **RoomNet**: online sin base de datos para la página de Claude.

Los scripts se cargan en este orden en `html/game.html`: Supabase (CDN, versión fijada con `integrity`) → `config.js` → `consent.js` → `api.js` → `validate.js` → `scene.js` → `engine.js` → `fx.js` → `net.js` → `social.js` → `game.js`. Cada uno es una IIFE que publica su API en `window`.

## Sesión

Sin sesión, `App` crea una de invitado al momento (`api.loginAsGuest()`), así que la portada se ve sin pasar por ninguna pantalla de entrada. Los invitados ven el botón «Entrar» en la barra superior, que lleva a `login.html`. Con cuenta, el chip de usuario abre el perfil.

## Analítica y consentimiento

`consent.js` muestra el banner solo si `SITE.gaMeasurementId` tiene valor. Hasta que la persona acepta no se carga nada de Google; si rechaza o retira el permiso, se borran las cookies `_ga`. Los eventos se envían con `Analytics.track` y, sin consentimiento, se descartan.

Eventos actuales: `game_start` (`mode`, `level`, `map`, `size`), `game_end` (`mode`, `result`, `moves`), `power_used` (`power`), `skin_change` (`skin`), `online_room` (`action`, `transport`), `sign_up` y `login` (`method`).

## Estado de la partida

`Engine.createState(opts)` devuelve un objeto plano, serializable a JSON (versión `v: 2`):

| Campo | Qué es |
| --- | --- |
| `rows`, `cols`, `map`, `events` | Ajustes de la partida |
| `cells[r][c]` | `null`, `{ id, color: 'red' \| 'yellow' }` o `{ id, stone: true }`. Fila 0 arriba |
| `frozen` | `{ columna: turnos }`. Se descuenta en cada cambio de turno |
| `turn`, `starter` | Color al que le toca y quién empezó |
| `charges` | Cargas de cada color (máximo `MAX_CHARGE` = 6) |
| `doubleArmed`, `powerUsedThisTurn` | Estado de poderes |
| `moves` | Tiradas hechas |
| `nextEventAt` | Tirada en la que ocurre el próximo evento (`Infinity` si no hay eventos) |
| `nextEvent` | `null` hasta que el evento ocurre: se sortea en ese momento con `rollEvent` |
| `over`, `result`, `winner`, `winLine` | Fin de partida. `result`: `win`, `draw` o `double` |
| `seq` | Número de versión del estado. Sube con cada cambio que deba ver el rival |
| `lastEvent`, `lastMove` | Para reproducir el último cambio en el otro dispositivo |

## Flujo de un turno

```
jugador toca columna
  └─ App.drop(col)
       ├─ comprueba canDrop (congelada / llena)
       └─ dropSequence(col)
            ├─ Engine.place → BoardView.render (caída con rebote)
            ├─ si hay doble ficha armada: segunda ficha
            ├─ moves++ → Engine.resolve → si termina: finish()
            ├─ si eventDue: rollEvent → cinta de aviso → applyEvent → animación → resolve
            ├─ nextTurn(): endTurn (hielo −1, +1 carga al siguiente); si no puede tirar, pasa
            ├─ seq++ → push() al rival
            └─ maybeAI() si le toca a la IA
```

Los **poderes** son una acción libre antes de soltar ficha, uno por turno. `App.arm` los prepara; `usePower` valida con `Engine.powerTargetError`, aplica con `Engine.applyPower`, anima, comprueba victoria (un poder puede provocarla) y hace `seq++` + `push()`.

**Gravedad:** cualquier función del motor que mueva fichas termina con `settle()`, que apila cada tramo de columna sobre su suelo (el fondo o una piedra).

## IA

`Engine.aiDecide(state, nivel)`:

1. Si puede ganar en una tirada, gana.
2. Si el rival amenaza en una sola columna, la bloquea.
3. En normal y difícil, usa poderes ante dos amenazas a la vez (Bomba o Hielo) y Doble si le da la victoria.
4. Si no, negamax con poda alfa-beta y profundidad creciente (fácil 2, normal 4, difícil 6) con un límite de nodos, para que nunca tarde más de un instante.

## Render y animaciones

- El tablero es una rejilla (`.grid`) con tres capas: fichas (`.pieces`), placa de plástico con agujeros (`.plate`, con `mask`) y brillo de los bordes (`.rims`). Las fichas van detrás de la placa, como en el juego físico.
- El tamaño de casilla (`--pitch`) se calcula en `BoardView.layout()` según la pantalla.
- Las animaciones usan Web Animations API sobre `transform`. Con `prefers-reduced-motion` se acortan o se omiten.
- `DemoBoard` es una versión ligera para la portada: dos IA juegan solas.

## Navegación

La portada (`#home`) y la partida (`#arena`) están en la misma página. `location.hash` decide cuál se ve: `#jugar` muestra la partida si hay una empezada; cualquier otro valor muestra la portada. El botón atrás del navegador funciona.

## Online

Hay dos transportes. `App.transport()` elige: `'db'` si hay cuenta y Supabase responde, `'room'` si la página corre dentro de Claude con la capacidad `room`, o ninguno.

### Con Supabase (`'db'`)

1. El anfitrión crea una fila en `rooms` (código de 6 caracteres) y se suscribe a sus cambios.
2. El invitado se une (`rooms.status = 'playing'`). El anfitrión crea la fila en `games` con el estado inicial en `board_state`.
3. Cada jugada hace `updateGame` con el estado completo. El otro lado recibe el cambio por Realtime y lo aplica si `seq` es mayor que el suyo (`applyRemote`).
4. La revancha reutiliza la misma fila (`resetGame`).

### Salas de la página de Claude (`'room'`, `js/net.js`)

- Sala común (`lobby`): cada jugador publica `{ app: '4r', name, hosting, playing }` en su presencia. Así se ve quién está en la página y quién espera rival.
- Sala de partida (`4r-<código>`): cada jugador publica `{ role, name, seq, st }`, donde `st` es el estado comprimido (`NetCodec.encode`, menos de 4 KiB). Gana el `seq` más alto, así que una reconexión recupera la última jugada.
- El anfitrión marca `opp` con el par de su rival para que un tercero no pueda entrar en una partida ya empezada.

### Amigos (`js/components/social.js`)

Tablas `friendships` y `game_invites` con Realtime, y presencia de Supabase en el canal `lobby` para saber quién está conectado. Retar a un amigo crea una sala `'db'` y le envía una invitación con el código.

## Versión para la página de Claude

`npm run build:artifact` genera `dist-artifact/`: quita Supabase, entra como invitado, marca `window.__ARTIFACT` (que oculta ranking, amigos y cerrar sesión) e `index.html` abre el juego. El online usa salas `'room'`. La página debe declarar la capacidad `room`.
