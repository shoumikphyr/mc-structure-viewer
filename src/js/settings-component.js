(() => {
    const triggerSelector = '[data-settings-open]';
    const loaderUrl = document.currentScript?.src || new URL('src/js/settings-component.js', window.location.href).href;

    function addFallbackTrigger() {
        if (document.querySelector(triggerSelector)) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'main-settings-nav-button settings-floating-trigger';
        button.dataset.settingsOpen = '';
        button.setAttribute('aria-label', 'Abrir configuración');
        button.setAttribute('title', 'Configuración');
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'settingsPanel');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 2.9-.1-.1a1.7 1.7 0 0 0-1.8.7l-.1.1h-3.4l-.1-.1a1.7 1.7 0 0 0-2.4-.8l-.1.1-2.9-1.7.1-.1a1.7 1.7 0 0 0-.7-1.8l-.1-.1v-3.4l.1-.1a1.7 1.7 0 0 0 .8-2.4l-.1-.1 1.7-2.9.1.1a1.7 1.7 0 0 0 1.8-.7l.1-.1h3.4l.1.1a1.7 1.7 0 0 0 2.4.8l.1-.1 2.9 1.7-.1.1a1.7 1.7 0 0 0 .7 1.8l.1.1v3.4l-.1.1Z"/></svg>';
        document.body.append(button);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar ' + src));
            document.body.append(script);
        });
    }

    addFallbackTrigger();
    window.MCViewerSettingsReady = (async () => {
        const response = await fetch(new URL('../components/settings-panel.html', loaderUrl), { credentials: 'same-origin' });
        if (!response.ok) throw new Error('No se pudo cargar la configuración compartida.');
        const markup = await response.text();
        document.body.insertAdjacentHTML('beforeend', markup);

        const viewerPage = /(?:^|\/)viewer\.html$/i.test(window.location.pathname);
        document.querySelectorAll('[data-settings-viewer-only]').forEach(element => {
            element.hidden = !viewerPage;
        });

        await Promise.all([
            loadScript(new URL('account-security.js', loaderUrl).href),
            loadScript(new URL('admin-users.js', loaderUrl).href)
        ]);
        document.dispatchEvent(new CustomEvent('mc-viewer-settings-ready'));
    })().catch(error => {
        console.error(error);
        document.dispatchEvent(new CustomEvent('mc-viewer-settings-error', { detail: { message: error.message } }));
    });
})();
