# Automated Channel Liquidity Manager

A Python daemon that connects to an LND Lightning node, scores every open channel's balance ratio, and automatically executes circular payments to push channels back toward 50/50. It logs every decision to SQLite and optionally ships metrics to InfluxDB + Grafana.

## Prerequisites

- **Python 3.10+**
- **Polar** (lightningpolar.com) — full multi-node Lightning network on your laptop
- **Docker Desktop** (required by Polar)

## Dev environment: Polar

1. Download [Polar](https://lightningpolar.com), install Docker Desktop.
2. **Create network**: New Network → name it "Rebalancer Test".
3. **Add 3 LND nodes**: Alice, Bob, Carol.
4. **Start the network**.
5. **Open channels**:
   - Alice → Bob: 1,000,000 sats
   - Bob → Carol: 800,000 sats
   - Carol → Alice: 600,000 sats
6. **Imbalance**: In Polar’s Send UI, send 700,000 sats through Alice → Bob. Alice then has 300k local / 700k remote (critically imbalanced); the rebalancer will fix this.
7. **Connect details**: In the node’s **Connect** tab, note:
   - REST port (e.g. 8081 for Alice)
   - Path to `tls.cert`
   - Path to `admin.macaroon` (e.g. under `data/chain/bitcoin/regtest/`)

## Verify LND connection

```bash
# Macaroon as hex (use your actual path)
xxd -p -c 256 ~/.polar/networks/1/volumes/lnd/alice/data/chain/bitcoin/regtest/admin.macaroon

# Test REST (replace HEX_HERE with the hex from above, and port if different)
curl -k --header "Grpc-Metadata-macaroon: HEX_HERE" \
  https://localhost:8081/v1/getinfo | python3 -m json.tool
```

## Install and run

```bash
cd channel-liquidity-manager
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set LND_REST_URL, LND_TLS_CERT_PATH, LND_MACAROON_PATH to your Polar paths.
# For Polar dev, you can leave LND_TLS_CERT_PATH unset (or empty) to skip TLS verify.
python scheduler.py
```

The daemon runs two jobs:

- **Rebalance**: every 10 minutes — scores channels, runs circular payments for the top 5 imbalanced (max 500 ppm fee).
- **Snapshot**: every 5 minutes — writes channel state to SQLite (and optionally InfluxDB).

Logs go to stdout and `rebalancer.log`. Events and snapshots are stored in `rebalancer.db`.

## Optional: Read-only API (SPARK BTC dashboard)

To feed the web dashboard with live metrics:

```bash
# In another terminal, from channel-liquidity-manager/
python api_server.py
```

Serves `http://localhost:5000`: `/health`, `/api/config`, `/api/status`, `/api/snapshots/latest`, `/api/rebalances/recent`, `/api/report?period=day|week`. Report returns JSON (markdown + summary) or raw Markdown with `?format=md`. Set `REBALANCER_DB_PATH` if the DB is elsewhere (scheduler and API both use it). Set `REBALANCER_API_URL=http://localhost:5000` in the web app `.env` to enable the live status strip and dashboard.

## Optional: InfluxDB + Grafana

1. Start the stack:

   ```bash
   docker-compose up -d
   ```

2. In `.env`, set (values match `docker-compose` init):

   ```env
   INFLUXDB_URL=http://localhost:8086
   INFLUXDB_TOKEN=mytoken123
   INFLUXDB_ORG=lightning
   INFLUXDB_BUCKET=channels
   ```

3. Restart the daemon so it pushes metrics.

4. In **Grafana** (http://localhost:3000, login `admin` / `admin`):
   - Add **InfluxDB** data source: URL `http://influxdb:8086`, token `mytoken123`, org `lightning` (or use `http://host.docker.internal:8086` if Grafana runs in Docker and InfluxDB on host).
   - Create a panel with a **Flux** query for channel ratio over time:

   ```flux
   from(bucket:"channels")
     |> range(start: -6h)
     |> filter(fn:(r) => r._measurement == "channel_health" and r._field == "ratio")
     |> group(columns:["alias"])
   ```

You can add more panels (e.g. rebalance events, fee_ppm, success rate) using the `rebalance` measurement and fields `amount_sats`, `fee_sats`, `fee_ppm`, `success`.

## Configuration

| Env | Required | Description |
|-----|----------|-------------|
| `LND_REST_URL` | Yes | e.g. `https://localhost:8081` |
| `LND_TLS_CERT_PATH` | No | Path to `tls.cert`; leave unset to skip verify (dev only) |
| `LND_MACAROON_PATH` | Yes | Path to `admin.macaroon` |
| `REBALANCER_DB_PATH` | No | SQLite path (default `rebalancer.db`); used by scheduler and API |
| `TARGET_RATIO_LOW` | No | Healthy band lower bound (default `0.40`) |
| `TARGET_RATIO_HIGH` | No | Healthy band upper bound (default `0.60`); e.g. 0.45–0.55 for tighter band |
| `ALERT_LEVEL` | No | `critical`, `warning`, or `off` (default `critical`) |
| `ALERT_WEBHOOK_URL` | No | Discord (or Telegram bridge) webhook URL for alerts |
| `ALERT_EMAIL_API_KEY` | No | SendGrid API key for email alerts (optional) |
| `ALERT_EMAIL_FROM` | No | From address for email alerts |
| `ALERT_EMAIL_TO` | No | To address for email alerts |
| `INFLUXDB_URL` | No | e.g. `http://localhost:8086` |
| `INFLUXDB_TOKEN` | No | InfluxDB 2.x token |
| `INFLUXDB_ORG` | No | Default `lightning` |
| `INFLUXDB_BUCKET` | No | Default `channels` |

For production, set `LND_TLS_CERT_PATH` to your real cert and do not disable TLS verify.

## Fee limit

Rebalancer caps routing fee at **500 ppm** (e.g. 1M sats at 200 ppm ≈ 200 sats). You can change `MAX_FEE_PPM` in `rebalancer.py` if needed.
