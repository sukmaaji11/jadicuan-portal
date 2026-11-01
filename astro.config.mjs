import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import sanity from "@sanity/astro";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
const projectId = env.PUBLIC_SANITY_PROJECT_ID || "demo-project";
const dataset = env.PUBLIC_SANITY_DATASET || "production";

if (!process.env.PUBLIC_SANITY_PROJECT_ID && env.PUBLIC_SANITY_PROJECT_ID) {
  process.env.PUBLIC_SANITY_PROJECT_ID = env.PUBLIC_SANITY_PROJECT_ID;
}
if (!process.env.PUBLIC_SANITY_DATASET && env.PUBLIC_SANITY_DATASET) {
  process.env.PUBLIC_SANITY_DATASET = env.PUBLIC_SANITY_DATASET;
}

export default defineConfig({
  site: "https://jadicuan.co.id",
  trailingSlash: "always",
  integrations: [
    sanity({
      projectId,
      dataset,
      apiVersion: "2026-01-01",
      useCdn: false,
      studioBasePath: "/studio",
      studioRouterHistory: "hash",
    }),
    react(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/$/, "");
        return pathname !== "/studio" && pathname !== "/cari";
      },
    }),
  ],
});
