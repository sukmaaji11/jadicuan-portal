// Kode akses "Versi lengkap" Kalkulator Modal.
//
// Kode = muatan 8 byte + tanda tangan ECDSA P-256 (r||s, 64 byte), ditulis dalam
// Crockford base32 (116 karakter). Kode dibuat Owner dengan kunci RAHASIA di
// tools/akses-kalkulator-modal (offline). Situs hanya memegang kunci PUBLIK, jadi
// kode tidak bisa dipalsukan dari isi situs dan tidak perlu server untuk diperiksa.
//
// Kode tidak terikat ke perangkat: pembeli boleh memasukkan kode yang sama lagi
// setelah ganti HP atau menghapus data browser. Kode yang tersebar bisa diblokir
// lewat nomor serinya (BLOCKED_SERIALS di src/config/kalkulator-modal.ts).
//
// Format harus sama persis dengan tools/akses-kalkulator-modal/core.mjs
// (diuji di src/lib/akses-kode.test.mjs).

export const KODE_VERSI = 1;
export const KODE_PRODUK = 1; // 1 = Kalkulator Modal versi lengkap
const AWALAN_PESAN = "JCKM";
const PAYLOAD_BYTES = 8;
const SIGNATURE_BYTES = 64;
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const PANJANG_KODE = Math.ceil(((PAYLOAD_BYTES + SIGNATURE_BYTES) * 8) / 5); // 116
/** Hari ke-0 = 1 Januari 2026 (UTC). */
const EPOCH_MS = Date.UTC(2026, 0, 1);

export type KunciPublik = { x: string; y: string }; // JWK P-256 (base64url)

export type InfoAkses = {
  serial: number;
  /** Nomor seri yang ditampilkan ke pembeli dan dipakai untuk memblokir, mis. "KM-1A2B3C4D". */
  label: string;
  dibuat: Date;
  /** Kode bersih (tanpa spasi/tanda hubung), untuk disimpan di perangkat. */
  kode: string;
};

export type HasilPeriksa =
  | { ok: true; info: InfoAkses }
  | { ok: false; alasan: "kosong" | "format" | "tidak-cocok" | "diblokir" | "tidak-didukung" };

/** Huruf besar, buang spasi/tanda hubung/baris baru, perbaiki huruf yang mirip angka. */
export function normalisasiKode(teks: string): string {
  return teks
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/U/g, "V");
}

/** Kelompok 4 karakter agar mudah dicek mata. */
export function formatKode(kode: string): string {
  return normalisasiKode(kode).replace(/(.{4})(?=.)/g, "$1-");
}

export function labelSerial(serial: number): string {
  return `KM-${(serial >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string, byteLength: number): Uint8Array<ArrayBuffer> | null {
  const out = new Uint8Array(byteLength);
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const ch of text) {
    const digit = ALPHABET.indexOf(ch);
    if (digit < 0) return null;
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      if (index >= byteLength) return null;
      out[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  if (index !== byteLength || value !== 0) return null; // sisa bit harus nol
  return out;
}

export function buatPayload(serial: number, hari: number): Uint8Array {
  const p = new Uint8Array(PAYLOAD_BYTES);
  const view = new DataView(p.buffer);
  view.setUint8(0, KODE_VERSI);
  view.setUint8(1, KODE_PRODUK);
  view.setUint32(2, serial >>> 0);
  view.setUint16(6, hari);
  return p;
}

export function pesanTertanda(payload: Uint8Array): Uint8Array<ArrayBuffer> {
  const prefix = new TextEncoder().encode(AWALAN_PESAN);
  const msg = new Uint8Array(prefix.length + payload.length);
  msg.set(prefix, 0);
  msg.set(payload, prefix.length);
  return msg;
}

export function hariKeTanggal(hari: number): Date {
  return new Date(EPOCH_MS + hari * 86_400_000);
}

export async function periksaKode(teks: string, kunci: KunciPublik, diblokir: readonly number[] = []): Promise<HasilPeriksa> {
  const kode = normalisasiKode(teks);
  if (!kode) return { ok: false, alasan: "kosong" };
  if (kode.length !== PANJANG_KODE) return { ok: false, alasan: "format" };
  const bytes = base32Decode(kode, PAYLOAD_BYTES + SIGNATURE_BYTES);
  if (!bytes) return { ok: false, alasan: "format" };
  const payload = bytes.slice(0, PAYLOAD_BYTES);
  const signature = bytes.slice(PAYLOAD_BYTES);
  const view = new DataView(payload.buffer);
  if (view.getUint8(0) !== KODE_VERSI || view.getUint8(1) !== KODE_PRODUK) return { ok: false, alasan: "tidak-didukung" };
  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: kunci.x, y: kunci.y, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, pesanTertanda(payload));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, alasan: "tidak-cocok" };
  const serial = view.getUint32(2);
  if (diblokir.includes(serial)) return { ok: false, alasan: "diblokir" };
  return { ok: true, info: { serial, label: labelSerial(serial), dibuat: hariKeTanggal(view.getUint16(6)), kode } };
}

export const PESAN_GAGAL: Record<Exclude<HasilPeriksa, { ok: true }>["alasan"], string> = {
  kosong: "Tempel kode akses dulu.",
  format: "Kode belum lengkap atau ada huruf yang salah. Salin ulang seluruh kode dari pesan kami.",
  "tidak-cocok": "Kode tidak cocok. Salin ulang seluruh kode dari pesan kami, atau hubungi kami.",
  diblokir: "Kode ini sudah tidak berlaku. Hubungi kami kalau kamu merasa ini keliru.",
  "tidak-didukung": "Kode ini bukan untuk Kalkulator Modal.",
};
