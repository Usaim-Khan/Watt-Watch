/**
 * WattWatch — Centralized API Layer
 * All fetch calls live here. No fetch() scattered in other files.
 */

const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:8000'
    : 'https://api.watt-watch.app';

/**
 * Generic request helper with error handling.
 * Parses JSON errors from the backend and re-throws with the detail message.
 */
async function request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    };

    const res = await fetch(url, config);

    // 204 No Content — success with no body
    if (res.status === 204) return null;

    // Try to parse JSON body
    let data;
    try {
        data = await res.json();
    } catch {
        // No JSON body
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        return null;
    }

    if (!res.ok) {
        // FastAPI returns { detail: "..." }
        const message = data?.detail || `Request failed with status ${res.status}`;
        throw new Error(message);
    }

    return data;
}

/* ============================================
   Meters
   ============================================ */

/** Get all meters */
export async function getMeters() {
    return request('/meters/');
}

/** Get a single meter by ID */
export async function getMeter(id) {
    return request(`/meters/${id}`);
}

/** Create a new meter */
export async function createMeter({ code, name }) {
    return request('/meters/', {
        method: 'POST',
        body: JSON.stringify({ code, name }),
    });
}

/** Update meter name and/or code */
export async function updateMeter(id, { name, code }) {
    const body = {};
    if (name !== undefined) body.name = name;
    if (code !== undefined) body.code = code;
    return request(`/meters/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

/** Initialize a meter with its first reading */
export async function initMeter(id, { last_reading, last_reading_date }) {
    return request(`/meters/${id}/init`, {
        method: 'PATCH',
        body: JSON.stringify({ last_reading, last_reading_date }),
    });
}

/* ============================================
   Readings
   ============================================ */

/** Get readings for a specific meter */
export async function getReadings(meterId) {
    return request(`/readings/${meterId}`);
}

/** Create a new reading */
export async function createReading({ meter_id, reading, recorded_at }) {
    const payload = { meter_id, reading };
    if (recorded_at) payload.recorded_at = recorded_at;
    
    return request('/readings/', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/* ============================================
   Billing Periods
   ============================================ */

/** Get all billing periods */
export async function getBillingPeriods() {
    return request('/period/');
}

/** End the current billing month for all meters */
export async function endMonth() {
    return request('/period/end-month', {
        method: 'POST',
    });
}

/** Delete a meter by ID */
export async function deleteMeter(meterId) {
    return request(`/meters/${meterId}`, {
        method: 'DELETE',
    });
}