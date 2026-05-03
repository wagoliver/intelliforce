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

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
    },
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
