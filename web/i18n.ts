// Configuração do next-intl — locale escolhido via cookie `if_locale`.
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const SUPPORTED = ["pt-BR", "en"] as const;
const DEFAULT_LOCALE = "pt-BR";

export type Locale = (typeof SUPPORTED)[number];

export async function getCurrentLocale(): Promise<Locale> {
  const store = await cookies();
  const fromCookie = store.get("if_locale")?.value;
  if (fromCookie && SUPPORTED.includes(fromCookie as Locale)) {
    return fromCookie as Locale;
  }
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await getCurrentLocale();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
