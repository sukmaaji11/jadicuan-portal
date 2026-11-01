# JadiCuan Portal

Portal artikel JadiCuan dibangun dengan Astro, Sanity CMS, dan Cloudflare Pages. Halaman artikel dibuat sebagai HTML statis saat build agar cepat dan mudah diindeks mesin pencari. Dashboard CMS tersedia di `/studio`.

## Menjalankan secara lokal

Gunakan Node.js 20.19+, 22.13+, atau 23.5+.

```sh
npm install
```

Salin `.env.example` menjadi `.env`, lalu isi project ID Sanity:

```env
PUBLIC_SANITY_PROJECT_ID=project-id-dari-sanity
PUBLIC_SANITY_DATASET=production
```

Jalankan situs lokal:

```sh
npm run dev
```

Buka `http://localhost:4321` untuk situs. Setelah project ID tersedia, dashboard CMS ada di `http://localhost:4321/studio`. Tanpa project ID, situs tetap bisa dijalankan untuk melihat desain, tetapi artikel tidak akan dimuat.

## Menyiapkan Sanity CMS

1. Buat project gratis di [sanity.io/manage](https://www.sanity.io/manage), lalu salin project ID ke `.env`.
2. Gunakan dataset `production` dan pastikan dataset dapat dibaca publik untuk artikel yang memang akan tampil di website.
3. Di pengaturan API Sanity, tambahkan CORS origin `http://localhost:4321` dan `https://jadicuan.co.id`. Izinkan credentials untuk kedua origin tersebut.
4. Buka `/studio`, masuk menggunakan akun Sanity, lalu buat dan terbitkan dokumen **Artikel**. Field judul, URL, ringkasan, kategori, tanggal terbit, isi, dan alt text gambar tersedia di CMS.

Project ID dan nama dataset bukan rahasia. Jangan menaruh API token tulis atau kredensial editor di variabel `PUBLIC_*`.

## Deploy ke Cloudflare Pages

Hubungkan repository ini ke Cloudflare Pages dengan konfigurasi berikut:

- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable `NODE_VERSION`: `22`
- Environment variable `PUBLIC_SANITY_PROJECT_ID`: project ID Sanity
- Environment variable `PUBLIC_SANITY_DATASET`: `production`

Tambahkan domain `jadicuan.co.id` di pengaturan **Custom domains** Cloudflare Pages. Pastikan DNS domain mengarah ke project Pages sebelum mengganti website yang sedang live.

Karena website dibuat statis, artikel baru akan muncul setelah build berikutnya. Buat **Build hook** di Cloudflare Pages, lalu tambahkan webhook di Sanity yang memanggil URL hook saat dokumen post dipublikasikan, diperbarui, atau dihapus. Perlakukan URL hook sebagai rahasia.

## SEO dan indexing

Situs menghasilkan title/description unik, canonical URL, Open Graph/Twitter metadata, schema `BlogPosting`, sitemap XML, RSS, robots.txt, dan halaman HTML untuk setiap artikel. Setelah domain aktif, daftarkan properti domain di Google Search Console dan kirim sitemap `https://jadicuan.co.id/sitemap-index.xml`.

## Pemeriksaan

```sh
npm run check
npm run build
```
