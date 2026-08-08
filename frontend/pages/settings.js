/**
 * WattWatch — Settings Page
 * Application-level settings: theme toggle and about section.
 */

import { getTheme, setTheme } from '../scripts/store.js';
import { getMeters, deleteMeter } from '../api/api.js';
import { showToast } from '../scripts/toast.js';
import { openModal, closeModal } from '../components/modal.js';

/**
 * Render the settings page.
 */
export function renderSettings() {
    const app = document.getElementById('app');
    const isDark = getTheme() === 'dark';

    app.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Settings</h1>
            <p class="page-subtitle">Application preferences</p>
        </div>

        <!-- Theme Setting -->
        <div class="glass-card p-6 mb-5 card-animate">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-base font-bold text-gray-800 dark:text-gray-100">Appearance</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Switch between light and dark themes</p>
                </div>
                <div class="toggle-wrapper">
                    <span class="text-sm text-gray-500 dark:text-gray-400">☀️</span>
                    <button class="toggle ${isDark ? 'active' : ''}" id="theme-toggle" aria-label="Toggle dark mode" role="switch" aria-checked="${isDark}"></button>
                    <span class="text-sm text-gray-500 dark:text-gray-400">🌙</span>
                </div>
            </div>
        </div>

        <!-- Manage Meters -->
        <div class="glass-card p-6 mb-5 card-animate" style="animation-delay: 0.04s">
            <h3 class="text-base font-bold text-gray-800 dark:text-gray-100 mb-2">Manage Meters</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">View and permanently delete registered meters</p>
            <div id="settings-meters-list" class="space-y-3">
                <div class="text-sm text-gray-400 dark:text-gray-500">Loading meters...</div>
            </div>
        </div>

        <!-- About Section -->
        <div class="glass-card p-6 card-animate" style="animation-delay: 0.08s">
            <h3 class="text-base font-bold text-gray-800 dark:text-gray-100 mb-3">About WattWatch</h3>
            <div class="space-y-3">
                <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    WattWatch is a modern electricity usage management application designed to help you track
                    meter readings, monitor consumption, and manage billing periods across multiple electricity meters.
                </p>
                <div class="flex flex-wrap gap-x-8 gap-y-2 pt-2">
                    <div>
                        <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Version</p>
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">1.0.0</p>
                    </div>
                    <div>
                        <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Built With</p>
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">FastAPI + Vanilla JS</p>
                    </div>
                    <div>
                        <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">License</p>
                        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">MIT</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        // Re-render to update toggle state
        renderSettings();
    });

    // Load meters list
    loadMetersList();
}

async function loadMetersList() {
    const container = document.getElementById('settings-meters-list');
    if (!container) return;

    try {
        const meters = await getMeters();
        if (meters.length === 0) {
            container.innerHTML = `<p class="text-sm text-gray-500 dark:text-gray-450">No meters registered yet.</p>`;
            return;
        }

        container.innerHTML = meters.map(meter => `
            <div class="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                <div>
                    <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(meter.name)}</h4>
                    <p class="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">${escapeHtml(meter.code)}</p>
                </div>
                <button class="btn btn-danger btn-sm text-xs px-3 py-1.5" data-action="delete" data-id="${meter.id}" data-name="${escapeHtml(meter.name)}">
                    Delete
                </button>
            </div>
        `).join('');

        // Bind delete action buttons
        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const name = e.target.dataset.name;
                showDeleteConfirmModal(id, name);
            });
        });
    } catch (err) {
        container.innerHTML = `<p class="text-sm text-red-500">Failed to load meters: ${escapeHtml(err.message)}</p>`;
    }
}

function showDeleteConfirmModal(id, name) {
    const html = `
        <div class="text-center py-2">
            <div class="text-4xl mb-3">⚠️</div>
            <p class="text-gray-600 dark:text-gray-300 mb-1">Delete meter "${escapeHtml(name)}"?</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 mb-6">This will permanently delete this meter and all of its associated readings. This action cannot be undone.</p>
            <div class="flex gap-3 justify-center">
                <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
                <button class="btn btn-danger" id="btn-confirm-delete">Delete Permanently</button>
            </div>
        </div>
    `;
    openModal('Delete Meter', html);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
        const btn = document.getElementById('btn-confirm-delete');
        btn.disabled = true;
        btn.textContent = 'Deleting...';

        try {
            await deleteMeter(id);
            showToast('Meter deleted successfully', 'success');
            closeModal();
            loadMetersList();
        } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Delete Permanently';
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

