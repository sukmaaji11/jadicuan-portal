// Konfigurasi "Versi lengkap" di /kalkulator-modal/.
//
// ---------------- Penjualan ----------------
// Pembayaran TIDAK terjadi di situs ini. Tombol beli membuka landing page Scalev;
// setelah pembayaran, Owner membuat kode akses (tools/akses-kalkulator-modal/admin.html)
// dan mengirimnya ke pembeli. Situs tidak menyimpan data pembeli atau data kartu.
//
// - dijual: false = kartu versi lengkap masih uji minat ("Kabari aku saat tersedia").
//   true = tombol "Beli versi lengkap" ke urlPembelian + kolom "Sudah punya kode akses?".
//   Tautan aktivasi (#kode=...) selalu berfungsi, juga saat dijual = false (untuk uji Owner).
// - urlPembelian: tautan landing page Scalev. Wajib diisi sebelum dijual = true.
// - harga: harga final (Rp). null = uji harga di bawah tetap berjalan.
//   Harga di sini HARUS sama dengan harga di landing page Scalev.
export const VERSI_LENGKAP: { dijual: boolean; urlPembelian: string; harga: number | null } = {
  // dijual tetap false sampai isi landing page Scalev sudah untuk Kalkulator Modal (14 Nov 2026:
  // halaman masih berisi teks, harga Rp149.000, dan testimoni produk Valuasi Oto).
  dijual: false,
  urlPembelian: "https://jadicuan.myscalev.com/kalkulator-modal-usaha-25k",
  harga: 25000,
};

// ---------------- Kode akses ----------------
// Kunci PUBLIK untuk memeriksa kode (aman di repositori). Pasangannya, kunci RAHASIA,
// hanya ada di komputer Owner: Documents\JadiCuanAdmin\kalkulator-modal-kunci-rahasia.json.
// Mengganti kunci ini membuat SEMUA kode yang sudah dikirim tidak berlaku.
export const KUNCI_PUBLIK_AKSES = {
  x: "Xt9rBcEfOzmwYYp8HsX9D4GwmmV2MWRXzElrOqiYk90",
  y: "GaoRPEzurfMx2G_W4BCxWXBJ9K9ehdKb0bRwb-BH67U",
} as const;

// Nomor seri kode yang diblokir (mis. tersebar di grup). Tulis dalam heksadesimal sesuai
// label, contoh "KM-1A2B3C4D" -> 0x1a2b3c4d. Berlaku setelah situs dideploy ulang.
export const SERIAL_DIBLOKIR: readonly number[] = [];

// ---------------- Uji harga (selama harga belum final) ----------------
// - SHOW_PRICE_TEST: false untuk menyembunyikan baris harga. Klik tetap
//   dicatat dengan price_variant "off".
// - PRICE_TEST_VARIANTS: dua harga yang diuji. Tiap pengunjung mendapat satu
//   varian secara acak, disimpan di localStorage supaya tetap sama.
//   Kalau `id` diganti, pengunjung lama otomatis mendapat varian baru.
export const SHOW_PRICE_TEST = true;

export const PRICE_TEST_VARIANTS = [
  { id: "79000", price: 79000 },
  { id: "99000", price: 99000 },
] as const;
