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

## Kalkulator Untung Bersih Seller

Halaman `/kalkulator-untung-seller/` (`src/pages/kalkulator-untung-seller.astro`), ditautkan dari menu alat di beranda. Kalkulator ini menghitung untung bersih per produk setelah potongan Shopee, TikTok Shop, dan Tokopedia. Hasilnya: margin, status (Rugi / Tipis / Sehat), harga impas, dan harga jual yang disarankan.

Tidak ada akun dan tidak ada backend. Data produk dan file CSV dihitung di browser dan tidak dikirim ke server. Pengaturan disimpan di `localStorage` dengan kunci `jadicuan:kalkulator-seller:*`.

| File | Isi |
|---|---|
| `src/config/biaya-marketplace.json` | Profil biaya Shopee, TikTok Shop / Tokopedia, dan Custom. |
| `src/config/kalkulator-seller.ts` | `FREE_ROW_LIMIT` (batas baris CSV, `null` = nonaktif) dan ukuran file maksimum. |
| `src/lib/seller.ts` | Rumus murni: untung, margin, status, harga impas/saran, timpaan Pengaturan, pembaca angka Indonesia. |
| `src/lib/seller-csv.ts` | Pembaca CSV dan template. Tampilan impor dan Web Worker ada di modul bersama `impor-csv-ui.ts` dan `csv-worker.ts`. |
| `src/lib/seller-ekspor.ts` | Baris ekspor CSV/XLSX. |
| `src/lib/seller-ui.ts`, `seller-hasil.ts`, `seller-impor.ts`, `seller-banding.ts`, `seller-tampil.ts` | Tampilan. |
| `samples/produk-contoh.csv` | 30 produk contoh, termasuk yang rugi dan 6 baris yang sengaja salah format. |

### Memperbarui angka biaya marketplace

1. Buka `src/config/biaya-marketplace.json`. Setiap angka punya `verified`, `source`, dan `catatan`.
2. Ubah angkanya dan isi `source` dengan link halaman seller center resmi. `verified: true` hanya untuk angka yang dibaca langsung dari seller center. Angka lain tetap `false`.
3. Perbarui `updatedAt` profil (format `YYYY-MM-DD`).
4. Jalankan `npm run test:seller`. Uji akan gagal bila ada angka `verified: true` tanpa link `https://`.
5. Selama masih ada angka `verified: false`, halaman menampilkan banner "Angka biaya belum diverifikasi, cek seller center resmi" beserta daftar angkanya.

Arti nilai di config:

- `null` berarti belum ada angka, sehingga pengguna mengisi sendiri.
- Persen ditulis 0-100.
- `komisi.pilihanPersen` adalah daftar tarif per kategori yang bisa dipilih.
- `komisiDinamis.perKategori` dipakai TikTok Shop berdasarkan nama kategori.
- `program[].jenis` bernilai `gratis_ongkir`, `promo`, atau `lainnya`. Nilai ini diaktifkan oleh kolom `gratis_ongkir` / `promo` atau dari Pengaturan.

Pengguna bisa menimpa semua angka dari panel **Pengaturan** di halaman, dan timpaan itu hanya tersimpan di perangkatnya.

### Rumus singkat

Semua dihitung per 1 pesanan = 1 barang. Tiap potongan dibulatkan ke rupiah penuh.

- **Harga bersih:** harga jual − diskon penjual.
- **Dasar biaya:** harga bersih atau harga jual, sesuai `dasar` profil.
- **Potongan:**
  - komisi (dengan batas maksimum bila ada)
  - komisi dinamis (khusus TikTok Shop)
  - program (gratis ongkir, promo)
  - pre-order
  - biaya transaksi
  - affiliate
  - biaya proses
  - logistik
  - iklan (Rp, atau harga bersih ÷ ROAS)
  - retur (tingkat retur × biaya per retur)
  - PPh 0,5% dari harga bersih (bila aktif)
- **Untung bersih:** harga bersih − potongan − HPP − packing.
- **Margin:** untung ÷ harga bersih.
- **Status:**
  - Rugi bila untung < 0.
  - Tipis bila margin di bawah batas sehat (bawaan 15%).
  - Sehat bila margin di atas batas itu.
- **Harga impas dan harga saran (bawaan target margin 20%):** dihitung dengan rumus tertutup, atau pencarian biner bila ada batas biaya yang tercapai. Hasilnya dibulatkan ke atas ke kelipatan Rp100 (bisa diatur).

### Format CSV

Tombol **Unduh template CSV** di halaman menghasilkan header dan 3 baris contoh.

