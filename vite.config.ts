import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => {
  const base = command === "build" ? "/AI-Plantgraphy-PWA/" : "/";

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "brand/ai-plantgraphy-icon.png",
          "brand/ai-plantgraphy-header.jpg",
          "icons/icon-192.png",
          "icons/icon-512.png",
        ],
        manifest: {
          name: "AI Plantgraphy PWA",
          short_name: "AI Plantgraphy",
          description: "端末内保存で使える植物観察 PWA",
          theme_color: "#2f7d59",
          background_color: "#f4faf6",
          display: "standalone",
          scope: base,
          start_url: base,
          icons: [
            {
              src: `${base}icons/icon-192.png`,
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: `${base}icons/icon-512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
      }),
    ],
  };
});
