/**
 * WattWatch — Modal Component
 * Reusable modal with backdrop close, Escape key, and focus management.
 */

const backdrop = () => document.getElementById('modal-backdrop');
const titleEl = () => document.getElementById('modal-title');
const bodyEl  = () => document.getElementById('modal-body');
const closeBtn = () => document.getElementById('modal-close-btn');

let onCloseCallback = null;

/**
 * Open the modal.
 * @param {string} title
 * @param {string} bodyHTML
 * @param {Function} [onClose] - optional callback when modal closes
 */
export function openModal(title, bodyHTML, onClose = null) {
    titleEl().textContent = title;
    bodyEl().innerHTML = bodyHTML;
    backdrop().classList.remove('hidden');
    onCloseCallback = onClose;
    document.body.style.overflow = 'hidden';

    // Focus first input if exists
    requestAnimationFrame(() => {
        const firstInput = bodyEl().querySelector('input, select, textarea, button[type="submit"]');
        if (firstInput) firstInput.focus();
    });
}

/** Close the modal */
export function closeModal() {
    backdrop().classList.add('hidden');
    document.body.style.overflow = '';
    if (onCloseCallback) {
        onCloseCallback();
        onCloseCallback = null;
    }
}

/** Initialize modal event listeners (call once) */
export function initModal() {
    // Close on backdrop click
    backdrop().addEventListener('click', (e) => {
        if (e.target === backdrop()) closeModal();
    });

    // Close button
    closeBtn().addEventListener('click', closeModal);

    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !backdrop().classList.contains('hidden')) {
            closeModal();
        }
    });
}
