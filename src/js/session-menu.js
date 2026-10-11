(() => {
    const STORAGE_KEY = 'mc-viewer-remembered-accounts';

    function normalizedUsername(value) {
        if (typeof value !== 'string') return '';
        const username = value.trim();
        return username.length >= 3 && username.length <= 20 ? username : '';
    }

    function getRememberedAccounts() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (!Array.isArray(parsed)) return [];
            const unique = new Map();
            for (const value of parsed) {
                const username = normalizedUsername(value);
                if (username && !unique.has(username.toLocaleLowerCase())) unique.set(username.toLocaleLowerCase(), username);
            }
            return [...unique.values()];
        } catch {
            return [];
        }
    }

    function rememberAccount(value) {
        const username = normalizedUsername(value);
        if (!username) return false;
        const accounts = getRememberedAccounts().filter(item => item.toLocaleLowerCase() !== username.toLocaleLowerCase());
        accounts.unshift(username);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
            return true;
        } catch {
            return false;
        }
    }

    function forgetAccount(value) {
        const username = normalizedUsername(value);
        if (!username) return false;
        const accounts = getRememberedAccounts().filter(item => item.toLocaleLowerCase() !== username.toLocaleLowerCase());
        try {
            if (accounts.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
            else localStorage.removeItem(STORAGE_KEY);
            return true;
        } catch {
            return false;
        }
    }

    const dialog = document.createElement('dialog');
    dialog.className = 'logout-choice-dialog';
    dialog.setAttribute('aria-labelledby', 'logoutChoiceTitle');
    const title = document.createElement('h2');
    title.id = 'logoutChoiceTitle';
    title.textContent = '¿Cómo quieres cerrar sesión?';
    const explanation = document.createElement('p');
    explanation.textContent = 'Puedes guardar esta cuenta en el menú de inicio o quitarla de este dispositivo. Solo se recuerda el nombre de usuario; la contraseña, los códigos de verificación y la sesión no se guardan. Para volver a entrar tendrás que iniciar sesión otra vez.';
    const status = document.createElement('p');
    status.className = 'logout-choice-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const actions = document.createElement('div');
    actions.className = 'logout-choice-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'logout-choice-cancel';
    cancel.textContent = 'Seguir conectado';
    cancel.addEventListener('click', () => dialog.close());
    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'logout-choice-save';
    save.dataset.logoutChoice = 'save';
    save.textContent = 'Cerrar sesión y guardar sesión';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'logout-choice-remove';
    remove.dataset.logoutChoice = 'remove';
    remove.textContent = 'Cerrar sesión y eliminar sesión';
    actions.append(save, remove, cancel);
    dialog.append(title, explanation, status, actions);
    document.body.append(dialog);

    document.addEventListener('click', event => {
        const button = event.target.closest?.('#logoutButton');
        if (!button || button.hidden || button.disabled) return;
        event.preventDefault();
        status.textContent = '';
        dialog.showModal();
    });

    actions.addEventListener('click', async event => {
        const button = event.target.closest('[data-logout-choice]');
        if (!button || button.disabled) return;
        const username = normalizedUsername(window.MCViewerSessionUsername);
        if (!username) {
            status.textContent = 'No pudimos verificar la cuenta activa. Recarga la página e inténtalo de nuevo.';
            return;
        }

        actions.querySelectorAll('button').forEach(item => { item.disabled = true; });
        status.textContent = 'Cerrando sesión…';
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
            if (!response.ok) throw new Error('El servidor no pudo cerrar la sesión. Inténtalo de nuevo.');
            const choice = button.dataset.logoutChoice;
            const remembered = choice === 'save' ? rememberAccount(username) : false;
            const forgotten = choice === 'remove' ? forgetAccount(username) : true;
            dialog.close();
            window.MCViewerTheme?.setAccountContext(null, false);
            window.MCViewerSessionUsername = null;
            document.dispatchEvent(new CustomEvent('mc-viewer-logout-complete', {
                detail: { username, remembered, forgotten, choice }
            }));
        } catch (error) {
            status.textContent = error.message || 'No se pudo cerrar la sesión. Inténtalo de nuevo.';
        } finally {
            actions.querySelectorAll('button').forEach(item => { item.disabled = false; });
        }
    });

    window.MCViewerSessionMenu = { getRememberedAccounts, forgetAccount };
})();
