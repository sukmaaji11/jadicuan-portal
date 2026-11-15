// Pembantu bersama kalkulator (tanpa ketergantungan lain, aman diimpor di mana saja):
// penyimpanan localStorage yang dibungkus try/catch, dan format angka untuk isian.

export function bacaSimpan<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function tulisSimpan(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* penyimpanan penuh atau diblokir: abaikan */
  }
}

/** 1250000 -> "1.250.000" untuk ditampilkan di isian. */
export function ribuan(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 12.5 -> "12,5" untuk isian persen. */
export function persenTeks(v: number | null | undefined): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "" : String(v).replace(".", ",");
}
