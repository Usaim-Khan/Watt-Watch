/**
 * WattWatch — Local Storage Helper
 * Manages unit caps and theme preference.
 */

const CAPS_KEY = 'wattwatch_unit_caps';
const THEME_KEY = 'wattwatch_theme';
const DEFAULT_CAP = 200;

/**
 * Get the unit cap for a meter.
 * @param {number} meterId
 * @returns {number}
 */
export function getUnitCap(meterId) {
    const caps = JSON.parse(localStorage.getItem(CAPS_KEY) || '{}');
    return caps[meterId] ?? DEFAULT_CAP;
}

/**
 * Set the unit cap for a meter.
 * @param {number} meterId
 * @param {number} cap
 */
export function setUnitCap(meterId, cap) {
    const caps = JSON.parse(localStorage.getItem(CAPS_KEY) || '{}');
    caps[meterId] = cap;
    localStorage.setItem(CAPS_KEY, JSON.stringify(caps));
}

/**
 * Get the current theme ('light' or 'dark').
 * @returns {string}
 */
export function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
}

/**
 * Set the theme ('light' or 'dark').
 * @param {string} theme
 */
export function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

/** Apply the stored theme on page load */
export function applyStoredTheme() {
    const theme = getTheme();
    setTheme(theme);
}