- **Kolom wajib:** `nama_produk`, `harga_jual`, `hpp`, `marketplace` (Shopee / TikTok Shop / Tokopedia / Custom), `kategori`.
- **Kolom opsional:** `sku`, `komisi_persen`, `diskon_penjual` (Rp atau %), `affiliate_persen`, `biaya_iklan`, `roas`, `packing`, `logistik`, `retur_persen`, `biaya_retur`, `gratis_ongkir`, `promo`, `preorder`, `pph`, `terjual_per_bulan`, `stok`.
- **Kolom opsional yang kosong** memakai nilai di Pengaturan.
- **Alias header yang diterima:** `nama`, `price`, `harga`, `modal`, `cost`, `platform`, `category`, `diskon`, dan lain-lain. Huruf besar/kecil tidak dibedakan. Bila kolom wajib tidak dikenali, halaman menampilkan layar pencocokan kolom.
- **Format yang dikenali:**
  - pemisah koma, titik koma, atau tab
  - file dengan BOM UTF-8
  - angka seperti `Rp 25.000`, `25.000`, `25000`, `12,5%`, `12.5`
  - ya/tidak, y/n, true/false, 1/0
- **Baris yang salah** dilaporkan dengan nomor baris dan alasannya. Baris lain tetap dihitung.
- **Ekspor** tersedia dalam CSV (titik koma, koma desimal) dan XLSX (SheetJS 0.20.3, dimuat hanya saat tombol Excel ditekan). Isinya kolom input + semua kolom hasil, dan file ekspor bisa diimpor lagi.

### Event Meta Pixel

| Event | Kapan | Parameter |
|---|---|---|
| `seller_calc_start` | Pertama kali mengisi form atau mengimpor CSV | - |
| `seller_calc_complete` | Hasil pertama tampil | - |
| `seller_csv_import` | File CSV selesai dibaca | `baris`: `1-50`, `51-500`, `501-2000`, atau `2000+` |
| `seller_export` | Unduh hasil | `format`: `csv` atau `xlsx` |

Tidak ada nama produk atau angka yang dikirim.

Pixel dimuat hanya bila environment variable `PUBLIC_META_PIXEL_ID_SELLER` diisi di Cloudflare Pages. Per 15 Nov 2026 Pixel-nya belum dibuat, jadi halaman berjalan tanpa Pixel.

### Tes

```sh
npm run test:seller   # rumus, CSV, ekspor
npm test              # semua: HPP, Modal, Seller
```

Deploy sama dengan halaman lain: push ke `main`, lalu Cloudflare Pages menjalankan `npm run build`.

## Kalkulator Harga Pesan Antar

Halaman `/kalkulator-harga-pesan-antar/` (`src/pages/kalkulator-harga-pesan-antar.astro`) ada di menu alat beranda. Pengguna mengisi HPP satu menu, lalu melihat untuk GoFood, GrabFood, ShopeeFood, TikTok, dan profil Custom:

- harga display yang aman, beserta tombol **Salin harga**
- uang bersih yang diterima
- untung per porsi dan total potongan
- status Aman, Tipis, atau Rugi bila harga disamakan dengan harga lapak
- rincian potongan

Mode **Banyak menu (CSV)** menampilkan tabel per platform, dan hasilnya bisa diekspor ke CSV atau XLSX.

Tidak ada akun dan tidak ada backend. Menu dan file CSV dihitung di browser dan tidak dikirim ke server. Pengaturan disimpan di `localStorage` dengan kunci `jadicuan:kalkulator-pesan-antar:*`.

| File | Isi |
|---|---|
| `src/config/biaya-pesan-antar.json` | Profil potongan per platform dan tarif PPN. |
| `src/lib/food.ts` | Rumus murni: harga saran, harga impas, uang bersih, untung, dan perbandingan dengan harga lapak. |
| `src/lib/food-csv.ts`, `food-ekspor.ts` | CSV menu dan baris ekspor. |
| `src/lib/food-ui.ts`, `food-banyak.ts` | Tampilan. |
| `samples/menu-contoh.csv` | 20 baris contoh, termasuk menu yang rugi dan 4 baris yang sengaja salah. |

Beberapa modul dipakai bersama Kalkulator Untung Seller:

- `seller.ts`: pembaca angka dan format
- `seller-csv.ts`: pembaca CSV
- `impor-csv-ui.ts` dan `csv-worker.ts`: tampilan impor dan Web Worker
- `ekspor-xlsx.ts`, `penyimpanan.ts`, `form-pengaturan.ts`

### Memperbarui angka potongan

Tidak ada platform yang mempublikasikan satu tarif tunggal, karena tarif disepakati per mitra. Karena itu semua angka di config `verified: false` dan halaman selalu menampilkan banner "Angka potongan belum diverifikasi". Angka yang belum diganti pengguna diberi label "Angka referensi, belum diverifikasi".

