Revisa este cambio del repositorio 4 en Raya: <enlace al PR o rama>

Lee `AGENTS.md`, `docs/CONVENTIONS.md` y el documento de `docs/` del área afectada. Ejecuta `npm run lint`, `npm test` y, si toca interfaz u online, `npm run test:e2e`.

Comprueba, de más a menos grave:
1. Que funciona y no rompe el flujo de turnos, la gravedad, la sincronía online (`seq` y `push`) ni ninguno de los dos transportes online.
2. Las reglas de oro de `AGENTS.md` (lógica en el motor, Supabase solo en `api.js`, `textContent` con datos de usuarios, tokens de diseño, migraciones para la base de datos, sin `alert`/`confirm`).
3. Que hay pruebas para lo nuevo.
4. Accesibilidad, móvil a 390 px, textos en español y `prefers-reduced-motion`.
5. Documentación al día.

Responde con una lista: archivo y línea, problema, arreglo propuesto. Separa «debe arreglarse» de «sugerencia».
