(() => {
    const securitySection = document.querySelector('[data-account-security]');
    if (!securitySection) return;

    const accessPrompt = document.querySelector('[data-security-access-prompt]');
    const loginLink = document.querySelector('[data-security-login-link]');
    const sessionCard = document.querySelector('[data-account-session]');
    const sessionUsername = document.querySelector('[data-account-session-username]');
    const notice = document.getElementById('securityNotice');

    async function api(url, options = {}) {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
        const type = response.headers.get('content-type') || '';
        if (!type.includes('application/json')) throw new Error('El servidor no respondió con datos válidos.');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud.');
        return payload;
    }

    function setNotice(message, kind = '') {
        notice.textContent = message;
        notice.className = 'form-note' + (kind ? ' ' + kind : '');
    }

    async function loadSecurity() {
        try {
            const { security } = await api('/api/security');
            document.getElementById('securityEmailStatus').textContent = security.emailVerified ? security.email : 'Sin correo verificado';
            document.getElementById('mfaState').textContent = security.mfaRequired
                ? 'Verificación en dos pasos obligatoria para administrador.'
                : (security.mfaEnabled ? 'Verificación en dos pasos activada.' : 'Verificación en dos pasos desactivada.');
            document.getElementById('mfaEnableForm').hidden = security.mfaEnabled || security.mfaRequired || !security.emailVerified;
            document.getElementById('mfaVerifyForm').hidden = true;
            document.getElementById('mfaDisableForm').hidden = !security.mfaEnabled || security.mfaRequired;
        } catch (error) {
            setNotice(error.message, 'error');
        }
    }

    async function submit(event, url, payload, successMessage, onSuccess) {
        event.preventDefault();
        try {
            const result = await api(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (successMessage) setNotice(successMessage, 'success');
            if (onSuccess) await onSuccess(result);
        } catch (error) {
            setNotice(error.message, 'error');
        }
    }

    document.getElementById('emailRequestForm').addEventListener('submit', event => submit(event, '/api/security/email/request', {
        email: document.getElementById('securityEmail').value,
        currentPassword: document.getElementById('emailCurrentPassword').value
    }, 'Si se pudo enviar, recibirás un código válido durante cinco minutos.'));
    document.getElementById('emailVerifyForm').addEventListener('submit', event => submit(event, '/api/security/email/verify', {
        code: document.getElementById('securityEmailCode').value
    }, 'Correo verificado.', loadSecurity));
    document.getElementById('mfaEnableForm').addEventListener('submit', event => submit(event, '/api/security/mfa/request', {
        currentPassword: document.getElementById('mfaCurrentPassword').value
    }, 'Si se pudo enviar, recibirás un código para activar el segundo factor.', () => {
        document.getElementById('mfaVerifyForm').hidden = false;
    }));
    document.getElementById('mfaVerifyForm').addEventListener('submit', event => submit(event, '/api/security/mfa/verify', {
        code: document.getElementById('mfaCode').value
    }, 'Verificación en dos pasos activada.', loadSecurity));
    document.getElementById('mfaDisableForm').addEventListener('submit', event => submit(event, '/api/security/mfa/disable', {
        currentPassword: document.getElementById('mfaDisablePassword').value
    }, 'Verificación en dos pasos desactivada.', loadSecurity));
    document.getElementById('passwordChangeForm').addEventListener('submit', event => submit(event, '/api/security/password', {
        currentPassword: document.getElementById('currentPassword').value,
        newPassword: document.getElementById('newPassword').value,
        confirmPassword: document.getElementById('confirmNewPassword').value
    }, 'Contraseña cambiada. Se cerró la sesión; inicia de nuevo con la contraseña nueva.', () => {
        window.setTimeout(() => { window.location.href = 'index.html'; }, 800);
    }));

    api('/api/auth/me').then(({ user }) => {
        const authenticated = Boolean(user);
        securitySection.hidden = !authenticated;
        if (accessPrompt) accessPrompt.hidden = authenticated;
        if (loginLink) loginLink.hidden = authenticated;
        if (sessionCard) sessionCard.hidden = !authenticated;
        if (sessionUsername) sessionUsername.textContent = authenticated ? user.username : '';
        if (authenticated) loadSecurity();
    }).catch(error => setNotice(error.message, 'error'));
})();
