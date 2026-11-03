(function () {
    'use strict';
    const $ = id => document.getElementById(id);

    // si ya hay sesión, directo al juego
    if (api.getCurrentUser()) { location.replace('game.html'); return; }

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

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab); });
            document.querySelectorAll('.form').forEach(f => f.classList.toggle('active', f.id === tab.dataset.tab + '-form'));
            show();
            document.querySelector(`#${tab.dataset.tab}-form input`).focus();
        });
    });

    document.querySelectorAll('.pw-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = $(btn.dataset.target);
            const hidden = input.type === 'password';
            input.type = hidden ? 'text' : 'password';
            btn.textContent = hidden ? 'Ocultar' : 'Mostrar';
        });
    });

    $('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const id = $('login-email').value.trim();
        const pw = $('login-password').value;
        if (!id || !pw) return show('error', 'Escribe tu usuario y tu contraseña');
        busy(e.target, true);
        try {
            await api.login(id, pw);
            location.href = 'game.html';
        } catch (err) {
            show('error', err.message);
        } finally { busy(e.target, false); }
    });

    $('register-form').addEventListener('submit', async e => {
        e.preventDefault();
        const username = $('reg-username').value.trim();
        const email = $('reg-email').value.trim();
        const pw = $('reg-password').value;
        if (!username || !email || !pw) return show('error', 'Rellena los tres campos');
        if (pw.length < 4) return show('error', 'La contraseña necesita al menos 4 caracteres');
        busy(e.target, true);
        try {
            await api.register(username, email, pw);
            await api.login(username, pw);
            location.href = 'game.html';
        } catch (err) {
            show('error', err.message);
        } finally { busy(e.target, false); }
    });

    $('guest-btn').addEventListener('click', () => {
        api.loginAsGuest();
        location.href = 'game.html';
    });
})();
