# SPARK BTC — Project Evaluation & Stripe Interview Expansion Plan

**Purpose:** Honest assessment of the project’s current state and concrete steps to make it world-class and interview-ready for Stripe (payments/infra/reliability focus).

---

## 1. Current State Summary

### What’s Strong

| Area | What you have |
|------|----------------|
| **Domain** | Real financial/operational system: Lightning channel liquidity, rebalancing, fee limits. Directly adjacent to payments and money movement. |
| **Full stack** | Python daemon (LND client, scoring, circular rebalance) + SQLite + optional InfluxDB + Flask API + Next.js 16 (React 19) dashboard. |
| **Product thinking** | Clear value prop: “score channels, rebalance automatically, track health.” Configurable target band, simulator with shareable URLs (nuqs), live status strip. |
| **Ops-friendly** | Docker Compose for scheduler + API, env-based config, optional alerts (webhook + email), optional Grafana. Report (Markdown) endpoint. |
| **Code quality** | Modular Python (analyzer, rebalancer, lnd_client, config, notifier, metrics), typed API payloads in Next.js, clean separation between API proxy routes and UI. |

### Gaps That Matter for “World Class” and Stripe

| Gap | Why it matters |
|-----|----------------|
| **No automated tests** | Stripe cares about reliability and correctness. No unit tests (Python or TS) or integration tests means you can’t demonstrate “we don’t ship without verification.” |
| **No CI/CD** | No GitHub Actions (or similar): no lint/test on PR, no build/deploy pipeline. Hard to talk about “how we ship safely.” |
| **API surface** | Flask API is fine but: no OpenAPI/schema, no request validation (e.g. query params), no rate limiting or explicit error contract. For Stripe, API design and consistency matter. |
| **Observability** | InfluxDB/Grafana optional; no structured logging, no tracing, no SLO-style metrics. For infra/reliability roles, “how do you know it’s healthy?” is central. |
| **Security** | Macaroon path and TLS from env; no secrets management story, no audit logging for rebalance decisions. For payments-adjacent systems, security narrative matters. |
| **Scale / multi-node** | Single-node only. Multi-node design is documented but not implemented. Limits “systems” discussion. |
| **Documentation** | README and EXPANSION.md are good; no single “architecture” doc, no runbook, no explicit API docs. |

---

## 2. How to Expand for a World-Class, Stripe-Ready Project

### Tier 1 — Foundation (Do First)

These show you care about reliability, correctness, and shipping discipline.

1. **Tests**
   - **Python:** `pytest` for `analyzer` (score_channel, health/direction bands, edge cases), `rebalancer` (amount/fee math, mock LND), `config` (env parsing). At least one integration test that uses a real SQLite DB and the API (e.g. `api_server` routes).
   - **Frontend:** Vitest + React Testing Library for: StatusStrip (with mocked fetch), RebalanceSimulator (grade math, URL state), dashboard table with mock data. One E2E (Playwright) for “landing → dashboard → see table.”
   - **Outcome:** You can say “every change is covered by tests and CI runs them.”

2. **CI**
   - GitHub Actions: lint (Ruff for Python, ESLint for TS), run Python tests, run frontend tests, build Next.js. Optionally: run API + Next.js in CI and hit `/api/status` and `/health`.
   - **Outcome:** “We run lint and tests on every PR; main is always green.”

3. **API contract and errors**
   - Add a small OpenAPI (or at least a single `openapi.yaml`) describing `/api/status`, `/api/config`, `/api/snapshots/latest`, `/api/rebalances/recent`, `/health`. Use consistent JSON error shape (e.g. `{ "error": "code", "message": "..." }`) on 4xx/5xx.
   - **Outcome:** “We have a documented, consistent API and error contract.”

4. **Structured logging and one SLO-style metric**
   - Python: JSON logs (e.g. `structlog` or stdlib JSONFormatter) with `timestamp`, `level`, `event`, `chan_id` where relevant. Add one “rebalance success rate over last 24h” (or “snapshots written per hour”) and expose it in `/api/status` or a `/api/metrics` endpoint.
   - **Outcome:** “We log in a parseable way and track one clear reliability metric.”

