/**
 * WattWatch — Meter Card Component
 * Renders a single meter card for the dashboard.
 */

import { toggleDropdown } from './dropdown.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from '../scripts/toast.js';
import { initMeter, createReading, updateMeter } from '../api/api.js';
import { navigate } from '../scripts/router.js';
import { getUnitCap, setUnitCap } from '../scripts/store.js';

/**
 * Render a single meter card.
 * @param {object} meter - Meter data from API
 * @param {number} index - Card index (for staggered animation)
 * @param {Function} onRefresh - Callback to refresh the dashboard
 * @returns {string} HTML
 */
export function renderMeterCard(meter, index, onRefresh) {
    const isInitialized = meter.last_reading_date !== null;
    const unitCap = getUnitCap(meter.id);

    // Compute usage info
    let unitsUsed = 0;
    let remaining = unitCap;
    let percentage = 0;
    let statusLabel = 'N/A';
    let statusClass = 'badge-safe';
    let progressClass = '';

    if (isInitialized && meter.last_reading !== null) {
        // last_reading is the baseline; current readings may be higher
        // But from the meter data alone, we see the "last_reading" which is the reset baseline
        // The "units used" in the current period = latest reading − last_reading
        // But the meter object only has last_reading, not the "current" live reading.
        // Since the frontend card shows what we know: units used = 0 at start of period
        // We'll show 0 used right after init/reset. The detail page shows the latest reading.
        // For now, show units = 0 used (the card will be updated when readings exist).
        unitsUsed = 0;
        remaining = unitCap;
        percentage = 0;
        statusLabel = 'Safe';
        statusClass = 'badge-safe';
    }

    if (!isInitialized) {
        statusLabel = 'Not Initialized';
        statusClass = 'badge-warning';
    }

    const dropdownId = `dropdown-meter-${meter.id}`;

    return `
        <div class="glass-card p-5 cursor-pointer card-animate meter-card"
             style="animation-delay: ${index * 0.06}s; position: relative; z-index: ${1000 - index};"
             data-meter-id="${meter.id}">

            <!-- Header -->
            <div class="flex items-start justify-between mb-3">
                <div class="card-clickable">
                    <h3 class="text-base font-bold text-gray-800 dark:text-gray-100">${escapeHtml(meter.name)}</h3>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">${escapeHtml(meter.code)}</p>
                </div>
                <span class="badge ${statusClass}">${statusLabel}</span>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-3 gap-3 mb-3 card-clickable">
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Cap</p>
                    <p class="text-sm font-bold text-gray-700 dark:text-gray-200">${unitCap}</p>
                </div>
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Used</p>
                    <p class="text-sm font-bold text-gray-700 dark:text-gray-200">${unitsUsed}</p>
                </div>
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">Remaining</p>
                    <p class="text-sm font-bold ${remaining < 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}">${remaining}</p>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="progress-track mb-4 card-clickable">
                <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 items-center card-actions">
                ${!isInitialized ? `
                    <button class="btn btn-primary btn-sm" data-action="init" data-meter-id="${meter.id}">
                        Initialize
                    </button>
                ` : ''}
                <button class="btn btn-secondary btn-sm" data-action="add-reading" data-meter-id="${meter.id}">
                    Add Reading
                </button>
                <div class="dropdown-wrapper ml-auto">
                    <button class="btn btn-ghost btn-sm" data-dropdown="${dropdownId}" data-action="dropdown">
                        Settings ▾
                    </button>
                    <div class="dropdown-menu hidden" id="${dropdownId}">
                        <button class="dropdown-item" data-action="rename" data-meter-id="${meter.id}">
                            ✏️ Rename Meter
                        </button>
                        <button class="dropdown-item" data-action="change-code" data-meter-id="${meter.id}">
                            🔖 Change Code
                        </button>
                        <button class="dropdown-item" data-action="change-cap" data-meter-id="${meter.id}">
                            📊 Change Unit Cap
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

let currentMeters = [];
let currentRefreshCallback = null;

/**
 * Bind event listeners to meter cards in the DOM.
 * Call after rendering cards.
 * @param {Array} meters - Array of meter objects
 * @param {Function} onRefresh - Refresh callback
 */
export function bindMeterCardEvents(meters, onRefresh) {
    currentMeters = meters;
    currentRefreshCallback = onRefresh;

    const app = document.getElementById('app');
    
    // Prevent duplicate event listeners
    if (app.dataset.meterEventsBound) return;
    app.dataset.meterEventsBound = 'true';

    app.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');

        if (btn) {
            const action = btn.dataset.action;
            const meterId = btn.dataset.meterId;
            const meter = currentMeters.find(m => m.id === Number(meterId));

            if (!meter && action !== 'dropdown') return; // Safe guard

            switch (action) {
                case 'init':
                    e.stopPropagation();
                    showInitModal(meter, currentRefreshCallback);
                    break;
                case 'add-reading':
                    e.stopPropagation();
                    if (meter.last_reading_date === null) {
                        showToast('Please initialize the meter first before adding a reading.', 'warning');
                    } else {
                        showAddReadingModal(meter, currentRefreshCallback);
                    }
                    break;
                case 'dropdown':
                    e.stopPropagation();
                    toggleDropdown(btn.dataset.dropdown);
                    break;
                case 'rename':
                    e.stopPropagation();
                    closeDropdowns();
                    showRenameModal(meter, currentRefreshCallback);
                    break;
                case 'change-code':
                    e.stopPropagation();
                    closeDropdowns();
                    showChangeCodeModal(meter, currentRefreshCallback);
                    break;
                case 'change-cap':
                    e.stopPropagation();
                    closeDropdowns();
                    showChangeCapModal(meter, currentRefreshCallback);
                    break;
            }
            return;
        }

        // Card click → navigate to detail page (except when clicking actions)
        const card = e.target.closest('.meter-card');
        if (card && !e.target.closest('.card-actions') && !e.target.closest('.dropdown-menu')) {
            navigate(`#/meter/${card.dataset.meterId}`);
        }
    });
}

