/* Global navigation feedback for real document navigations. */
(function () {
    let shown = false;
    let overlay = null;

    function ensureOverlay() {
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'gpPageNavigationLoader';
        overlay.className = 'gp-page-navigation-loader';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = `
            <div class="gp-loader-red-streak gp-loader-red-streak-top" aria-hidden="true"></div>
            <div class="gp-loader-red-streak gp-loader-red-streak-bottom" aria-hidden="true"></div>
            <div class="gp-page-loader-content">
                <img class="gp-cheetah-runner" src="/assets/cheetah-sprint-loader.gif?v=3"
                     width="440" height="192" alt="" aria-hidden="true" decoding="async" fetchpriority="high">
                <div class="gp-page-loader-title"><span>OPENING</span> <b>PAGE</b></div>
                <div class="gp-page-loader-progress" role="progressbar" aria-label="Page loading" aria-valuetext="Loading">
                    <span></span>
                </div>
                <small class="gp-page-loader-caption">Preparing your workspace</small>
            </div>`;
        return overlay;
    }

    function show() {
        if (shown) return;
        shown = true;
        const node = ensureOverlay();
        (document.body || document.documentElement).appendChild(node);
        requestAnimationFrame(() => node.classList.add('is-visible'));
    }

    function hide() {
        shown = false;
        if (!overlay) return;
        overlay.classList.remove('is-visible');
        overlay.remove();
        overlay = null;
    }

    // beforeunload also catches navigation initiated by JS buttons and forms.
    window.addEventListener('beforeunload', show);
    window.addEventListener('pageshow', hide);
    document.addEventListener('DOMContentLoaded', hide, { once: true });

    window.GPPageNavigation = { show, hide };
})();
