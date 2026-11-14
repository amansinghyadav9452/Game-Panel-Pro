/*
 * Game Panel fixed light theme.
 * Theme switching and remote appearance preferences have been removed.
 * This script intentionally performs no API calls and stores no theme state.
 */
(() => {
    const root = document.documentElement;
    root.classList.add("light-theme");
    root.style.colorScheme = "light";
})();
