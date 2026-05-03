/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // MVP: pula checagens de tipo/lint no build pra agilizar iteração
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Aceita qualquer origin em dev (IP da rede local, hostname custom, etc.)
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        // wildcards: aceita qualquer IP da rede local + hostnames custom
        "*.local:3000",
        "*:3000",
      ],
    },
  },
};

export default nextConfig;
