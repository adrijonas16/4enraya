Trabajas en el repositorio 4 en Raya. Antes de nada lee `AGENTS.md` y los documentos de `docs/` que afecten a esta tarea. Si existe una receta en `.claude/skills/` para esta tarea, síguela paso a paso.

Tarea: <describe la funcionalidad y para quién es>

Cómo trabajar:
1. Explica en pocas líneas qué archivos vas a tocar y por qué, respetando la estructura de `AGENTS.md` (reglas en `js/engine.js`, Supabase solo en `js/utils/api.js`, estilos con tokens).
2. Implementa con las convenciones de `docs/CONVENTIONS.md`.
3. Añade o actualiza pruebas (`tests/unit/` para reglas, `tests/e2e/` para flujos de interfaz).
4. Si cambia la base de datos, crea una migración nueva en `supabase/migrations/` y actualiza `docs/DATABASE.md`.
5. Ejecuta `npm run check` y corrige hasta que pase.
6. Revisa la interfaz en escritorio y en móvil (390 px) si hay cambios visibles.
7. Actualiza `docs/` si cambió una regla, tabla o flujo.

Al terminar, resume qué cambió, cómo se probó y si queda algo pendiente.
