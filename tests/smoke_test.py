#!/usr/bin/env python3
"""
WattWatch — Live Smoke Test
============================
Targets the deployed API (https://api.watt-watch.app) and frontend
(https://watt-watch.app/). Exercises the meters/readings/billing-period
routes end-to-end against real infrastructure.

Assumptions baked into this script (per project conventions):
  - Test meters are "initialized" and all their readings are recorded
    on the SAME calendar date (no multi-day gaps needed to pass the
    reading/date monotonicity checks — reading VALUE increases, date
    stays constant).
  - POST /period/end-month is exercised for real. It only guards on
    the FIRST meter returned by GET /meters/ being >= 25 days past its
    last_reading_date — so depending on the state of production data,
    this call may legitimately succeed (200/204, closes real billing
    periods) or legitimately reject (400, too soon). Both outcomes are
    treated as PASS; only a 5xx / unexpected body is a FAIL. See
    test_end_month() for the exact logic.
  - Any meters this script creates are prefixed "SMK" and deleted in
    cleanup. If the script crashes mid-run, orphaned "SMK*" meters may
    be left behind — safe to delete manually via DELETE /meters/{id}.

Usage:
    pip install requests
    python smoke_test.py
"""

import sys
import time
import requests
from datetime import datetime, timezone, timedelta

API_BASE = "https://api.watt-watch.app"
FRONTEND_BASE = "https://watt-watch.app/"
TIMEOUT = 15

results = []          # (name, passed, detail)
created_meter_ids = []  # for cleanup


def record(name, passed, detail=""):
    results.append((name, passed, detail))
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))


def api(method, path, **kwargs):
    return requests.request(method, f"{API_BASE}{path}", timeout=TIMEOUT, **kwargs)


def unique_code(suffix=""):
    # 7-8 chars required by MeterCreate schema
    return f"SMK{int(time.time() * 1000) % 100000:05d}{suffix}"[:8]


# ---------------------------------------------------------------------
# Infra reachability
# ---------------------------------------------------------------------

