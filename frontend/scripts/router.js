/**
 * WattWatch — Simple Hash Router
 * Maps hash-based URLs to page render functions.
 */

const routes = [];
let notFoundHandler = null;

/**
 * Register a route pattern.
 * Supports :param syntax, e.g. '/meter/:id'
 */
export function addRoute(pattern, handler) {
    // Convert pattern to regex: '/meter/:id' → /^\/meter\/([^/]+)$/
    const paramNames = [];
    const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
    });
    routes.push({
        regex: new RegExp(`^${regexStr}$`),
        paramNames,
        handler,
    });
}

/** Register a fallback for unmatched routes */
export function setNotFound(handler) {
    notFoundHandler = handler;
}

/** Navigate to a hash route */
export function navigate(hash) {
    window.location.hash = hash;
}

/** Get the current hash path (without the '#') */
function getPath() {
    const hash = window.location.hash || '#/';
    return hash.slice(1); // remove '#'
}

/** Match the current path and call the handler */
function resolve() {
    const path = getPath();

    for (const route of routes) {
        const match = path.match(route.regex);
        if (match) {
            const params = {};
            route.paramNames.forEach((name, i) => {
                params[name] = decodeURIComponent(match[i + 1]);
            });
            route.handler(params);
            return;
        }
    }

    // No route matched
    if (notFoundHandler) notFoundHandler();
}

/** Start listening for hash changes */
export function startRouter() {
    window.addEventListener('hashchange', resolve);
    // Initial resolve
    resolve();
}

/** Get the current path for active-link highlighting */
export function getCurrentPath() {
    return getPath();
}
