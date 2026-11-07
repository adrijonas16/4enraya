# Reglas del proyecto 4 en Raya

Este archivo es la fuente única de reglas para cualquier persona o asistente de IA (Claude, Codex, Cursor, Copilot…) que modifique el repositorio. Si una regla cambia, se cambia aquí y en el documento de `docs/` correspondiente, en el mismo pull request.

## Qué es

Un 4 en raya para navegador con poderes, eventos de caos, IA, siete estilos de tablero, amigos y partidas online. Interfaz en español. Funciona en escritorio y en móvil.

- **Sin framework ni paso de compilación.** HTML, CSS y JavaScript del navegador, cargados con `<script>` clásicos. No se añade React, bundlers ni TypeScript sin acordarlo antes en un issue.
- **Datos y online:** Supabase (Postgres + Realtime + Auth), con la clave pública `anon` en `js/utils/api.js`. Esa clave es pública por diseño; cualquier otra clave o secreto nunca entra al repositorio.
- **Publicación:** Vercel publica `master` automáticamente. Existe además una versión para páginas de Claude que se genera con `npm run build:artifact`.

## Mapa del código

```
index.html               redirige al juego (Vercel lo hace con una redirección)
404.html                 página no encontrada (rutas absolutas)
html/game.html           portada + partida + todas las hojas (dialog). Sin sesión se juega como invitado
html/login.html          entrar o crear cuenta: Google, usuario y contraseña
html/privacidad.html     política de privacidad
html/terminos.html       términos y condiciones
img/                     favicon, iconos e imagen de vista previa (se generan con scripts/make-images.mjs)
robots.txt, sitemap.xml, site.webmanifest
css/variables.css        tokens de diseño, base, botones, campos, escena de fondo
css/game.css             portada, tablero, placas, hojas, amigos, responsive
css/skins.css            estilos de tablero (solo variables --sk-*)
css/login.css            pantalla de entrada
js/config.js             configuración pública: URL, ID de Google Analytics, contacto, versión de la política
js/consent.js            banner de cookies y Google Analytics (solo tras aceptar). API: Analytics.track
js/legal.js              páginas legales: contacto montado en el navegador (antispam)
js/utils/validate.js     validación de formularios compartida (mismas reglas que la base de datos)
js/engine.js             reglas, física, poderes, eventos e IA. SIN DOM
js/net.js                online por salas de la página de Claude y compresión del estado
js/fx.js                 sonido sintetizado (WebAudio) y partículas (canvas)
js/scene.js              fondo animado
js/utils/api.js          acceso a Supabase. Única capa que habla con la base de datos
js/vendor/               librerías de terceros con versión fija (supabase-js) y sus licencias
js/components/game.js    BoardView (render y animaciones), DemoBoard, App (flujo, UI, online)
js/components/social.js  amigos, presencia y retos
js/components/login.js   pantalla de entrada
supabase/migrations/     historial de la base de datos (SQL)
tests/unit/              pruebas del motor con node:test
tests/e2e/               pruebas de extremo a extremo con Playwright
tests/fakes/             dobles de Supabase y de la sala en tiempo real
scripts/                 servidor local, imágenes y generador de la versión para Claude
docs/                    arquitectura, convenciones, diseño, base de datos, pruebas, publicación
.claude/skills/          recetas paso a paso para tareas que se repiten
```

Lee `docs/ARCHITECTURE.md` antes de tocar el flujo de turnos, el render o el online.

## Comandos

```bash
npm install          # dependencias de desarrollo (lint y pruebas)
npm start            # http://localhost:8080
npm run lint         # ESLint
npm test             # pruebas unitarias del motor
npm run test:e2e     # Playwright (la primera vez: npx playwright install chromium)
npm run check        # todo lo anterior; tiene que pasar antes de abrir un PR
npm run build:artifact   # genera dist-artifact/ para la página de Claude
```

## Reglas de oro

