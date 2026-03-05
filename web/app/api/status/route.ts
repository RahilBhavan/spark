import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type StatusPayload = {
  channels_n: number;
  last_snapshot_ts: string | null;
  rebalance_count_today: number;
  node_grade: string | null;
  source: "sqlite" | "none" | "error";
};

const FALLBACK: StatusPayload = {
  channels_n: 0,
  last_snapshot_ts: null,
  rebalance_count_today: 0,
  node_grade: null,
  source: "none",
};

export async function GET(): Promise<NextResponse<StatusPayload>> {
  const apiUrl = process.env.REBALANCER_API_URL;
  if (!apiUrl) {
    return NextResponse.json(FALLBACK);
  }

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/status`, {
      next: { revalidate: 0 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json({ ...FALLBACK, source: "error" });
    }
    const data = (await res.json()) as StatusPayload;
    return NextResponse.json({
      ...data,
      source: data.source ?? "sqlite",
    });
  } catch {
    return NextResponse.json({ ...FALLBACK, source: "error" });
  }
}
