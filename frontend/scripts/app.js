/**
 * WattWatch — Main Application Entry Point
 * Initializes router, sidebar, theme, and global components.
 */

import { addRoute, startRouter, getCurrentPath, setNotFound, navigate } from './router.js';
import { initModal } from '../components/modal.js';
import { initDropdowns } from '../components/dropdown.js';
import { applyStoredTheme } from './store.js';

// Pages
import { renderDashboard } from '../pages/dashboard.js';
import { renderMeterDetail } from '../pages/meterDetail.js';
import { renderBilling } from '../pages/billing.js';
import { renderSettings } from '../pages/settings.js';

/* ---- Initialize ---- */

// Apply stored theme before anything renders
applyStoredTheme();

// Initialize global components
initModal();
initDropdowns();

// Setup sidebar
setupSidebar();


// Register routes
addRoute('/', () => {
    updateActiveNav('/');
    renderDashboard();
});

addRoute('/meter/:id', (params) => {
    updateActiveNav('/');
    renderMeterDetail(params);
});

addRoute('/billing', () => {
    updateActiveNav('/billing');
    renderBilling();
});

addRoute('/settings', () => {
    updateActiveNav('/settings');
    renderSettings();
});

setNotFound(() => {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="empty-state" style="min-height: 60vh;">
            <div class="empty-state-icon">🔍</div>
            <h3 class="empty-state-title">Page not found</h3>
            <p class="empty-state-text">The page you're looking for doesn't exist.</p>
            <button class="btn btn-primary" id="btn-go-home">Go to Dashboard</button>
        </div>
    `;
    document.getElementById('btn-go-home').addEventListener('click', () => navigate('#/'));
});

// Start the router
startRouter();

/* ---- Sidebar Logic ---- */

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger-btn');

    // Mobile hamburger toggle
    hamburger?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('hidden');
    });

    // Close sidebar on overlay click
    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.add('hidden');
    });

    // Close sidebar on nav link click (mobile)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                overlay.classList.add('hidden');
            }
        });
    });
}

/**
 * Update sidebar active state.
 * @param {string} route - The route path to highlight
 */
function updateActiveNav(route) {
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkRoute = link.dataset.route;
        if (linkRoute === route) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}


