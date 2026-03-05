import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type ConfigPayload = {
  target_ratio_low: number;
  target_ratio_high: number;
  estimated_extra_cost_per_forward_sats?: number;
};

const FALLBACK: ConfigPayload = {
  target_ratio_low: 0.4,
  target_ratio_high: 0.6,
};

export async function GET(): Promise<NextResponse<ConfigPayload>> {
  const apiUrl = process.env.REBALANCER_API_URL;
  if (!apiUrl) {
    return NextResponse.json(FALLBACK);
  }

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/config`, {
      next: { revalidate: 0 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(FALLBACK);
    }
    const data = (await res.json()) as ConfigPayload;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
