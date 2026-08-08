/**
 * WattWatch — Meter Detail Page
 * Displays full meter info, readings table, and actions.
 */

import { getMeter, getReadings, createReading, initMeter, updateMeter } from '../api/api.js';
import { renderDetailSkeleton } from '../components/skeleton.js';
import { openModal, closeModal } from '../components/modal.js';
import { toggleDropdown } from '../components/dropdown.js';
import { showToast } from '../scripts/toast.js';
import { navigate } from '../scripts/router.js';
import { getUnitCap, setUnitCap } from '../scripts/store.js';

const ROWS_PER_PAGE = 10;

/**
 * Render the meter detail page.
 * @param {object} params - { id }
 */
export async function renderMeterDetail(params) {
    const app = document.getElementById('app');
    const meterId = Number(params.id);

    app.innerHTML = renderDetailSkeleton();

    try {
        const [meter, readings] = await Promise.all([
            getMeter(meterId),
            getReadings(meterId),
        ]);

        renderPage(meter, readings);
    } catch (err) {
        app.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3 class="empty-state-title">Meter not found</h3>
                <p class="empty-state-text">${escapeHtml(err.message)}</p>
                <button class="btn btn-secondary" id="btn-back-err">← Back to Dashboard</button>
            </div>
        `;
        document.getElementById('btn-back-err')?.addEventListener('click', () => navigate('#/'));
    }
}

function renderPage(meter, readings) {
    const app = document.getElementById('app');
    const isInitialized = meter.last_reading_date !== null;
    const unitCap = getUnitCap(meter.id);

    // Compute usage
    let unitsUsed = 0;
    let remaining = unitCap;
    let percentage = 0;
    let statusLabel = 'Not Initialized';
    let statusClass = 'badge-warning';
    let progressClass = '';
    let currentReading = '—';
    let lastReadingDate = '—';

    if (isInitialized && meter.last_reading !== null) {
        const latestReading = readings.length > 0 ? readings[0] : null;

        if (latestReading && latestReading.reading > meter.last_reading) {
            unitsUsed = latestReading.reading - meter.last_reading;
            currentReading = latestReading.reading.toLocaleString();
        } else {
            currentReading = meter.last_reading.toLocaleString();
        }

        lastReadingDate = latestReading
            ? formatDate(latestReading.recorded_at)
            : formatDate(meter.last_reading_date);

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
        }
    }

    const dropdownId = 'detail-settings-dropdown';

    app.innerHTML = `
        <!-- Back button -->
        <div class="mb-5">
            <button class="btn btn-ghost" id="btn-back">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                Back
            </button>
        </div>

        <!-- Meter Info Card -->
        <div class="glass-card p-6 mb-6 card-animate" style="position: relative; z-index: 20;">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
                <div>
                    <h1 class="text-xl font-bold text-gray-800 dark:text-gray-100">${escapeHtml(meter.name)}</h1>
                    <p class="text-sm text-gray-400 dark:text-gray-500 font-mono mt-1">${escapeHtml(meter.code)}</p>
                </div>
                <span class="badge ${statusClass} self-start">${statusLabel}</span>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Unit Cap</p>
                    <p class="text-lg font-bold text-gray-700 dark:text-gray-200">${unitCap}</p>
                </div>
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Current Reading</p>
                    <p class="text-lg font-bold text-gray-700 dark:text-gray-200">${currentReading}</p>
                </div>
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Last Reading</p>
                    <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">${lastReadingDate}</p>
                </div>
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Units Used</p>
                    <p class="text-lg font-bold text-gray-700 dark:text-gray-200">${unitsUsed}</p>
                </div>
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Remaining</p>
                    <p class="text-lg font-bold ${remaining < 0 ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}">${remaining}</p>
                </div>
                <div>
                    <p class="text-[0.7rem] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold mb-1">Base Reading</p>
                    <p class="text-lg font-bold text-gray-700 dark:text-gray-200">${meter.last_reading !== null ? meter.last_reading.toLocaleString() : '—'}</p>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="progress-track mb-5">
                <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>

            <!-- Actions -->
            <div class="flex flex-wrap gap-2 items-center">
                ${!isInitialized ? `
                    <button class="btn btn-primary btn-sm" id="detail-init-btn">Initialize Meter</button>
                ` : ''}
                <button class="btn btn-secondary btn-sm" id="detail-reading-btn">
                    Add Reading
                </button>
                <div class="dropdown-wrapper ml-auto">
                    <button class="btn btn-ghost btn-sm" data-dropdown="${dropdownId}" id="detail-settings-btn">
                        Settings ▾
                    </button>
                    <div class="dropdown-menu hidden" id="${dropdownId}">
                        <button class="dropdown-item" id="dd-rename">✏️ Rename Meter</button>
                        <button class="dropdown-item" id="dd-code">🔖 Change Code</button>
                        <button class="dropdown-item" id="dd-cap">📊 Change Unit Cap</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Readings Table -->
        <div class="card-animate" style="animation-delay: 0.1s">
            <h2 class="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Reading History</h2>
            <div id="readings-table-container"></div>
        </div>
    `;

    // Render readings table
    renderReadingsTable(readings, 1);

    // Bind events
    const refresh = () => renderMeterDetail({ id: meter.id });

    document.getElementById('btn-back').addEventListener('click', () => navigate('#/'));

    document.getElementById('detail-settings-btn').addEventListener('click', () => {
        toggleDropdown(dropdownId);
    });

    if (!isInitialized) {
        document.getElementById('detail-init-btn')?.addEventListener('click', () => {
            showInitModal(meter, refresh);
        });
    }

    document.getElementById('detail-reading-btn').addEventListener('click', () => {
        if (!isInitialized) {
            showToast('Please initialize the meter first before adding a reading.', 'warning');
            return;
        }
        showReadingModal(meter, refresh);
    });

    document.getElementById('dd-rename')?.addEventListener('click', () => {
        toggleDropdown(dropdownId);
        showRenameModal(meter, refresh);
    });
    document.getElementById('dd-code')?.addEventListener('click', () => {
        toggleDropdown(dropdownId);
        showChangeCodeModal(meter, refresh);
    });
    document.getElementById('dd-cap')?.addEventListener('click', () => {
        toggleDropdown(dropdownId);
        showChangeCapModal(meter, refresh);
    });
}

function renderReadingsTable(readings, page) {
    const container = document.getElementById('readings-table-container');
    if (!container) return;

    if (readings.length === 0) {
        container.innerHTML = `
            <div class="glass-card">
                <div class="empty-state" style="padding: 2.5rem 1.5rem;">
                    <div class="empty-state-icon" style="font-size: 2.5rem;">📊</div>
                    <h3 class="empty-state-title">No readings yet</h3>
                    <p class="empty-state-text">Add a reading to start tracking this meter.</p>
                </div>
            </div>
        `;
        return;
    }

    const totalPages = Math.ceil(readings.length / ROWS_PER_PAGE);
    const startIdx = (page - 1) * ROWS_PER_PAGE;
    const pageReadings = readings.slice(startIdx, startIdx + ROWS_PER_PAGE);

    let html = `
        <div class="glass-card overflow-hidden">
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Reading</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pageReadings.map(r => `
                            <tr>
                                <td>${formatDate(r.recorded_at)}</td>
                                <td class="font-semibold">${r.reading.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Pagination
    if (totalPages > 1) {
        html += `<div class="pagination">`;
        html += `<button class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        html += `<button class="page-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''}>›</button>`;
        html += `</div>`;
    }

    container.innerHTML = html;

    // Bind pagination
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = Number(btn.dataset.page);
            if (p >= 1 && p <= totalPages) renderReadingsTable(readings, p);
        });
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

    document.getElementById('init-date').value = toLocalDatetimeString(new Date());
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

function showReadingModal(meter, onRefresh) {
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

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

function toLocalDatetimeString(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
