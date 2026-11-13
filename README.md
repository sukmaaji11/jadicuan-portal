# JadiCuan Portal

Portal artikel JadiCuan dibangun dengan Astro, Sanity CMS, dan Cloudflare Pages. Halaman artikel dibuat sebagai HTML statis saat build agar cepat dan mudah diindeks mesin pencari. Dashboard CMS tersedia di `/studio`.

Kalkulator HPP tersedia di `/kalkulator-hpp/`, dan Kalkulator Modal & Balik Modal di `/kalkulator-modal/`. Semua hitungan dilakukan di browser dan tidak dikirim atau disimpan ke server. Kalkulator Modal menyimpan isian di `localStorage` perangkat pengunjung saja, dan pengunjung bisa menghapusnya lewat tombol "Hapus data saya".

## Kalkulator Modal & Balik Modal

- Halaman: `src/pages/kalkulator-modal.astro`
- Rumus (fungsi murni): `src/lib/modal.ts`, diuji di `src/lib/modal.test.mjs`
- Contoh Cepat (es teh, nasi goreng, sate ayam): `CONTOH_CEPAT` di `src/lib/modal.ts`. Sumber harga bahan ada di komentar kode.

### Event Meta Pixel (nama resmi menunggu konfirmasi Owner, tugas K3)

| Event | Pemicu | Parameter |
|---|---|---|
| `modal_start` | Interaksi pertama dengan isian (termasuk "Pakai contoh"), sekali per kunjungan | – |
| `modal_complete` | Sampai halaman hasil, sekali per muat halaman | – |
| `modal_share_click` | Klik "Salin ringkasan" | – |
| `modal_upgrade_click` | Klik "Kabari aku saat tersedia", atau "Beli versi lengkap" setelah dijual | `price_variant`: `79000`, `99000`, `off`, atau harga final |

Isian dan hasil hitung pengunjung tidak pernah dikirim ke Pixel. Event Kalkulator HPP tidak diubah.

### Uji harga versi lengkap

Versi lengkap belum ada. Kartu terkunci di bawah hasil hanya mengukur minat: tidak ada pembayaran dan tidak ada data pribadi yang dikumpulkan. Pengaturannya ada di `src/config/kalkulator-modal.ts`:

- **Mematikan uji harga:** ubah `SHOW_PRICE_TEST` menjadi `false`. Baris harga hilang, dan klik tetap dicatat dengan `price_variant: "off"`.
- **Mengganti harga:** ubah `PRICE_TEST_VARIANTS`. `price` adalah angka yang tampil, `id` adalah nilai yang dikirim sebagai `price_variant`. Ganti `id` juga kalau harganya diganti, supaya data lama dan baru tidak tercampur. Pengunjung lama otomatis mendapat varian baru.

Setiap pengunjung mendapat satu varian secara acak, yang disimpan di `localStorage` (`jadicuan:kalkulator-modal:varian-harga`).

### Versi lengkap (kode akses, tanpa login)

Isinya: 3 skenario (sepi, normal, ramai), simpan sampai 20 usaha, dan unduh PDF. Semuanya dihitung dan disimpan di browser pembeli. Tidak ada akun, server, atau data pembeli di situs.

**Alur penjualan:**

1. Pembeli menekan "Beli versi lengkap" dan membayar di landing page Scalev.
2. Owner membuat kode di `tools/akses-kalkulator-modal/admin.html`. Halaman ini dibuka offline dengan klik dua kali. Caranya:
   - Seret file kunci rahasia ke halaman.
   - Isi nama atau nomor pesanan Scalev.
   - Tekan **Buat kode**, lalu **Salin pesan WA** atau **Buka WhatsApp**.
3. Pembeli membuka tautan di pesan itu (`/kalkulator-modal/#kode=...`), atau menempel kodenya di "Sudah punya kode akses?". Versi lengkap langsung aktif.

**Cara kerja kode:**

- Kode ditandatangani ECDSA P-256 dengan kunci rahasia Owner. Situs hanya memegang kunci publik, jadi kode tidak bisa dipalsukan (`src/lib/akses-kode.ts`).
- Kode tidak terikat ke HP. Setelah ganti HP atau menghapus data browser, kode yang sama tinggal dimasukkan lagi.
- Kode dari tautan dipindahkan dari alamat halaman sebelum Meta Pixel dimuat, jadi tidak ikut tercatat di Pixel.

**Kunci rahasia:**

- Lokasinya `%USERPROFILE%\Documents\JadiCuanAdmin\kalkulator-modal-kunci-rahasia.json`.
- Cadangkan di dua tempat aman. Jangan di-commit dan jangan dikirim lewat chat.
- Kalau kunci hilang, kode baru tidak bisa dibuat. Kalau kunci diganti, semua kode lama tidak berlaku.
- Alternatif lewat terminal:
  - `node tools/akses-kalkulator-modal/admin.mjs buat --nama "Bu Ani" --catatan "Scalev #1234"`
  - Riwayat kode disimpan di CSV di folder kunci yang sama.

**Pengaturan** (`src/config/kalkulator-modal.ts`, `VERSI_LENGKAP`):

- **Mulai menjual:**
  1. Isi `urlPembelian` dengan tautan Scalev.
  2. Ubah `dijual` menjadi `true`.
  3. Isi `harga` dengan harga final. Harga ini harus sama dengan harga di Scalev. Selama `harga` masih `null`, uji harga tetap berjalan.
- **Memblokir kode yang tersebar:** tambahkan nomor serinya ke `SERIAL_DIBLOKIR`. Contoh: `KM-1A2B3C4D` ditulis `0x1a2b3c4d`. Setelah itu deploy ulang.
- **Setelah mengubah `core.mjs` atau `admin.template.html`:** jalankan `npm run admin:kode`. Uji akan gagal kalau `admin.html` tertinggal dari sumbernya.

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
- Environment variable `PUBLIC_META_PIXEL_ID`: ID Meta Pixel untuk Kalkulator HPP.
- Environment variable `PUBLIC_META_PIXEL_ID_MODAL`: ID Meta Pixel untuk Kalkulator Modal.
- Kalau salah satu kosong, Pixel tidak dipasang di halaman itu. Kode Pixel ada di `src/components/MetaPixel.astro`.

Tambahkan domain `jadicuan.co.id` di pengaturan **Custom domains** Cloudflare Pages. Pastikan DNS domain mengarah ke project Pages sebelum mengganti website yang sedang live.

Karena website dibuat statis, artikel baru akan muncul setelah build berikutnya. Buat **Build hook** di Cloudflare Pages, lalu tambahkan webhook di Sanity yang memanggil URL hook saat dokumen post dipublikasikan, diperbarui, atau dihapus. Perlakukan URL hook sebagai rahasia.

## SEO dan indexing

Situs menghasilkan title/description unik, canonical URL, Open Graph/Twitter metadata, schema `BlogPosting`, sitemap XML, RSS, robots.txt, dan halaman HTML untuk setiap artikel. Setelah domain aktif, daftarkan properti domain di Google Search Console dan kirim sitemap `https://jadicuan.co.id/sitemap-index.xml`.

## Pemeriksaan

```sh
npm run check
npm run test:hpp
npm run test:modal
npm run build
```
