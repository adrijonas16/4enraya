---
name: analitica-y-privacidad
description: Medir algo nuevo con Google Analytics, añadir un servicio de terceros o cambiar qué datos personales se guardan. Úsala antes de tocar analítica, cookies, formularios con datos personales o la política de privacidad.
---

# Analítica y privacidad

## Medir un evento nuevo

1. Envíalo solo con `Analytics.track('nombre_evento', { … })`. Sin consentimiento se descarta solo.
2. Nombre en `snake_case` y en inglés, como recomienda GA4 (`game_start`, `sign_up`). Reutiliza los nombres recomendados de GA4 cuando existan.
3. Parámetros sin datos personales: nada de nombres de usuario, emails, códigos de sala ni texto escrito por la persona. Sí valores de una lista cerrada (`mode: 'ai'`, `result: 'won'`).
4. Añádelo a la lista de eventos de `docs/ARCHITECTURE.md` (sección Analítica).

## Añadir un servicio de terceros (script, fuente, API)

1. ¿Es imprescindible? Si solo mide o personaliza, va detrás del consentimiento (ver `js/consent.js`).
2. Fija la versión. Las librerías se copian a `js/vendor/` con la versión en el nombre y su licencia; no se cargan desde un CDN.
3. Añade su dominio a la CSP de `vercel.json` (solo la directiva que haga falta).
4. Añádelo a la lista de proveedores de `html/privacidad.html`.

## Cambiar qué datos se tratan

1. Actualiza la tabla «Qué datos tratamos» de `html/privacidad.html` y la fecha de «Última actualización».
2. Sube `policyVersion` en `js/config.js` si el cambio afecta a cookies o analítica: el banner volverá a preguntar.
3. Si es un dato nuevo en la base de datos, sigue también `cambio-base-datos`.

## Comprobar

- `npx playwright test tests/e2e/site.spec.js -g cookies`
- Sin aceptar, en la pestaña Red del navegador no debe aparecer ninguna petición a Google.
