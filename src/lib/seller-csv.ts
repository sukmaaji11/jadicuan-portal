// Impor CSV Kalkulator Untung Seller. Fungsi murni (tanpa DOM) supaya bisa diuji dan dijalankan
// di Web Worker. Toleran terhadap ekspor Excel Indonesia: pemisah koma/titik koma/tab
// (deteksi otomatis), BOM UTF-8, tanda kutip, angka "Rp 25.000" / "12,5%", ya/tidak.
// Baris yang salah tidak menggagalkan file: dilaporkan dengan nomor baris dan alasannya.
import { bacaAngka, bacaMarketplace, bacaYaTidak, type Produk } from "./seller";

export type Kolom =
  | "nama_produk"
  | "sku"
  | "harga_jual"
  | "hpp"
  | "marketplace"
  | "kategori"
  | "komisi_persen"
  | "diskon_penjual"
  | "affiliate_persen"
  | "biaya_iklan"
  | "roas"
  | "packing"
  | "logistik"
  | "retur_persen"
  | "biaya_retur"
  | "gratis_ongkir"
  | "promo"
  | "preorder"
  | "pph"
  | "terjual_per_bulan"
  | "stok";

export const KOLOM_WAJIB: Kolom[] = ["nama_produk", "harga_jual", "hpp", "marketplace", "kategori"];

export const LABEL_KOLOM: Record<Kolom, string> = {
  nama_produk: "Nama produk",
  sku: "SKU",
  harga_jual: "Harga jual",
  hpp: "HPP / modal",
  marketplace: "Marketplace",
  kategori: "Kategori",
  komisi_persen: "Komisi / biaya admin (%)",
  diskon_penjual: "Diskon penjual (Rp atau %)",
  affiliate_persen: "Komisi affiliate (%)",
  biaya_iklan: "Biaya iklan per pesanan (Rp)",
  roas: "ROAS",
  packing: "Packing (Rp)",
  logistik: "Biaya logistik (Rp)",
  retur_persen: "Tingkat retur (%)",
  biaya_retur: "Biaya per retur (Rp)",
  gratis_ongkir: "Gratis ongkir (ya/tidak)",
  promo: "Program promo (ya/tidak)",
  preorder: "Pre-order (ya/tidak)",
  pph: "PPh 0,5% (ya/tidak)",
  terjual_per_bulan: "Terjual per bulan",
  stok: "Stok",
};

// Nama lain yang sering dipakai (sudah dinormalkan: huruf kecil, selain huruf/angka jadi "_").
const ALIAS: Record<Kolom, string[]> = {
  nama_produk: ["nama_produk", "nama", "produk", "nama_barang", "product", "product_name", "name", "item"],
  sku: ["sku", "kode", "kode_produk", "kode_sku"],
  harga_jual: ["harga_jual", "harga", "price", "harga_produk", "selling_price"],
  hpp: ["hpp", "modal", "cost", "harga_modal", "harga_pokok", "harga_beli", "cogs"],
  marketplace: ["marketplace", "platform", "toko", "channel"],
  kategori: ["kategori", "category", "kategori_produk"],
  komisi_persen: ["komisi_persen", "komisi", "biaya_admin", "admin", "admin_persen", "komisi_admin"],
  diskon_penjual: ["diskon_penjual", "diskon", "voucher", "discount", "potongan"],
  affiliate_persen: ["affiliate_persen", "affiliate", "komisi_affiliate"],
  biaya_iklan: ["biaya_iklan", "iklan", "ads", "biaya_ads"],
  roas: ["roas"],
  packing: ["packing", "kemasan", "biaya_packing"],
  logistik: ["logistik", "biaya_logistik", "biaya_layanan_logistik"],
  retur_persen: ["retur_persen", "retur", "return", "tingkat_retur"],
  biaya_retur: ["biaya_retur", "ongkos_retur"],
  gratis_ongkir: ["gratis_ongkir", "free_ongkir", "gratisongkir", "ongkir_xtra"],
  promo: ["promo", "promo_xtra", "program_promo"],
  preorder: ["preorder", "pre_order", "po"],
  pph: ["pph", "pph_final", "pajak"],
  terjual_per_bulan: ["terjual_per_bulan", "terjual", "sold", "penjualan_per_bulan", "terjual_bulan"],
  stok: ["stok", "stock", "qty"],
};

