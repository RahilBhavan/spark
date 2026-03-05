import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type RebalanceEvent = {
  ts: string;
  chan_id: string;
  amount_sats: number;
  fee_sats: number;
  fee_ppm: number;
  success: number;
  error: string | null;
};

export type RebalancesRecentPayload = {
  events: RebalanceEvent[];
};

const FALLBACK: RebalancesRecentPayload = {
  events: [],
};

export async function GET(
  request: Request
): Promise<NextResponse<RebalancesRecentPayload>> {
  const apiUrl = process.env.REBALANCER_API_URL;
  if (!apiUrl) {
    return NextResponse.json(FALLBACK);
  }

  const node = new URL(request.url).searchParams.get("node");
  const qs = node ? `?node=${encodeURIComponent(node)}` : "";

  try {
    const res = await fetch(
      `${apiUrl.replace(/\/$/, "")}/api/rebalances/recent${qs}`,
      {
        next: { revalidate: 0 },
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) {
      return NextResponse.json(FALLBACK);
    }
    const data = (await res.json()) as RebalancesRecentPayload;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
