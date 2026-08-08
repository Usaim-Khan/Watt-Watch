# Electricity Meter Tracking — Database Design

## Overview

Three tables track individual meters, every reading ever taken, and the
consumption summary for each billing period. `readings` is an append-only,
continuous log of every value a meter has ever displayed — including the
readings that happen to mark the start/end of a billing period. `billing_period`
stores a derived summary snapshot for fast queries and audit purposes.

---

## Tables

### `meters`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | Surrogate key |
| `meter_code` | TEXT, UNIQUE | Physical code printed on the meter |
| `name` | TEXT | Human-friendly label (e.g. "1st Floor", "Water") |
| `last_reset_reading` | NUMERIC(12,2) | Cached copy of the most recent reading — the baseline for the current period |
| `last_reset_at` | TIMESTAMPTZ | Timestamp of that baseline reading |

> `last_reset_reading` / `last_reset_at` are a denormalized cache of the
> latest row in `readings` for that meter, kept on `meters` purely so "reset"
> doesn't need a subquery. They should always match the latest `readings`
> row — if they ever drift apart, that's a bug to investigate.

### `readings`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | Surrogate key |
| `meter_id` | BIGINT FK → `meters.id` | |
| `reading` | NUMERIC(12,2) | Raw value shown on the meter |
| `recorded_at` | TIMESTAMPTZ | When the reading was taken |

- Append-only. Every "Add reading" action inserts here.
- On "Reset," the input reading is **also** inserted here as a normal row —
  it is both a regular reading and (retroactively) the closing value of the
  period. Nothing on the row itself flags it as special; that's determined
  by cross-referencing `billing_period`.
- This makes `readings` the single, complete, chartable timeline for a
  meter — no need to union with any other table to plot trend data.

### `billing_period`

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | Surrogate key |
| `meter_id` | BIGINT FK → `meters.id` | |
| `start_date` | TIMESTAMPTZ | Start of the billing period (= previous reset's date) |
| `end_date` | TIMESTAMPTZ | End of the billing period (= this reset's date) |
| `start_reading` | NUMERIC(12,2) | Meter value at period start |
| `end_reading` | NUMERIC(12,2) | Meter value at period end |
| `units_consumed` | NUMERIC(12,2) | `end_reading - start_reading` |

- One row per meter per reset. Written once, at reset time, and not
  expected to change (aside from manual corrections).
- Intentionally redundant with `readings` (both store `end_reading`) —
  this is a deliberate snapshot for billing/audit history, not a
  normalization gap.

---

## Operational Flow

**Add reading**
1. Insert a row into `readings` (`meter_id`, `reading`, `recorded_at`).
2. Nothing else changes.

**Reset** (run per meter, typically for all meters at once)
1. Take the user-input reading.
2. Insert it into `readings` as a normal row.
3. Compute `units_consumed = input_reading - meters.last_reset_reading`.
4. Insert a row into `billing_period`:
   - `start_date` = `meters.last_reset_at`, `end_date` = now
   - `start_reading` = `meters.last_reset_reading`, `end_reading` = input
   - `units_consumed` as computed
5. Update `meters.last_reset_reading` = input, `meters.last_reset_at` = now.

Steps 2–5 should run in a single transaction.

---

## Known Trade-offs (accepted by design)

- **No explicit "is this a reset reading?" flag on `readings`.** Determining
  whether a given reading closed a billing period requires a lookup against
  `billing_period` rather than a flag check. Chosen deliberately to keep the
  schema simpler.
- **No batch grouping for multi-meter resets.** If all meters are reset in
  the same session, there's no shared identifier tying those `billing_period`
  rows together as one event.

- **Validation (e.g. "new reading shouldn't be lower than the last one")**
  is handled at the application layer, checking both `readings` and
  `meters.last_reset_reading` as needed — not enforced via DB constraints.

## Not Yet Addressed (flagged for future discussion)

- Correcting a past reading that's already been rolled into a `billing_period`
- Multi-user / multi-property ownership
