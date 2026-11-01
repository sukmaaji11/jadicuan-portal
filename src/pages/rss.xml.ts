import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getAllArticles } from "../lib/sanity";

export const GET: APIRoute = async (context) => {
  const articles = await getAllArticles();
  return rss({
    title: "JadiCuan — Cerita, Inspirasi, Peluang",
    description:
      "Cerita bisnis, inspirasi, wawasan digital, dan peluang untuk melangkah lebih jauh.",
    site: context.site!,
    items: articles.map((article) => ({
      title: article.title,
      description: article.excerpt,
      pubDate: new Date(article.publishedAt),
      link: `/artikel/${article.slug}/`,
      author: article.author,
    })),
    customData: "<language>id-ID</language>",
  });
};
