# Cómo contribuir

1. Lee [`AGENTS.md`](AGENTS.md): estructura, reglas y flujo de trabajo. Vale igual para personas que para asistentes de IA.
2. Prepara el entorno: `npm install` y, para las pruebas de navegador, `npx playwright install chromium`.
3. Crea una rama desde `master` (`feat/…`, `fix/…`, `docs/…`, `chore/…`).
4. Si la tarea tiene receta en [`.claude/skills/`](.claude/skills), síguela.
5. `npm run check` tiene que pasar.
6. Abre un pull request con la plantilla. Si hay cambios visibles, añade capturas de escritorio y móvil.

Documentación técnica:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): cómo está hecho
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md): estilo de código, CSS, textos y Git
- [`docs/DESIGN.md`](docs/DESIGN.md): sistema de diseño y estilos de tablero
- [`docs/DATABASE.md`](docs/DATABASE.md): Supabase, migraciones y seguridad
- [`docs/TESTING.md`](docs/TESTING.md): pruebas
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): publicación
- [`docs/prompts/`](docs/prompts): instrucciones listas para asistentes de IA
