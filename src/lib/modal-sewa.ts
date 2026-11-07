// Kapan penjelasan "sewa dihitung di dua tempat" ditampilkan di Kalkulator
// Modal. Hanya teks/tampilan: rumus tetap di src/lib/modal.ts dan tidak berubah.
//
// Keputusan Owner: sewa setahun masuk modal awal, sewa per bulan tetap masuk
// biaya bulanan (dan cadangan kas) agar perkiraan hati-hati, karena tahun
// berikutnya sewa harus dibayar lagi.

type SewaInput = { sewaSetahun: number | null; sewaBulanan: number | null };

const positif = (value: number | null) =>
  value !== null && Number.isFinite(value) && value > 0;

/** True bila sewa setahun DAN sewa per bulan sama-sama diisi lebih dari 0. */
export function sewaDihitungDuaKali(input: SewaInput): boolean {
  return positif(input.sewaSetahun) && positif(input.sewaBulanan);
}

/** True bila sewa per bulan diisi lebih dari 0 (catatan di titik impas). */
export function adaSewaBulanan(input: SewaInput): boolean {
  return positif(input.sewaBulanan);
}

export const CATATAN_RINGKASAN_SEWA =
  "Catatan: perhitungan sengaja hati-hati, sewa dihitung di modal awal dan biaya bulanan.";

export const CATATAN_BEP_SEWA = "Titik impas ini sudah termasuk sewa bulanan.";