/* ---- Modals ---- */

function showInitModal(meter, onRefresh) {
    const html = `
        <form id="init-form" class="space-y-1">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Set the starting reading for <strong>${escapeHtml(meter.name)}</strong>.
            </p>
            <div class="form-group">
                <label class="form-label" for="init-reading">Current Meter Reading</label>
                <input class="form-input" type="number" id="init-reading" min="1" required placeholder="e.g. 1250">
            </div>
            <div class="form-group">
                <label class="form-label" for="init-date">Reading Date</label>
                <input class="form-input" type="datetime-local" id="init-date" required>
            </div>
            <div class="flex gap-2 justify-end pt-2">
                <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
                <button type="submit" class="btn btn-primary">Initialize</button>
            </div>
        </form>
    `;
    openModal('Initialize Meter', html);

    // Set default date to now
    const dateInput = document.getElementById('init-date');
    dateInput.value = toLocalDatetimeString(new Date());

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('init-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const reading = parseInt(document.getElementById('init-reading').value);
        const dateVal = document.getElementById('init-date').value;

        if (!reading || !dateVal) return;

        try {
            await initMeter(meter.id, {
                last_reading: reading,
                last_reading_date: new Date(dateVal).toISOString(),
            });
            showToast('Meter initialized successfully', 'success');
            closeModal();
            onRefresh();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function showAddReadingModal(meter, onRefresh) {
    const html = `
        <form id="reading-form" class="space-y-1">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Add a new reading for <strong>${escapeHtml(meter.name)}</strong>.
            </p>
            <div class="form-group">
                <label class="form-label" for="new-reading">Meter Reading</label>
                <input class="form-input" type="number" id="new-reading" min="1" required placeholder="e.g. 1380">
                <p class="form-hint">Must be higher than the last recorded reading.</p>
            </div>
            
            <div class="form-group mt-3">
                <label class="form-label">Date of Reading</label>
                <div class="flex gap-4 mb-2">
                    <label class="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="date_option" value="today" checked>
                        <span class="text-sm text-gray-700 dark:text-gray-300">Today</span>
                    </label>
                    <label class="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="date_option" value="custom">
                        <span class="text-sm text-gray-700 dark:text-gray-300">Add a date</span>
                    </label>
                </div>
                <div id="custom-date-container" class="hidden">
                    <input class="form-input" type="datetime-local" id="reading-date">
                </div>
            </div>

            <div class="flex gap-2 justify-end pt-2">
                <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Reading</button>
            </div>
        </form>
    `;
    openModal('Add Reading', html);

    const dateRadios = document.querySelectorAll('input[name="date_option"]');
    const customDateContainer = document.getElementById('custom-date-container');
    const customDateInput = document.getElementById('reading-date');
    customDateInput.value = toLocalDatetimeString(new Date());

    dateRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customDateContainer.classList.remove('hidden');
                customDateInput.required = true;
            } else {
                customDateContainer.classList.add('hidden');
                customDateInput.required = false;
            }
        });
    });

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('reading-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const reading = parseInt(document.getElementById('new-reading').value);
        if (!reading) return;
        
        let recorded_at = new Date().toISOString();
        if (document.querySelector('input[name="date_option"]:checked').value === 'custom') {
            recorded_at = new Date(customDateInput.value).toISOString();
        }

        try {
            await createReading({ meter_id: meter.id, reading, recorded_at });
            showToast('Reading added successfully', 'success');
            closeModal();
            onRefresh();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Close all dropdowns helper for when clicking an action
function closeDropdowns() {
    import('./dropdown.js').then(module => module.closeAllDropdowns());
}

function showRenameModal(meter, onRefresh) {
    const html = `
        <form id="rename-form" class="space-y-1">
            <div class="form-group">
                <label class="form-label" for="new-name">New Name</label>
                <input class="form-input" type="text" id="new-name" minlength="2" maxlength="30" required
                       value="${escapeHtml(meter.name)}" placeholder="e.g. Ground Floor">
            </div>
            <div class="flex gap-2 justify-end pt-2">
                <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `;
    openModal('Rename Meter', html);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('rename-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-name').value.trim();
        if (!name) return;

        try {
            await updateMeter(meter.id, { name });
            showToast('Meter renamed successfully', 'success');
            closeModal();
            onRefresh();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function showChangeCodeModal(meter, onRefresh) {
    const html = `
        <form id="code-form" class="space-y-1">
            <div class="form-group">
                <label class="form-label" for="new-code">New Meter Code</label>
                <input class="form-input" type="text" id="new-code" minlength="7" maxlength="8" required
                       value="${escapeHtml(meter.code)}" placeholder="e.g. MTR-1234">
                <p class="form-hint">7–8 characters</p>
            </div>
            <div class="flex gap-2 justify-end pt-2">
                <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `;
    openModal('Change Meter Code', html);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('code-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('new-code').value.trim();
        if (!code) return;

        try {
            await updateMeter(meter.id, { code });
            showToast('Meter code updated', 'success');
            closeModal();
            onRefresh();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function showChangeCapModal(meter, onRefresh) {
    const currentCap = getUnitCap(meter.id);
    const html = `
        <form id="cap-form" class="space-y-1">
            <div class="form-group">
                <label class="form-label" for="new-cap">Monthly Unit Cap</label>
                <input class="form-input" type="number" id="new-cap" min="1" required
                       value="${currentCap}" placeholder="e.g. 200">
                <p class="form-hint">Default is 200 units.</p>
            </div>
            <div class="flex gap-2 justify-end pt-2">
                <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </form>
    `;
    openModal('Change Unit Cap', html);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('cap-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const cap = parseInt(document.getElementById('new-cap').value);
        if (!cap || cap < 1) return;

        setUnitCap(meter.id, cap);
        showToast('Unit cap updated', 'success');
        closeModal();
        onRefresh();
    });
}

/* ---- Helpers ---- */

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function toLocalDatetimeString(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
