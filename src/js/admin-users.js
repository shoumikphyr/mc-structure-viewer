(() => {
    const section = document.querySelector('[data-owner-admin]');
    if (!section) return;

    const userList = section.querySelector('[data-owner-user-list]');
    const pinnedOwner = section.querySelector('[data-owner-user-pinned]');
    const userSearch = section.querySelector('[data-owner-user-search]');
    const userRole = section.querySelector('[data-owner-user-role]');
    const saveUserRole = section.querySelector('[data-owner-user-save]');
    const status = section.querySelector('[data-owner-admin-status]');
    const transferForm = section.querySelector('[data-owner-transfer-form]');
    const targetSelect = section.querySelector('[data-owner-transfer-target]');
    const passwordInput = section.querySelector('[data-owner-transfer-password]');
    const codeInput = section.querySelector('[data-owner-transfer-code]');
    const phraseInput = section.querySelector('[data-owner-transfer-phrase]');
    const phraseHint = section.querySelector('[data-owner-transfer-hint]');
    const confirmFields = section.querySelector('[data-owner-transfer-confirm]');
    const requestCodeButton = section.querySelector('[data-owner-transfer-request]');
    let accounts = [];
    let selectedAccount = null;

    async function api(url, options = {}) {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
        const type = response.headers.get('content-type') || '';
        if (!type.includes('application/json')) throw new Error('El servidor no respondió con datos válidos.');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud.');
        return payload;
    }

    function showStatus(message, kind = '') {
        status.textContent = message;
        status.className = 'owner-admin-status' + (kind ? ' is-' + kind : '');
    }

    function renderUserRows() {
        userList.replaceChildren();
        pinnedOwner?.replaceChildren();
        const query = String(userSearch?.value || '').trim().toLocaleLowerCase();
        if (!selectedAccount || selectedAccount.username.toLocaleLowerCase() !== query) {
            selectedAccount = null;
            if (saveUserRole) saveUserRole.disabled = true;
        }
        const owner = accounts.find(account => account.isOwner);
        if (owner && pinnedOwner) {
            const ownerRow = document.createElement('div');
            ownerRow.className = 'owner-user-row owner-user-row-protected';
            const ownerName = document.createElement('span');
            ownerName.className = 'owner-user-name';
            ownerName.textContent = owner.username;
            const protectedLabel = document.createElement('span');
            protectedLabel.className = 'owner-user-role';
            protectedLabel.textContent = 'Propietario · protegido';
            ownerRow.append(ownerName, protectedLabel);
            pinnedOwner.append(ownerRow);
        }
        const matches = query
            ? accounts.filter(account => !account.isOwner && account.username.toLocaleLowerCase().includes(query))
            : [];
        if (!matches.length) {
            const empty = document.createElement('p');
            empty.className = 'owner-user-empty';
            empty.textContent = query
                ? 'No hay cuentas que coincidan.'
                : 'Busca una cuenta para cambiar su rol.';
            userList.append(empty);
            return;
        }

        for (const account of matches) {
            const result = document.createElement('button');
            result.type = 'button';
            result.className = 'owner-user-match';
            result.textContent = account.username;
            result.setAttribute('aria-label', 'Seleccionar cuenta ' + account.username);
            result.addEventListener('click', () => {
                selectedAccount = account;
                userSearch.value = account.username;
                userRole.value = account.role === 'subadmin' ? 'subadmin' : 'user';
                saveUserRole.disabled = false;
                userList.replaceChildren();
                userSearch.focus();
            });
            userList.append(result);
        }
    }

    saveUserRole?.addEventListener('click', async () => {
        if (!selectedAccount) return;
        saveUserRole.disabled = true;
        try {
            await api('/api/admin/users/' + encodeURIComponent(selectedAccount.id) + '/role', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: userRole.value })
            });
            showStatus('Rol actualizado para ' + selectedAccount.username + '.', 'success');
            selectedAccount = null;
            userSearch.value = '';
            userRole.value = 'user';
            await loadAccounts();
        } catch (error) {
            showStatus(error.message, 'error');
        } finally {
            saveUserRole.disabled = !selectedAccount;
        }
    });

    function renderAccounts() {
        targetSelect.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecciona una cuenta';
        placeholder.disabled = true;
        placeholder.selected = true;
        targetSelect.append(placeholder);

        for (const account of accounts) {
            if (!account.isOwner) {
                const target = document.createElement('option');
                target.value = account.id;
                target.textContent = account.username + ' (' + (account.role === 'subadmin' ? 'subadmin' : 'user') + ')';
                targetSelect.append(target);
            }
        }
        renderUserRows();
    }

    userSearch?.addEventListener('input', () => {
        selectedAccount = null;
        if (saveUserRole) saveUserRole.disabled = true;
        renderUserRows();
    });

    async function loadAccounts() {
        try {
            const result = await api('/api/admin/users');
            if (!result.canManageRoles) return;
            accounts = result.users;
            section.hidden = false;
            renderAccounts();
        } catch {
            // La sección sigue oculta para sesiones sin autorización de propietario.
            section.hidden = true;
        }
    }

    targetSelect.addEventListener('change', () => {
        confirmFields.hidden = true;
        codeInput.value = '';
        phraseInput.value = '';
        const target = accounts.find(account => account.id === targetSelect.value);
        phraseHint.textContent = target ? 'Escribe exactamente: TRANSFERIR ' + target.username : 'Escribe TRANSFERIR seguido del usuario seleccionado.';
    });

    requestCodeButton.addEventListener('click', async () => {
        if (!targetSelect.value || !passwordInput.value) {
            showStatus('Selecciona una cuenta e introduce tu contraseña actual.', 'error');
            return;
        }
        requestCodeButton.disabled = true;
        try {
            await api('/api/admin/owner-transfer/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: targetSelect.value, currentPassword: passwordInput.value })
            });
            confirmFields.hidden = false;
            showStatus('Si el correo está configurado, recibirás el código para confirmar la transferencia.', 'success');
            codeInput.focus();
        } catch (error) {
            showStatus(error.message, 'error');
        } finally {
            requestCodeButton.disabled = false;
        }
    });

    transferForm.addEventListener('submit', async event => {
        event.preventDefault();
        const target = accounts.find(account => account.id === targetSelect.value);
        if (!target) return showStatus('Selecciona una cuenta válida.', 'error');
        const submit = transferForm.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            await api('/api/admin/owner-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: target.id,
                    currentPassword: passwordInput.value,
                    code: codeInput.value,
                    confirmation: phraseInput.value
                })
            });
            showStatus('Propiedad transferida. Se actualizará la sesión administrativa.', 'success');
            window.setTimeout(() => window.location.reload(), 1200);
        } catch (error) {
            showStatus(error.message, 'error');
        } finally {
            submit.disabled = false;
        }
    });

    loadAccounts();
})();
