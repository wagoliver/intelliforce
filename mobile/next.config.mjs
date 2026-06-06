import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Mobile roda na 3002 — Server Actions (login) exigem allowedOrigins batendo.
    serverActions: {
      allowedOrigins: [
        "localhost:3002",
        "127.0.0.1:3002",
        "*.local:3002",
        "*:3002",
        // Acesso HTTPS via Tailscale serve (necessário p/ Web Push no iOS)
        "nbarc2000.tailc053c2.ts.net",
        "*.ts.net",
      ],
    },
  },
};

export default withNextIntl(nextConfig);
