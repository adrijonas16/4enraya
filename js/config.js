/* ==========================================================
   Configuración pública del sitio. Aquí no va ningún secreto.
   ========================================================== */
window.SITE = Object.freeze({
    name: '4 en Raya',
    url: 'https://4enraya-steel.vercel.app',

    // ID de medición de Google Analytics 4 (formato G-XXXXXXXXXX).
    // Vacío = sin analítica y sin banner de cookies.
    gaMeasurementId: '',

    // Contacto para privacidad. Si hay email, se muestra montado en el
    // navegador para que los robots de spam no lo lean del HTML.
    contactEmail: '',
    contactUrl: 'https://github.com/adrijonas16/4enraya/issues',

    // Versión de los textos legales; si cambia, se vuelve a pedir el consentimiento
    policyVersion: '2026-11-07',
});
