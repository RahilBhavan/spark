import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "./page";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => React.createElement("a", { href }, children),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/nodes"))
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ nodes: ["default"] }),
          });
        if (url.includes("/api/status"))
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                channels_n: 2,
                last_snapshot_ts: "2025-01-15T12:00:00Z",
                rebalance_count_today: 1,
                node_grade: "B",
                source: "sqlite",
              }),
          });
        if (url.includes("/api/config"))
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                target_ratio_low: 0.4,
                target_ratio_high: 0.6,
              }),
          });
        if (url.includes("/api/snapshots/latest"))
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                snapshots: [
                  {
                    chan_id: "chan1",
                    alias: "alice",
                    local_balance: 500000,
                    capacity: 1000000,
                    ratio: 0.5,
                    health: "HEALTHY",
                  },
                ],
                ts: "2025-01-15T12:00:00Z",
              }),
          });
        if (url.includes("/api/rebalances/recent"))
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                events: [
                  {
                    ts: "2025-01-15T12:05:00Z",
                    chan_id: "chan1",
                    amount_sats: 100000,
                    fee_sats: 50,
                    fee_ppm: 500,
                    success: 1,
                    error: null,
                  },
                ],
              }),
          });
        return Promise.reject(new Error("Unknown URL"));
      })
    );
  });

  it("shows loading initially", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it("renders dashboard with snapshot table and recent rebalances", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
    expect(screen.getByRole("cell", { name: "alice" })).toBeInTheDocument();
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
    expect(screen.getByText(/100,000 sats/)).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});

describe("DashboardPage empty state", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const empty = { snapshots: [], ts: null };
        const emptyEvents = { events: [] };
        const status = {
          channels_n: 0,
          last_snapshot_ts: null,
          rebalance_count_today: 0,
          node_grade: null,
          source: "none",
        };
        const config = { target_ratio_low: 0.4, target_ratio_high: 0.6 };
        if (url.includes("/api/nodes"))
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ nodes: ["default"] }),
          });
        if (url.includes("/api/status"))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(status) });
        if (url.includes("/api/config"))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(config) });
        if (url.includes("/api/snapshots/latest"))
          return Promise.resolve({ ok: true, json: () => Promise.resolve(empty) });
        if (url.includes("/api/rebalances/recent"))
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(emptyEvents),
          });
        return Promise.reject(new Error("Unknown URL"));
      })
    );
  });

  it("shows empty state when no channel data", async () => {
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.queryByText(/Loading/)).not.toBeInTheDocument();
    });
    expect(
      screen.getByText(/No channel data. Set REBALANCER_API_URL/)
    ).toBeInTheDocument();
    expect(screen.getByText(/No rebalance events yet/)).toBeInTheDocument();
  });
});
