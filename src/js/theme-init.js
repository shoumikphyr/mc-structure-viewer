(() => {
    const storageKey = 'mc_viewer_appearance';
    const reduceMotionKey = 'mc_viewer_reduce_motion';
    const uiScaleKey = 'mc_viewer_ui_scale';
    let theme = 'light';

    try {
        const savedTheme = window.localStorage.getItem(storageKey);
        if (savedTheme === 'dark' || savedTheme === 'light') theme = savedTheme;
    } catch (_) {
        // La aplicación sigue usando el tema claro si el navegador bloquea el almacenamiento.
    }

    document.documentElement.dataset.theme = theme;
    try {
        const savedMotion = window.localStorage.getItem(reduceMotionKey);
        const systemPrefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
        document.documentElement.dataset.reduceMotion = (savedMotion === null ? systemPrefersReducedMotion : savedMotion === 'true') ? 'true' : 'false';
        document.documentElement.dataset.uiScale = window.localStorage.getItem(uiScaleKey) === 'large' ? 'large' : 'normal';
    } catch (_) {
        document.documentElement.dataset.reduceMotion = 'false';
        document.documentElement.dataset.uiScale = 'normal';
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#090a09' : '#f1f4f1';
})();
