// Proxy de download BINÁRIO. Diferente do catch-all /api/proxy (que faz
// `await upstream.text()` e corromperia o PDF), este repassa `upstream.body`
// cru, preservando bytes + Content-Type/Content-Disposition. Injeta o Bearer.
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BACKEND = process.env.API_URL_INTERNAL ?? "http://api:8000";

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${BACKEND}/${path.join("/")}${req.nextUrl.search}`;

  const token = (await cookies()).get("if_token")?.value;
  const headers: Record<string, string> = { Accept: req.headers.get("Accept") ?? "*/*" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const upstream = await fetch(url, { method: "GET", headers, cache: "no-store" });
  if (!upstream.body) {
    return new NextResponse(null, { status: upstream.status });
  }

  const out = new Headers();
  const ct = upstream.headers.get("Content-Type");
  if (ct) out.set("Content-Type", ct);
  const cd = upstream.headers.get("Content-Disposition");
  if (cd) out.set("Content-Disposition", cd);
  out.set("Cache-Control", "no-store");

  return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}
