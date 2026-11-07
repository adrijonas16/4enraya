/* ==========================================================
   Validación de formularios compartida. Devuelve un mensaje
   de error para la persona o null si el valor es válido.
   Las mismas reglas existen en la base de datos (migración
   20261107170000_validation_and_rate_limits).
   ========================================================== */
(function (global) {
    'use strict';

    const USERNAME = /^[A-Za-z0-9_ÁÉÍÓÚáéíóúÑñÜü]{3,15}$/;
    const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const ROOM = /^[A-Z0-9]{6}$/;

    // quita caracteres de control e invisibles y espacios sobrantes
    // eslint-disable-next-line no-control-regex
    const clean = v => String(v || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g, '').trim();

    const Validate = {
        clean,
        username(v) {
            v = clean(v);
            if (!v) return 'Escribe un nombre de usuario';
            if (v.length < 3) return 'El nombre necesita al menos 3 caracteres';
            if (v.length > 15) return 'El nombre puede tener como mucho 15 caracteres';
            if (!USERNAME.test(v)) return 'Usa solo letras, números o _ (sin espacios)';
            return null;
        },
        email(v) {
            v = clean(v);
            if (!v) return 'Escribe tu email';
            if (v.length > 120 || !EMAIL.test(v)) return 'Ese email no parece válido. Revisa que tenga @ y un dominio';
            return null;
        },
        password(v, { min = 8 } = {}) {
            if (!v) return 'Escribe una contraseña';
            if (v.length < min) return `La contraseña necesita al menos ${min} caracteres`;
            if (v.length > 72) return 'La contraseña puede tener como mucho 72 caracteres';
            return null;
        },
        nick(v) {
            v = clean(v);
            if (v.length < 2) return 'Tu nombre necesita al menos 2 caracteres';
            if (v.length > 15) return 'Tu nombre puede tener como mucho 15 caracteres';
            return null;
        },
        room(v) {
            return ROOM.test(clean(v).toUpperCase()) ? null : 'El código tiene 6 letras o números';
        },

        // Marca un campo como inválido o válido y escribe el mensaje accesible
        mark(input, message) {
            const err = document.getElementById(input.getAttribute('aria-describedby') || '');
            input.setAttribute('aria-invalid', message ? 'true' : 'false');
            if (err) err.textContent = message || '';
            return !message;
        },
    };

    global.Validate = Object.freeze(Validate);
})(window);
