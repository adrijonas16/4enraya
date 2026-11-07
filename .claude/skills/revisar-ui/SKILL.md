---
name: revisar-ui
description: Revisar visualmente un cambio de interfaz en escritorio y móvil con capturas antes de darlo por terminado. Úsala tras cualquier cambio en HTML, CSS o animaciones.
---

# Revisar la interfaz

## Pasos

1. Arranca el servidor: `npm start` (http://localhost:8080) o deja que Playwright lo haga.
2. Haz capturas con un script de Playwright en un archivo temporal fuera de `tests/` (no lo subas), cubriendo:
   - **Escritorio** 1280×820 y **móvil** 390×844 con `deviceScaleFactor: 2`.
   - Portada, partida en curso, la hoja o panel que cambiaste y el estado final (victoria).
   - Identifícate como invitado antes de cargar: `localStorage.setItem('user', JSON.stringify({ username: 'Invitado', guest: true }))`.
   - Para empezar sin clics: `app.showGame(); app.newGame();`.
3. Mira las capturas y comprueba:
   - Nada se sale de la pantalla: `document.documentElement.scrollWidth <= innerWidth`.
   - Nada se corta ni se parte en dos líneas sin querer (barra superior en móvil).
   - Contraste del texto y estados de foco visibles con teclado (`Tab`).
   - Los textos siguen `docs/CONVENTIONS.md` (minúscula inicial, verbos claros).
4. Repite con `page.emulateMedia({ reducedMotion: 'reduce' })` si tocaste animaciones.
5. Corrige y vuelve a capturar hasta que esté bien. Adjunta las capturas finales al PR.