export const HEADER_TEMPLATE: Kolom[] = [
  "nama_produk",
  "sku",
  "harga_jual",
  "hpp",
  "marketplace",
  "kategori",
  "komisi_persen",
  "diskon_penjual",
  "affiliate_persen",
  "biaya_iklan",
  "roas",
  "packing",
  "retur_persen",
  "biaya_retur",
  "gratis_ongkir",
  "promo",
  "terjual_per_bulan",
];

/** Template dengan 3 baris contoh (pemisah titik koma, cocok untuk Excel Indonesia). */
export function buatTemplateCsv(): string {
  const baris = [
    HEADER_TEMPLATE,
    ["Kaos polos hitam", "KAOS-01", "75.000", "42.000", "Shopee", "Pakaian Pria", "8,25", "5.000", "", "", "6", "1.500", "2", "15.000", "ya", "tidak", "120"],
    ["Sepatu sneakers", "SPT-02", "189.000", "120.000", "TikTok Shop", "Sepatu", "6", "10%", "5", "8.000", "", "2.000", "3", "25.000", "tidak", "ya", "40"],
    ["Keripik pedas 200 g", "KRP-03", "18.000", "12.500", "Tokopedia", "Makanan & Minuman", "6", "", "", "", "", "1.000", "", "", "tidak", "tidak", "300"],
  ];
  return "﻿" + baris.map((r) => r.map(sel).join(";")).join("\r\n") + "\r\n";
}

/** Tulis satu sel CSV dengan tanda kutip bila perlu. */
export function sel(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";,\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function normalHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Tebak pemisah dari baris pertama (di luar tanda kutip): ; , atau tab. */
export function tebakPemisah(teks: string): string {
  const baris = teks.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  let kutip = false;
  const hitung: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of baris) {
    if (ch === '"') kutip = !kutip;
    else if (!kutip && ch in hitung) hitung[ch]++;
  }
  const [terbaik] = Object.entries(hitung).sort((a, b) => b[1] - a[1]);
  return terbaik[1] > 0 ? terbaik[0] : ",";
}

/** Pecah teks CSV menjadi baris dan sel (RFC 4180: kutip ganda, baris baru di dalam kutip). */
export function pecahCsv(teks: string, pemisah = tebakPemisah(teks)): string[][] {
  const s = teks.replace(/^﻿/, "");
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let kutip = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (kutip) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i++;
        } else kutip = false;
      } else cell += ch;
    } else if (ch === '"') kutip = true;
    else if (ch === pemisah) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  // Buang baris kosong total (mis. baris terakhir atau ;;;; dari Excel).
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Pemetaan: indeks kolom di file untuk tiap Kolom (atau -1 bila tidak ada). */
export type Pemetaan = Record<Kolom, number>;

export function petakanHeader(header: string[]): { pemetaan: Pemetaan; hilang: Kolom[]; dikenali: number } {
  const norm = header.map(normalHeader);
  const pemetaan = {} as Pemetaan;
  const terpakai = new Set<number>();
  let dikenali = 0;
  for (const kolom of Object.keys(ALIAS) as Kolom[]) {
    let idx = -1;
    for (const alias of ALIAS[kolom]) {
      const i = norm.findIndex((h, j) => h === alias && !terpakai.has(j));
      if (i >= 0) {
        idx = i;
        break;
      }
    }
    pemetaan[kolom] = idx;
    if (idx >= 0) {
      terpakai.add(idx);
      dikenali++;
    }
  }
  return { pemetaan, hilang: KOLOM_WAJIB.filter((k) => pemetaan[k] < 0), dikenali };
}

export type ErrorBaris = { baris: number; alasan: string[] };
export type HasilImpor = {
  produk: Produk[];
  barisProduk: number[]; // nomor baris file (1 = header) untuk tiap produk
  error: ErrorBaris[];
  totalBaris: number;
  dipotongBatas: number; // jumlah baris yang tidak diproses karena batas
};

