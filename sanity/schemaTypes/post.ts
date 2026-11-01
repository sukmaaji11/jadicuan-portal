import { defineField, defineType } from "sanity";

export const post = defineType({
  name: "post",
  title: "Artikel",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Judul",
      type: "string",
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: "slug",
      title: "URL artikel",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "excerpt",
      title: "Ringkasan",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required().max(220),
    }),
    defineField({
      name: "category",
      title: "Kategori",
      type: "string",
      options: {
        list: [
          { title: "Cerita", value: "cerita" },
          { title: "Inspirasi", value: "inspirasi" },
          { title: "Peluang", value: "peluang" },
        ],
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "author",
      title: "Penulis",
      type: "string",
      initialValue: "Tim JadiCuan",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Tanggal terbit",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "featured",
      title: "Tampilkan sebagai pilihan editor",
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "coverImage",
      title: "Gambar sampul",
      type: "image",
      options: { hotspot: true },
      fields: [
        defineField({
          name: "alt",
          title: "Teks alternatif gambar",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: "body",
      title: "Isi artikel",
      type: "array",
      of: [
        {
          type: "block",
          styles: [
            { title: "Paragraf", value: "normal" },
            { title: "Subjudul", value: "h2" },
            { title: "Subjudul kecil", value: "h3" },
            { title: "Kutipan", value: "blockquote" },
          ],
          marks: {
            decorators: [
              { title: "Tebal", value: "strong" },
              { title: "Miring", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Tautan",
                fields: [
                  defineField({
                    name: "href",
                    title: "URL",
                    type: "url",
                    validation: (rule) =>
                      rule.uri({
                        scheme: ["http", "https", "mailto"],
                      }),
                  }),
                ],
              },
            ],
          },
        },
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            defineField({
              name: "alt",
              title: "Teks alternatif gambar",
              type: "string",
              validation: (rule) => rule.required(),
            }),
          ],
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "seoTitle",
      title: "Judul SEO (opsional)",
      type: "string",
      validation: (rule) => rule.max(60),
    }),
    defineField({
      name: "seoDescription",
      title: "Deskripsi SEO (opsional)",
      type: "text",
      rows: 2,
      validation: (rule) => rule.max(160),
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "category",
      media: "coverImage",
    },
  },
});