1. **Las reglas del juego viven en `js/engine.js` y solo ahí.** El motor no toca el DOM, no usa `setTimeout` ni sonido. La interfaz llama a `Engine.*` y anima el resultado. Todo cambio de reglas lleva prueba en `tests/unit/`.
2. **La gravedad siempre se respeta.** Después de cualquier cambio en el tablero (poder, evento) se llama a `settle()`. Ninguna ficha puede quedar flotando; la prueba de eventos lo comprueba.
3. **El estado de la partida es un objeto serializable** (`createState`). Nada de funciones ni referencias al DOM dentro. Cada cambio que deba verse en el otro jugador incrementa `state.seq` y se envía con `push()`.
4. **El online tiene dos transportes y los dos deben seguir funcionando:** Supabase (`api.js`, con cuenta) y salas de la página de Claude (`net.js`, invitados). El estado de sala viaja comprimido y debe ocupar menos de 4 KiB.
5. **Solo `js/utils/api.js` habla con Supabase.** Los componentes llaman a métodos de `api`; no crean consultas propias.
6. **Base de datos solo por migraciones.** Todo cambio de esquema es un archivo nuevo en `supabase/migrations/` (`AAAAMMDDhhmmss_nombre.sql`), idempotente cuando se pueda, y se documenta en `docs/DATABASE.md`. Nunca se edita una migración ya aplicada.
7. **Seguridad del DOM:** cualquier texto que venga de usuarios (nombres, códigos, mensajes) se pinta con `textContent`, nunca con `innerHTML`. Los filtros a Supabase se construyen con los métodos del cliente (`.eq`, `.in`…), no concatenando texto del usuario.
8. **Diseño con tokens.** Colores, radios, tipografía y curvas de animación salen de `css/variables.css`. Un estilo de tablero nuevo solo define variables `--sk-*`. Ver `docs/DESIGN.md`.
9. **Accesible y para móvil.** Controles con nombre accesible, foco visible, uso con teclado, `prefers-reduced-motion` respetado y sin desplazamiento horizontal a 390 px de ancho.
10. **Textos de la interfaz en español**, en minúscula inicial, con verbos claros y sin jerga técnica. Los errores dicen qué pasó y qué hacer. Ver `docs/CONVENTIONS.md`.
11. **Privacidad primero.** Nada de analítica, cookies ni servicios de terceros nuevos sin consentimiento: los eventos se envían solo con `Analytics.track(nombre, datos)` y nunca llevan datos personales (nombres, emails, códigos de sala). Si cambia qué datos se tratan, se actualiza `html/privacidad.html` y `SITE.policyVersion` en el mismo PR.
12. **Formularios:** se validan con `Validate` en el navegador, con mensajes por campo (`aria-invalid` + `aria-describedby`), y con la misma regla en la base de datos. Ningún formulario nuevo sin protección antispam (campo trampa, tiempo mínimo o límite de frecuencia).
13. **Seguridad de la web:** la política de contenido (CSP) de `vercel.json` solo permite los dominios que se usan. Las librerías de terceros se sirven desde el propio sitio en `js/vendor/` con la versión en el nombre (`supabase-2.119.0.js`) y su licencia al lado; nada de CDN. Una API o servicio externo nuevo exige añadir su dominio a la CSP. Sin scripts en línea en el HTML.
14. **SEO y vista previa:** toda página nueva lleva título (≤ 60 caracteres), descripción (50–160), `canonical`, Open Graph e iconos (copia la cabecera de una existente) y, si es pública, entra en `sitemap.xml`.
15. **No romper lo que funciona:** si un cambio toca algo que cubren las pruebas E2E, se ejecutan antes de dar el trabajo por terminado.

## Flujo de trabajo

1. Rama desde `master`: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
2. Commits pequeños en español, en imperativo: `Añadir poder Escudo`, `Corregir sincronía tras revancha`.
3. `npm run check` en verde.
4. Pull request con la plantilla. Si hay cambios visibles, capturas de escritorio y móvil.
5. Al fusionar en `master`, Vercel publica solo. Comprueba la publicación (ver `docs/DEPLOYMENT.md`).

## Terminado significa

- [ ] `npm run check` pasa.
- [ ] Probado a mano en escritorio y en móvil.
- [ ] Pruebas nuevas para la lógica nueva.
- [ ] Documentación de `docs/` al día si cambió una regla, una tabla o un flujo.
- [ ] Sin `console.log` de depuración ni código comentado.

## Recetas

Para tareas frecuentes hay recetas paso a paso en `.claude/skills/` (las usa Claude Code automáticamente; cualquier persona puede seguirlas a mano):

| Tarea | Receta |
| --- | --- |
| Añadir un poder | `.claude/skills/agregar-poder/SKILL.md` |
| Añadir un evento de caos | `.claude/skills/agregar-evento/SKILL.md` |
| Añadir un estilo de tablero | `.claude/skills/agregar-estilo-tablero/SKILL.md` |
| Cambiar la base de datos | `.claude/skills/cambio-base-datos/SKILL.md` |
| Revisar la interfaz en escritorio y móvil | `.claude/skills/revisar-ui/SKILL.md` |
| Publicar una versión | `.claude/skills/publicar/SKILL.md` |
| Medir algo nuevo o cambiar qué datos se tratan | `.claude/skills/analitica-y-privacidad/SKILL.md` |
| Añadir una página | `.claude/skills/agregar-pagina/SKILL.md` |

Para otros asistentes hay instrucciones listas para copiar en `docs/prompts/`.
