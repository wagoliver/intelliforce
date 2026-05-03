// Proxy SSE dedicado pra /chat/stream.
//
// IMPORTANTE: NÃO usar o catch-all em /api/proxy/[...path] aqui — aquele faz
// `await upstream.text()` que bufferiza o stream inteiro e mata SSE. Esta rota
// repassa `upstream.body` cru pra preservar o streaming.

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND = process.env.API_URL_INTERNAL ?? "http://api:8000";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("if_token")?.value;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const body = await req.text();

  const upstream = await fetch(`${BACKEND}/chat/stream`, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
    // @ts-expect-error duplex required by Node fetch when streaming bodies
    duplex: "half",
  });

  if (!upstream.body) {
    return new NextResponse("Upstream sem body", { status: 502 });
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
