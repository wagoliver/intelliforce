// Proxy de download BINÁRIO. Diferente do catch-all /api/proxy (que faz
// `await upstream.text()` e corromperia o PDF), este repassa `upstream.body`
// cru, preservando bytes + Content-Type/Content-Disposition. Injeta o Bearer.
//
// Renovação automática: em 401 (sessão expirada), renova com o if_refresh,
// repete o download e grava o novo if_token.
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

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${BACKEND}/${path.join("/")}${req.nextUrl.search}`;

  const cookieStore = await cookies();
  const token = cookieStore.get("if_token")?.value;
  const refreshToken = cookieStore.get("if_refresh")?.value;
  const accept = req.headers.get("Accept") ?? "*/*";

  function fetchUpstream(tok: string | undefined) {
    const headers: Record<string, string> = { Accept: accept };
    if (tok) headers.Authorization = `Bearer ${tok}`;
    return fetch(url, { method: "GET", headers, cache: "no-store" });
  }

  let upstream = await fetchUpstream(token);

  let refreshed: RefreshedTokens | null = null;
  if (upstream.status === 401 && refreshToken) {
    refreshed = await tryRefresh(refreshToken);
    if (refreshed) upstream = await fetchUpstream(refreshed.access);
  }

  if (!upstream.body) {
    return new NextResponse(null, { status: upstream.status });
  }

  const out = new Headers();
  const ct = upstream.headers.get("Content-Type");
  if (ct) out.set("Content-Type", ct);
  const cd = upstream.headers.get("Content-Disposition");
  if (cd) out.set("Content-Disposition", cd);
  out.set("Cache-Control", "no-store");

  const res = new NextResponse(upstream.body, { status: upstream.status, headers: out });
  if (refreshed) {
    res.cookies.set("if_token", refreshed.access, accessCookieOptions());
    res.cookies.set("if_refresh", refreshed.refresh, refreshCookieOptions());
  }
  return res;
}
