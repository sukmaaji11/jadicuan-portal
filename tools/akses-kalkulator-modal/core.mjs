// Inti pembuat kode akses Kalkulator Modal (Owner/Admin saja, OFFLINE).
// Dipakai oleh admin.mjs (Node) dan disalin ke admin.html (browser) oleh build-admin.mjs.
// Format harus sama dengan src/lib/akses-kode.ts (situs hanya memeriksa, tidak membuat).
// Hanya memakai Web Crypto, jadi berjalan di Node 20+ dan Chrome/Edge.

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const KODE_VERSI = 1;
const KODE_PRODUK = 1;
const AWALAN_PESAN = "JCKM";
const EPOCH_MS = Date.UTC(2026, 0, 1);
export const SITUS = "https://jadicuan.co.id/kalkulator-modal/";

export function base32Encode(bytes) {
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

export function labelSerial(serial) {
  return `KM-${(serial >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

export function formatKode(kode) {
  return kode.replace(/(.{4})(?=.)/g, "$1-");
}

/** Nomor hari menurut tanggal WIB (UTC+7), supaya tanggal kode sama dengan kalender Owner. */
export function hariIni(now = Date.now()) {
  return Math.max(0, Math.floor((now + 7 * 3_600_000 - EPOCH_MS) / 86_400_000));
}

/** Pasangan kunci baru. Simpan `rahasia` di tempat aman; `publik` (x, y) masuk ke config situs. */
export async function buatPasanganKunci() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const rahasia = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    format: "jadicuan-akses-kalkulator-modal",
    versi: 1,
    dibuat: new Date().toISOString(),
    rahasia,
    publik: { x: rahasia.x, y: rahasia.y },
  };
}

/** Baca dan periksa file kunci rahasia (JSON dari buatPasanganKunci). */
export async function bacaKunci(json) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  if (data?.format !== "jadicuan-akses-kalkulator-modal" || data?.rahasia?.kty !== "EC" || !data.rahasia.d) {
    throw new Error("Ini bukan file kunci rahasia Kalkulator Modal.");
  }
  const key = await crypto.subtle.importKey("jwk", data.rahasia, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { key, publik: data.publik };
}

function serialAcak() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0];
}

/** Buat satu kode. Nomor seri acak 32-bit, jadi CLI dan halaman admin tidak perlu berbagi urutan. */
export async function buatKode(kunci, { serial = serialAcak(), hari = hariIni() } = {}) {
  const payload = new Uint8Array(8);
  const view = new DataView(payload.buffer);
  view.setUint8(0, KODE_VERSI);
  view.setUint8(1, KODE_PRODUK);
  view.setUint32(2, serial >>> 0);
  view.setUint16(6, hari);
  const prefix = new TextEncoder().encode(AWALAN_PESAN);
  const msg = new Uint8Array(prefix.length + payload.length);
  msg.set(prefix, 0);
  msg.set(payload, prefix.length);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kunci.key, msg));
  const all = new Uint8Array(payload.length + sig.length);
  all.set(payload, 0);
  all.set(sig, payload.length);
  const kode = base32Encode(all);
  return {
    serial: serial >>> 0,
    label: labelSerial(serial),
    tanggal: new Date(EPOCH_MS + hari * 86_400_000).toISOString().slice(0, 10),
    kode,
    tautan: `${SITUS}#kode=${kode}`,
  };
}

/** Pesan WhatsApp siap kirim ke pembeli. */
export function pesanWhatsApp(hasil, nama = "") {
  return [
    `Halo${nama ? ` ${nama}` : ""}, terima kasih sudah membeli Versi Lengkap Kalkulator Modal JadiCuan.`,
    "",
    "Buka tautan ini untuk mengaktifkan:",
    hasil.tautan,
    "",
    "Atau tempel kode akses ini di halaman kalkulator (bagian Versi lengkap → Sudah punya kode akses?):",
    formatKode(hasil.kode),
    "",
    `Nomor seri: ${hasil.label}. Simpan pesan ini. Kode yang sama bisa dipakai lagi kalau kamu ganti HP.`,
    "Mohon jangan dibagikan ke orang lain.",
  ].join("\n");
}
