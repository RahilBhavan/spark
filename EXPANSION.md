# SPARK BTC — Expansion & Roadmap

SPARK BTC is the product name for this Lightning channel liquidity and operational-intelligence stack. This doc outlines how to expand it so it stands out and stays highly functional.

---

## What’s in place

- **Branding:** SPARK BTC hero, amber accent, metadata.
- **Backend:** LND REST client, channel scoring (HEALTHY/WARNING/CRITICAL), circular rebalancing (10 min), SQLite + optional InfluxDB/Grafana.
- **Optional API:** `api_server.py` exposes `/api/status`, `/api/snapshots/latest`, `/api/rebalances/recent` for the dashboard.
- **Web:** Next.js landing, rebalance simulator (capacity, local balance, channel grade A–F, estimated fee), live status strip when `REBALANCER_API_URL` is set.

---

## Expansions that make it stand out

### 1. **Live dashboard page**

- **Route:** `/dashboard` (or `/app`).
- **Data:** Use `/api/snapshots/latest` and `/api/rebalances/recent` (via Next.js proxy or `REBALANCER_API_URL`).
- **UI:** Table of channels (alias, capacity, ratio, health, grade); list of recent rebalances (time, channel, amount, fee, success/fail); optional sparkline of ratio-over-time if you add a simple time-series endpoint.
- **Differentiator:** Single place to see “right now” state and recent rebalance activity without opening Grafana.

### 2. **Configurable target band (e.g. 45–55%)**

- **Backend:** In `analyzer.py`, make the healthy band configurable (env or config: `TARGET_RATIO_LOW`, `TARGET_RATIO_HIGH`); default 0.40–0.60, option for 0.45–0.55.
- **API:** Expose current target band in `/api/status` or a small `/api/config` so the web can show “Target: 45–55%” and the simulator can mirror it.
- **Differentiator:** Operators can tune how aggressive rebalancing is (tighter band = more rebalances, better liquidity; wider = fewer fees).

### 3. **Alerts (Telegram / Discord / email)**

- **Trigger:** Critical channel (ratio &lt;0.2 or &gt;0.8), or N consecutive rebalance failures for the same channel.
- **Actions:** Send message to Telegram/Discord webhook or email (e.g. SendGrid).
- **Config:** `ALERT_WEBHOOK_URL`, `ALERT_LEVEL=critical|warning|off`.
- **Differentiator:** “SPARK BTC tells you when something needs attention” without needing to watch Grafana.

### 4. **Fee savings / “cost of imbalance” estimate**

- **Concept:** Compare “what you’d pay to rebalance now” vs “what you’re losing by not rebalancing” (e.g. failed forwards, or a simple heuristic: “routing opportunity cost”).
- **Web:** In simulator or dashboard: “Est. fee to rebalance: X sats. If you don’t rebalance, typical extra cost per forward: Y sats (approx).”
- **Differentiator:** Frames the product in sats saved, not just “channel health.”

### 5. **Shareable simulator links (nuqs)**

- **Web:** Put capacity and local balance in URL query (e.g. `?capacity=1000000&local=300000`). Use `nuqs` so sharing the link restores the same inputs.
- **Differentiator:** “Share this link with your co-node operator” to discuss a specific channel scenario.

### 6. **Node “health report” (PDF or markdown)**

- **Backend:** Optional job (e.g. daily) or on-demand script: aggregate snapshots + rebalance events, compute node grade, top imbalanced channels, total fees spent.
- **Output:** Markdown or simple PDF (e.g. WeasyPrint or a Node script). Serve via API or store in a `reports/` folder.
- **Differentiator:** “Weekly SPARK BTC report” for operators who want a summary without opening the app.

### 7. **Multi-node / multi-LND (later)**

- **Concept:** Single dashboard, multiple LND instances (different `LND_REST_URL` + macaroon per node). One scheduler per node or a multi-worker design.
- **Differentiator:** Small teams or node pools manage all nodes from one SPARK BTC instance.

### 8. **Polar one-click / “SPARK BTC in 5 minutes”**

- **Doc or script:** Step-by-step (or script) that: create Polar network → open channels → set env → run scheduler + API + web. Optional `docker-compose` that runs scheduler + api_server + (optionally) web behind a simple reverse proxy.
- **Differentiator:** Fastest path from zero to “see SPARK BTC rebalancing” on regtest.

---

## Suggested order

1. **Short term:** Live dashboard page (1), configurable target band (2), alerts (3). These add the most perceived “product” value.
2. **Next:** Fee savings / cost-of-imbalance (4), shareable simulator (5).
3. **Later:** Node report (6), multi-node (7), Polar one-click (8).

---

## Env / config summary

| Component        | Env / config | Purpose |
|-----------------|--------------|---------|
| Daemon          | `LND_REST_URL`, `LND_MACAROON_PATH`, `LND_TLS_CERT_PATH` | LND connection |
| Daemon          | `REBALANCER_DB_PATH` | SQLite path (default `rebalancer.db`) |
| API server      | `PORT`, `REBALANCER_DB_PATH` | Optional read-only API |
| Web             | `REBALANCER_API_URL` | Base URL of api_server for live status/dashboard |
| (Future)        | `TARGET_RATIO_LOW`, `TARGET_RATIO_HIGH` | Healthy band (e.g. 0.45–0.55) |
| (Future)        | `ALERT_WEBHOOK_URL`, `ALERT_LEVEL` | Alerts (Telegram/Discord) |

---

## Summary

Expanding SPARK BTC around **live visibility** (dashboard, status strip, optional reports), **tunable behavior** (target band, alerts), and **operator-friendly UX** (simulator links, fee impact, one-click Polar) will make it clearly “the” liquidity-ops layer for your Bitcoin/Lightning node and give you a solid base for multi-node or paid features later.
