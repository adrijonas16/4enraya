class Login {
    constructor() {
        console.log('Login class created');
        this.init();
    }

    init() {
        console.log('Login init called');
        console.log('API available:', typeof api);
        this.bindTabs();
        this.bindForms();
        this.bindPasswordToggles();
        console.log('All bindings done');
    }

    bindPasswordToggles() {
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.textContent = '🙈';
                } else {
                    input.type = 'password';
                    btn.textContent = '👁️';
                }
            });
        });
    }

    bindTabs() {
        document.querySelectorAll('.login-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab + '-form').classList.add('active');
                this.clearMessages();
            });
        });
    }

    bindForms() {
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleRegister();
        });
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            this.showError('Completa todos los campos');
            return;
        }

        try {
            const user = await api.login(email, password);
            this.redirectToGame();
        } catch (err) {
            this.showError(err.message);
        }
    }

    async handleRegister() {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;

        if (!username || !email || !password) {
            this.showError('Completa todos los campos');
            return;
        }

        if (password.length < 4) {
            this.showError('La contraseña debe tener al menos 4 caracteres');
            return;
        }

        try {
            await api.register(username, email, password);
            this.showSuccess('Cuenta creada. Inicia sesión.');
            document.querySelector('[data-tab="login"]').click();
        } catch (err) {
            this.showError(err.message);
        }
    }

    showError(msg) {
        const errorEl = document.getElementById('login-error');
        const successEl = document.getElementById('login-success');
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
        successEl.style.display = 'none';
    }

    showSuccess(msg) {
        const errorEl = document.getElementById('login-error');
        const successEl = document.getElementById('login-success');
        successEl.textContent = msg;
        successEl.style.display = 'block';
        errorEl.style.display = 'none';
    }

    clearMessages() {
        document.getElementById('login-error').style.display = 'none';
        document.getElementById('login-success').style.display = 'none';
    }

    redirectToGame() {
        window.location.href = '../html/game.html';
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, creating Login');
        new Login();
    });
} else {
    console.log('DOM already ready, creating Login');
    new Login();
}
