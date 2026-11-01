import type { APIRoute } from "astro";
import { getAllArticles } from "../lib/sanity";

export const GET: APIRoute = async () => {
  const articles = await getAllArticles();
  const searchIndex = articles.map(({ title, slug, excerpt, category, publishedAt }) => ({
    title,
    slug,
    excerpt,
    category,
    publishedAt,
  }));

  return new Response(JSON.stringify(searchIndex), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
