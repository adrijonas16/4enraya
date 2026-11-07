# Convenciones

## JavaScript

- **Scripts clásicos** envueltos en una IIFE con `'use strict'`. Cada archivo publica lo que exporta en `window` (`window.Engine`, `window.Social`…). No se usan módulos ES en el código del navegador, para que funcione abriendo los archivos sin compilar.
- **Estilo:** 4 espacios, comillas simples, punto y coma, `const` por defecto y `let` solo si se reasigna. Nunca `var`. Comparaciones con `===` (salvo `== null`). Lo comprueba `npm run lint`.
- **Nombres:** `camelCase` para funciones y variables, `PascalCase` para clases, `UPPER_SNAKE` para constantes de configuración (`MAX_CHARGE`, `POWERS`). Identificadores de poderes, eventos, mapas y estilos en minúscula y sin espacios (`bomb`, `flipAll`, `obstacles`, `caramelo`).
- **Comentarios en español**, cortos, explicando el porqué. No comentes lo obvio ni dejes código comentado.
- **Asíncrono:** `async/await`. Toda llamada a red tiene `catch` y un mensaje para el usuario si falla.
- **Animaciones:** Web Animations API (`el.animate`) sobre `transform` y `opacity`. Nada de animar `top`, `left`, `width`.
- **Estado:** el estado de la partida solo cambia mediante funciones de `Engine`. La interfaz nunca edita `state.cells` directamente (la única excepción documentada es reconstruir una tirada remota en `applyRemote`).
- **DOM:** `document.getElementById` mediante el atajo `$`. Para texto de usuarios, `textContent`. `innerHTML` solo con plantillas nuestras sin datos externos.
- **Sin dependencias nuevas en el navegador** salvo acuerdo previo. Las que hay viven en `js/vendor/` con la versión en el nombre del archivo. Para actualizar Supabase: `npm pack @supabase/supabase-js@X`, copia `dist/umd/supabase.js` a `js/vendor/supabase-X.js`, cambia las rutas en los HTML y en `tests/e2e/helpers.js` no hace falta tocar nada.

## CSS

- **Tokens primero:** colores, radios, tipografía, curvas y texturas son variables de `css/variables.css`. No se escriben colores sueltos salvo dentro de un estilo de tablero (`css/skins.css`) o de un degradado que ya existe.
- **Archivos:** base y tokens en `variables.css`; pantalla de juego en `game.css`; estilos de tablero en `skins.css`; entrada en `login.css`.
- **Clases** descriptivas y cortas (`.plaque`, `.power`, `.ticker`), modificadores como clases extra (`.plaque.active`, `.power.armed`). Evita selectores de id en CSS salvo para piezas únicas de maquetación.
- **Especificidad baja:** nada de `!important` salvo `prefers-reduced-motion` y utilidades de ocultar (`[hidden]`, `.hidden`, `.in-artifact …`).
- **Responsive:** puntos de corte existentes 1080 px, 900 px, 560 px y 440 px. Comprueba 390 px de ancho sin desplazamiento horizontal.
- **Movimiento:** los efectos que no provoca el jugador se usan con moderación. Siempre respeta `prefers-reduced-motion`.

## HTML

- Un único `html/game.html` con portada, partida y hojas (`<dialog>`).
- Botones con `type="button"` salvo los de envío. Iconos sin texto con `aria-label`.
- Ventanas modales con `<dialog>` y `showModal()`. No uses `alert`, `confirm` ni `prompt`: la página de Claude los bloquea.

## Formularios

- `novalidate` en el `<form>` y validación con `Validate` (`js/utils/validate.js`), para que los mensajes estén en español y sean iguales en todos los navegadores.
- Cada campo dentro de `.field`, con `<label for>`, y un `<p class="field-error" id="…-err">` enlazado con `aria-describedby`. `Validate.mark(input, mensaje)` pone `aria-invalid` y escribe el error.
- Valida al salir del campo y al enviar; al enviar, lleva el foco al primer campo con error.
- Antispam: campo trampa `.hp`, tiempo mínimo desde que se muestra el formulario y bloqueo temporal tras varios fallos. En la base de datos, límites con `enforce_rate_limit`.
- Los datos se limpian con `Validate.clean` antes de enviarlos (y los emails, en minúsculas).

## Textos de la interfaz

- Español neutro, tuteo, **minúscula inicial** salvo nombres propios (`Nueva partida`, no `Nueva Partida`). Sin mayúsculas sostenidas.
- Botones con verbo que dice lo que pasa: `Crear sala`, `Empezar partida`, `Guardar email`. El mismo nombre en todo el flujo.
- Errores: qué pasó y qué hacer, sin disculpas. `Esa columna está llena`, `No hay nadie en la sala ABC123. Revisa el código.`
- Sin jerga técnica: «se perdió la conexión», no «error de websocket».
- No anuncies los eventos de caos antes de que ocurran.

## Git

- Ramas: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `test/…`.
- Commits en español, en imperativo, con una primera línea de menos de 72 caracteres: `Añadir estilo de tablero Jade`. Si hace falta, cuerpo con viñetas.
- Un pull request por cambio. `master` siempre publicable.
