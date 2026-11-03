# 4 en Raya

Conecta cuatro con poderes, eventos de caos, IA, partidas online y un fondo animado que reacciona al juego.

## Cómo abrirlo

Es una web estática. Sirve la carpeta con cualquier servidor y abre `index.html`:

```bash
npx serve .
# o
python3 -m http.server 8080
```

Puedes entrar con tu cuenta o pulsar **Jugar como invitado** (juego local y contra la IA, sin ranking ni online).

## Reglas

- Gana quien conecte 4 fichas en horizontal, vertical o diagonal.
- **Cargas:** ganas una al empezar cada turno (máximo 6). Antes de soltar tu ficha puedes gastar cargas en un poder (uno por turno):
  - ❄️ Hielo (2): congela una columna durante el turno del rival.
  - 🌊 Ola (3): invierte el orden de las fichas de una columna.
  - 💣 Bomba (4): destruye una ficha rival; las de encima caen.
  - ⚡ Doble (5): tu próxima tirada suelta dos fichas.
- **Eventos de caos:** remolino, terremoto, vuelco, meteorito, marea, ventisca y regalo. Debajo del tablero se anuncia cuál viene y en cuántas tiradas. Si un evento deja cuatro en raya a los dos, es empate.
- **Mapas:** Clásico, Obstáculos (piedras que hacen de suelo), Glaciar (columnas congeladas), Caos (eventos cada 2–4 tiradas) y Aleatorio.

Controles: ratón o toque, o teclado (`←` `→` apuntar, `Espacio` soltar, `1`–`4` poderes, `Esc` cancelar).

## Estructura

```
index.html              redirige a login o al juego
html/login.html         acceso, registro e invitado
html/game.html          juego
css/variables.css       tokens de diseño y base
css/game.css, login.css
fonts/                  Archivo (variable, incluida en el repo)
js/engine.js            reglas, física, eventos, poderes e IA (sin DOM)
js/fx.js                sonido sintetizado y partículas
js/scene.js             fondo animado (auroras, fichas flotando, destellos)
js/components/game.js   interfaz, animaciones, flujo y online
js/components/login.js
js/utils/api.js         Supabase (el juego funciona aunque no cargue)
```

## Online (Supabase)

Usa las tablas existentes `users`, `rooms`, `games`, `game_history`, `rankings` y las funciones `increment_wins` / `increment_points`.
El estado completo de la partida (fichas, hielo, cargas, eventos) se guarda en `games.board_state` como JSON con `v: 2`, así ambos jugadores ven exactamente lo mismo. Las partidas guardadas con la versión anterior no son compatibles.

Solo cuentan para el ranking las partidas contra la IA y las online; las de dos jugadores en el mismo dispositivo no.

## Pendiente de seguridad

Las contraseñas se guardan y comparan en texto plano en la tabla `users` con la clave pública (`anon`). Conviene migrar a Supabase Auth (`supabase.auth.signUp` / `signInWithPassword`) y activar RLS en las tablas.
