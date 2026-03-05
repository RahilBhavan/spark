# Multi-Node / Multi-LND Design (Future)

SPARK BTC currently runs against a single LND instance. Multi-node support would allow one dashboard and (optionally) one scheduler process to manage multiple nodes.

## Goals

- Single dashboard showing channels and rebalance activity per node.
- Per-node configuration: `LND_REST_URL`, `LND_MACAROON_PATH`, `LND_TLS_CERT_PATH`.
- Option A: One scheduler process per node (multiple processes, each with its own env or config file); dashboard aggregates by reading multiple API instances or a single API that multiplexes.
- Option B: One scheduler process with a worker per node; shared DB with a `node_id` column in `events` and `snapshots`; API and web filter/select by node.

## Required Changes

1. **Database**
   - Add `node_id` (or `node_name`) to `events` and `snapshots`.
   - Migrations or new tables for existing deployments.

2. **Config**
   - Env or config file (e.g. YAML/JSON) listing nodes:
     - `node_id`, `LND_REST_URL`, `LND_MACAROON_PATH`, `LND_TLS_CERT_PATH`.
   - Scheduler and analyzer/rebalancer keyed by `node_id` (e.g. pass node config into `get_all_scores` / `run_cycle`).

3. **API**
   - All snapshot/event endpoints accept `?node=default|node2` (or path segment).
   - `/api/status` returns per-node or aggregated summary when multiple nodes are configured.

4. **Web**
   - Dashboard: node selector (dropdown or tabs); table and recent-events list filtered by selected node.

## Recommendation

Treat as a dedicated follow-on after Phase 1–2 are stable. Option A (one process per node, dashboard aggregates) avoids shared-state complexity and matches “one .env per node” today; Option B reduces operational surface but requires careful concurrency and config loading.
