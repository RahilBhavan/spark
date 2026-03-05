"use client";

import { useQueryState, parseAsInteger } from "nuqs";
import { Suspense, useEffect, useState } from "react";

type StatusPayload = {
  channels_n: number;
  last_snapshot_ts: string | null;
  rebalance_count_today: number;
  node_grade: string | null;
  source: string;
};

function StatusStrip() {
  const [status, setStatus] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json())
      .then((data: StatusPayload) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = status?.source === "sqlite";
  const ts = status?.last_snapshot_ts
    ? new Date(status.last_snapshot_ts).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <footer className="border-t border-zinc-800 bg-zinc-950/80 px-6 py-4 font-mono text-xs text-zinc-500">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-2">
        <span>
          <span className="text-zinc-600">CHANNELS.N</span>{" "}
          {live ? status!.channels_n : "—"}
        </span>
        <span>
          <span className="text-zinc-600">LAST.SNAPSHOT</span> {ts}
        </span>
        <span>
          <span className="text-zinc-600">REBAL.TODAY</span>{" "}
          {live ? status!.rebalance_count_today : "—"}
        </span>
        <span>
          <span className="text-zinc-600">NODE.GRADE</span>{" "}
          {live && status!.node_grade ? status!.node_grade : "—"}
        </span>
        <span>
          <span className="text-zinc-600">MAX.PPM</span> 500
        </span>
        <span className="ml-auto text-green-600/90">
          {live ? "Live" : "SPARK BTC"}
        </span>
      </div>
    </footer>
  );
}

function SimulatorFallback() {
  return (
    <section className="border border-zinc-800 bg-zinc-900/40 px-6 py-6">
      <p className="font-mono text-sm text-zinc-500">Loading simulator…</p>
    </section>
  );
}

function gradeFromRatio(ratio: number): string {
  const dev = Math.abs(ratio - 0.5);
  if (dev <= 0.05) return "A";
  if (dev <= 0.1) return "B";
  if (dev <= 0.2) return "C";
  if (dev <= 0.35) return "D";
  return "F";
}

type ConfigPayload = {
  target_ratio_low: number;
  target_ratio_high: number;
  estimated_extra_cost_per_forward_sats?: number;
};

const DEFAULT_CAPACITY = 1_000_000;
const DEFAULT_LOCAL = 300_000;

