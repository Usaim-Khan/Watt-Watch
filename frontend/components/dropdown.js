/**
 * WattWatch — Dropdown Component
 * Reusable dropdown menu with outside-click close.
 */

/** Currently open dropdown ID (only one open at a time) */
let activeDropdownId = null;

/**
 * Toggle a dropdown menu.
 * @param {string} dropdownId - ID of the dropdown menu element
 */
export function toggleDropdown(dropdownId) {
    const menu = document.getElementById(dropdownId);
    if (!menu) return;

    if (activeDropdownId === dropdownId) {
        closeAllDropdowns();
    } else {
        closeAllDropdowns();
        menu.classList.remove('hidden');
        activeDropdownId = dropdownId;
    }
}

/** Close all open dropdowns */
export function closeAllDropdowns() {
    if (activeDropdownId) {
        const menu = document.getElementById(activeDropdownId);
        if (menu) menu.classList.add('hidden');
        activeDropdownId = null;
    }
}

/** Initialize global click listener for outside-click close (call once) */
export function initDropdowns() {
    document.addEventListener('click', (e) => {
        if (activeDropdownId) {
            const menu = document.getElementById(activeDropdownId);
            const trigger = menu?.previousElementSibling || menu?.closest('.dropdown-wrapper')?.querySelector('button');
            if (menu && !menu.contains(e.target) && !e.target.closest(`[data-dropdown="${activeDropdownId}"]`)) {
                closeAllDropdowns();
            }
        }
    });
}
