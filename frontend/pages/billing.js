/**
 * WattWatch — Billing History Page
 * Displays billing periods in a clean responsive table.
 */

import { getBillingPeriods, getMeters } from '../api/api.js';
import { renderTableSkeleton } from '../components/skeleton.js';

const ROWS_PER_PAGE = 10;

/**
 * Render the billing history page.
 */
export async function renderBilling() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Billing History</h1>
            <p class="page-subtitle">View past billing periods and consumption records</p>
        </div>
        <div id="billing-container">
            ${renderTableSkeleton(5, 7)}
        </div>
    `;

    try {
        const [periods, meters] = await Promise.all([
            getBillingPeriods(),
            getMeters(),
        ]);

        // Build a meter lookup map
        const meterMap = {};
        meters.forEach(m => { meterMap[m.id] = m; });

        renderBillingTable(periods, meterMap, 1);
    } catch (err) {
        document.getElementById('billing-container').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3 class="empty-state-title">Failed to load billing history</h3>
                <p class="empty-state-text">${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

function renderBillingTable(periods, meterMap, page) {
    const container = document.getElementById('billing-container');
    if (!container) return;

    if (periods.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3 class="empty-state-title">No billing history</h3>
                <p class="empty-state-text">Billing records will appear here after you end your first monthly billing period.</p>
            </div>
        `;
        return;
    }

    const totalPages = Math.ceil(periods.length / ROWS_PER_PAGE);
    const startIdx = (page - 1) * ROWS_PER_PAGE;
    const pagePeriods = periods.slice(startIdx, startIdx + ROWS_PER_PAGE);

    let html = `
        <div class="glass-card overflow-hidden card-animate">
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Meter</th>
                            <th>Billing Period</th>
                            <th>Start Reading</th>
                            <th>End Reading</th>
                            <th>Units Consumed</th>
                            <th>Start Date</th>
                            <th>End Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagePeriods.map(p => {
                            const meter = meterMap[p.meter_id];
                            const meterName = meter ? meter.name : `Meter #${p.meter_id}`;
                            const startDate = formatDate(p.start_date);
                            const endDate = formatDate(p.end_date);

                            return `
                                <tr>
                                    <td class="font-semibold text-gray-700 dark:text-gray-200">${escapeHtml(meterName)}</td>
                                    <td>${startDate} – ${endDate}</td>
                                    <td>${p.start_reading.toLocaleString()}</td>
                                    <td>${p.end_reading.toLocaleString()}</td>
                                    <td>
                                        <span class="font-bold text-brand-600 dark:text-brand-400">${p.units_consumed.toLocaleString()}</span>
                                    </td>
                                    <td>${startDate}</td>
                                    <td>${endDate}</td>
                                </tr>
                            `;
                        }).join('')}
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
            if (p >= 1 && p <= totalPages) renderBillingTable(periods, meterMap, p);
        });
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}
