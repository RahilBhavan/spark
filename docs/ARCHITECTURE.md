# SPARK BTC — Architecture

High-level view of components, data flow, and configuration for the channel liquidity manager and dashboard.

## Components

| Component | Role |
|-----------|------|
| **scheduler** | Python daemon (APScheduler). Runs rebalance job every 10m and snapshot job every 5m. Writes events and snapshots to SQLite; optional InfluxDB and notifier. |
| **api_server** | Flask read-only API. Serves config, status, snapshots, rebalances, health, and report from SQLite/env. Structured JSON logging (structlog). |
| **web** | Next.js 16 app. Landing page, dashboard (snapshots table, recent rebalances), simulator. Proxies `/api/*` to `REBALANCER_API_URL`. |
| **rebalancer** | Circular rebalance logic: scores from analyzer, LND self-invoice + send with max fee 500 ppm. |
| **analyzer** | Channel scoring (ratio, health band, direction DEPLETED_OUTBOUND / DEPLETED_INBOUND), candidate selection. |
| **lnd_client** | LND REST client (gRPC-gateway): getinfo, list channels, add invoice, send payment. |
| **SQLite** | Single DB (`rebalancer.db` by default). Tables: `events`, `snapshots`, `idempotency`. Shared by scheduler and API. |
| **InfluxDB** (optional) | Time-series metrics (snapshots, rebalance results). Used by Grafana. |

## Data flow

1. **Snapshot (every 5m)**  
   `scheduler.snapshot_job()` → `get_all_scores()` (LND + analyzer) → INSERT into `snapshots`. Optionally push to InfluxDB and run notifier (critical channels).

2. **Rebalance (every 10m)**  
   `scheduler.rebalance_job()` → `get_candidates()` → idempotency check (same channel + 10‑min window + amount → skip) → `run_cycle(candidates)` → LND invoice + send → INSERT into `events` and `idempotency`. Optionally InfluxDB and notifier (failure streak).

3. **Dashboard**  
   Browser → Next.js `/api/*` (proxy) → Flask API → SQLite (and env for config). Dashboard shows latest snapshots, recent rebalances, status strip, SLO (rebalance_success_rate_24h).

## Environment variables

| Var | Used by | Purpose |
|-----|---------|--------|
| `REBALANCER_DB_PATH` | scheduler, api_server | Path to SQLite DB (default `rebalancer.db`). |
| `LND_REST_URL` | lnd_client | LND REST base URL. |
| `LND_TLS_CERT_PATH` | lnd_client | TLS cert path; empty to skip verify (e.g. Polar). |
| `LND_MACAROON_PATH` | lnd_client | Path to admin macaroon (or hex in env). |
| `TARGET_RATIO_LOW` / `TARGET_RATIO_HIGH` | config, analyzer | Target band (e.g. 0.40–0.60). |
| `ESTIMATED_EXTRA_COST_PER_FORWARD_SATS` | config | Optional; exposed in API and dashboard for “cost of not rebalancing”. |
| `PORT` | api_server | Flask port (default 5000). |
| `REBALANCER_API_URL` | web | Base URL of Flask API for proxy and live strip. |
| `INFLUXDB_*` | metrics | Optional InfluxDB 2.x URL, token, org, bucket. |

## API contract

- **OpenAPI:** `channel-liquidity-manager/openapi.yaml` describes `/health`, `/api/config`, `/api/status`, `/api/snapshots/latest`, `/api/rebalances/recent`.
- **Errors:** 4xx/5xx return JSON `{ "error": "<code>", "message": "..." }` (e.g. `not_found`, `internal_error`).
- **SLO:** `GET /api/status` includes `rebalance_success_rate_24h` (0–1 or null).

## Idempotency

Rebalance decisions are deduped by `(chan_id, window_ts, amount_sats)` with a 10‑minute UTC window. Table `idempotency` stores keys; scheduler skips candidates already present in the current window and inserts a row after writing an event.

## Rate limiting and resilience

- **API:** Flask-Limiter applies 60 requests/minute per IP by default; `/health` is exempt for liveness checks.
- **Rebalancer:** On LND errors (invoice or send_payment), one retry after 2s backoff before returning failure.
