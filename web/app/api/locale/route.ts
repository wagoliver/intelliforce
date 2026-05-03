// Endpoint pra trocar o idioma (seta cookie `if_locale`).
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SUPPORTED = ["pt-BR", "en"];

export async function POST(req: NextRequest) {
  const { locale } = await req.json().catch(() => ({ locale: null }));
  if (!SUPPORTED.includes(locale)) {
    return NextResponse.json({ error: "unsupported locale" }, { status: 400 });
  }
  const store = await cookies();
  store.set("if_locale", locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true, locale });
}
