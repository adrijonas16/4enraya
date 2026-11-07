@AGENTS.md

## Notas para Claude Code

- Antes de una tarea que coincida con una receta de `.claude/skills/`, carga esa skill y síguela.
- Para revisar un cambio antes del PR, usa el subagente `revisor` (`.claude/agents/revisor.md`): revisa el diff contra estas reglas sin haber visto cómo se escribió.
- Para cualquier cambio visible, sigue `revisar-ui`: capturas de escritorio y de móvil antes de dar el trabajo por terminado.
- Para la base de datos usa las herramientas de Supabase solo después de escribir la migración en `supabase/migrations/`. El proyecto es `cyzjihoibpdabhiotjpf`.
- No publiques en Vercel ni en la página de Claude sin que el usuario lo pida; sigue `publicar`.
