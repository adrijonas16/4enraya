/* ==========================================================
   Consentimiento de cookies y Google Analytics 4.
   La analítica no se carga hasta que la persona acepta.
   Uso: Analytics.track('nombre_evento', { parametro: 'valor' })
   ========================================================== */
(function (global) {
    'use strict';

    const SITE = global.SITE || {};
    const KEY = '4r-consent';
    const enabled = !!SITE.gaMeasurementId && !global.__ARTIFACT;
    const queue = [];
    let loaded = false;

    function read() {
        try {
            const v = JSON.parse(localStorage.getItem(KEY) || 'null');
            return v && v.version === SITE.policyVersion ? v.choice : null;
        } catch (e) { return null; }
    }

    function save(choice) {
        try { localStorage.setItem(KEY, JSON.stringify({ choice, version: SITE.policyVersion, at: new Date().toISOString() })); }
        catch (e) { /* sin almacenamiento: se volverá a preguntar */ }
    }

    function gtag() { global.dataLayer.push(arguments); }

    function loadGA() {
        if (loaded || !enabled) return;
        loaded = true;
        global.dataLayer = global.dataLayer || [];
        global.gtag = gtag;
        gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
        });
        gtag('js', new Date());
        // sin query ni hash: al volver de Google la URL lleva tokens con el email
        gtag('config', SITE.gaMeasurementId, {
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
            page_location: location.origin + location.pathname,
            page_referrer: document.referrer ? new URL(document.referrer).origin + new URL(document.referrer).pathname : undefined,
        });
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(SITE.gaMeasurementId);
        document.head.appendChild(s);
        queue.splice(0).forEach(([name, params]) => gtag('event', name, params));
    }

    function revoke() {
        global['ga-disable-' + SITE.gaMeasurementId] = true; // corta los envíos en esta misma visita
        if (loaded && global.gtag) global.gtag('consent', 'update', { analytics_storage: 'denied' });
        // borra las cookies _ga del dominio
        document.cookie.split(';').map(c => c.trim().split('=')[0]).filter(n => /^_ga/.test(n)).forEach(n => {
            const host = location.hostname;
            [host, '.' + host].forEach(d => { document.cookie = `${n}=; Max-Age=0; path=/; domain=${d}`; });
            document.cookie = `${n}=; Max-Age=0; path=/`;
        });
    }

    // ruta absoluta: funciona desde cualquier página, también desde la 404
    const legalHref = page => '/html/' + page;

    // eventos que se envían justo antes de cambiar de página: se guardan y salen en la siguiente
    const PENDING = '4r-pending-events';
    function flushPending() {
        try {
            const list = JSON.parse(sessionStorage.getItem(PENDING) || '[]');
            sessionStorage.removeItem(PENDING);
            list.forEach(([n, p]) => global.Analytics.track(n, p));
        } catch (e) { /* nada pendiente */ }
    }

    function showBanner() {
        if (!enabled || document.getElementById('consent')) return;
        const box = document.createElement('section');
        box.id = 'consent';
        box.className = 'consent';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-labelledby', 'consent-title');
        box.innerHTML = `
            <h2 id="consent-title">¿Nos dejas medir cómo se usa el juego?</h2>
            <p>Usamos Google Analytics para saber qué modos se juegan y mejorar el juego. Solo se activa si aceptas, y puedes cambiar de opinión cuando quieras. <a href="${legalHref('privacidad.html')}#cookies">Más información</a></p>
            <div class="consent-actions">
                <button type="button" class="btn btn-ghost btn-small" data-consent="denied">Rechazar</button>
                <button type="button" class="btn btn-primary btn-small" data-consent="granted">Aceptar analítica</button>
            </div>`;
        box.addEventListener('click', ev => {
            const b = ev.target.closest('[data-consent]');
            if (!b) return;
            const choice = b.dataset.consent;
            save(choice);
            if (choice === 'granted') loadGA(); else revoke();
            box.remove();
        });
        document.body.appendChild(box);
    }

    function init() {
        // enlaces "Preferencias de cookies" en cualquier página
        document.querySelectorAll('[data-cookie-prefs]').forEach(el => {
            if (!enabled) { el.hidden = true; return; }
            el.addEventListener('click', ev => { ev.preventDefault(); showBanner(); });
        });
        if (!enabled) return;
        const choice = read();
        if (choice === 'granted') { loadGA(); flushPending(); }
        else if (choice === null) showBanner();
    }

    global.Analytics = Object.freeze({
        enabled,
        track(name, params = {}) {
            if (!enabled || read() !== 'granted') return;
            if (loaded && global.gtag) global.gtag('event', name, params);
            else queue.push([name, params]);
        },
        // para eventos justo antes de navegar a otra página
        trackBeforeLeave(name, params = {}) {
            if (!enabled || read() !== 'granted') return;
            try {
                const list = JSON.parse(sessionStorage.getItem(PENDING) || '[]');
                list.push([name, params]);
                sessionStorage.setItem(PENDING, JSON.stringify(list.slice(-10)));
            } catch (e) { /* sin almacenamiento */ }
        },
        openPreferences: showBanner,
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window);
