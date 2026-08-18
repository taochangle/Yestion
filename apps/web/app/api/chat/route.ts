import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:8080";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const token = request.cookies.get("auth_token")?.value;

  const upstream = await fetch(`${apiTarget}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body
  });

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => "");
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      detail = parsed.error || raw;
    } catch {
      // keep raw text
    }
    return NextResponse.json(
      { error: detail || `chat request failed with status ${upstream.status}` },
      { status: upstream.status }
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