/** Ubah sel menjadi Produk, atau daftar alasan bila tidak valid. */
export function barisKeProduk(row: string[], p: Pemetaan): { produk: Produk } | { alasan: string[] } {
  const ambil = (k: Kolom) => (p[k] >= 0 ? (row[p[k]] ?? "").trim() : "");
  const alasan: string[] = [];
  const angka = (k: Kolom, jenis: "rp" | "persen" | "angka", wajib = false) => {
    const t = ambil(k);
    if (!t) {
      if (wajib) alasan.push(`${LABEL_KOLOM[k]} kosong.`);
      return null;
    }
    const v = bacaAngka(t, jenis);
    if (v === null) alasan.push(`${LABEL_KOLOM[k]} "${t.slice(0, 30)}" bukan angka.`);
    else if (v < 0) alasan.push(`${LABEL_KOLOM[k]} tidak boleh minus.`);
    return v !== null && v >= 0 ? v : null;
  };
  const yaTidak = (k: Kolom) => {
    const t = ambil(k);
    if (!t) return null;
    const v = bacaYaTidak(t);
    if (v === null) alasan.push(`${LABEL_KOLOM[k]} "${t.slice(0, 20)}" harus ya atau tidak.`);
    return v;
  };

  const nama = ambil("nama_produk");
  if (!nama) alasan.push("Nama produk kosong.");
  const hargaJual = angka("harga_jual", "rp", true);
  if (hargaJual === 0) alasan.push("Harga jual harus lebih dari 0.");
  const hpp = angka("hpp", "rp", true);
  const mpTeks = ambil("marketplace");
  const marketplace = bacaMarketplace(mpTeks);
  if (!mpTeks) alasan.push("Marketplace kosong.");
  else if (!marketplace) alasan.push(`Marketplace "${mpTeks.slice(0, 20)}" tidak dikenal. Pakai Shopee, TikTok Shop, Tokopedia, atau Custom.`);
  const kategori = ambil("kategori");
  if (!kategori) alasan.push("Kategori kosong.");

  const diskonTeks = ambil("diskon_penjual");
  let diskonRp: number | null = null;
  let diskonPersen: number | null = null;
  if (diskonTeks) {
    const persen = diskonTeks.includes("%");
    const v = bacaAngka(diskonTeks, persen ? "persen" : "rp");
    if (v === null || v < 0) alasan.push(`Diskon penjual "${diskonTeks.slice(0, 20)}" bukan angka.`);
    else if (persen) diskonPersen = v;
    else diskonRp = v;
  }

  const produk: Produk = {
    nama,
    sku: ambil("sku") || undefined,
    hargaJual: hargaJual ?? 0,
    hpp: hpp ?? 0,
    marketplace: marketplace ?? "custom",
    kategori,
    komisiPersen: angka("komisi_persen", "persen"),
    diskonRp,
    diskonPersen,
    affiliatePersen: angka("affiliate_persen", "persen"),
    biayaIklan: angka("biaya_iklan", "rp"),
    roas: angka("roas", "persen"),
    packing: angka("packing", "rp"),
    logistik: angka("logistik", "rp"),
    returPersen: angka("retur_persen", "persen"),
    biayaRetur: angka("biaya_retur", "rp"),
    gratisOngkir: yaTidak("gratis_ongkir"),
    promo: yaTidak("promo"),
    preorder: yaTidak("preorder"),
    pph: yaTidak("pph"),
    terjualPerBulan: angka("terjual_per_bulan", "rp"),
    stok: angka("stok", "rp"),
  };
  for (const k of ["komisi_persen", "affiliate_persen", "retur_persen"] as Kolom[]) {
    const v = k === "komisi_persen" ? produk.komisiPersen : k === "affiliate_persen" ? produk.affiliatePersen : produk.returPersen;
    if (v !== null && v !== undefined && v > 100) alasan.push(`${LABEL_KOLOM[k]} lebih dari 100%.`);
  }
  if (produk.diskonPersen !== null && produk.diskonPersen !== undefined && produk.diskonPersen > 100) alasan.push("Diskon penjual lebih dari 100%.");
  return alasan.length ? { alasan } : { produk };
}

/** Proses seluruh isi (tanpa header). `batas` = feature flag FREE_ROW_LIMIT (null = tanpa batas). */
export function impor(rows: string[][], pemetaan: Pemetaan, batas: number | null = null): HasilImpor {
  const data = rows.slice(1);
  const diproses = batas !== null && batas >= 0 ? data.slice(0, batas) : data;
  const hasil: HasilImpor = { produk: [], barisProduk: [], error: [], totalBaris: data.length, dipotongBatas: data.length - diproses.length };
  diproses.forEach((row, i) => {
    const nomor = i + 2; // baris 1 = header
    const r = barisKeProduk(row, pemetaan);
    if ("produk" in r) {
      hasil.produk.push(r.produk);
      hasil.barisProduk.push(nomor);
    } else hasil.error.push({ baris: nomor, alasan: r.alasan });
  });
  return hasil;
}

/** Rentang jumlah baris untuk pelacakan event (bukan jumlah persisnya). */
export function rentangBaris(n: number): string {
  if (n <= 50) return "1-50";
  if (n <= 500) return "51-500";
  if (n <= 2000) return "501-2000";
  return "2000+";
}
