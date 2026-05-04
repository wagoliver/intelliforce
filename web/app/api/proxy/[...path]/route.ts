// Proxy do Next.js: recebe chamadas do browser e repassa pra API real,
// injetando o cookie httpOnly como Authorization Bearer.
//
// Permite que Client Components consumam a API sem expor o token no JS.

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.API_URL_INTERNAL ?? "http://api:8000";

async function forward(req: NextRequest, pathSegments: string[], method: string) {
  const path = pathSegments.join("/");
  const search = req.nextUrl.search;
  const url = `${BACKEND}/${path}${search}`;

  const cookieStore = await cookies();
  const token = cookieStore.get("if_token")?.value;

  const headers: Record<string, string> = {
    Accept: req.headers.get("Accept") ?? "application/json",
  };
  const ct = req.headers.get("Content-Type");
  if (ct) headers["Content-Type"] = ct;
  if (token) headers.Authorization = `Bearer ${token}`;

  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.text() : undefined;

  const upstream = await fetch(url, { method, headers, body, cache: "no-store" });
  const text = await upstream.text();

  // HTTP spec / Fetch API: status 204 (No Content), 205 (Reset Content) e
  // 304 (Not Modified) NÃO podem carregar body. O `Response` constructor do
  // undici (Node 18+) valida isso e joga TypeError("Invalid response status
  // code 204") se passarmos string vazia em vez de null.
  const NULL_BODY_STATUSES = new Set([204, 205, 304]);
  const responseBody = NULL_BODY_STATUSES.has(upstream.status) ? null : text;

  // Pra respostas sem-body, não fazemos sentido forçar Content-Type.
  const responseHeaders: Record<string, string> = {};
  if (!NULL_BODY_STATUSES.has(upstream.status)) {
    responseHeaders["Content-Type"] =
      upstream.headers.get("Content-Type") ?? "application/json";
  }

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
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
