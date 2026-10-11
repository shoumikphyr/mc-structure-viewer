(() => {
    const storageKey = 'mc_viewer_appearance';
    const adminStorageKey = 'mc_viewer_admin_appearance';
    const reduceMotionKey = 'mc_viewer_reduce_motion';
    const uiScaleKey = 'mc_viewer_ui_scale';
    const defaultPageKey = 'mc_viewer_default_page';
    const rememberWorkKey = 'mc_viewer_remember_work';
    const keyboardShortcutsKey = 'mc_viewer_keyboard_shortcuts';
    const viewerPreferenceKeys = ['mc_viewer_settings_show_fps', 'mc_viewer_settings_solo_left',
        'mc_viewer_settings_solo_right', 'mc_viewer_settings_grid'];
    const root = document.documentElement;
    const validThemes = new Set(['light', 'dark']);
    const allThemes = new Set(['light', 'dark', 'admin']);
    const systemPrefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    let adminAuthorized = false;
    let authorizationRequest = 0;
    let settingsInitialized = false;
    let settingsPanel = null;
    let lastSettingsTrigger = null;

    function getSavedTheme() {
        try {
            const saved = window.localStorage.getItem(storageKey);
            return validThemes.has(saved) ? saved : 'light';
        } catch (_) { return 'light'; }
    }

    function getSavedAdminTheme() {
        try {
            const saved = window.localStorage.getItem(adminStorageKey);
            return allThemes.has(saved) ? saved : getSavedTheme();
        } catch (_) { return getSavedTheme(); }
    }

    function normalizeTheme(theme) {
        if (validThemes.has(theme)) return theme;
        return theme === 'admin' && adminAuthorized ? 'admin' : getSavedTheme();
    }

    function syncAdminThemeOption() {
        document.querySelectorAll('[data-admin-theme-choice]').forEach(choice => { choice.hidden = !adminAuthorized; });
        syncThemeControls();
    }

    function syncThemeControls() {
        document.querySelectorAll('[data-theme-select]').forEach(control => {
            const selected = control.value === root.dataset.theme;
            control.checked = selected;
            control.closest('.appearance-theme-card')?.classList.toggle('is-selected', selected);
        });
    }

    function applyTheme(theme, persist = false) {
        const selectedTheme = normalizeTheme(theme);
        root.dataset.theme = selectedTheme;
        if (document.body) document.body.dataset.theme = selectedTheme;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = selectedTheme === 'admin' ? '#100e14' : selectedTheme === 'dark' ? '#090a09' : '#f1f4f1';
        if (persist) {
            try {
                if (selectedTheme === 'admin') window.localStorage.setItem(adminStorageKey, 'admin');
                else {
                    window.localStorage.setItem(storageKey, selectedTheme);
                    if (adminAuthorized) window.localStorage.setItem(adminStorageKey, selectedTheme);
                }
            } catch (_) { /* La selección permanece activa en esta pestaña. */ }
        }
        syncThemeControls();
        window.dispatchEvent(new CustomEvent('mc-viewer-theme-change', { detail: { theme: selectedTheme } }));
        return selectedTheme;
    }

    function closeSettings(restoreFocus = true) {
        if (!settingsPanel || settingsPanel.hidden) return;
        settingsPanel.hidden = true;
        document.querySelectorAll('[data-settings-open]').forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
        if (restoreFocus) (lastSettingsTrigger?.isConnected ? lastSettingsTrigger : document.querySelector('[data-settings-open]'))?.focus();
    }

    function initializeSettingsPanel() {
        if (settingsInitialized) return;
        settingsPanel = document.getElementById('settingsPanel');
        if (!settingsPanel) return;
        settingsInitialized = true;

        document.addEventListener('click', event => {
            const trigger = event.target.closest('[data-settings-open]');
            if (!trigger) return;
            event.preventDefault();
            lastSettingsTrigger = trigger;
            settingsPanel.hidden = !settingsPanel.hidden;
            document.querySelectorAll('[data-settings-open]').forEach(button => button.setAttribute('aria-expanded', String(!settingsPanel.hidden)));
            if (!settingsPanel.hidden) document.getElementById('settingsCloseBtn')?.focus();
        });
        document.getElementById('settingsCloseBtn')?.addEventListener('click', () => closeSettings());
        settingsPanel.addEventListener('click', event => { if (event.target === settingsPanel) closeSettings(); });

        settingsPanel.querySelectorAll('[data-theme-select]').forEach(control => {
            control.checked = control.value === root.dataset.theme;
            control.addEventListener('change', () => {
                if (control.checked) applyTheme(control.value, true);
            });
        });

        const reduceMotionToggle = settingsPanel.querySelector('[data-reduce-motion]');
        const uiScaleSelect = settingsPanel.querySelector('[data-ui-scale]');
        const defaultPageSelect = settingsPanel.querySelector('[data-default-page]');
        const rememberWorkToggle = settingsPanel.querySelector('[data-remember-work]');
        const keyboardShortcutsToggle = settingsPanel.querySelector('[data-keyboard-shortcuts]');
        const resetStatus = settingsPanel.querySelector('[data-preferences-reset-status]');
        if (defaultPageSelect) {
            let savedPage = 'home';
            try { savedPage = window.localStorage.getItem(defaultPageKey) === 'viewer' ? 'viewer' : 'home'; } catch (_) {}
            defaultPageSelect.value = savedPage;
            defaultPageSelect.addEventListener('change', () => {
                const page = defaultPageSelect.value === 'viewer' ? 'viewer' : 'home';
                try { window.localStorage.setItem(defaultPageKey, page); } catch (_) {}
            });
        }
        if (rememberWorkToggle) {
            let remember = true;
            try { remember = window.localStorage.getItem(rememberWorkKey) !== 'false'; } catch (_) {}
            rememberWorkToggle.checked = remember;
            rememberWorkToggle.addEventListener('change', () => {
                const enabled = rememberWorkToggle.checked;
                try {
                    window.localStorage.setItem(rememberWorkKey, String(enabled));
                    if (!enabled) viewerPreferenceKeys.forEach(key => window.localStorage.removeItem(key));
                } catch (_) {}
                window.dispatchEvent(new CustomEvent('mc-viewer-remember-work-change', { detail: { enabled } }));
            });
        }
        if (keyboardShortcutsToggle) {
            let enabled = true;
            try { enabled = window.localStorage.getItem(keyboardShortcutsKey) !== 'false'; } catch (_) {}
            keyboardShortcutsToggle.checked = enabled;
            keyboardShortcutsToggle.addEventListener('change', () => {
                try { window.localStorage.setItem(keyboardShortcutsKey, String(keyboardShortcutsToggle.checked)); } catch (_) {}
            });
        }
        if (reduceMotionToggle) {
            reduceMotionToggle.checked = root.dataset.reduceMotion === 'true';
            reduceMotionToggle.addEventListener('change', () => {
                root.dataset.reduceMotion = String(reduceMotionToggle.checked);
                try { window.localStorage.setItem(reduceMotionKey, String(reduceMotionToggle.checked)); } catch (_) {}
            });
        }
        if (uiScaleSelect) {
            uiScaleSelect.value = root.dataset.uiScale === 'large' ? 'large' : 'normal';
            uiScaleSelect.addEventListener('change', () => {
                const scale = uiScaleSelect.value === 'large' ? 'large' : 'normal';
                root.dataset.uiScale = scale;
                try { window.localStorage.setItem(uiScaleKey, scale); } catch (_) {}
            });
        }

        const preferenceKeys = [storageKey, adminStorageKey, reduceMotionKey, uiScaleKey, defaultPageKey, rememberWorkKey, keyboardShortcutsKey, ...viewerPreferenceKeys];
        settingsPanel.querySelector('[data-preferences-reset]')?.addEventListener('click', () => {
            if (!window.confirm('¿Restablecer las preferencias locales de MC Viewer? Se restablecerán tema, página inicial, accesibilidad y opciones del visor. No se eliminarán cuentas, sesiones, estructuras ni archivos.')) return;
            try { preferenceKeys.forEach(key => window.localStorage.removeItem(key)); } catch (_) {}
            root.dataset.reduceMotion = String(systemPrefersReducedMotion());
            root.dataset.uiScale = 'normal';
            if (reduceMotionToggle) reduceMotionToggle.checked = systemPrefersReducedMotion();
            if (uiScaleSelect) uiScaleSelect.value = 'normal';
            if (defaultPageSelect) defaultPageSelect.value = 'home';
            if (rememberWorkToggle) rememberWorkToggle.checked = true;
            if (keyboardShortcutsToggle) keyboardShortcutsToggle.checked = true;
            applyTheme('light', true);
            window.dispatchEvent(new CustomEvent('mc-viewer-preferences-reset'));
            if (resetStatus) resetStatus.textContent = 'Preferencias restablecidas. No se modificaron tus archivos ni los datos de tu cuenta.';
        });

        const tabs = [...settingsPanel.querySelectorAll('[data-settings-tab]')].filter(tab => !tab.hidden);
        const panels = [...settingsPanel.querySelectorAll('[data-settings-panel]')];
        function activateTab(name, focus = false) {
            tabs.forEach((tab, index) => {
                const active = tab.dataset.settingsTab === name;
                tab.setAttribute('aria-selected', String(active));
                tab.tabIndex = active ? 0 : -1;
                if (active && focus) tab.focus();
            });
            panels.forEach(panel => { panel.hidden = panel.dataset.settingsPanel !== name; });
        }
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => activateTab(tab.dataset.settingsTab));
            tab.addEventListener('keydown', event => {
                if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                    : (index + (event.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length;
                activateTab(tabs[next].dataset.settingsTab, true);
            });
        });
        if (tabs.length) activateTab(tabs[0].dataset.settingsTab);

        document.addEventListener('keydown', event => {
            if (settingsPanel.hidden) return;
            if (event.key === 'Escape') { closeSettings(); return; }
            if (event.key !== 'Tab') return;
            const focusable = [...settingsPanel.querySelectorAll('button:not(:disabled), a[href], select:not(:disabled), input:not(:disabled)')]
                .filter(element => !element.closest('[hidden]') && element.tabIndex >= 0);
            if (!focusable.length) return;
            if (event.shiftKey && document.activeElement === focusable[0]) {
                event.preventDefault(); focusable.at(-1).focus();
            } else if (!event.shiftKey && document.activeElement === focusable.at(-1)) {
                event.preventDefault(); focusable[0].focus();
            }
        });

        const shortcut = document.getElementById('settingsVisionShortcut');
        shortcut?.addEventListener('click', () => {
            closeSettings(false);
            const appContainer = document.querySelector('.app-container');
            if (appContainer?.classList.contains('sidebar-hidden')) document.getElementById('toggleSidebarBtn')?.click();
            const visionSection = document.getElementById('visionSection');
            if (visionSection?.closest('.accordion-section')?.classList.contains('collapsed') && typeof window.toggleAccordion === 'function') window.toggleAccordion('visionSection');
            document.getElementById('toggleGrid')?.focus();
        });

        const summary = document.getElementById('settingsDataSummary');
        const textureSummary = document.getElementById('settingsTextureSummary');
        const fields = ['fileName', 'fileDimensions', 'fileBlocks'].map(id => document.getElementById(id)).filter(Boolean);
        const updateSummary = () => {
            if (!summary) return;
            const [name, dimensions, count] = fields.map(element => element.textContent.trim());
            summary.textContent = !name || name === 'Ninguno' ? 'No hay una estructura cargada. Usa “Cargar Estructura” en el panel del visor.' : `${name} · Dimensiones: ${dimensions || '—'} · Bloques: ${count || '—'}`;
        };
        updateSummary();
        fields.forEach(field => new MutationObserver(updateSummary).observe(field, { childList: true, characterData: true, subtree: true }));
        const resourceStatus = document.getElementById('resourcePackStatus');
        if (resourceStatus && textureSummary) {
            const updateTextureSummary = () => { textureSummary.textContent = resourceStatus.textContent.trim(); };
            updateTextureSummary();
            new MutationObserver(updateTextureSummary).observe(resourceStatus, { childList: true, characterData: true, subtree: true });
        }

        const hashTabs = { '#settings-account': 'settingsTabAccount', '#settings-viewer': 'settingsTabViewer', '#settings-data': 'settingsTabData', '#settings-accessibility': 'settingsTabAccessibility', '#settings-help': 'settingsTabHelp' };
        const openFromHash = () => {
            const hash = window.location.hash;
            if (hash !== '#settings' && !hashTabs[hash]) return;
            if (settingsPanel.hidden) {
                settingsPanel.hidden = false;
                document.querySelectorAll('[data-settings-open]').forEach(button => button.setAttribute('aria-expanded', 'true'));
            }
            if (hashTabs[hash]) document.getElementById(hashTabs[hash])?.click();
            document.getElementById('settingsCloseBtn')?.focus();
        };
        openFromHash();
        window.addEventListener('hashchange', openFromHash);
        syncAdminThemeOption();
        window.dispatchEvent(new CustomEvent('mc-viewer-settings-mounted'));
    }

    applyTheme(getSavedTheme());
    window.MCViewerTheme = {
        getTheme: () => normalizeTheme(root.dataset.theme),
        setTheme: theme => applyTheme(theme, true),
        setAccountContext: () => refreshAccountAuthorization()
    };

    async function refreshAccountAuthorization() {
        const requestId = ++authorizationRequest;
        try {
            const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
            if (!response.ok) throw new Error('Session validation failed.');
            const session = await response.json();
            if (requestId !== authorizationRequest) return false;
            adminAuthorized = session?.user?.role === 'admin';
        } catch (_) {
            if (requestId !== authorizationRequest) return false;
            adminAuthorized = false;
        }
        syncAdminThemeOption();
        applyTheme(adminAuthorized ? getSavedAdminTheme() : getSavedTheme());
        return adminAuthorized;
    }

    window.addEventListener('storage', event => {
        if (event.key === adminStorageKey && adminAuthorized) applyTheme(event.newValue);
        else if (event.key === storageKey && !adminAuthorized) applyTheme(event.newValue);
        else if (event.key === reduceMotionKey) {
            root.dataset.reduceMotion = String(event.newValue === null ? systemPrefersReducedMotion() : event.newValue === 'true');
            const toggle = document.querySelector('[data-reduce-motion]');
            if (toggle) toggle.checked = root.dataset.reduceMotion === 'true';
        } else if (event.key === uiScaleKey) {
            root.dataset.uiScale = event.newValue === 'large' ? 'large' : 'normal';
            const select = document.querySelector('[data-ui-scale]');
            if (select) select.value = root.dataset.uiScale;
        } else if (event.key === defaultPageKey) {
            const select = document.querySelector('[data-default-page]');
            if (select) select.value = event.newValue === 'viewer' ? 'viewer' : 'home';
        } else if (event.key === rememberWorkKey) {
            const toggle = document.querySelector('[data-remember-work]');
            if (toggle) toggle.checked = event.newValue !== 'false';
        } else if (event.key === keyboardShortcutsKey) {
            const toggle = document.querySelector('[data-keyboard-shortcuts]');
            if (toggle) toggle.checked = event.newValue !== 'false';
        }
    });

    document.addEventListener('mc-viewer-settings-ready', initializeSettingsPanel, { once: true });
    window.MCViewerSettingsReady?.then(initializeSettingsPanel);
    refreshAccountAuthorization();
})();