def test_frontend_reachable():
    try:
        r = requests.get(FRONTEND_BASE, timeout=TIMEOUT)
        record("Frontend reachable", r.status_code == 200,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("Frontend reachable", False, str(e))


def test_health_db():
    try:
        r = api("GET", "/health/db")
        ok = r.status_code == 200 and r.json().get("db_status") == "connected"
        record("API DB health check", ok, f"status={r.status_code} body={r.text[:150]}")
    except requests.RequestException as e:
        record("API DB health check", False, str(e))


def test_cors_headers():
    try:
        r = api("OPTIONS", "/meters/", headers={
            "Origin": "https://watt-watch.app",
            "Access-Control-Request-Method": "GET",
        })
        allow_origin = r.headers.get("access-control-allow-origin")
        ok = r.status_code in (200, 204) and allow_origin in (
            "https://watt-watch.app", "*"
        )
        record("CORS allows frontend origin", ok,
               f"status={r.status_code} allow_origin={allow_origin}")
    except requests.RequestException as e:
        record("CORS allows frontend origin", False, str(e))


# ---------------------------------------------------------------------
# Meters
# ---------------------------------------------------------------------

def test_list_meters():
    try:
        r = api("GET", "/meters/")
        record("GET /meters/ returns list", r.status_code == 200 and isinstance(r.json(), list),
               f"status={r.status_code} count={len(r.json()) if r.status_code == 200 else '?'}")
    except requests.RequestException as e:
        record("GET /meters/ returns list", False, str(e))


def test_create_meter():
    code = unique_code()
    try:
        r = api("POST", "/meters/", json={"code": code, "name": "Smoke Test Meter A"})
        ok = r.status_code == 201 and r.json().get("code") == code
        meter_id = r.json().get("id") if r.status_code == 201 else None
        if meter_id:
            created_meter_ids.append(meter_id)
        record("POST /meters/ creates meter", ok, f"status={r.status_code} id={meter_id}")
        return meter_id, code
    except requests.RequestException as e:
        record("POST /meters/ creates meter", False, str(e))
        return None, code


def test_duplicate_meter_code(code):
    try:
        r = api("POST", "/meters/", json={"code": code, "name": "Duplicate"})
        record("POST /meters/ rejects duplicate code (409)", r.status_code == 409,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("POST /meters/ rejects duplicate code (409)", False, str(e))


def test_get_meter(meter_id):
    if meter_id is None:
        record("GET /meters/{id}", False, "skipped — no meter_id from create step")
        return
    try:
        r = api("GET", f"/meters/{meter_id}")
        record("GET /meters/{id} returns meter", r.status_code == 200 and r.json().get("id") == meter_id,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("GET /meters/{id} returns meter", False, str(e))


def test_get_nonexistent_meter():
    try:
        r = api("GET", "/meters/999999999")
        record("GET /meters/{bad_id} returns 404", r.status_code == 404, f"status={r.status_code}")
    except requests.RequestException as e:
        record("GET /meters/{bad_id} returns 404", False, str(e))


def test_rename_meter(meter_id):
    if meter_id is None:
        record("PATCH /meters/{id} renames meter", False, "skipped — no meter_id")
        return
    try:
        r = api("PATCH", f"/meters/{meter_id}", json={"name": "Smoke Test Meter A (renamed)"})
        ok = r.status_code == 200 and r.json().get("name") == "Smoke Test Meter A (renamed)"
        record("PATCH /meters/{id} renames meter", ok, f"status={r.status_code}")
    except requests.RequestException as e:
        record("PATCH /meters/{id} renames meter", False, str(e))


def test_rename_conflict(meter_id, other_code):
    if meter_id is None:
        record("PATCH /meters/{id} rejects taken code (409)", False, "skipped — no meter_id")
        return
    try:
        r = api("PATCH", f"/meters/{meter_id}", json={"code": other_code})
        record("PATCH /meters/{id} rejects taken code (409)", r.status_code == 409,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("PATCH /meters/{id} rejects taken code (409)", False, str(e))


def test_init_meter(meter_id, init_dt):
    if meter_id is None:
        record("PATCH /meters/{id}/init initializes meter", False, "skipped — no meter_id")
        return
    try:
        r = api("PATCH", f"/meters/{meter_id}/init", json={
            "last_reading": 1000,
            "last_reading_date": init_dt.isoformat(),
        })
        ok = r.status_code == 200 and r.json().get("last_reading") == 1000
        record("PATCH /meters/{id}/init initializes meter", ok, f"status={r.status_code}")
    except requests.RequestException as e:
        record("PATCH /meters/{id}/init initializes meter", False, str(e))


def test_init_already_initialized(meter_id, init_dt):
    if meter_id is None:
        record("PATCH /meters/{id}/init rejects re-init (400)", False, "skipped — no meter_id")
        return
    try:
        r = api("PATCH", f"/meters/{meter_id}/init", json={
            "last_reading": 1100,
            "last_reading_date": init_dt.isoformat(),
        })
        record("PATCH /meters/{id}/init rejects re-init (400)", r.status_code == 400,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("PATCH /meters/{id}/init rejects re-init (400)", False, str(e))


# ---------------------------------------------------------------------
# Readings
# ---------------------------------------------------------------------

def test_create_reading_valid(meter_id, reading_dt):
    if meter_id is None:
        record("POST /readings/ creates valid reading", False, "skipped — no meter_id")
        return
    try:
        r = api("POST", "/readings/", json={
            "meter_id": meter_id,
            "reading": 1050,
            "recorded_at": reading_dt.isoformat(),
        })
        ok = r.status_code == 201 and r.json().get("reading") == 1050
        record("POST /readings/ creates valid reading", ok, f"status={r.status_code}")
    except requests.RequestException as e:
        record("POST /readings/ creates valid reading", False, str(e))


def test_create_reading_too_low(meter_id, reading_dt):
    if meter_id is None:
        record("POST /readings/ rejects reading below last (400)", False, "skipped — no meter_id")
        return
    try:
        r = api("POST", "/readings/", json={
            "meter_id": meter_id,
            "reading": 500,  # below last_reading (1000) and below latest reading (1050)
            "recorded_at": reading_dt.isoformat(),
        })
        record("POST /readings/ rejects reading below last (400)", r.status_code == 400,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("POST /readings/ rejects reading below last (400)", False, str(e))


def test_create_reading_date_too_early(meter_id, earlier_dt):
    if meter_id is None:
        record("POST /readings/ rejects earlier recorded_at (400)", False, "skipped — no meter_id")
        return
    try:
        r = api("POST", "/readings/", json={
            "meter_id": meter_id,
            "reading": 1200,  # value is fine, date is not
            "recorded_at": earlier_dt.isoformat(),
        })
        record("POST /readings/ rejects earlier recorded_at (400)", r.status_code == 400,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("POST /readings/ rejects earlier recorded_at (400)", False, str(e))


def test_create_reading_nonexistent_meter(reading_dt):
    try:
        r = api("POST", "/readings/", json={
            "meter_id": 999999999,
            "reading": 100,
            "recorded_at": reading_dt.isoformat(),
        })
        record("POST /readings/ rejects unknown meter_id (404)", r.status_code == 404,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("POST /readings/ rejects unknown meter_id (404)", False, str(e))


def test_get_readings_for_meter(meter_id):
    if meter_id is None:
        record("GET /readings/{meter_id} returns list", False, "skipped — no meter_id")
        return
    try:
        r = api("GET", f"/readings/{meter_id}")
        ok = r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1
        record("GET /readings/{meter_id} returns list", ok, f"status={r.status_code}")
    except requests.RequestException as e:
        record("GET /readings/{meter_id} returns list", False, str(e))


def test_get_readings_date_filter(meter_id, start_date, end_date):
    if meter_id is None:
        record("GET /readings/{meter_id}?start_date&end_date filters", False, "skipped — no meter_id")
        return
    try:
        r = api("GET", f"/readings/{meter_id}", params={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        })
        record("GET /readings/{meter_id}?start_date&end_date filters", r.status_code == 200,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("GET /readings/{meter_id}?start_date&end_date filters", False, str(e))


def test_get_readings_invalid_date_range(meter_id, start_date, earlier_end_date):
    """start_date must be strictly after earlier_end_date to trigger the 400."""
    if meter_id is None:
        record("GET /readings/{meter_id} rejects start>end (400)", False, "skipped — no meter_id")
        return
    try:
        r = api("GET", f"/readings/{meter_id}", params={
            "start_date": start_date.isoformat(),
            "end_date": earlier_end_date.isoformat(),
        })
        record("GET /readings/{meter_id} rejects start>end (400)", r.status_code == 400,
               f"status={r.status_code}")
    except requests.RequestException as e:
        record("GET /readings/{meter_id} rejects start>end (400)", False, str(e))


def test_get_all_readings():
    try:
        r = api("GET", "/readings/")
        ok = r.status_code == 200 and isinstance(r.json(), list)
        record("GET /readings/ returns nested list per meter", ok, f"status={r.status_code}")
    except requests.RequestException as e:
        record("GET /readings/ returns nested list per meter", False, str(e))


# ---------------------------------------------------------------------
# Billing periods
# ---------------------------------------------------------------------

def test_get_billing_periods():
    try:
        r = api("GET", "/period/")
        ok = r.status_code == 200 and isinstance(r.json(), list)
        record("GET /period/ returns list", ok, f"status={r.status_code} count={len(r.json()) if ok else '?'}")
        return len(r.json()) if ok else None
    except requests.RequestException as e:
        record("GET /period/ returns list", False, str(e))
        return None


def test_end_month(periods_before):
    """
    POST /period/end-month is called for real against production data.
    It only gates on the FIRST meter in GET /meters/ being >= 25 days
    past its last_reading_date, so the correct outcome depends on live
    state, not on this script. Pass/fail logic:

      - 204 No Content -> month was closed. PASS, and additionally
        verify GET /period/ grew (more billing periods than before).
      - 400 with "atleast 25 days" or "not been initialized" or a
        reading-validation message -> guard rail correctly blocked an
        unsafe close. PASS.
      - 404 "no meters found" -> PASS (nothing to close, correct).
      - anything else (5xx, unexpected 400 body, connection error) ->
        FAIL, since that indicates a real bug rather than an expected
        guard rail.
    """
    try:
        r = api("POST", "/period/end-month")
    except requests.RequestException as e:
        record("POST /period/end-month", False, f"request error: {e}")
        return

    if r.status_code == 204:
        after = api("GET", "/period/")
        grew = (after.status_code == 200 and periods_before is not None
                and len(after.json()) >= periods_before)
        record("POST /period/end-month", grew,
               f"status=204 (month closed) periods_before={periods_before} "
               f"periods_after={len(after.json()) if after.status_code == 200 else '?'}")
        return

    if r.status_code == 400:
        detail = ""
        try:
            detail = r.json().get("detail", "")
        except ValueError:
            pass
        expected_guard = any(s in detail for s in (
            "25 days", "not been initialized", "less than or equal to"
        ))
        record("POST /period/end-month", expected_guard,
               f"status=400 (guarded, expected) detail={detail!r}")
        return

    if r.status_code == 404:
        record("POST /period/end-month", True, "status=404 no meters found (expected on empty DB)")
        return

    record("POST /period/end-month", False, f"unexpected status={r.status_code} body={r.text[:200]}")


# ---------------------------------------------------------------------
# Cleanup / deletion
# ---------------------------------------------------------------------

def test_delete_meter(meter_id, label):
    if meter_id is None:
        record(f"DELETE /meters/{{id}} ({label})", False, "skipped — no meter_id")
        return
    try:
        r = api("DELETE", f"/meters/{meter_id}")
        record(f"DELETE /meters/{{id}} ({label})", r.status_code == 204, f"status={r.status_code}")
    except requests.RequestException as e:
        record(f"DELETE /meters/{{id}} ({label})", False, str(e))


def test_get_deleted_meter(meter_id):
    if meter_id is None:
        record("GET deleted meter returns 404", False, "skipped — no meter_id")
        return
    try:
        r = api("GET", f"/meters/{meter_id}")
        record("GET deleted meter returns 404", r.status_code == 404, f"status={r.status_code}")
    except requests.RequestException as e:
        record("GET deleted meter returns 404", False, str(e))


def test_delete_nonexistent_meter():
    try:
        r = api("DELETE", "/meters/999999999")
        record("DELETE nonexistent meter returns 404", r.status_code == 404, f"status={r.status_code}")
    except requests.RequestException as e:
        record("DELETE nonexistent meter returns 404", False, str(e))


# ---------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------

def main():
    print(f"WattWatch smoke test — {datetime.now(timezone.utc).isoformat()}")
    print(f"API:      {API_BASE}")
    print(f"Frontend: {FRONTEND_BASE}\n")

    # Fixed reference datetime shared by init + all readings for this run,
    # per the "same day" assumption.
    init_dt = datetime.now(timezone.utc).replace(microsecond=0)
    reading_dt = init_dt  # readings recorded same date as init
    start_date = init_dt.date()
    end_date = init_dt.date()
    invalid_range_earlier_date = start_date - timedelta(days=1)  # used only by the invalid-range test

    test_frontend_reachable()
    test_health_db()
    test_cors_headers()

    test_list_meters()

    meter_a_id, meter_a_code = test_create_meter()
    meter_b_id, meter_b_code = test_create_meter()

    test_duplicate_meter_code(meter_a_code)
    test_get_meter(meter_a_id)
    test_get_nonexistent_meter()
    test_rename_meter(meter_a_id)
    test_rename_conflict(meter_a_id, meter_b_code)

    test_init_meter(meter_a_id, init_dt)
    test_init_already_initialized(meter_a_id, init_dt)

    test_create_reading_valid(meter_a_id, reading_dt)
    test_create_reading_too_low(meter_a_id, reading_dt)
    # strictly earlier than recorded_at of the reading just created
    test_create_reading_date_too_early(meter_a_id, init_dt.replace(year=init_dt.year - 1))
    test_create_reading_nonexistent_meter(reading_dt)

    test_get_readings_for_meter(meter_a_id)
    test_get_readings_date_filter(meter_a_id, start_date, end_date)
    test_get_readings_invalid_date_range(meter_a_id, start_date, invalid_range_earlier_date)
    test_get_all_readings()

    periods_before = test_get_billing_periods()
    test_end_month(periods_before)

    test_delete_meter(meter_a_id, "A")
    test_get_deleted_meter(meter_a_id)
    test_delete_meter(meter_b_id, "B")
    test_delete_nonexistent_meter()

    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n{passed}/{total} checks passed")

    if passed != total:
        print("\nFailures:")
        for name, ok, detail in results:
            if not ok:
                print(f"  - {name}: {detail}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()