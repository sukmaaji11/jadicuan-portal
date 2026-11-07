// Konfigurasi uji harga "Versi lengkap" di /kalkulator-modal/.
// Versi lengkap BELUM ADA. Ini hanya uji minat: tidak ada pembayaran dan
// tidak ada data pribadi yang dikumpulkan.
//
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
