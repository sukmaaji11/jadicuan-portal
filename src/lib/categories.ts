export const categories = [
  {
    slug: "cerita",
    title: "Cerita",
    description:
      "Kisah di balik bisnis, perjalanan para pelaku usaha, dan pengalaman yang layak dipelajari.",
    icon: "✦",
  },
  {
    slug: "inspirasi",
    title: "Inspirasi",
    description:
      "Wawasan, ide, dan sudut pandang baru seputar bisnis, teknologi, serta produktivitas.",
    icon: "◈",
  },
  {
    slug: "peluang",
    title: "Peluang",
    description:
      "Tren, produk, dan kesempatan yang bisa menjadi awal dari langkah berikutnya.",
    icon: "↗",
  },
] as const;

export type CategorySlug = (typeof categories)[number]["slug"];
