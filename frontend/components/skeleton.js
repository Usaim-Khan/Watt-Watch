/**
 * WattWatch — Skeleton Loaders
 * Loading placeholder components.
 */

/**
 * Render placeholder card skeletons for the dashboard.
 * @param {number} count
 * @returns {string} HTML
 */
export function renderCardSkeletons(count = 3) {
    let html = '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="glass-card p-6">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <div class="skeleton" style="width: 120px; height: 18px; margin-bottom: 8px;"></div>
                        <div class="skeleton" style="width: 80px; height: 14px;"></div>
                    </div>
                    <div class="skeleton" style="width: 56px; height: 24px; border-radius: 999px;"></div>
                </div>
                <div class="space-y-3 mb-4">
                    <div class="skeleton" style="width: 100%; height: 12px;"></div>
                    <div class="skeleton" style="width: 75%; height: 12px;"></div>
                </div>
                <div class="skeleton" style="width: 100%; height: 8px; border-radius: 999px;"></div>
                <div class="flex gap-2 mt-5">
                    <div class="skeleton" style="width: 90px; height: 34px;"></div>
                    <div class="skeleton" style="width: 90px; height: 34px;"></div>
                    <div class="skeleton" style="width: 80px; height: 34px;"></div>
                </div>
            </div>`;
    }
    html += '</div>';
    return html;
}

/**
 * Render a table skeleton.
 * @param {number} rows
 * @param {number} cols
 * @returns {string} HTML
 */
export function renderTableSkeleton(rows = 5, cols = 5) {
    let html = '<div class="glass-card overflow-hidden"><table class="data-table"><thead><tr>';
    for (let c = 0; c < cols; c++) {
        html += `<th><div class="skeleton" style="width: ${60 + Math.random() * 40}px; height: 14px;"></div></th>`;
    }
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            html += `<td><div class="skeleton" style="width: ${50 + Math.random() * 60}px; height: 14px;"></div></td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

/**
 * Render a detail page skeleton.
 * @returns {string} HTML
 */
export function renderDetailSkeleton() {
    return `
        <div class="mb-6">
            <div class="skeleton" style="width: 80px; height: 34px; margin-bottom: 1.5rem;"></div>
        </div>
        <div class="glass-card p-6 mb-6">
            <div class="flex items-start justify-between mb-4">
                <div>
                    <div class="skeleton" style="width: 180px; height: 24px; margin-bottom: 10px;"></div>
                    <div class="skeleton" style="width: 100px; height: 16px;"></div>
                </div>
                <div class="skeleton" style="width: 60px; height: 24px; border-radius: 999px;"></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                ${Array(4).fill(`<div><div class="skeleton" style="width: 60px; height: 12px; margin-bottom: 6px;"></div><div class="skeleton" style="width: 80px; height: 20px;"></div></div>`).join('')}
            </div>
            <div class="skeleton" style="width: 100%; height: 8px; border-radius: 999px;"></div>
        </div>
        ${renderTableSkeleton(5, 2)}
    `;
}
