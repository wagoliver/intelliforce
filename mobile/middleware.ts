// Baseado em web/middleware.ts — adiciona refresh automático de sessão.
import { NextResponse, type NextRequest } from "next/server";

// Inclui os assets PWA públicos (manifest, service worker, ícones) — sem isso
// o middleware redirecionaria pro /login e a instalação do PWA quebraria.
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
  "/icons",
  "/robots.txt",
];

const BACKEND = process.env.API_URL_INTERNAL ?? "http://api:8000";
const SECURE = process.env.SECURE_COOKIES === "true";
const ACCESS_MAX_AGE = 60 * 60; // 1h
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7d

async function tryRefresh(
  refreshToken: string,
): Promise<{ access: string; refresh: string } | null> {
  try {
    const r = await fetch(`${BACKEND}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data?.access_token) return null;
    return { access: data.access_token, refresh: data.refresh_token ?? refreshToken };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Access ainda válido (cookie presente) → segue.
  if (req.cookies.get("if_token")) {
    return NextResponse.next();
  }

  // Access expirou mas há refresh → tenta renovar transparentemente.
  const refresh = req.cookies.get("if_refresh")?.value;
  if (refresh) {
    const tokens = await tryRefresh(refresh);
    if (tokens) {
      // Propaga o novo access pro request atual (pra RSC/requireUser enxergar)
      // e persiste no browser via Set-Cookie na resposta.
      req.cookies.set("if_token", tokens.access);
      const res = NextResponse.next({ request: { headers: req.headers } });
      res.cookies.set("if_token", tokens.access, {
        httpOnly: true,
        sameSite: "lax",
        secure: SECURE,
        path: "/",
        maxAge: ACCESS_MAX_AGE,
      });
      res.cookies.set("if_refresh", tokens.refresh, {
        httpOnly: true,
        sameSite: "lax",
        secure: SECURE,
        path: "/",
        maxAge: REFRESH_MAX_AGE,
      });
      return res;
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
