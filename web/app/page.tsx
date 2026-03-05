"use client";

import { useQueryState, parseAsInteger } from "nuqs";
import { Suspense, useEffect, useState } from "react";
import { MagneticButton } from "./components/magnetic-button";
import { ParallaxSection } from "./components/parallax-section";
import { RevealOnScroll } from "./components/reveal-on-scroll";

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
    <footer
      className="border-t border-zinc-800 bg-zinc-950/80 px-6 py-4 font-mono text-xs text-zinc-500"
      role="status"
      aria-live="polite"
      aria-label="Live node status"
    >
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

const SIM_CAPACITY_ID = "sim-capacity";
const SIM_LOCAL_ID = "sim-local";

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
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: ConfigPayload) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!copyFeedback) return;
    const t = setTimeout(() => setCopyFeedback(false), 2000);
    return () => clearTimeout(t);
  }, [copyFeedback]);

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

  const handleCopyLink = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    void navigator.clipboard.writeText(url).then(() => setCopyFeedback(true));
  };

  return (
    <section
      className="border border-zinc-800 bg-zinc-900/40 px-6 py-6"
      aria-labelledby="simulator-heading"
    >
      <p className="mb-2 font-display text-[length:var(--text-display-label)] font-medium uppercase tracking-widest text-zinc-500">
        /// Simulation Module
      </p>
      <h2 id="simulator-heading" className="mb-4 font-display text-xl font-semibold text-zinc-100 sm:text-2xl">
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
          onClick={handleCopyLink}
          className="min-h-[44px] min-w-[44px] rounded border border-zinc-600 bg-zinc-800/60 px-3 py-2 font-mono text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--spark)]"
          aria-label={copyFeedback ? "Link copied" : "Copy simulator link"}
        >
          {copyFeedback ? "Copied!" : "Copy link"}
        </button>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor={SIM_CAPACITY_ID} className="mb-1 block text-xs text-zinc-500">
            Capacity (sats)
          </label>
          <input
            id={SIM_CAPACITY_ID}
            type="number"
            min={1}
            value={capacity ?? DEFAULT_CAPACITY}
            onChange={(e) =>
              setCapacity(Math.max(1, Number(e.target.value) || 0))
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-[var(--spark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            aria-describedby="sim-target-band"
          />
        </div>
        <div>
          <label htmlFor={SIM_LOCAL_ID} className="mb-1 block text-xs text-zinc-500">
            Local balance (sats)
          </label>
          <input
            id={SIM_LOCAL_ID}
            type="number"
            min={0}
            max={capacityNum}
            value={localBalance ?? DEFAULT_LOCAL}
            onChange={(e) =>
              setLocalBalance(
                Math.max(0, Math.min(Number(e.target.value) || 0, capacityNum))
              )
            }
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-[var(--spark)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--spark)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          />
        </div>
      </div>
      {config && (
        <p id="sim-target-band" className="sr-only">
          Target band: {Math.round(config.target_ratio_low * 100)} to {Math.round(config.target_ratio_high * 100)} percent local
        </p>
      )}
      {/* Ratio bar: 0% — [target band] — 100% with current ratio marker */}
      <div className="mt-6">
        <p className="mb-1.5 font-mono text-xs text-zinc-500">
          Local ratio: <span className="text-zinc-200">{(ratio * 100).toFixed(1)}%</span>
          {config && (
            <span className="ml-2 text-zinc-500">
              {withinBand ? "(within target)" : "(outside target)"}
            </span>
          )}
        </p>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`Local ratio ${(ratio * 100).toFixed(1)} percent. Target band ${Math.round(low * 100)} to ${Math.round(high * 100)} percent.`}>
          <span
            className="absolute inset-y-0 left-0 rounded-l-full bg-zinc-600/80"
            style={{ width: `${low * 100}%` }}
          />
          <span
            className="absolute inset-y-0 rounded-full bg-green-600/40"
            style={{ left: `${low * 100}%`, width: `${(high - low) * 100}%` }}
          />
          <span
            className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-full bg-[var(--spark)]"
            style={{ left: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
          />
        </div>
      </div>
      {/* Results: grade + key metrics in clear hierarchy */}
      <div className="mt-6 rounded border border-zinc-800 bg-zinc-950/60 px-4 py-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs text-zinc-500">Channel grade</span>
          <span
            className={`font-display text-lg font-semibold ${
              nodeGrade === "A" || nodeGrade === "B"
                ? "text-green-400/90"
                : nodeGrade === "C"
                  ? "text-[var(--spark)]"
                  : "text-red-400/90"
            }`}
          >
            {nodeGrade}
          </span>
          {config && (
            <span className="font-mono text-xs text-zinc-500">
              {withinBand ? "within target band" : "outside target band"}
            </span>
          )}
        </div>
        <ul className="grid gap-1.5 font-mono text-sm" role="list">
          <li>
            <span className="text-zinc-500">Imbalance:</span>{" "}
            <span className="text-zinc-200">{imbalanceSats.toLocaleString()} sats</span>
          </li>
          <li>
            <span className="text-zinc-500">Est. rebalance (≈80%):</span>{" "}
            <span className="font-medium text-[var(--spark)]">{rebalanceAmount.toLocaleString()} sats</span>
          </li>
          <li>
            <span className="text-zinc-500">Max fee @ 500 ppm:</span>{" "}
            <span className="font-medium text-[var(--spark)]">{maxFeeSats} sats</span>
          </li>
        </ul>
        {config?.estimated_extra_cost_per_forward_sats != null && (
          <p className="mt-3 border-t border-zinc-800 pt-3 font-mono text-xs text-zinc-400">
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
      <main className="flex-1 px-[10vw] py-24 sm:px-[12vw] md:px-[14vw]">
        <div className="mx-auto max-w-[90rem] relative">
          {/* Hero parallax background — moves slower than scroll */}
          <ParallaxSection
            className="pointer-events-none absolute left-0 top-0 h-[80vh] w-full max-w-[70rem] opacity-30"
            speed={0.5}
          >
            <div
              className="h-full w-full rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(ellipse 60% 50% at 30% 20%, var(--spark) 0%, transparent 55%)",
              }}
            />
          </ParallaxSection>

          {/* Hero — asymmetric: headline dominates left, copy + CTAs right (stack on small) */}
          <RevealOnScroll variant="fade-up" start="top 90%">
            <header className="relative mb-28 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-8">
              <p className="mb-4 font-display text-[length:var(--text-display-label)] font-medium uppercase tracking-[0.2em] text-zinc-500">
                Lightning liquidity ops for Bitcoin
              </p>
              <h1
                className="font-display font-bold tracking-tight text-white"
                style={{ fontSize: "var(--text-display-hero)", lineHeight: "0.95" }}
              >
                <span className="text-[var(--spark)]">SPARK</span>{" "}
                <span className="text-zinc-300">BTC</span>
              </h1>
            </div>
            <div className="flex flex-col justify-end lg:col-span-4 lg:pl-4">
              <p className="font-display text-lg font-light text-zinc-400 sm:text-xl">
                Operational intelligence for every channel, every rebalance,
                every node.
              </p>
              <p className="mt-3 font-mono text-sm font-light text-zinc-500">
                Score channel balance ratios, run circular rebalances, and track
                health in near real-time. Keep liquidity balanced — pay less, route more.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <MagneticButton
                  href="/dashboard"
                  data-cursor="Dashboard"
                  strength={0.25}
                  className="min-h-[44px] min-w-[44px] rounded border-0 bg-[var(--spark)] px-6 py-3 font-mono text-sm font-medium text-zinc-950 transition hover:bg-[var(--spark-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--spark)]"
                  aria-label="Go to dashboard"
                >
                  Dashboard
                </MagneticButton>
                <MagneticButton
                  href="https://github.com/rahilbhavan/spark/tree/main/channel-liquidity-manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cursor="Initialize"
                  strength={0.25}
                  className="min-h-[44px] min-w-[44px] rounded border border-zinc-600 bg-transparent px-6 py-3 font-mono text-sm text-zinc-300 transition hover:border-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--spark)]"
                  aria-label="Initialize manager (opens GitHub)"
                >
                  Initialize Manager
                </MagneticButton>
              </div>
            </div>
            </header>
          </RevealOnScroll>

          {/* Feature sections — asymmetric grid, one block larger / offset */}
          <RevealOnScroll variant="fade-up" start="top 88%">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-12">
            <section className="border border-zinc-800 bg-zinc-900/30 px-6 py-6 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50 lg:col-span-5">
              <p className="mb-2 font-display text-[length:var(--text-display-label)] font-medium uppercase tracking-widest text-zinc-500">
                Channel Health
              </p>
              <h2 className="mb-2 font-display text-xl font-semibold text-zinc-100 sm:text-2xl">
                Real-Time Channel Health
              </h2>
              <p className="font-mono text-sm text-zinc-400">
                Scores each channel by local/capacity ratio.
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 font-mono text-xs text-zinc-500" aria-hidden>
                <li>Healthy: 40–60% local</li>
                <li>Warning: 20–80%</li>
                <li>Critical: outside band · Snapshot every 5 min</li>
              </ul>
            </section>
            <section className="border border-zinc-800 bg-zinc-900/30 px-6 py-6 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50 lg:col-span-5">
              <p className="mb-2 font-display text-[length:var(--text-display-label)] font-medium uppercase tracking-widest text-zinc-500">
                Analysis
              </p>
              <h2 className="mb-2 font-display text-xl font-semibold text-zinc-100 sm:text-2xl">
                Imbalance Analysis
              </h2>
              <p className="font-mono text-sm text-zinc-400">
                Urgency score and direction: depleted outbound (low local), depleted
                inbound (high local).
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 font-mono text-xs text-zinc-500" aria-hidden>
                <li>Prioritizes top 5 channels for rebalance</li>
              </ul>
            </section>
            <section className="border border-zinc-800 bg-zinc-900/30 px-6 py-6 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50 sm:col-span-2 lg:col-span-2 lg:-mt-2 lg:self-end">
              <p className="mb-2 font-display text-[length:var(--text-display-label)] font-medium uppercase tracking-widest text-zinc-500">
                Integration
              </p>
              <h2 className="mb-2 font-display text-xl font-semibold text-zinc-100 sm:text-2xl">
                LND Integration
              </h2>
              <p className="font-mono text-sm text-zinc-400">
                Connects to LND REST.
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 font-mono text-xs text-zinc-500" aria-hidden>
                <li>Rebalance every 10 min · Snapshot every 5</li>
                <li>Optional InfluxDB + Grafana</li>
              </ul>
            </section>
            </div>
          </RevealOnScroll>

          {/* Simulator (wrapped in Suspense for nuqs/useSearchParams) */}
          <RevealOnScroll variant="fade-up" start="top 85%">
            <div className="mt-20">
              <Suspense fallback={<SimulatorFallback />}>
                <RebalanceSimulator />
              </Suspense>
            </div>
          </RevealOnScroll>
        </div>
      </main>

      <StatusStrip />
    </div>
  );
}
