import { NextResponse, type NextRequest } from "next/server";

import { accessCookieOptions, refreshCookieOptions, tryRefresh } from "@/lib/auth/refresh";

const PUBLIC_PATHS = ["/login", "/register", "/_next", "/favicon.ico"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Access ainda válido (cookie presente) → segue.
  if (req.cookies.get("if_token")) {
    return NextResponse.next();
  }

  // Access expirou mas há refresh → tenta renovar transparentemente, sem
  // mandar o usuário pro login no meio da navegação.
  const refresh = req.cookies.get("if_refresh")?.value;
  if (refresh) {
    const tokens = await tryRefresh(refresh);
    if (tokens) {
      // Propaga o novo access pro request atual (pra RSC/requireUser enxergar)
      // e persiste no browser via Set-Cookie na resposta.
      req.cookies.set("if_token", tokens.access);
      const res = NextResponse.next({ request: { headers: req.headers } });
      res.cookies.set("if_token", tokens.access, accessCookieOptions());
      res.cookies.set("if_refresh", tokens.refresh, refreshCookieOptions());
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
