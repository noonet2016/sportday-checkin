import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plesk/Passenger deploy: build locally, ship the minimal standalone server.
  output: "standalone",
  poweredByHeader: false,
  // Dev-only: let Next's dev-mode cross-origin requests (RSC, HMR) work when the
  // app is reached through an HTTPS dev tunnel. Ignored in production builds.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      // Dev-only: allow Server Actions when reached through an HTTPS dev tunnel
      // (cloudflared/ngrok). Next rejects actions whose Origin != Host, which a
      // tunnel always trips. Never enabled in production.
      ...(process.env.NODE_ENV !== "production"
        ? { allowedOrigins: ["*.trycloudflare.com", "*.ngrok-free.app"] }
        : {}),
    },
  },
};

export default nextConfig;

