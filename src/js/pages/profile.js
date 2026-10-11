(() => {
    const pageStatus = document.getElementById('pageStatus');
    const profileContent = document.getElementById('profileContent');
    const profileGate = document.getElementById('profileGate');
    const profileUsername = document.getElementById('profileUsername');
    const profileAvatar = document.getElementById('profileAvatar');
    const profileSubtitle = document.getElementById('profileSubtitle');
    const profileStructures = document.getElementById('profileStructures');
    const ownerStructures = document.getElementById('ownerStructures');
    const profileUpload = document.getElementById('profileUpload');
    const uploadStatus = document.getElementById('uploadStatus');
    const publishUpload = document.getElementById('publishUpload');
    const queryParams = new URLSearchParams(window.location.search);
    const requestedUsername = queryParams.get('user');
    let currentUser = null;
    let viewingOwnProfile = false;

    async function api(url, options = {}) {
        let response;
        try {
            response = await fetch(url, { credentials: 'same-origin', ...options });
        } catch {
            throw new Error('No hay conexión con el servidor. Inicia la página con "node server.js".');
        }
        const type = response.headers.get('content-type') || '';
        if (!type.includes('application/json')) throw new Error('El servidor no respondió con datos válidos.');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud.');
        return payload;
    }

    function setPageStatus(message, isError = false) {
        pageStatus.textContent = message;
        pageStatus.classList.toggle('error', isError);
        pageStatus.hidden = !message;
    }

    function setUploadStatus(message, kind = '') {
        uploadStatus.textContent = message;
        uploadStatus.className = 'profile-status upload-status' + (kind ? ' ' + kind : '');
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(navigator.language?.startsWith('en') ? 'en' : 'es', { dateStyle: 'medium' }).format(date);
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function makeLink(label, href, className) {
        const link = el('a', className, label);
        link.href = href;
        return link;
    }

    async function uploadStructureCover(id, file, input) {
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            setUploadStatus('Elige una imagen PNG, JPEG o WebP de hasta 5 MB.', 'error');
            input.value = '';
            return;
        }
        setUploadStatus('Actualizando imagen…');
        try {
            await api('/api/structures/' + encodeURIComponent(id) + '/cover', {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file
            });
            setUploadStatus('Imagen de la estructura actualizada.', 'success');
            await loadOwnerStructures();
            await loadProfile(currentUser.username);
        } catch (error) {
            setUploadStatus(error.message, 'error');
        } finally {
            input.value = '';
        }
    }

    function createOwnerMenu(structure) {
        const menu = el('details', 'structure-menu');
        const toggle = el('summary', 'structure-menu-toggle');
        toggle.setAttribute('aria-label', 'Opciones de ' + structure.name);
        toggle.title = 'Opciones de la estructura';
        toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';

        const panel = el('div', 'structure-menu-panel');
        const downloadLink = makeLink('Descargar', '/api/structures/' + encodeURIComponent(structure.id) + '/download', 'structure-menu-item');
        downloadLink.setAttribute('download', '');
        const visibilityButton = el('button', 'structure-menu-item', structure.isPublic ? 'Hacer privada' : 'Hacer pública');
        visibilityButton.type = 'button';
        visibilityButton.addEventListener('click', () => changeVisibility(structure.id, !structure.isPublic));

        const coverInput = el('input', 'structure-cover-input');
        coverInput.type = 'file';
        coverInput.accept = 'image/png,image/jpeg,image/webp';
        coverInput.setAttribute('aria-label', 'Seleccionar imagen para ' + structure.name);
        coverInput.addEventListener('change', () => uploadStructureCover(structure.id, coverInput.files?.[0], coverInput));
        const coverButton = el('button', 'structure-menu-item', 'Cambiar imagen representativa');
        coverButton.type = 'button';
        coverButton.addEventListener('click', () => coverInput.click());

        const deleteButton = el('button', 'structure-menu-item delete-structure', 'Eliminar');
        deleteButton.type = 'button';
        deleteButton.addEventListener('click', () => deleteStructure(structure.id, structure.name));
        panel.append(downloadLink, visibilityButton, coverButton, deleteButton, coverInput);
        menu.append(toggle, panel);
        return menu;
    }

    function addCoverImage(art, structure) {
        if (!structure.coverUrl) return;
        const image = el('img', 'card-art-image');
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('load', () => art.classList.add('has-cover'), { once: true });
        image.addEventListener('error', () => image.remove(), { once: true });
        image.src = structure.coverUrl;
        art.prepend(image);
    }

    function createCard(structure, { owner = false, username = '' } = {}) {
        const card = el('article', 'community-card' + (owner ? ' owner-card' : ''));
        const art = el('div', 'card-art');
        art.setAttribute('aria-hidden', 'true');
        addCoverImage(art, structure);
        art.append(el('span', 'file-type', structure.name.toLowerCase().endsWith('.litematic') ? 'LITEMATIC' : 'SCHEM'));

        const body = el('div', 'community-card-body');
        body.append(el('h3', '', structure.name));
        const meta = el('div', 'community-meta');
        if (username) {
            meta.append(makeLink('@' + username, 'profile.html?user=' + encodeURIComponent(username), 'community-author'));
        }
        meta.append(el('span', '', formatBytes(structure.size)));
        if (structure.uploadedAt) meta.append(el('span', '', formatDate(structure.uploadedAt)));
        body.append(meta);

        if (owner) {
            body.append(el('div', 'visibility-chip' + (structure.isPublic ? ' is-public' : ''), structure.isPublic ? 'VISIBLE EN EL BUSCADOR PÚBLICO' : 'SOLO TÚ PUEDES VERLA'));
        }

        const actions = el('div', 'community-actions');
        actions.append(makeLink('Abrir en el visor', 'viewer.html?structure=' + encodeURIComponent(structure.id), ''));
        if (owner) {
            actions.append(createOwnerMenu(structure));
        } else {
            actions.append(makeLink('Descargar', '/api/structures/' + encodeURIComponent(structure.id) + '/download', ''));
        }
        body.append(actions);
        card.append(art, body);
        return card;
    }

    function renderPublicWorks(structures, username) {
        profileStructures.replaceChildren(...structures.map(structure => createCard(structure, { username })));
        document.getElementById('publicCount').textContent = String(structures.length);
        document.getElementById('profileEmpty').hidden = structures.length > 0;
    }

    function renderOwnerStructures(structures) {
        ownerStructures.replaceChildren(...structures.map(structure => createCard(structure, { owner: true })));
        document.getElementById('privateCount').textContent = String(structures.length);
        document.getElementById('ownerEmpty').hidden = structures.length > 0;
    }


    async function loadProfile(username) {
        const result = await api('/api/profiles/' + encodeURIComponent(username));
        const profile = result.profile;
        viewingOwnProfile = Boolean(currentUser && currentUser.username.toLowerCase() === profile.username.toLowerCase());
        const accountRole = viewingOwnProfile ? currentUser.role : (profile.creatorEnabled ? 'creator' : 'user');
        profileUsername.textContent = profile.username;
        profileAvatar.textContent = Array.from(profile.username)[0]?.toUpperCase() || 'M';
        profileSubtitle.textContent = viewingOwnProfile
            ? 'Este es tu espacio. Tú decides qué construcciones compartir.'
            : 'Construcciones que ' + profile.username + ' decidió compartir con la comunidad.';
        const isAdmin = viewingOwnProfile && accountRole === 'admin';
        const isSubadmin = viewingOwnProfile && accountRole === 'subadmin';
        const creatorEnabled = viewingOwnProfile ? Boolean(currentUser.creatorEnabled) : Boolean(profile.creatorEnabled);
        document.body.dataset.accountRole = isAdmin ? 'admin' : (isSubadmin ? 'subadmin' : (creatorEnabled ? 'creator' : 'user'));
        window.MCViewerTheme?.setAccountContext(currentUser, isAdmin);
        const modeBadge = document.getElementById('profileModeBadge');
        modeBadge.textContent = isAdmin ? 'ADMINISTRADOR' : (isSubadmin ? 'SUBADMIN' : (creatorEnabled ? 'CREADOR' : 'USUARIO'));
        document.getElementById('creatorModeCard').hidden = !viewingOwnProfile || isAdmin;
        document.getElementById('adminProfileNote').hidden = !isAdmin;
        document.getElementById('creatorModeButton').textContent = creatorEnabled ? 'Desactivar modo creador' : 'Activar modo creador';
        document.getElementById('creatorModeDescription').textContent = creatorEnabled
            ? 'Tu perfil está identificado como creador. Mi taller conserva las herramientas existentes para subir, organizar y compartir estructuras.'
            : 'Actívalo desde tu perfil para identificar tu cuenta como creador. Mi taller reúne las herramientas existentes para subir, organizar y compartir estructuras.';
        document.title = profile.username + ' — MC Viewer';
        renderPublicWorks(profile.structures, profile.username);
        profileContent.hidden = false;
        profileGate.hidden = true;
        document.getElementById('myWorkshop').hidden = !viewingOwnProfile;
        const myProfileLink = document.getElementById('myProfileLink');
        myProfileLink.hidden = !currentUser;
        myProfileLink.href = viewingOwnProfile ? '#myWorkshop' : 'profile.html';
        document.getElementById('logoutButton').hidden = !currentUser;

        if (viewingOwnProfile) await loadOwnerStructures();
    }

    async function loadOwnerStructures() {
        const result = await api('/api/structures');
        renderOwnerStructures(result.structures);
    }

    async function changeVisibility(id, isPublic) {
        try {
            await api('/api/structures/' + encodeURIComponent(id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic })
            });
            setUploadStatus(isPublic ? 'La estructura ya aparece en el buscador público.' : 'La estructura ahora es privada.', 'success');
            await loadOwnerStructures();
            await loadProfile(currentUser.username);
        } catch (error) {
            setUploadStatus(error.message, 'error');
        }
    }

    async function deleteStructure(id, name) {
        if (!window.confirm('¿Eliminar "' + name + '" de tu perfil y biblioteca?')) return;
        try {
            await api('/api/structures/' + encodeURIComponent(id), { method: 'DELETE' });
            setUploadStatus('Construcción eliminada.', 'success');
            await loadOwnerStructures();
            await loadProfile(currentUser.username);
        } catch (error) {
            setUploadStatus(error.message, 'error');
        }
    }

    async function uploadStructure(file) {
        if (!file) return;
        const extension = file.name.split('.').pop().toLowerCase();
        if (!['schem', 'litematic'].includes(extension)) return setUploadStatus('Elige un archivo .schem o .litematic.', 'error');
        if (!file.size || file.size > 64 * 1024 * 1024) return setUploadStatus('El archivo debe pesar entre 1 byte y 64 MB.', 'error');

        profileUpload.disabled = true;
        setUploadStatus('Subiendo ' + file.name + '…');
        try {
            await api('/api/structures', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-File-Name': encodeURIComponent(file.name),
                    'X-Structure-Public': String(Boolean(publishUpload.checked))
                },
                body: file
            });
            setUploadStatus(publishUpload.checked ? 'Subida y publicada en tu perfil.' : 'Subida a tu biblioteca privada.', 'success');
            await loadOwnerStructures();
            await loadProfile(currentUser.username);
        } catch (error) {
            setUploadStatus(error.message, 'error');
        } finally {
            profileUpload.disabled = false;
            profileUpload.value = '';
        }
    }

    document.getElementById('shareProfile').addEventListener('click', async event => {
        const url = new URL('profile.html?user=' + encodeURIComponent(profileUsername.textContent), window.location.href).href;
        try {
            await navigator.clipboard.writeText(url);
            event.currentTarget.innerHTML = 'Enlace copiado <span aria-hidden="true">✓</span>';
        } catch {
            window.prompt('Copia el enlace de tu perfil:', url);
        }
    });

    document.addEventListener('mc-viewer-logout-complete', () => {
        window.MCViewerTheme?.setAccountContext(null, false);
        window.location.href = 'index.html';
    });

    document.getElementById('creatorModeButton').addEventListener('click', async () => {
        const enabled = !Boolean(currentUser?.creatorEnabled);
        const status = document.getElementById('creatorModeStatus');
        const button = document.getElementById('creatorModeButton');
        button.disabled = true;
        status.textContent = 'Guardando…';
        try {
            const result = await api('/api/account/creator-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            currentUser.creatorEnabled = result.creatorEnabled;
            status.textContent = enabled ? 'Modo creador activado.' : 'Modo creador desactivado.';
            await loadProfile(currentUser.username);
        } catch (error) {
            status.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });

    profileUpload.addEventListener('change', () => uploadStructure(profileUpload.files?.[0]));

    (async () => {
        try {
            const session = await api('/api/auth/me');
            currentUser = session.user;
            window.MCViewerSessionUsername = currentUser?.username || null;
            if (!currentUser) window.MCViewerTheme?.setAccountContext(null, false);
            const username = requestedUsername || currentUser?.username;
            if (!username) {
                document.getElementById('gateTitle').textContent = 'Inicia sesión para abrir tu perfil.';
                document.getElementById('gateMessage').textContent = 'Tu espacio reúne tus estructuras y las que decidas compartir con la comunidad.';
                profileGate.hidden = false;
                setPageStatus('');
                return;
            }
            await loadProfile(username);
            setPageStatus('');
        } catch (error) {
            document.getElementById('gateTitle').textContent = requestedUsername ? 'No encontramos este perfil.' : 'No se pudo cargar tu perfil.';
            document.getElementById('gateMessage').textContent = requestedUsername ? 'Revisa el nombre del enlace o vuelve a explorar construcciones.' : error.message;
            profileGate.hidden = false;
            setPageStatus('');
        }
    })();
})();
