# Publicación

## Vercel (web principal)

- Proyecto `4enraya` en la cuenta de Vercel de adrijonas16, enlazado al repositorio de GitHub.
- Dominio principal: https://4enraya-steel.vercel.app
- **Cada fusión en `master` se publica sola.** Las ramas y los pull requests generan versiones de prueba (protegidas con inicio de sesión de Vercel).
- No hay paso de compilación: `vercel.json` desactiva instalación y compilación y sirve la raíz tal cual. Cachea las fuentes un año.

Después de fusionar:

1. En Vercel, la última publicación de producción debe estar en estado **Ready** con el commit de `master`.
2. Abre el dominio, entra como invitado y juega una tirada.
3. Si falla, revisa los registros de la publicación. Para volver atrás, promueve la publicación anterior desde el panel.

## Supabase

Configuración que no está en el código y debe mantenerse:

- **Authentication → URL Configuration:** Site URL = dominio de Vercel; Redirect URLs incluyen `https://4enraya-steel.vercel.app/**` y `http://localhost:*/**`.
- **Authentication → Providers → Google:** activado con el ID y secreto de un cliente OAuth web de Google Cloud cuya redirección autorizada sea `https://cyzjihoibpdabhiotjpf.supabase.co/auth/v1/callback`.
- Las migraciones se aplican aparte (ver `docs/DATABASE.md`). Publicar en Vercel no cambia la base de datos.

## Página de Claude (versión para invitados)

Una copia del juego publicada como página de Claude, útil para jugar sin cuenta y con online por salas en tiempo real.

1. `npm run build:artifact` genera `dist-artifact/`.
2. Publica todos los archivos de `dist-artifact/` en la misma página (no una nueva), conservando las rutas. `index.html` es la entrada.
3. La página debe tener declarada la capacidad `room` (`{ "room": {} }`); sin ella el online no aparece.
4. Para jugar con alguien, compártele la página desde Claude.

Solo se publica cuando el usuario lo pide.

## Secretos

No hay secretos en el repositorio. La clave `anon` de Supabase es pública por diseño. Los secretos de Google y cualquier clave de servicio viven solo en los paneles de Supabase y Google Cloud.
