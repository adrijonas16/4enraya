(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    if (window.Scene) new Scene($('scene'));

    // vuelta desde Google con error en la URL
    const params = new URLSearchParams(location.search + '&' + location.hash.slice(1));
    const oauthError = params.get('error_description');

    // con cuenta ya iniciada, directo al juego (los invitados sí pueden entrar aquí)
    const current = api.getCurrentUser();
    if (current && !current.guest && !oauthError) { location.replace('game.html'); return; }

    // antispam: tiempo mínimo desde que se ve el formulario y límite de intentos
    const shownAt = Date.now();
    let failures = 0;
    let lockedUntil = 0;

    function show(kind, msg) {
        $('login-error').textContent = kind === 'error' ? msg : '';
        $('login-success').textContent = kind === 'ok' ? msg : '';
    }

    function busy(form, on) {
        const b = form.querySelector('[type="submit"]');
        b.disabled = on;
        b.dataset.label = b.dataset.label || b.textContent;
        b.textContent = on ? 'Un momento…' : b.dataset.label;
    }

    function guard() {
        if (Date.now() < lockedUntil) {
            const s = Math.ceil((lockedUntil - Date.now()) / 1000);
            show('error', `Demasiados intentos. Espera ${s} segundos y vuelve a probar.`);
            return false;
        }
        if (Date.now() - shownAt < 1500) {
            show('error', 'Un momento… vuelve a pulsar el botón.');
            return false;
        }
        return true;
    }

    function failed(message) {
        failures++;
        if (failures >= 5) { lockedUntil = Date.now() + 30000; failures = 0; }
        show('error', message);
    }

    // pestañas accesibles (flechas para cambiar)
    const tabs = [...document.querySelectorAll('.tab')];
    function select(tab, focus) {
        tabs.forEach(t => {
            const on = t === tab;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
        });
        document.querySelectorAll('.form').forEach(f => f.classList.toggle('active', f.id === tab.dataset.tab + '-form'));
        show();
        if (focus) document.querySelector(`#${tab.dataset.tab}-form input`).focus();
    }
    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => select(tab, true));
        tab.addEventListener('keydown', e => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
            select(next, false);
            next.focus();
        });
    });
    if (location.hash === '#crear-cuenta') select(tabs[1], false);

    document.querySelectorAll('.pw-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = $(btn.dataset.target);
            const hidden = input.type === 'password';
            input.type = hidden ? 'text' : 'password';
            btn.textContent = hidden ? 'Ocultar' : 'Mostrar';
            btn.setAttribute('aria-label', hidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
        });
    });

    // validación al salir de cada campo y al enviar
    const rules = {
        'login-email': v => (Validate.clean(v) ? null : 'Escribe tu usuario o tu email'),
        'login-password': v => (v ? null : 'Escribe tu contraseña'),
        'reg-username': v => Validate.username(v),
        'reg-email': v => Validate.email(v),
        'reg-password': v => Validate.password(v),
    };
    Object.keys(rules).forEach(id => {
        const input = $(id);
        input.addEventListener('blur', () => { if (input.value) Validate.mark(input, rules[id](input.value)); });
        input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') Validate.mark(input, rules[id](input.value)); });
    });
    function validate(ids) {
        let first = null;
        ids.forEach(id => {
            const ok = Validate.mark($(id), rules[id]($(id).value));
            if (!ok && !first) first = $(id);
        });
        if (first) first.focus();
        return !first;
    }

    $('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        show();
        if (!validate(['login-email', 'login-password']) || !guard()) return;
        busy(e.target, true);
        try {
            await api.login(Validate.clean($('login-email').value), $('login-password').value);
            Analytics.track('login', { method: 'password' });
            location.href = 'game.html';
        } catch (err) {
            failed(err.message);
        } finally { busy(e.target, false); }
    });

    $('register-form').addEventListener('submit', async e => {
        e.preventDefault();
        show();
        const terms = $('reg-terms');
        const okFields = validate(['reg-username', 'reg-email', 'reg-password']);
        const okTerms = Validate.mark(terms, terms.checked ? null : 'Necesitas aceptar los términos para crear una cuenta');
        if (!okFields || !okTerms || !guard()) return;
        // un robot rellenó el campo trampa: fingimos un error genérico
        if ($('reg-website').value) { failed('No se pudo crear la cuenta. Inténtalo de nuevo.'); return; }
        const username = Validate.clean($('reg-username').value);
        const email = Validate.clean($('reg-email').value).toLowerCase();
        const pw = $('reg-password').value;
        busy(e.target, true);
        try {
            await api.register(username, email, pw);
            await api.login(username, pw);
            Analytics.track('sign_up', { method: 'password' });
            location.href = 'game.html';
        } catch (err) {
            failed(err.message);
        } finally { busy(e.target, false); }
    });

    const gbtn = $('google-btn');
    const gLabel = gbtn.querySelector('span');
    if (!api.online) {
        gbtn.disabled = true;
        gLabel.textContent = 'Google no disponible sin conexión';
    }
    gbtn.addEventListener('click', async () => {
        gbtn.disabled = true;
        gLabel.textContent = 'Abriendo Google…';
        try { await api.loginWithGoogle(); }
        catch (err) { show('error', err.message); gbtn.disabled = false; gLabel.textContent = 'Continuar con Google'; }
    });

    if (oauthError) {
        show('error', /provider is not enabled/i.test(oauthError)
            ? 'El inicio con Google aún no está activado en el servidor.'
            : 'Google no pudo completar el inicio de sesión. Prueba otra vez.');
        history.replaceState(null, '', location.pathname);
    } else if (api.online) {
        // ¿volvemos de Google con sesión?
        gLabel.textContent = 'Comprobando sesión…';
        gbtn.disabled = true;
        api.finishOAuth().then(user => {
            if (user) {
                Analytics.track('login', { method: 'google' });
                location.replace('game.html');
                return;
            }
            gbtn.disabled = false; gLabel.textContent = 'Continuar con Google';
        }).catch(err => {
            show('error', err.message);
            gbtn.disabled = false; gLabel.textContent = 'Continuar con Google';
        });
    }

    $('guest-btn').addEventListener('click', () => { if (!api.getCurrentUser()) api.loginAsGuest(); });
})();
