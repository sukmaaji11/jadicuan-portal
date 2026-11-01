import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./sanity/schemaTypes";

export default defineConfig({
  name: "jadicuan",
  title: "JadiCuan",
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID || "demo-project",
  dataset: process.env.PUBLIC_SANITY_DATASET || "production",
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
