---
name: publicar
description: Publicar una versión del juego en Vercel (vía GitHub) y, si se pide, en la página de Claude. Úsala solo cuando el usuario pida subir o publicar.
---

# Publicar

Lee `docs/DEPLOYMENT.md`. No publiques sin que el usuario lo pida.

## GitHub y Vercel

1. `npm run check` en verde.
2. Rama + commit (español, imperativo) + push.
3. Pull request hacia `master` con la plantilla. Fusiona solo si el usuario lo pidió o lo aprueba.
4. Vercel publica `master` solo. Comprueba la última publicación de producción del proyecto `4enraya`: estado **Ready** y commit correcto. Si falla, lee los registros de la publicación antes de tocar nada.
5. Abre https://4enraya-steel.vercel.app y prueba una tirada como invitado.

## Página de Claude (si se pide)

1. `npm run build:artifact`.
2. Publica los archivos que cambiaron de `dist-artifact/` sobre la página existente, con sus rutas (`index.html`, `html/…`, `js/…`, `css/…`, `fonts/…`). No crees una página nueva.
3. Comprueba que la página sigue declarando la capacidad `room`.

## Al terminar

Dile al usuario qué se publicó, dónde y cualquier paso que quede de su lado (por ejemplo, configuración en Supabase).