### Tier 2 — Differentiation

These make the project memorable and align with Stripe’s product/infra mindset.

5. **Idempotency and safety**
   - Add idempotency for rebalance decisions: e.g. “same channel + same 10-min window + same target amount” → skip or dedupe. Store idempotency key in DB and document it. Shows you think about “payments-like” behavior (no double rebalance).

6. **Fee and “cost of imbalance” narrative**
   - Implement the “cost of not rebalancing” idea from EXPANSION.md: in analyzer or a small module, compute a simple heuristic (e.g. extra fee per forward when ratio is bad) and expose in `/api/config` (you already have `estimated_extra_cost_per_forward_sats`). In the dashboard, show “Est. fee to rebalance vs. est. extra cost if you don’t” so the value is in sats.

7. **Dashboard polish**
   - Auto-refresh (e.g. every 60s) for dashboard data; loading/error states on all API calls; empty states with clear CTAs. Optional: sparkline for “ratio over time” for one channel (if you add a simple time-series query to the API). Makes the product feel finished.

8. **Runbook and architecture doc**
   - One `docs/ARCHITECTURE.md`: components (scheduler, API, web, DB, optional InfluxDB), data flow, env vars. One `docs/RUNBOOK.md`: how to deploy, how to check health, what to do when rebalances fail or API is down. Shows operational maturity.

### Tier 3 — “Stripe-Level” Talking Points

9. **Multi-node (MVP)**
   - Implement Option A from MULTI_NODE_DESIGN: second config (e.g. `LND_REST_URL_2`, `LND_MACAROON_PATH_2`) and a second scheduler process (or same code, two envs). API reads from two DBs or one DB with `node_id`. Dashboard: node selector and filter by node. You can then discuss “how would you scale to many nodes?” (queue, worker pool, etc.).

10. **Secrets and audit**
    - Don’t store macaroon in plain env in a doc; add a short “Production” section: use a secrets manager (e.g. Doppler, Vault, or cloud secret) and inject at runtime. Log rebalance decisions (channel, amount, max_fee, result) to a dedicated `audit` table or append-only log. Gives you a clear “security and audit” story.

11. **Rate limiting and backoff**
    - In the rebalancer: exponential backoff when LND returns errors (e.g. 429 or connection errors). In the API: simple rate limit (e.g. 60 req/min per IP) for `/api/*` so you can talk about “protecting the system under load.”

---

## 3. Suggested Order and Time Allocation

| Phase | Focus | Rough time |
|-------|--------|------------|
| **1** | Tests (Python + TS) + CI | 1–2 days |
| **2** | API contract (OpenAPI + error shape) + structured logging + one SLO metric | 0.5–1 day |
| **3** | Idempotency + fee/cost narrative + dashboard polish | 1 day |
| **4** | ARCHITECTURE.md + RUNBOOK.md | 0.5 day |
| **5** | Multi-node MVP or secrets/audit (pick one for depth) | 1 day |

Total: about 4–5 focused days to go from “solid side project” to “world-class, interview-ready.”

---

## 4. How to Use This in a Stripe Interview

- **Reliability:** “We have tests and CI; we log in a structured way and track a rebalance success metric; we have a runbook.”
- **Payments-adjacent:** “The system moves value (rebalances) with fee caps and idempotency; we think about cost of imbalance and double-execution.”
- **API and DX:** “We have an OpenAPI spec and consistent error responses; the dashboard consumes the same API we document.”
- **Scale and ops:** “We designed for multi-node; we use env-based config and optional observability (InfluxDB/Grafana); we’ve thought about secrets and audit.”

Keep the project name and domain (SPARK BTC, Lightning liquidity) front and center—it’s a real, niche problem—and use the expansions above to show you can build reliable, observable, and safe systems that could sit next to payment infrastructure.
