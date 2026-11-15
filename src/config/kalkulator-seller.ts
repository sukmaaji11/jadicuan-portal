// Pengaturan Kalkulator Untung Bersih Seller (/kalkulator-untung-seller/).
// Angka biaya marketplace ada di src/config/biaya-marketplace.json.

// Batas jumlah baris CSV untuk model berbayar nanti. null = nonaktif (semua baris diproses).
// Model harga belum diputuskan Owner; JANGAN membuat sistem pembayaran di sini.
export const FREE_ROW_LIMIT: number | null = null;

// Ukuran file CSV maksimum yang dibaca (MB), supaya HP tidak kehabisan memori.
export const MAKS_UKURAN_MB = 20;
