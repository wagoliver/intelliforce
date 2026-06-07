// Renovação automática de sessão JWT.
//
// O access token (cookie if_token) dura ~1h; o refresh (if_refresh) dura 7d.
// Quando o access expira, trocamos o refresh por um novo par em POST
// /auth/refresh (rotação completa no backend). Usado pelo middleware
// (navegação/RSC) e pelos proxies de API (em 401). Edge-safe: só usa fetch.

const BACKEND = process.env.API_URL_INTERNAL ?? "http://api:8000";

export const SECURE = process.env.SECURE_COOKIES === "true";
// O cookie do access expira ANTES do JWT (60 min no backend — manter a margem
// se JWT_ACCESS_TOKEN_EXPIRE_MINUTES mudar). Sem a margem existe uma janela em
// que o cookie ainda está no browser mas o JWT dentro dele já venceu: o
// middleware (que só olha presença do cookie) deixa passar, o /auth/me responde
// 401 e o requireUser derruba o usuário pro /login mesmo com refresh válido.
export const ACCESS_MAX_AGE = 55 * 60; // 55min (JWT dura 60)
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7d

export interface RefreshedTokens {
  access: string;
  refresh: string;
}

/** Troca um refresh token por um novo par. Retorna null se inválido/falha. */
export async function tryRefresh(refreshToken: string): Promise<RefreshedTokens | null> {
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

/** Opções padrão do cookie de access (httpOnly, 1h). */
export function accessCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: SECURE, path: "/", maxAge: ACCESS_MAX_AGE };
}

/** Opções padrão do cookie de refresh (httpOnly, 7d). */
export function refreshCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: SECURE, path: "/", maxAge: REFRESH_MAX_AGE };
}
