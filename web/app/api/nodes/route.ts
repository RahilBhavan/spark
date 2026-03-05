import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type NodesPayload = {
  nodes: string[];
};

const FALLBACK: NodesPayload = { nodes: ["default"] };

export async function GET(): Promise<NextResponse<NodesPayload>> {
  const apiUrl = process.env.REBALANCER_API_URL;
  if (!apiUrl) {
    return NextResponse.json(FALLBACK);
  }

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/nodes`, {
      next: { revalidate: 0 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(FALLBACK);
    }
    const data = (await res.json()) as NodesPayload;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
