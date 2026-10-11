(() => {
    let preferredPage = 'home';
    try {
        preferredPage = window.localStorage.getItem('mc_viewer_default_page') === 'viewer' ? 'viewer' : 'home';
    } catch (_) {}
    if (preferredPage !== 'viewer' || window.location.hash || window.location.search) return;

    // Only apply the preference when entering from outside MC Viewer. Internal
    // navigation links to Inicio continue to respect their explicit destination.
    try {
        if (document.referrer && new URL(document.referrer).origin === window.location.origin) return;
    } catch (_) {}
    window.location.replace(new URL('viewer.html', window.location.href).href);
})();
