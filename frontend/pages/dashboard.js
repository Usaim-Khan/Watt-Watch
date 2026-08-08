/**
 * WattWatch — Dashboard Page
 * Displays all meters as cards with Add Meter and End Month actions.
 */

import { getMeters, createMeter, endMonth, getReadings } from '../api/api.js';
import { renderMeterCard, bindMeterCardEvents } from '../components/meterCard.js';
import { renderCardSkeletons } from '../components/skeleton.js';
import { openModal, closeModal } from '../components/modal.js';
import { showToast } from '../scripts/toast.js';
import { getUnitCap } from '../scripts/store.js';

/**
 * Render the dashboard page.
 */
export async function renderDashboard() {
    const app = document.getElementById('app');

    // Page header + action buttons
    app.innerHTML = `
        <div class="page-header">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 class="page-title">Dashboard</h1>
                    <p class="page-subtitle">Manage your electricity meters</p>
                </div>
                <div class="flex gap-3">
                    <button class="btn btn-primary" id="btn-add-meter">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Meter
                    </button>
                    <button class="btn btn-secondary" id="btn-end-month">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        End Month
                    </button>
                </div>
            </div>
        </div>
        <div id="meters-container">
            ${renderCardSkeletons(3)}
        </div>
    `;

    // Bind top-level buttons
    document.getElementById('btn-add-meter').addEventListener('click', () => showAddMeterModal(loadMeters));
    document.getElementById('btn-end-month').addEventListener('click', showEndMonthConfirm);

    // Load data
    await loadMeters();
}

/**
 * Fetch and render all meter cards.
 */
async function loadMeters() {
    const container = document.getElementById('meters-container');
    if (!container) return;

    try {
        const meters = await getMeters();

        if (meters.length > 0 && meters[0].last_reading_date) {
            const date = new Date(meters[0].last_reading_date);
            const monthName = date.toLocaleString('default', { month: 'long' });
            const subtitle = document.querySelector('.page-subtitle');
            if (subtitle) {
                subtitle.innerHTML = `Manage your electricity meters — <span class="font-semibold text-brand-600 dark:text-brand-400">${monthName}</span>`;
            }
        }

        if (meters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚡</div>
                    <h3 class="empty-state-title">No meters added yet</h3>
                    <p class="empty-state-text">Start by adding your first electricity meter to begin tracking usage.</p>
                    <button class="btn btn-primary" id="btn-empty-add">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add Meter
                    </button>
                </div>
            `;
            document.getElementById('btn-empty-add')?.addEventListener('click', () => showAddMeterModal(loadMeters));
            return;
        }

        // For each meter, fetch latest reading to compute "units used"
        const metersWithUsage = await Promise.all(meters.map(async (meter) => {
            if (meter.last_reading === null) return { ...meter, _latestReading: null };
            try {
                const readings = await getReadings(meter.id);
                const latest = readings.length > 0 ? readings[0] : null;
                return { ...meter, _latestReading: latest };
            } catch {
                return { ...meter, _latestReading: null };
            }
        }));

        // Render cards
        container.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                ${metersWithUsage.map((m, i) => renderEnhancedMeterCard(m, i)).join('')}
            </div>
        `;

        bindMeterCardEvents(meters, loadMeters);
    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3 class="empty-state-title">Failed to load meters</h3>
                <p class="empty-state-text">${escapeHtml(err.message)}</p>
                <button class="btn btn-secondary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

/**
 * Enhanced card rendering that includes live usage computation.
 */
function renderEnhancedMeterCard(meter, index) {
    const isInitialized = meter.last_reading_date !== null;
    const unitCap = getUnitCap(meter.id);

    let unitsUsed = 0;
    let remaining = unitCap;
    let percentage = 0;
    let statusLabel = 'Not Initialized';
    let statusClass = 'badge-warning';
    let progressClass = '';

    if (isInitialized && meter.last_reading !== null) {
        if (meter._latestReading && meter._latestReading.reading > meter.last_reading) {
            unitsUsed = meter._latestReading.reading - meter.last_reading;
        }
        remaining = unitCap - unitsUsed;
        percentage = unitCap > 0 ? (unitsUsed / unitCap) * 100 : 0;

        if (percentage > 100) {
            statusLabel = 'Exceeded';
            statusClass = 'badge-danger';
            progressClass = 'danger';
        } else if (percentage >= 70) {
            statusLabel = 'Near Cap';
            statusClass = 'badge-warning';
            progressClass = 'warning';
        } else {
            statusLabel = 'Safe';
            statusClass = 'badge-safe';
            progressClass = '';
        }
    }

    const dropdownId = `dropdown-meter-${meter.id}`;

    return `
        <div class="glass-card p-5 cursor-pointer card-animate meter-card"
             style="animation-delay: ${index * 0.06}s"
             data-meter-id="${meter.id}">

            <div class="flex items-start justify-between mb-3">
                <div class="card-clickable">
                    <h3 class="text-base font-bold text-gray-800 dark:text-gray-100">${escapeHtml(meter.name)}</h3>
                    <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">${escapeHtml(meter.code)}</p>
                </div>
                <span class="badge ${statusClass}">${statusLabel}</span>
            </div>

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

/* ---- Modals ---- */

function showAddMeterModal(onRefresh) {
    const html = `
        <form id="add-meter-form" class="space-y-1">
            <div class="form-group">
                <label class="form-label" for="meter-name">Meter Name</label>
                <input class="form-input" type="text" id="meter-name" minlength="2" maxlength="30" required
                       placeholder="e.g. Ground Floor">
            </div>
            <div class="form-group">
                <label class="form-label" for="meter-code">Meter Code</label>
                <input class="form-input" type="text" id="meter-code" minlength="7" maxlength="8" required
                       placeholder="e.g. MTR-1234">
                <p class="form-hint">7–8 characters, printed on the meter</p>
            </div>
            <div class="flex gap-2 justify-end pt-2">
                <button type="button" class="btn btn-ghost" id="modal-cancel">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Meter</button>
            </div>
        </form>
    `;
    openModal('Add Meter', html);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('add-meter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('meter-name').value.trim();
        const code = document.getElementById('meter-code').value.trim();

        if (!name || !code) return;

        try {
            await createMeter({ name, code });
            showToast('Meter added successfully', 'success');
            closeModal();
            onRefresh();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

function showEndMonthConfirm() {
    const html = `
        <div class="text-center py-2">
            <div class="text-4xl mb-3">📅</div>
            <p class="text-gray-600 dark:text-gray-300 mb-1">End the current billing period?</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 mb-6">This action cannot be undone. A billing record will be created for all meters.</p>
            <div class="flex gap-3 justify-center">
                <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
                <button class="btn btn-danger" id="btn-confirm-end">End Month</button>
            </div>
        </div>
    `;
    openModal('End Billing Period', html);

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('btn-confirm-end').addEventListener('click', async () => {
        const btn = document.getElementById('btn-confirm-end');
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
            await endMonth();
            showToast('Billing period ended successfully', 'success');
            closeModal();
            loadMeters();
        } catch (err) {
            showToast(err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'End Month';
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
