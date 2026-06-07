// Baseado em web/app/api/proxy/[...path]/route.ts — com retry de 401 via refresh.
// Recebe chamadas do browser e repassa pra API real, injetando o cookie
// httpOnly como Authorization Bearer. Em 401, tenta renovar a sessão com o
// if_refresh, repete a requisição e grava o novo if_token no browser.

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  accessCookieOptions,
  refreshCookieOptions,
  tryRefresh,
  type RefreshedTokens,
} from "@/lib/auth/refresh";

const BACKEND = process.env.API_URL_INTERNAL ?? "http://api:8000";

const NULL_BODY_STATUSES = new Set([204, 205, 304]);

async function forward(req: NextRequest, pathSegments: string[], method: string) {
  const path = pathSegments.join("/");
  const url = `${BACKEND}/${path}${req.nextUrl.search}`;

  const cookieStore = await cookies();
  const token = cookieStore.get("if_token")?.value;
  const refreshToken = cookieStore.get("if_refresh")?.value;

  const ct = req.headers.get("Content-Type");
  const accept = req.headers.get("Accept") ?? "application/json";
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.text() : undefined;

  function buildHeaders(tok: string | undefined): Record<string, string> {
    const h: Record<string, string> = { Accept: accept };
    if (ct) h["Content-Type"] = ct;
    if (tok) h.Authorization = `Bearer ${tok}`;
    return h;
  }

  let upstream = await fetch(url, { method, headers: buildHeaders(token), body, cache: "no-store" });

  // Sessão expirou: tenta renovar uma vez e repete a requisição original.
  let refreshed: RefreshedTokens | null = null;
  if (upstream.status === 401 && refreshToken) {
    refreshed = await tryRefresh(refreshToken);
    if (refreshed) {
      upstream = await fetch(url, {
        method,
        headers: buildHeaders(refreshed.access),
        body,
        cache: "no-store",
      });
    }
  }

  const text = await upstream.text();
  const responseBody = NULL_BODY_STATUSES.has(upstream.status) ? null : text;

  const res = new NextResponse(responseBody, { status: upstream.status });
  if (!NULL_BODY_STATUSES.has(upstream.status)) {
    res.headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") ?? "application/json",
    );
  }
  if (refreshed) {
    res.cookies.set("if_token", refreshed.access, accessCookieOptions());
    res.cookies.set("if_refresh", refreshed.refresh, refreshCookieOptions());
  }
  return res;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path, "GET");
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path, "POST");
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path, "PATCH");
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path, "PUT");
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path, "DELETE");
}
