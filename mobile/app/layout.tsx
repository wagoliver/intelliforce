// Baseado em web/app/layout.tsx — adaptado para mobile (viewport + theme-color).
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { RegisterSW } from "@/components/pwa/RegisterSW";

import "./globals.css";
import "./portal-theme.css";

export const metadata: Metadata = {
  title: "IntelliForce Mobile",
  description: "Plataforma de gestão de força de trabalho digital — app mobile",
  applicationName: "IntelliForce",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "IntelliForce" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// viewport-fit=cover libera o uso de env(safe-area-inset-*) em telas com notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Trava o zoom (no PWA standalone o iOS respeita isto) — evita a tela
  // "fora de foco" ao tocar nos campos. text-base (16px) nos inputs já evita
  // o auto-zoom no Safari normal.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Faz o conteúdo redimensionar quando o teclado abre (em vez de sobrepor).
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// Resolve o tema antes do paint (sem flash): cookie if_theme, senão o do sistema.
const THEME_INIT = `(function(){try{var m=document.cookie.match(/(?:^|; )if_theme=(dark|light)/);var t=m?m[1]:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const store = await cookies();
  const theme = store.get("if_theme")?.value === "dark" ? "dark" : "light";

  return (
    <html lang={locale} className={theme === "dark" ? "dark" : ""} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
