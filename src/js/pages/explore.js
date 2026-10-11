(() => {
    const pageStatus = document.getElementById('pageStatus');
    const structureSearch = document.getElementById('structureSearch');
    const searchResults = document.getElementById('searchResults');
    const searchEmpty = document.getElementById('searchEmpty');
    let searchTimer = 0;

    async function api(url) {
        let response;
        try {
            response = await fetch(url, { credentials: 'same-origin' });
        } catch {
            throw new Error('No hay conexión con el servidor. Inicia la página con "node server.js".');
        }
        const type = response.headers.get('content-type') || '';
        if (!type.includes('application/json')) throw new Error('El servidor no respondió con datos válidos.');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las construcciones.');
        return payload;
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

    function createCard(structure) {
        const card = el('article', 'community-card');
        const art = el('div', 'card-art');
        art.setAttribute('aria-hidden', 'true');
        if (structure.coverUrl) {
            const image = el('img', 'card-art-image');
            image.alt = '';
            image.loading = 'lazy';
            image.addEventListener('load', () => art.classList.add('has-cover'), { once: true });
            image.addEventListener('error', () => image.remove(), { once: true });
            image.src = structure.coverUrl;
            art.append(image);
        }
        art.append(el('span', 'file-type', structure.name.toLowerCase().endsWith('.litematic') ? 'LITEMATIC' : 'SCHEM'));
        const body = el('div', 'community-card-body');
        body.append(el('h3', '', structure.name));
        const meta = el('div', 'community-meta');
        if (structure.username) meta.append(makeLink('@' + structure.username, 'profile.html?user=' + encodeURIComponent(structure.username), 'community-author'));
        meta.append(el('span', '', formatBytes(structure.size)));
        if (structure.uploadedAt) meta.append(el('span', '', formatDate(structure.uploadedAt)));
        body.append(meta);
        const actions = el('div', 'community-actions');
        actions.append(makeLink('Abrir en el visor', 'viewer.html?structure=' + encodeURIComponent(structure.id), ''));
        actions.append(makeLink('Descargar', '/api/structures/' + encodeURIComponent(structure.id) + '/download', ''));
        body.append(actions);
        card.append(art, body);
        return card;
    }

    function renderSearchResults(structures) {
        searchResults.replaceChildren(...structures.map(createCard));
        searchEmpty.hidden = structures.length > 0;
        searchEmpty.textContent = 'No encontramos construcciones con esa búsqueda.';
    }

    async function loadSearch(query = '') {
        pageStatus.classList.remove('error');
        pageStatus.textContent = query ? 'Buscando construcciones…' : 'Cargando construcciones…';
        pageStatus.hidden = false;
        try {
            const result = await api('/api/public/structures?q=' + encodeURIComponent(query));
            renderSearchResults(result.structures);
            pageStatus.textContent = result.structures.length + (result.structures.length === 1 ? ' construcción pública' : ' construcciones públicas');
        } catch (error) {
            searchResults.replaceChildren();
            searchEmpty.hidden = false;
            searchEmpty.textContent = error.message;
            pageStatus.textContent = 'No se pudo completar la búsqueda.';
            pageStatus.classList.add('error');
        }
    }

    structureSearch.addEventListener('input', () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => loadSearch(structureSearch.value.trim()), 180);
    });

    document.addEventListener('keydown', event => {
        let shortcutsEnabled = true;
        try { shortcutsEnabled = localStorage.getItem('mc_viewer_keyboard_shortcuts') !== 'false'; } catch (_) {}
        const target = event.target;
        const editingText = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);
        if (shortcutsEnabled && event.key === '/' && !editingText) {
            event.preventDefault();
            structureSearch.focus();
        }
    });

    // El catálogo es público; la sesión se consulta solo para aplicar la preferencia temática de la cuenta.
    fetch('/api/auth/me', { credentials: 'same-origin' })
        .then(response => response.ok ? response.json() : null)
        .then(session => { if (session) window.MCViewerTheme?.setAccountContext(session.user, false); })
        .catch(() => {});

    loadSearch();
})();