1. Buka `src/config/biaya-pesan-antar.json`.
2. Ubah angka di profil platform:
   - `komisiPersen`
   - `komisiAntarSendiriPersen`
   - `komisiTermasukPPN`: `true`, `false`, atau `null` bila belum diketahui
   - `dasar`: `sebelum_diskon` atau `setelah_diskon`
   - `biayaTetapPerPesanan`
   - `biayaLayananPersen`
   - `biayaIklanPersen`
3. Ubah juga `tarifPPN.persen` bila perlu.
4. Perbarui `updatedAt`, `source`, dan `catatan`.
5. Jalankan `npm run test:food`.

Selama `komisiTermasukPPN` bernilai `null`, kalkulator menghitung dengan PPN ditambahkan karena itu angka yang lebih hati-hati. Kartu platform itu menampilkan peringatan sampai pengguna memilih di Pengaturan.

Pengguna bisa menimpa semua angka dari panel **Pengaturan**. Angka timpaan itulah yang dipakai.

### Rumus singkat

Notasi:

| Simbol | Arti |
|---|---|
| p | harga display |
| d | diskon dari penjual |
| c | komisi |
| t | PPN atas komisi (0 bila sudah termasuk) |
| f | biaya tetap per pesanan |
| s | biaya layanan |
| a | iklan/promo |
| h, k, o | HPP, packing, overhead |
| x | PPh 0 atau 0,5% |

Rumus:

- dibayar pembeli = p(1−d)
- dasar komisi = p atau p(1−d)
- komisi = dasar × c × (1+t)
- biaya lain = dasar × (s+a) + f
- PPh = x × dibayar pembeli
- uang bersih = dibayar pembeli − komisi − biaya lain − PPh
- untung = uang bersih − h − k − o
- margin = untung ÷ dibayar pembeli

**Acuan utama adalah harga jual di lapak (L, wajib diisi).** Harga display saran adalah harga terendah yang memenuhi dua syarat:

- uang bersih ≥ L, yaitu p ≥ (L + f) ÷ A, dengan A = bagian harga yang tersisa setelah semua potongan persen
- untung ≥ target

Jadi harga di aplikasi tidak pernah di bawah harga lapak. HPP dipakai untuk menghitung untung, tidak untuk menurunkan harga.

Untung berbanding lurus dengan p, sehingga harga impas dan harga saran memakai rumus tertutup. Harga saran dibulatkan ke atas ke kelipatan yang dipilih (bawaan Rp500), lalu untungnya dihitung ulang pada harga bulat itu. Target dibaca dalam rupiah bulat.

Status:

- **Rugi:** untung < 0.
- **Tipis:** untung di antara 0 dan target.
- **Aman:** untung ≥ target.

Status dihitung pada harga lapak bila diisi, dan pada harga saran bila tidak.

Bila input tidak valid, kalkulator menampilkan pesan yang jelas, bukan hasil tak hingga. Kasusnya:

- HPP 0 atau negatif
- diskon 100%
- total potongan 100% atau lebih
- target margin yang tidak mungkin tercapai

### Format CSV menu

Tombol **Unduh template CSV** di tab Banyak menu menghasilkan template berisi 3 contoh.

- **Kolom wajib:** `nama_menu`, `hpp`, `harga_offline` (harga jual di lapak).
- **Kolom opsional:** `packing`, serta `target_rp`, `target_margin`, `diskon`, `overhead` (menimpa Pengaturan untuk menu itu).
- **Alias header:** `nama`, `menu`, `modal`, `cost`, `kemasan`, `harga_lapak`, `harga`, `price`.
- **Toleransi format:** sama dengan kalkulator seller, yaitu pemisah koma atau titik koma, BOM, `Rp 25.000`, dan `12,5%`.
- **Pencocokan kolom:** bila header wajib tidak dikenali, halaman menampilkan layar pencocokan kolom.
- **Baris salah:** dilaporkan dengan nomor baris dan alasannya. Baris lain tetap dihitung.
- **Ekspor:** satu baris per menu per platform aktif, berisi kolom input dan semua hasil.

### Event Meta Pixel

| Event | Kapan | Parameter |
|---|---|---|
| `food_calc_start` | Pertama kali mengisi menu atau mengimpor CSV | - |
| `food_calc_complete` | Hasil pertama tampil | - |
| `food_csv_import` | CSV selesai dibaca | `baris`: `1-50` / `51-500` / `501-2000` / `2000+` |
| `food_export` | Unduh hasil | `format`: `csv` / `xlsx` |
| `food_share_click` | Tombol "Salin harga" | - |

HPP, harga, dan nama menu tidak pernah dikirim.

Pixel dimuat hanya bila `PUBLIC_META_PIXEL_ID_FOOD` diisi di Cloudflare Pages.

### Tes

```sh
npm run test:food   # rumus, CSV, ekspor
npm test            # semua kalkulator
```

Deploy sama dengan halaman lain: push ke `main`, lalu Cloudflare Pages menjalankan `npm run build`.

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
