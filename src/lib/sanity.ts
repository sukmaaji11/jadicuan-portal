import { sanityClient } from "sanity:client";
import { createImageUrlBuilder } from "@sanity/image-url";
import type { PortableTextBlock } from "@portabletext/types";
import type { CategorySlug } from "./categories";

export type Article = {
  _id: string;
  _updatedAt: string;
  title: string;
  slug: string;
  excerpt: string;
  category: CategorySlug;
  author: string;
  publishedAt: string;
  featured: boolean;
  coverImage?: {
    asset?: { _ref?: string; url?: string };
    alt?: string;
  };
  body: PortableTextBlock[];
  seoTitle?: string;
  seoDescription?: string;
};

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || "production";
const isConfigured =
  typeof projectId === "string" &&
  projectId.length > 0 &&
  projectId !== "demo-project";

const imageBuilder = createImageUrlBuilder({
  projectId: projectId || "demo-project",
  dataset,
});

export function articleImageUrl(
  image: Article["coverImage"],
  width = 1200,
): string | undefined {
  if (!image?.asset) return undefined;
  return imageBuilder.image(image).width(width).auto("format").url();
}

const articleProjection = `{
  _id,
  _updatedAt,
  title,
  "slug": slug.current,
  excerpt,
  category,
  author,
  publishedAt,
  featured,
  coverImage{asset->{_ref, url}, alt},
  body,
  seoTitle,
  seoDescription
}`;

const publishedFilter =
  '_type == "post" && defined(slug.current) && defined(publishedAt) && publishedAt <= now()';

async function fetchArticles(
  query: string,
  params: Record<string, string | number> = {},
): Promise<Article[]> {
  if (!isConfigured) {
    if (!warnedAboutMissingConfig) {
      console.warn(
        "Sanity is not configured. Set PUBLIC_SANITY_PROJECT_ID and PUBLIC_SANITY_DATASET to load published articles.",
      );
      warnedAboutMissingConfig = true;
    }
    return [];
  }

  return sanityClient.fetch<Article[]>(query, params);
}

let warnedAboutMissingConfig = false;

export async function getLatestArticles(limit = 9): Promise<Article[]> {
  return fetchArticles(
    `*[${publishedFilter}] | order(publishedAt desc)[0...$limit]${articleProjection}`,
    { limit },
  );
}

export async function getAllArticles(): Promise<Article[]> {
  return fetchArticles(
    `*[${publishedFilter}] | order(publishedAt desc)${articleProjection}`,
  );
}

export async function getArticlesByCategory(
  category: string,
): Promise<Article[]> {
  return fetchArticles(
    `*[${publishedFilter} && category == $category] | order(publishedAt desc)${articleProjection}`,
    { category },
  );
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(date));
}

export function readingTime(body: PortableTextBlock[]): number {
  const text = body
    .flatMap((block) =>
      "children" in block && Array.isArray(block.children)
        ? block.children.flatMap((child) =>
            "text" in child && typeof child.text === "string" ? [child.text] : [],
          )
        : [],
    )
    .join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
