"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusPayload = {
  channels_n: number;
  last_snapshot_ts: string | null;
  rebalance_count_today: number;
  node_grade: string | null;
  source: string;
  rebalance_success_rate_24h?: number | null;
};

type SnapshotRow = {
  chan_id: string;
  alias: string;
  local_balance: number;
  capacity: number;
  ratio: number;
  health: string;
};

type RebalanceEvent = {
  ts: string;
  chan_id: string;
  amount_sats: number;
  fee_sats: number;
  fee_ppm: number;
  success: number;
  error: string | null;
};

type ConfigPayload = {
  target_ratio_low: number;
  target_ratio_high: number;
  estimated_extra_cost_per_forward_sats?: number | null;
};

function gradeFromRatio(ratio: number): string {
  const dev = Math.abs(ratio - 0.5);
  if (dev <= 0.05) return "A";
  if (dev <= 0.1) return "B";
  if (dev <= 0.2) return "C";
  if (dev <= 0.35) return "D";
  return "F";
}

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [config, setConfig] = useState<ConfigPayload | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [snapshotTs, setSnapshotTs] = useState<string | null>(null);
  const [events, setEvents] = useState<RebalanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<string[]>(["default"]);
  const [selectedNode, setSelectedNode] = useState<string>("default");

  const fetchData = () => {
    setError(null);
    const q = selectedNode && selectedNode !== "default" ? `?node=${encodeURIComponent(selectedNode)}` : "";
    return Promise.all([
      fetch(`/api/nodes`).then((r) => r.json()) as Promise<{ nodes: string[] }>,
      fetch(`/api/status${q}`).then((r) => r.json()) as Promise<StatusPayload>,
      fetch(`/api/config`).then((r) => r.json()) as Promise<ConfigPayload>,
      fetch(`/api/snapshots/latest${q}`).then((r) =>
        r.json()
      ) as Promise<{ snapshots: SnapshotRow[]; ts: string | null }>,
      fetch(`/api/rebalances/recent${q}`).then((r) =>
        r.json()
      ) as Promise<{ events: RebalanceEvent[] }>,
    ])
      .then(([nodesRes, s, cfg, snap, reb]) => {
        setNodes(nodesRes.nodes ?? ["default"]);
        setStatus(s);
        setConfig(cfg);
        setSnapshots(snap.snapshots ?? []);
        setSnapshotTs(snap.ts ?? null);
        setEvents(reb.events ?? []);
      })
      .catch(() => {
        setStatus(null);
        setConfig(null);
        setSnapshots([]);
        setSnapshotTs(null);
        setEvents([]);
        setError("Failed to load dashboard. Check API and try again.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    fetchData().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [selectedNode]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [selectedNode]);

  const chanIdToAlias = new Map(snapshots.map((s) => [s.chan_id, s.alias]));
  const live = status?.source === "sqlite";
  const tsDisplay = snapshotTs
    ? new Date(snapshotTs).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  return (
    <div className="min-h-screen flex flex-col bg-[#0c0c0c] text-zinc-200">
      <main className="flex-1 px-6 py-10 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <Link
                href="/"
                className="font-mono text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
              >
                ← Home
              </Link>
              <h1 className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
                <span className="text-[var(--spark)]">SPARK</span>{" "}
                <span className="text-zinc-300">BTC</span> — Dashboard
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {nodes.length > 1 && (
                <select
                  value={selectedNode}
                  onChange={(e) => setSelectedNode(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-200"
                >
                  {nodes.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
              {config && (
                <>
                  <span className="font-mono text-xs text-zinc-500">
                    Target:{" "}
                    {Math.round(config.target_ratio_low * 100)}–
                    {Math.round(config.target_ratio_high * 100)}%
                  </span>
                  {config.estimated_extra_cost_per_forward_sats != null &&
                    config.estimated_extra_cost_per_forward_sats > 0 && (
                      <span className="font-mono text-xs text-zinc-500">
                        Est. extra cost if you don&apos;t rebalance: ~
                        {config.estimated_extra_cost_per_forward_sats} sats/forward
                      </span>
                    )}
                </>
              )}
              <span
                className={`font-mono text-xs ${
                  live ? "text-green-600/90" : "text-zinc-500"
                }`}
              >
                {live ? "Live" : "No API"}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-center justify-between rounded border border-red-800/60 bg-red-950/30 px-4 py-3 font-mono text-sm text-red-300">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  fetchData();
                }}
                className="shrink-0 rounded border border-red-600/60 px-3 py-1.5 text-red-200 hover:bg-red-900/40"
              >
                Retry
              </button>
            </div>
          )}
          {loading ? (
            <p className="font-mono text-sm text-zinc-500">
              Loading…
            </p>
          ) : (
            <>
              <section className="mb-10">
                <p className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-500">
                  /// Snapshot (right now)
                </p>
                <p className="mb-4 font-mono text-sm text-zinc-400">
                  Last snapshot: {tsDisplay}
                </p>
                <div className="overflow-x-auto border border-zinc-800">
                  <table className="w-full border-collapse font-mono text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60 text-left text-zinc-500">
                        <th className="px-4 py-3">Alias</th>
                        <th className="px-4 py-3">Capacity</th>
                        <th className="px-4 py-3">Ratio</th>
                        <th className="px-4 py-3">Health</th>
                        <th className="px-4 py-3">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-zinc-500"
                          >
                            No channel data. Set REBALANCER_API_URL and run the
                            daemon.
                          </td>
                        </tr>
                      ) : (
                        snapshots.map((row) => {
                          const grade = gradeFromRatio(row.ratio);
                          return (
                            <tr
                              key={row.chan_id}
                              className="border-b border-zinc-800/80 hover:bg-zinc-900/40"
                            >
                              <td className="px-4 py-2 text-zinc-200">
                                {row.alias}
                              </td>
                              <td className="px-4 py-2 text-zinc-300">
                                {row.capacity.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-zinc-300">
                                {(row.ratio * 100).toFixed(1)}%
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={
                                    row.health === "HEALTHY"
                                      ? "text-green-400/90"
                                      : row.health === "WARNING"
                                        ? "text-[var(--spark)]"
                                        : "text-red-400/90"
                                  }
                                >
                                  {row.health}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={
                                    grade === "A" || grade === "B"
                                      ? "text-green-400/90"
                                      : grade === "C"
                                        ? "text-[var(--spark)]"
                                        : "text-red-400/90"
                                  }
                                >
                                  {grade}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <p className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-500">
                  /// Recent rebalances
                </p>
                <div className="border border-zinc-800">
                  {events.length === 0 ? (
                    <p className="px-4 py-8 font-mono text-sm text-zinc-500 text-center">
                      No rebalance events yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-zinc-800">
                      {events.map((ev, i) => (
                        <li
                          key={`${ev.ts}-${ev.chan_id}-${i}`}
                          className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 font-mono text-sm"
                        >
                          <span className="text-zinc-500 shrink-0">
                            {new Date(ev.ts).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                          <span className="text-zinc-300">
                            {chanIdToAlias.get(ev.chan_id) ?? ev.chan_id}
                          </span>
                          <span className="text-zinc-400">
                            {ev.amount_sats.toLocaleString()} sats
                          </span>
                          <span className="text-zinc-400">
                            fee {ev.fee_sats} sats
                          </span>
                          <span
                            className={
                              ev.success ? "text-green-400/90" : "text-red-400/90"
                            }
                          >
                            {ev.success ? "OK" : "Fail"}
                            {ev.error ? ` — ${ev.error}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-zinc-800 bg-zinc-950/80 px-6 py-4 font-mono text-xs text-zinc-500">
        <div className="mx-auto flex max-w-5xl items-center gap-x-8">
          <span>
            <span className="text-zinc-600">CHANNELS.N</span>{" "}
            {live ? status!.channels_n : "—"}
          </span>
          <span>
            <span className="text-zinc-600">REBAL.TODAY</span>{" "}
            {live ? status!.rebalance_count_today : "—"}
          </span>
          <span>
            <span className="text-zinc-600">NODE.GRADE</span>{" "}
            {live && status!.node_grade ? status!.node_grade : "—"}
          </span>
          {live &&
            status!.rebalance_success_rate_24h != null && (
              <span>
                <span className="text-zinc-600">SLO.24H</span>{" "}
                {(status!.rebalance_success_rate_24h * 100).toFixed(1)}%
              </span>
            )}
        </div>
      </footer>
    </div>
  );
}
