// Proxy SSE dedicado pra /chat/stream.
//
// IMPORTANTE: NÃO usar o catch-all em /api/proxy/[...path] aqui — aquele faz
// `await upstream.text()` que bufferiza o stream inteiro e mata SSE. Esta rota
// repassa `upstream.body` cru pra preservar o streaming.
//
// Renovação automática: o 401 do /chat/stream chega como status imediato (o
// get_current_user rejeita antes de abrir o stream), então conseguimos renovar
// a sessão com o if_refresh e repetir a requisição ANTES de devolver o corpo.

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  accessCookieOptions,
  refreshCookieOptions,
  tryRefresh,
  type RefreshedTokens,
} from "@/lib/auth/refresh";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND = process.env.API_URL_INTERNAL ?? "http://api:8000";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("if_token")?.value;
  const refreshToken = cookieStore.get("if_refresh")?.value;

  const body = await req.text();

  function fetchUpstream(tok: string | undefined) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    return fetch(`${BACKEND}/chat/stream`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      // @ts-expect-error duplex required by Node fetch when streaming bodies
      duplex: "half",
    });
  }

  let upstream = await fetchUpstream(token);

  // Sessão expirou antes de iniciar a run: renova e repete uma vez.
  let refreshed: RefreshedTokens | null = null;
  if (upstream.status === 401 && refreshToken) {
    refreshed = await tryRefresh(refreshToken);
    if (refreshed) upstream = await fetchUpstream(refreshed.access);
  }

  if (!upstream.body) {
    return new NextResponse("Upstream sem body", { status: upstream.status || 502 });
  }

  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
  if (refreshed) {
    res.cookies.set("if_token", refreshed.access, accessCookieOptions());
    res.cookies.set("if_refresh", refreshed.refresh, refreshCookieOptions());
  }
  return res;
}
