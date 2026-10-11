(() => {
    const authForm = document.getElementById('authForm');
    const authCard = document.getElementById('authCard');
    const dashboard = document.getElementById('dashboard');
    const authNotice = document.getElementById('authNotice');
    const loginChallengeCard = document.getElementById('loginChallengeCard');
    const challengeNotice = document.getElementById('challengeNotice');
    const authSubmit = document.getElementById('authSubmit');
    const passwordInput = document.getElementById('authPassword');
    const confirmField = document.getElementById('confirmField');
    const confirmInput = document.getElementById('authConfirm');
    let authMode = 'login';
    let activeUser = null;

    function setAccountLink(user) {
        const link = document.querySelector('.header-account-link');
        if (!link) return;
        link.href = user ? 'profile.html' : '#cuenta';
        if (link.firstChild) link.firstChild.textContent = user ? 'Mi perfil ' : 'Iniciar sesión / registrarse ';
    }

    async function api(url, options = {}) {
        let response;
        try {
            response = await fetch(url, { credentials: 'same-origin', ...options });
        } catch (error) {
            if (error instanceof TypeError) {
                throw new Error('No hay conexión con el servidor. Inicia la página con "node server.js" y vuelve a cargarla.');
            }
            throw error;
        }
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json') ? await response.json() : null;
        if (!contentType.includes('application/json')) {
            throw new Error('El servidor de cuentas no está activo. Inicia la página con "node server.js" y vuelve a cargarla.');
        }
        if (!response.ok) throw new Error(payload?.error || 'No se pudo completar la solicitud.');
        return { response, payload };
    }

    function setNotice(message, kind = '') {
        authNotice.textContent = message;
        authNotice.className = 'form-note' + (kind ? ' ' + kind : '');
    }

    function setMode(mode) {
        authMode = mode;
        document.querySelectorAll('[data-auth-mode]').forEach(button => {
            const selected = button.dataset.authMode === mode;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-selected', String(selected));
        });
        const registering = mode === 'register';
        confirmField.hidden = !registering;
        confirmInput.required = registering;
        passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
        authSubmit.textContent = registering ? 'Crear mi cuenta →' : 'Entrar →';
        renderRememberedAccounts();
        setNotice(registering ? 'Elige un usuario y una contraseña de al menos 8 caracteres.' : 'Tus estructuras quedan guardadas de forma privada.');
    }

    function renderRememberedAccounts() {
        const section = document.getElementById('rememberedAccounts');
        const list = document.getElementById('rememberedAccountList');
        const accounts = window.MCViewerSessionMenu?.getRememberedAccounts?.() || [];
        if (!section || !list) return;
        list.replaceChildren();
        section.hidden = authMode !== 'login' || accounts.length === 0;
        for (const username of accounts) {
            const row = document.createElement('div');
            row.className = 'remembered-account';
            const accountInfo = document.createElement('div');
            accountInfo.className = 'remembered-account-info';
            const open = document.createElement('button');
            open.className = 'remembered-account-open';
            open.type = 'button';
            open.dataset.rememberedUsername = username;
            const avatar = document.createElement('span');
            avatar.className = 'remembered-account-avatar';
            avatar.setAttribute('aria-hidden', 'true');
            avatar.textContent = username.slice(0, 1).toLocaleUpperCase();
            const name = document.createElement('span');
            name.className = 'remembered-account-name';
            name.textContent = username;
            const arrow = document.createElement('span');
            arrow.className = 'remembered-account-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '↗';
            open.append(avatar, name, arrow);
            open.setAttribute('aria-label', `Abrir inicio de sesión para ${username}`);
            const hint = document.createElement('small');
            hint.textContent = 'Pulsa para abrir el inicio de sesión de esta cuenta.';
            const remove = document.createElement('button');
            remove.className = 'remembered-account-remove';
            remove.type = 'button';
            remove.dataset.removeRememberedUsername = username;
            remove.textContent = 'Quitar';
            remove.setAttribute('aria-label', `Quitar ${username} de las cuentas guardadas`);
            accountInfo.append(open, hint);
            row.append(accountInfo, remove);
            list.append(row);
        }
    }

    document.getElementById('rememberedAccountList')?.addEventListener('click', event => {
        const removeButton = event.target.closest('[data-remove-remembered-username]');
        if (removeButton) {
            window.MCViewerSessionMenu?.forgetAccount?.(removeButton.dataset.removeRememberedUsername);
            renderRememberedAccounts();
            return;
        }
        const openButton = event.target.closest('[data-remembered-username]');
        if (!openButton) return;
        setMode('login');
        authForm.hidden = false;
        loginChallengeCard.hidden = true;
        document.getElementById('authUsername').value = openButton.dataset.rememberedUsername;
        passwordInput.value = '';
        window.setTimeout(() => passwordInput.focus(), 0);
    });

    function showSignedIn(user) {
        activeUser = user;
        window.MCViewerSessionUsername = user.username;
        window.MCViewerTheme?.setAccountContext(user, false);
        setAccountLink(user);
        authCard.hidden = true;
        loginChallengeCard.hidden = true;
        dashboard.hidden = false;
        document.getElementById('dashboardUsername').textContent = user.username;
        document.getElementById('dashboardRole').textContent = user.role === 'admin' ? 'Administrador' : (user.role === 'subadmin' ? 'Subadmin' : (user.creatorEnabled ? 'Creador' : 'Usuario'));
    }
    function showSignedOut() {
        activeUser = null;
        window.MCViewerSessionUsername = null;
        window.MCViewerTheme?.setAccountContext(null, false);
        setAccountLink(null);
        authCard.hidden = false;
        document.getElementById('authForm').hidden = false;
        loginChallengeCard.hidden = true;
        dashboard.hidden = true;
    }
    document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));
    document.getElementById('createAccountLink').addEventListener('click', () => setMode('register'));

    authForm.addEventListener('submit', async event => {
        event.preventDefault();
        const formData = new FormData(authForm);
        const username = String(formData.get('username') || '').trim();
        const password = String(formData.get('password') || '');
        if (authMode === 'register' && password !== String(formData.get('confirm') || '')) {
            return setNotice('Las contraseñas no coinciden.', 'error');
        }

        authSubmit.disabled = true;
        authSubmit.textContent = authMode === 'register' ? 'Creando cuenta…' : 'Entrando…';
        try {
            const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
            const result = await api(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            authForm.reset();
            if (result.payload.mfaRequired || result.payload.emailSetupRequired) {
                authForm.hidden = true;
                loginChallengeCard.hidden = false;
                const setup = Boolean(result.payload.emailSetupRequired);
                document.getElementById('challengeTitle').textContent = setup ? 'Vincula un correo para proteger la cuenta' : 'Verifica tu inicio de sesión';
                document.getElementById('setupEmailRequestForm').hidden = !setup;
                document.getElementById('setupEmailVerifyForm').hidden = true;
                document.getElementById('loginCodeForm').hidden = setup;
                challengeNotice.textContent = setup
                    ? 'La cuenta administradora requiere un correo verificado. El código se enviará mediante el correo configurado en el servidor.'
                    : 'Ingresa el código de un solo uso que se envió a tu correo verificado.';
                return;
            }
            showSignedIn(result.payload.user);
        } catch (error) {
            setNotice(error.message, 'error');
        } finally {
            authSubmit.disabled = false;
            authSubmit.textContent = authMode === 'register' ? 'Crear mi cuenta →' : 'Entrar →';
        }
    });

    document.addEventListener('mc-viewer-logout-complete', event => {
        showSignedOut();
        const { choice, remembered, forgotten } = event.detail || {};
        const message = choice === 'save'
            ? (remembered
                ? 'Sesión cerrada. La cuenta quedó guardada en este dispositivo; necesitarás tu contraseña para volver a entrar.'
                : 'Sesión cerrada, pero el navegador no pudo guardar la cuenta.')
            : (forgotten
                ? 'Sesión cerrada. La cuenta guardada se quitó de este dispositivo.'
                : 'Sesión cerrada, pero el navegador no pudo quitar la cuenta guardada.');
        setNotice(message, choice && ((choice === 'save' && !remembered) || (choice === 'remove' && !forgotten)) ? 'error' : '');
        renderRememberedAccounts();
        document.getElementById('cuenta').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    async function submitJsonForm(event, url, payload, successMessage, onSuccess, noticeTarget = 'challenge') {
        event.preventDefault();
        const targetNotice = challengeNotice;
        try {
            const result = await api(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (successMessage) {
                targetNotice.textContent = successMessage;
                targetNotice.className = 'form-note success';
            }
            if (onSuccess) await onSuccess(result.payload);
        } catch (error) {
            targetNotice.textContent = error.message;
            targetNotice.className = 'form-note error';
        }
    }

    document.getElementById('setupEmailRequestForm').addEventListener('submit', async event => {
        const email = document.getElementById('setupEmail').value;
        await submitJsonForm(event, '/api/auth/setup-email/request', { email }, 'Si se pudo enviar, recibirás un código válido durante cinco minutos.', () => {
            document.getElementById('setupEmailRequestForm').hidden = true;
            document.getElementById('setupEmailVerifyForm').hidden = false;
        }, 'challenge');
    });

    document.getElementById('setupEmailVerifyForm').addEventListener('submit', async event => {
        const code = document.getElementById('setupEmailCode').value;
        await submitJsonForm(event, '/api/auth/setup-email/verify', { code }, '', payload => {
            showSignedIn(payload.user);
        }, 'challenge');
    });

    document.getElementById('loginCodeForm').addEventListener('submit', async event => {
        const code = document.getElementById('loginCode').value;
        await submitJsonForm(event, '/api/auth/verify-code', { code }, '', payload => {
            showSignedIn(payload.user);
        }, 'challenge');
    });

    document.getElementById('resendLoginCode').addEventListener('click', async () => {
        await submitJsonForm({ preventDefault() {} }, '/api/auth/resend-code', {}, 'Se solicitó otro código.', null, 'challenge');
    });

    document.getElementById('cancelLoginChallenge').addEventListener('click', async () => {
        try { await api('/api/auth/cancel-challenge', { method: 'POST' }); } catch {}
        loginChallengeCard.hidden = true;
        authForm.hidden = false;
        setNotice('Inicio de sesión cancelado.');
    });

    const socialNetworks = [
        { key: 'discord', name: 'Discord', shapes: [['path', { d: 'M19.4 5.2a18 18 0 0 0-4.4-1.4l-.6 1.2a16.5 16.5 0 0 0-4.8 0L9 3.8a18 18 0 0 0-4.4 1.4C1.8 9.4 1 13.5 1.4 17.5a18 18 0 0 0 5.4 2.7l1.2-2a11 11 0 0 1-1.8-.9l.4-.3a12.8 12.8 0 0 0 11 0l.4.3a11 11 0 0 1-1.8.9l1.2 2a18 18 0 0 0 5.4-2.7c.5-4.7-.8-8.8-3.4-12.3ZM8.6 14.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.8 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z' }]] },
        { key: 'tiktok', name: 'TikTok', shapes: [['path', { d: 'M19.6 7.2a6.3 6.3 0 0 1-4.1-1.5v8.1a6.2 6.2 0 1 1-5.4-6.1v3.4a2.9 2.9 0 1 0 2.1 2.8V2.5h3.3a6.3 6.3 0 0 0 4.1 4.1v.6Z' }]] },
        { key: 'youtube', name: 'YouTube', shapes: [['path', { d: 'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.8V8.2l6.3 3.8-6.3 3.8Z' }]] },
        { key: 'x', name: 'X', shapes: [['path', { d: 'M18.9 1.2h3.7l-8 9.2L24 22.9h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.5h2L6.5 3.2H4.3l13.3 17.5Z' }]] },
        { key: 'instagram', name: 'Instagram', shapes: [['rect', { x: '3', y: '3', width: '18', height: '18', rx: '5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }], ['circle', { cx: '12', cy: '12', r: '4', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }], ['circle', { cx: '17.6', cy: '6.7', r: '1.1' }]] }
    ];
    const socialLinks = document.getElementById('socialLinks');
    const svgNamespace = 'http://www.w3.org/2000/svg';

    function safeSocialUrl(value) {
        try {
            const url = new URL(value);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch {
            return '';
        }
    }

    function renderSocials() {
        const configuredLinks = window.MC_VIEWER_SOCIALS || {};
        socialLinks.replaceChildren();
        for (const network of socialNetworks) {
            const href = safeSocialUrl(configuredLinks[network.key] || '');
            const item = document.createElement(href ? 'a' : 'span');
            item.className = 'social-link' + (href ? '' : ' social-link-empty');
            item.setAttribute('aria-label', network.name + (href ? '' : ' — agrega tu enlace en src/data/social-links.js'));
            item.title = href ? network.name : network.name + ' · agrega el enlace en src/data/social-links.js';
            if (href) {
                item.href = href;
                item.target = '_blank';
                item.rel = 'noopener noreferrer';
            } else {
                item.setAttribute('aria-disabled', 'true');
            }

            const icon = document.createElementNS(svgNamespace, 'svg');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('class', 'social-icon');
            icon.setAttribute('aria-hidden', 'true');
            for (const [tagName, attributes] of network.shapes) {
                const shape = document.createElementNS(svgNamespace, tagName);
                for (const [attribute, value] of Object.entries(attributes)) shape.setAttribute(attribute, value);
                icon.append(shape);
            }
            const label = document.createElement('span');
            label.className = 'social-label';
            label.textContent = network.name;
            item.append(icon, label);
            socialLinks.append(item);
        }
    }
    renderSocials();
    renderRememberedAccounts();
    setMode('login');
    api('/api/auth/me').then(result => {
        if (result.payload.user) showSignedIn(result.payload.user);
        else showSignedOut();
    }).catch(() => {
        setNotice('Para usar cuentas y biblioteca, inicia el servidor con "node server.js".');
    });
})();

