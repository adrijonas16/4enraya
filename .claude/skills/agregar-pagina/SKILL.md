---
name: agregar-pagina
description: Crear una página nueva del sitio (informativa, legal o de ayuda). Úsala cuando pidan una página o sección con dirección propia.
---

# Añadir una página

1. Crea `html/nombre.html` copiando `html/terminos.html` (página de texto) o la estructura de `html/login.html` (página con interacción).
2. **Cabecera:** cambia título (≤ 60 caracteres), descripción (50–160), `canonical`, `og:title`, `og:description`, `og:url` y los equivalentes `twitter:`. Mantén iconos, manifest y fuentes.
3. **Scripts:** solo archivos externos (la CSP no permite scripts en línea). Incluye `config.js` y `consent.js` para que funcione «Preferencias de cookies».
4. **Pie:** el mismo `.site-footer` que el resto.
5. **Enlaces:** desde el pie o desde donde tenga sentido. Rutas relativas dentro de `html/`; la 404 usa rutas absolutas.
6. **Buscadores:** si es pública, añádela a `sitemap.xml`. Si no debe indexarse, `robots: noindex, follow`.
7. **Pruebas:** añade la ruta a la lista `PAGES` de `tests/e2e/site.spec.js` (accesibilidad, metadatos, enlaces, móvil).
8. Sigue `revisar-ui` y `npm run check`.
