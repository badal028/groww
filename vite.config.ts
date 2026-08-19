import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "icon-192.png",
        "icon-512.png",
        "icon-1024.png",
        "apple-touch-icon.png",
        "icons/android/*.png",
      ],
      manifest: {
        name: "GrowwTrader",
        short_name: "GrowwTrader",
        description: "Paper trading for Stocks and F&O. Track positions, orders, and live P&L.",
        start_url: "/login",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#07080A",
        theme_color: "#00D09C",
        icons: [
          {
            src: "icons/android/launchericon-48x48.png",
            sizes: "48x48",
            type: "image/png",
          },
          {
            src: "icons/android/launchericon-72x72.png",
            sizes: "72x72",
            type: "image/png",
          },
          {
            src: "icons/android/launchericon-96x96.png",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: "icons/android/launchericon-144x144.png",
            sizes: "144x144",
            type: "image/png",
          },
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/android/launchericon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/android/launchericon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/kite\//, /^\/health/],
      },
    }),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
