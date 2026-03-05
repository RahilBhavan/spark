# Channel Liquidity / Intelligence — Landing

Yield-style operational intelligence landing page for the [Channel Liquidity Manager](../channel-liquidity-manager/) (Spark project). Single-page dark terminal aesthetic: hero, feature sections, rebalance simulator, status strip.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Bun

## Setup

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `bun dev` — development (Turbopack)
- `bun run build` — production build
- `bun run start` — run production server

## Deploy to Vercel

1. **Import** the repo in [Vercel](https://vercel.com); set **Root Directory** to `web`.
2. **Environment variable** (optional): add `REBALANCER_API_URL` = base URL of your running channel-liquidity-manager API (e.g. `https://your-api.example.com`). If unset, the site still works with fallback stub data.
3. Deploy. The build uses Bun (`bun install`, `next build`).

## Optional (future)

For a later API that reads live metrics from the daemon:

- `REBALANCER_API_URL` — base URL of the Python API (used by `/api/status`, `/api/config`, `/api/snapshots/latest`, `/api/rebalances/recent`).
- `REBALANCER_DB_PATH` — path to `rebalancer.db` (e.g. `../channel-liquidity-manager/rebalancer.db`)
- `INFLUXDB_URL` — InfluxDB base URL if using time-series metrics

The status strip and any “last snapshot” UI can then be wired to an API route that queries SQLite or InfluxDB.
