# SPARK BTC — Runbook

Operational guide: deploy, health checks, and what to do when things fail.

## Deploy

1. **Scheduler (daemon)**  
   From `channel-liquidity-manager/`: install deps (`pip install -r requirements.txt`), set `.env` (LND_*, TARGET_RATIO_*, optional INFLUXDB_*, REBALANCER_DB_PATH). Run:
   ```bash
   python scheduler.py
   ```
   Or use Docker Compose (see README).

2. **API**  
   Same dir or same env for `REBALANCER_DB_PATH`. Run:
   ```bash
   python api_server.py
   ```
   Listens on `PORT` (default 5000).

3. **Web**  
   From `web/`: set `.env` with `REBALANCER_API_URL=http://<api-host>:5000`. Run:
   ```bash
   bun install && bun run build && bun run start
   ```
   Or `bun run dev` for development.

## Health checks

| Check | Command / endpoint | Expected |
|-------|--------------------|----------|
| API liveness | `GET /health` | `{"status":"ok","db_attached":true}` (or `false` if no DB). |
| Dashboard data | `GET /api/status` | `channels_n`, `last_snapshot_ts`, `source: "sqlite"`. |
| SLO | `GET /api/status` | `rebalance_success_rate_24h` (number or null). |

If the dashboard shows “No API” or “Failed to load”, confirm `REBALANCER_API_URL` and that the API process is up and `/health` returns 200.

## Rebalances failing

1. **Check logs**  
   Scheduler: stdout and `rebalancer.log`. Look for “Amount too small”, “No exit channel found”, “Invoice failed”, “Payment failed”, or LND errors.

2. **LND**  
   Verify REST and macaroon (e.g. `curl -k` with macaroon to LND’s `/v1/getinfo`). Confirm channels have liquidity for the requested amount and direction.

3. **Idempotency**  
   Same channel + same 10‑min window + same amount is skipped. If you need to retry the same channel in the same window, that’s by design to avoid double payments.

4. **Failure streak**  
   After 3 consecutive failures (configurable in notifier), the notifier can alert (webhook/email) if configured.

## API down or slow

1. **Process**  
   Restart `api_server.py`. Ensure `REBALANCER_DB_PATH` matches the scheduler’s DB so the API sees the same data.

2. **DB**  
   If `db_attached` is false, the API is up but the DB file is missing or path wrong. Fix `REBALANCER_DB_PATH` and restart.

3. **Structured logs**  
   API uses structlog (JSON). Inspect `method`, `path`, `status` and any `internal_error` events for 5xx.

## Database

- **Path:** `REBALANCER_DB_PATH` (default `rebalancer.db` in cwd).
- **Backup:** Copy the SQLite file while the scheduler/API are idle or use SQLite backup APIs to avoid corruption.
- **Tables:** `events` (rebalance results), `snapshots` (channel state per run), `idempotency` (dedupe keys). Schema created on first run by the scheduler.

## Rate limiting (API)

The API is limited to 60 requests per minute per client IP. `/health` is exempt. If the dashboard or a client receives 429, reduce polling or use the exempt health endpoint for liveness only.

## Optional: InfluxDB / Grafana

If metrics are not appearing in Grafana, check `INFLUXDB_*` in the scheduler’s env and that the daemon can reach InfluxDB. Ensure the bucket and token exist and the scheduler logs show no push errors.
