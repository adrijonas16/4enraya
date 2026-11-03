# 4 en Raya

Conecta cuatro con poderes, eventos de caos, IA, partidas online y un fondo animado que reacciona al juego.

## Cómo abrirlo

Es una web estática. Sirve la carpeta con cualquier servidor y abre `index.html`:

```bash
npx serve .
# o
python3 -m http.server 8080
```

Puedes entrar con Google, con usuario y contraseña, o pulsar **Jugar como invitado** (juego local y contra la IA, sin ranking ni online).

## Publicar en Vercel

1. En [vercel.com/new](https://vercel.com/new) importa el repositorio `4enraya`.
2. Deja todo por defecto (no hay que compilar nada; `vercel.json` ya lo indica) y pulsa **Deploy**.
3. Cada `git push` a `main` vuelve a publicar solo.

## Activar el inicio con Google

La base de datos ya está preparada (columna `users.auth_id` y función `login_with_auth`). Falta configurar:

1. **Google Cloud Console** → APIs y servicios → Credenciales → Crear ID de cliente OAuth (Aplicación web).
   URI de redirección autorizada: `https://cyzjihoibpdabhiotjpf.supabase.co/auth/v1/callback`
2. **Supabase** → Authentication → Sign In / Providers → Google: actívalo y pega el ID y el secreto de cliente.
3. **Supabase** → Authentication → URL Configuration:
   - Site URL: la dirección de Vercel (por ejemplo `https://4enraya.vercel.app`)
   - Redirect URLs: añade `https://*.vercel.app/**` y `http://localhost:*/**`

## Reglas

- Gana quien conecte 4 fichas en horizontal, vertical o diagonal.
- **Cargas:** ganas una al empezar cada turno (máximo 6). Antes de soltar tu ficha puedes gastar cargas en un poder (uno por turno):
  - ❄️ Hielo (2): congela una columna durante el turno del rival.
  - 🌊 Ola (3): invierte el orden de las fichas de una columna.
  - 💣 Bomba (4): destruye una ficha rival; las de encima caen.
  - ⚡ Doble (5): tu próxima tirada suelta dos fichas.
- **Eventos de caos:** remolino, terremoto, vuelco, meteorito, marea, ventisca y regalo. Debajo del tablero se anuncia cuál viene y en cuántas tiradas. Si un evento deja cuatro en raya a los dos, es empate.
- **Mapas:** Clásico, Obstáculos (piedras que hacen de suelo), Glaciar (columnas congeladas), Caos (eventos cada 2–4 tiradas) y Aleatorio.

Estilos de tablero: Clásico, Madera, Neón, Cristal, Noche y oro, Lava y Caramelo. Se eligen en «Estilo del tablero» y se pueden cambiar a mitad de partida.

Amigos: busca a otros jugadores por su nombre, envía solicitudes, mira quién está conectado y cuántas veces le has ganado, y rétalo a una partida online con un toque (le llega un aviso en el momento). Requiere cuenta.

Controles: ratón o toque, o teclado (`←` `→` apuntar, `Espacio` soltar, `1`–`4` poderes, `Esc` cancelar).

## Estructura

```
index.html              redirige a login o al juego
html/login.html         acceso, registro e invitado
html/game.html          juego
css/variables.css       tokens de diseño y base
css/game.css, login.css
css/skins.css           estilos de tablero (solo variables CSS)
fonts/                  Archivo (variable, incluida en el repo)
js/engine.js            reglas, física, eventos, poderes e IA (sin DOM)
js/fx.js                sonido sintetizado y partículas
js/scene.js             fondo animado (auroras, fichas flotando, destellos)
js/components/game.js   interfaz, animaciones, flujo y online
js/components/login.js
js/components/social.js amigos, presencia y retos
js/utils/api.js         Supabase (el juego funciona aunque no cargue)
```

## Online (Supabase)

Usa las tablas `users`, `rooms`, `games`, `game_history`, `rankings`, `friendships`, `game_invites` y las funciones `increment_wins` / `increment_points`.
El estado completo de la partida (fichas, hielo, cargas, eventos) se guarda en `games.board_state` como JSON con `v: 2`, así ambos jugadores ven exactamente lo mismo. Las partidas guardadas con la versión anterior no son compatibles.

Solo cuentan para el ranking las partidas contra la IA y las online; las de dos jugadores en el mismo dispositivo no.

## Pendiente de seguridad

Las contraseñas se guardan y comparan en texto plano en la tabla `users` con la clave pública (`anon`). Conviene migrar a Supabase Auth (`supabase.auth.signUp` / `signInWithPassword`) y activar RLS en las tablas.
