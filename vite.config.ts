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
        includeAssets: ["favicon.svg"],
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
              src: `${base}favicon.svg`,
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
        },
      }),
    ],
  };
});
