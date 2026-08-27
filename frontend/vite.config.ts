import { defineConfig, type ProxyOptions } from "vite";
import type { IncomingMessage } from "node:http";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/** Browser and Express both use `/api/v1/...`. If a Set-Cookie still has Path=/auth
 * (legacy), map it so the refresh cookie is stored for `/api/v1/auth` only. */
function rewriteRefreshCookiePath(proxyRes: IncomingMessage) {
  const raw = proxyRes.headers["set-cookie"];
  if (!raw) return;
  const list = Array.isArray(raw) ? raw : [raw];
  proxyRes.headers["set-cookie"] = list.map((cookie) =>
    cookie.replace(/;\s*Path=\/auth(?=;|$)/i, "; Path=/api/v1/auth"),
  );
}

/** Shared so `vite preview` hits the API; `server.proxy` does not apply to preview.
 * Do not strip `/api`: the SPA calls `/api/v1/...` and Express mounts at `/api/v1`. */
const apiProxy: Record<string, ProxyOptions> = {
  "/api": {
    target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000",
    changeOrigin: true,
    configure(proxy) {
      proxy.on("proxyRes", (proxyRes) => {
        rewriteRefreshCookiePath(proxyRes);
      });
    },
  },
};

/** CSP without unsafe-inline: production HTML only. Vite HMR needs inline/eval. */
const prodCspMeta = {
  name: "csp-prod",
  apply: "build" as const,
  transformIndexHtml(html: string) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
    ].join("; ");
    return html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
    );
  },
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    prodCspMeta,
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Work Table",
        short_name: "Work Table",
        description: "Work time and payouts",
        theme_color: "#171717",
        background_color: "#fafafa",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});
