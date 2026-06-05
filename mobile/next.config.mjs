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
      ],
    },
  },
};

export default withNextIntl(nextConfig);
