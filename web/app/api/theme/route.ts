// Endpoint pra trocar tema (cookie `if_theme`).
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SUPPORTED = ["light", "dark"];

export async function POST(req: NextRequest) {
  const { theme } = await req.json().catch(() => ({ theme: null }));
  if (!SUPPORTED.includes(theme)) {
    return NextResponse.json({ error: "unsupported theme" }, { status: 400 });
  }
  const store = await cookies();
  store.set("if_theme", theme, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true, theme });
}
