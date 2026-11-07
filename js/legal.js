/* Páginas de texto: monta el contacto en el navegador (los robots de spam
   no encuentran el email en el HTML) */
(function () {
    'use strict';
    const SITE = window.SITE || {};
    document.querySelectorAll('[data-contact]').forEach(el => {
        el.textContent = '';
        if (SITE.contactEmail) {
            const a = document.createElement('a');
            a.href = 'mailto:' + SITE.contactEmail;
            a.textContent = SITE.contactEmail;
            el.appendChild(a);
        } else {
            const a = document.createElement('a');
            a.href = SITE.contactUrl;
            a.rel = 'noopener';
            a.textContent = 'la página del proyecto en GitHub';
            el.append('escribiéndonos en ', a, ' (no publiques ahí datos personales: pide un canal privado y te responderemos por él)');
        }
    });
})();
