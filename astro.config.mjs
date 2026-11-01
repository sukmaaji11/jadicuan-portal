import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://jadicuan.co.id",
  trailingSlash: "always",
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/$/, "");
        return pathname !== "/studio" && pathname !== "/cari";
      },
    }),
  ],
});
