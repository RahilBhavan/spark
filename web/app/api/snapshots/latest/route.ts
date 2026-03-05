import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type SnapshotRow = {
  chan_id: string;
  alias: string;
  local_balance: number;
  capacity: number;
  ratio: number;
  health: string;
};

export type SnapshotsLatestPayload = {
  snapshots: SnapshotRow[];
  ts: string | null;
};

const FALLBACK: SnapshotsLatestPayload = {
  snapshots: [],
  ts: null,
};

export async function GET(
  request: Request
): Promise<NextResponse<SnapshotsLatestPayload>> {
  const apiUrl = process.env.REBALANCER_API_URL;
  if (!apiUrl) {
    return NextResponse.json(FALLBACK);
  }

  const node = new URL(request.url).searchParams.get("node");
  const qs = node ? `?node=${encodeURIComponent(node)}` : "";

  try {
    const res = await fetch(
      `${apiUrl.replace(/\/$/, "")}/api/snapshots/latest${qs}`,
      {
        next: { revalidate: 0 },
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) {
      return NextResponse.json(FALLBACK);
    }
    const data = (await res.json()) as SnapshotsLatestPayload;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
