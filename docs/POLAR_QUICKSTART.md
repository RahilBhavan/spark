# SPARK BTC in 5 Minutes (Polar)

Get SPARK BTC rebalancing on a local Lightning network using [Polar](https://lightningpolar.com).

## Prerequisites

- [Polar](https://lightningpolar.com) installed
- Docker Desktop (required by Polar)
- Python 3.10+

## 1. Create a Polar network

1. Open Polar → **New Network**.
2. Name it (e.g. "SPARK Test").
3. Add at least 3 LND nodes (e.g. Alice, Bob, Carol).
4. Start the network.

## 2. Open channels

Create a small topology so rebalancing has routes:

- Alice → Bob: e.g. 1,000,000 sats
- Bob → Carol: e.g. 800,000 sats
- Carol → Alice: e.g. 600,000 sats

Use Polar’s channel UI to open these.

## 3. (Optional) Imbalance a channel

To see the rebalancer act: in Polar’s Send UI, send a large amount (e.g. 700,000 sats) through Alice → Bob. Alice’s side of the channel becomes low on local balance; the daemon will try to rebalance it.

## 4. Get LND connection details

In Polar, select the node you want SPARK BTC to manage (e.g. **Alice**). Open the **Connect** tab and note:

- **REST** port (e.g. `8081`)
- Path to **TLS cert** (e.g. `~/.polar/networks/1/volumes/lnd/alice/tls.cert`)
- Path to **admin macaroon** (e.g. `~/.polar/networks/1/volumes/lnd/alice/data/chain/bitcoin/regtest/admin.macaroon`)

## 5. Set environment and run

```bash
cd channel-liquidity-manager
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:

```env
LND_REST_URL=https://localhost:8081
LND_TLS_CERT_PATH=
LND_MACAROON_PATH=/path/to/admin.macaroon
```

For Polar on regtest you can leave `LND_TLS_CERT_PATH` empty to skip TLS verify.

Run the daemon:

```bash
python scheduler.py
```

Logs go to stdout and `rebalancer.log`. Snapshots every 5 minutes, rebalance every 10.

## 6. Optional: API + web dashboard

In a second terminal:

```bash
cd channel-liquidity-manager
python api_server.py
```

In a third terminal (from repo root):

```bash
cd web
cp .env.example .env
```

Add to `web/.env`:

```env
REBALANCER_API_URL=http://localhost:5000
```

Then:

```bash
bun run dev
```

Open http://localhost:3000 and use **Dashboard** to see channels and recent rebalances.

## Summary

| Step | Command / action |
|------|------------------|
| 1–3 | Polar: create network, open channels, optionally imbalance |
| 4 | Polar Connect tab: note REST port, tls.cert, admin.macaroon |
| 5 | `cp .env.example .env`, set LND_* in `channel-liquidity-manager/.env`, `python scheduler.py` |
| 6 | (Optional) `python api_server.py`, set `REBALANCER_API_URL` in `web/.env`, `bun run dev` |

You now have SPARK BTC scoring channels and running circular rebalances on Polar.

## Optional: Docker

From the repo root, you can run the scheduler and API in Docker:

```bash
cp channel-liquidity-manager/.env.example channel-liquidity-manager/.env
# Edit .env with LND_*; for Polar on host use LND_REST_URL=http://host.docker.internal:8081
docker compose up -d
```

API is at http://localhost:5000. Set `REBALANCER_API_URL=http://localhost:5000` in `web/.env` and run the web app locally (`cd web && bun run dev`) to use the dashboard.