function RebalanceSimulator() {
  const [capacity, setCapacity] = useQueryState(
    "capacity",
    parseAsInteger.withDefault(DEFAULT_CAPACITY)
  );
  const [localBalance, setLocalBalance] = useQueryState(
    "local",
    parseAsInteger.withDefault(DEFAULT_LOCAL)
  );
  const [config, setConfig] = useState<ConfigPayload | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: ConfigPayload) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  const capacityNum = Math.max(1, capacity ?? DEFAULT_CAPACITY);
  const localNum = Math.max(
    0,
    Math.min(localBalance ?? DEFAULT_LOCAL, capacityNum)
  );
  const ratio = localNum / capacityNum;
  const low = config?.target_ratio_low ?? 0.4;
  const high = config?.target_ratio_high ?? 0.6;
  const targetMid = (low + high) / 2;
  const targetLocal = Math.floor(capacityNum * targetMid);
  const imbalanceSats = Math.abs(localNum - targetLocal);
  const maxFeePpm = 500;
  const rebalanceAmount = Math.min(Math.floor(imbalanceSats * 0.8), 500_000);
  const maxFeeSats = Math.max(
    1,
    Math.floor((rebalanceAmount * maxFeePpm) / 1_000_000)
  );
  const nodeGrade = gradeFromRatio(ratio);
  const withinBand = ratio >= low && ratio <= high;

  return (
    <section className="border border-zinc-800 bg-zinc-900/40 px-6 py-6">
      <p className="mb-2 font-mono text-xs uppercase tracking-wider text-zinc-500">
        /// Simulation Module
      </p>
      <h2 className="mb-4 font-mono text-xl font-semibold text-zinc-100">
        Rebalance Simulator
      </h2>
      <p className="mb-2 max-w-xl text-sm text-zinc-400">
        Enter capacity and local balance. See channel grade (A–F), imbalance,
        and estimated rebalance fee at 500 ppm.
      </p>
      {config && (
        <p className="mb-2 font-mono text-xs text-zinc-500">
          Target band: {Math.round(config.target_ratio_low * 100)}–
          {Math.round(config.target_ratio_high * 100)}% local
        </p>
      )}
      <div className="mb-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(
              typeof window !== "undefined" ? window.location.href : ""
            );
          }}
          className="rounded border border-zinc-600 bg-zinc-800/60 px-3 py-1.5 font-mono text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
        >
          Copy link
        </button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Capacity (sats)
          </label>
          <input
            type="number"
            value={capacity ?? DEFAULT_CAPACITY}
            onChange={(e) =>
              setCapacity(Math.max(1, Number(e.target.value) || 0))
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-[var(--spark)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Local balance (sats)
          </label>
          <input
            type="number"
            value={localBalance ?? DEFAULT_LOCAL}
            onChange={(e) =>
              setLocalBalance(
                Math.max(0, Math.min(Number(e.target.value) || 0, capacityNum))
              )
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-[var(--spark)] focus:outline-none"
          />
        </div>
      </div>
      <div className="mt-6 grid gap-2 font-mono text-sm">
        <p>
          <span className="text-zinc-500">Channel grade:</span>{" "}
          <span
            className={
              nodeGrade === "A" || nodeGrade === "B"
                ? "text-green-400/90"
                : nodeGrade === "C"
                  ? "text-[var(--spark)]"
                  : "text-red-400/90"
            }
          >
            {nodeGrade}
          </span>
          {config && (
            <span className="ml-2 text-zinc-500 text-xs">
              {withinBand ? "(within target band)" : "(outside target band)"}
            </span>
          )}
        </p>
        <p>
          <span className="text-zinc-500">Ratio:</span>{" "}
          <span className="text-zinc-200">{(ratio * 100).toFixed(1)}%</span>
        </p>
        <p>
          <span className="text-zinc-500">Imbalance (sats):</span>{" "}
          <span className="text-zinc-200">
            {imbalanceSats.toLocaleString()}
          </span>
        </p>
        <p>
          <span className="text-zinc-500">Est. rebalance (≈80% of imbalance):</span>{" "}
          <span className="text-zinc-200">
            {rebalanceAmount.toLocaleString()} sats
          </span>
        </p>
        <p>
          <span className="text-zinc-500">Max fee @ 500 ppm (sats):</span>{" "}
          <span className="text-[var(--spark)]">{maxFeeSats}</span>
        </p>
        {config?.estimated_extra_cost_per_forward_sats != null && (
          <p className="mt-2 border-t border-zinc-800 pt-2 text-zinc-400">
            Est. fee to rebalance: <span className="text-zinc-200">{maxFeeSats}</span> sats.
            If you don&apos;t rebalance, typical extra cost per forward:{" "}
            <span className="text-zinc-200">{config.estimated_extra_cost_per_forward_sats}</span> sats (approx).
          </p>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0c0c0c] text-zinc-200">
      <main className="flex-1 px-6 py-16 sm:px-8 md:px-12">
        <div className="mx-auto max-w-5xl">
          {/* Hero */}
          <header className="mb-20 text-center">
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-zinc-500">
              Lightning liquidity ops for Bitcoin
            </p>
            <h1 className="mb-4 font-mono text-4xl font-bold tracking-tight text-white sm:text-5xl">
              <span className="text-[var(--spark)]">SPARK</span>{" "}
              <span className="text-zinc-300">BTC</span>
            </h1>
            <p className="mx-auto max-w-2xl font-mono text-base text-zinc-400 sm:text-lg">
              Operational intelligence for every channel, every rebalance,
              every node.
            </p>
            <p className="mx-auto mt-4 max-w-2xl font-mono text-sm text-zinc-500">
              Score channel balance ratios, run circular rebalances, and track
              health in near real-time. Keep liquidity balanced — pay less, route more.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/dashboard"
                className="inline-block rounded border border-[var(--spark)]/60 bg-[var(--spark)]/10 px-6 py-3 font-mono text-sm text-[var(--spark)] transition hover:border-[var(--spark-muted)] hover:bg-[var(--spark)]/20"
              >
                Dashboard
              </a>
              <a
                href="https://github.com/rahilbhavan/spark/tree/main/channel-liquidity-manager"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded border border-zinc-600 bg-zinc-800/60 px-6 py-3 font-mono text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                Initialize Manager
              </a>
            </div>
          </header>

          {/* Feature sections */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <section className="border border-zinc-800 bg-zinc-900/30 px-5 py-5">
              <h2 className="mb-2 font-mono text-lg font-semibold text-zinc-100">
                Real-Time Channel Health
              </h2>
              <p className="font-mono text-sm text-zinc-400">
                Scores each channel by local/capacity ratio. Healthy 0.40–0.60,
                warning 0.20–0.80, critical outside. Snapshot every 5 minutes.
              </p>
            </section>
            <section className="border border-zinc-800 bg-zinc-900/30 px-5 py-5">
              <h2 className="mb-2 font-mono text-lg font-semibold text-zinc-100">
                Imbalance Analysis
              </h2>
              <p className="font-mono text-sm text-zinc-400">
                Urgency score and direction: depleted outbound (low local), depleted
                inbound (high local). Prioritizes top 5 for rebalance.
              </p>
            </section>
            <section className="border border-zinc-800 bg-zinc-900/30 px-5 py-5 sm:col-span-2 lg:col-span-1">
              <h2 className="mb-2 font-mono text-lg font-semibold text-zinc-100">
                LND Integration
              </h2>
              <p className="font-mono text-sm text-zinc-400">
                Connects to LND REST. Rebalance every 10 min, snapshot every 5.
                Optional InfluxDB + Grafana for time-series.
              </p>
            </section>
          </div>

          {/* Simulator (wrapped in Suspense for nuqs/useSearchParams) */}
          <div className="mt-12">
            <Suspense fallback={<SimulatorFallback />}>
              <RebalanceSimulator />
            </Suspense>
          </div>
        </div>
      </main>

      <StatusStrip />
    </div>
  );
}
