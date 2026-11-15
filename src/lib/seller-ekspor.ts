// Ekspor hasil Kalkulator Untung Seller: kolom input + semua kolom hasil. Fungsi murni untuk
// menyusun baris (diuji di seller-ekspor.test.mjs). CSV memakai titik koma dan koma desimal
// supaya langsung rapi di Excel berbahasa Indonesia; XLSX (SheetJS) menyimpan angka asli.
import type { HasilProduk, Produk } from "./seller";

export type Sel = string | number | null;

export const KOLOM_EKSPOR = [
  "nama_produk",
  "sku",
  "marketplace",
  "kategori",
  "harga_jual",
  "hpp",
  "diskon_penjual",
  "komisi_persen",
  "komisi_dinamis_persen",
  "affiliate_persen",
  "biaya_iklan_input",
  "roas",
  "packing",
  "logistik_input",
  "retur_persen",
  "biaya_retur",
  "gratis_ongkir",
  "promo",
  "preorder",
  "pph",
  "terjual_per_bulan",
  "harga_bersih",
  "komisi",
  "komisi_dinamis",
  "program",
  "biaya_preorder",
  "biaya_transaksi",
  "komisi_affiliate",
  "biaya_proses",
  "biaya_logistik",
  "biaya_iklan",
  "biaya_retur_per_pesanan",
  "pph_rp",
  "total_potongan",
  "untung_bersih",
  "margin_persen",
  "status",
  "harga_impas",
  "harga_saran",
  "untung_per_bulan",
  "catatan",
] as const;

const ya = (v: boolean | null | undefined) => (v === true ? "ya" : v === false ? "tidak" : "");
const n = (v: number | null | undefined): Sel => (v === null || v === undefined || !Number.isFinite(v) ? null : v);

export function barisEkspor(
  data: Array<{ produk: Produk; hasil: HasilProduk }>,
  namaMarketplace: (id: Produk["marketplace"]) => string,
  catatan: (h: HasilProduk) => string,
): Sel[][] {
  const rows: Sel[][] = [[...KOLOM_EKSPOR]];
  for (const { produk: p, hasil: h } of data) {
    const r = h.rincian;
    rows.push([
      p.nama,
      p.sku ?? "",
      namaMarketplace(p.marketplace),
      p.kategori,
      p.hargaJual,
      p.hpp,
      p.diskonRp !== null && p.diskonRp !== undefined ? p.diskonRp : p.diskonPersen !== null && p.diskonPersen !== undefined ? `${String(p.diskonPersen).replace(".", ",")}%` : "",
      h.komisiPersen,
      h.komisiDinamisPersen,
      n(p.affiliatePersen),
      n(p.biayaIklan),
      n(p.roas),
      n(p.packing),
      n(p.logistik),
      n(p.returPersen),
      n(p.biayaRetur),
      ya(p.gratisOngkir),
      ya(p.promo),
      ya(p.preorder),
      ya(p.pph),
      n(p.terjualPerBulan),
      h.hargaBersih,
      r.komisi,
      r.komisiDinamis,
      r.program,
      r.preorder,
      r.transaksi,
      r.affiliate,
      r.proses,
      r.logistik,
      r.iklan,
      r.retur,
      r.pph,
      h.totalPotongan,
      h.untung,
      h.margin === null ? null : Math.round(h.margin * 10000) / 100,
      h.status === "rugi" ? "Rugi" : h.status === "tipis" ? "Tipis" : "Sehat",
      n(h.hargaImpas),
      n(h.hargaSaran),
      n(h.untungBulanan),
      catatan(h),
    ]);
  }
  return rows;
}

/** CSV untuk Excel Indonesia: pemisah ;, koma desimal, BOM supaya huruf tidak rusak. */
export function keCsv(rows: Sel[][]): string {
  const sel = (v: Sel) => {
    if (v === null) return "";
    const s = typeof v === "number" ? String(v).replace(".", ",") : v;
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(sel).join(";")).join("\r\n") + "\r\n";
}

export function namaFileEkspor(ekstensi: "csv" | "xlsx", tanggal = new Date()): string {
  const t = `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}-${String(tanggal.getDate()).padStart(2, "0")}`;
  return `untung-bersih-seller-${t}.${ekstensi}`;
}
