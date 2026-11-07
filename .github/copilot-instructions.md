# Instrucciones para GitHub Copilot

Sigue las reglas de `AGENTS.md` en la raíz del repositorio. En resumen:

- JavaScript del navegador sin framework ni compilación; scripts clásicos con 4 espacios, comillas simples y punto y coma.
- Las reglas del juego solo en `js/engine.js` (sin DOM) y con prueba en `tests/unit/`.
- Solo `js/utils/api.js` habla con Supabase. Cambios de esquema solo con migraciones en `supabase/migrations/`.
- Texto de usuarios siempre con `textContent`. Nunca `innerHTML` con datos de usuarios.
- Colores, tipografía y animaciones desde los tokens de `css/variables.css`.
- Interfaz en español, minúscula inicial, frases claras.
- `npm run check` debe pasar.
