// Ekspor Kalkulator Harga Pesan Antar: satu baris per menu per platform, kolom input + semua
// kolom hasil. CSV memakai keCsv() milik kalkulator seller (titik koma, koma desimal, BOM).
import type { HasilFood, Menu } from "./food";
import type { Sel } from "./seller-ekspor";

export const KOLOM_EKSPOR_FOOD = [
  "nama_menu",
  "platform",
  "hpp",
  "packing",
  "harga_offline",
  "komisi_persen",
  "ppn_atas_komisi",
  "harga_display_saran",
  "dibayar_pembeli",
  "komisi",
  "ppn_komisi",
  "biaya_tetap",
  "biaya_layanan",
  "iklan_promo",
  "pph",
  "total_potongan",
  "uang_bersih",
  "untung_per_porsi",
  "margin_persen",
  "target_untung",
  "harga_impas",
  "status_di_harga_lapak",
  "untung_di_harga_lapak",
  "kurang_dari_target",
  "kenaikan_rp",
  "kenaikan_persen",
  "catatan",
] as const;

const persen = (v: number | null) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 100);
const n = (v: number | null | undefined): Sel => (v === null || v === undefined || !Number.isFinite(v) ? null : v);

export function barisEksporFood(
  data: Array<{ menu: Menu; hasil: Array<{ nama: string; h: HasilFood }> }>,
  catatan: (h: HasilFood) => string,
): Sel[][] {
  const rows: Sel[][] = [[...KOLOM_EKSPOR_FOOD]];
  for (const { menu, hasil } of data) {
    for (const { nama, h } of hasil) {
      const awal: Sel[] = [menu.nama, nama, menu.hpp, n(menu.packing), n(menu.hargaOffline)];
      if (!h.ok) {
        rows.push([...awal, ...Array(KOLOM_EKSPOR_FOOD.length - awal.length - 1).fill(null), catatan(h)]);
        continue;
      }
      const s = h.saran;
      const o = h.offline;
      rows.push([
        ...awal,
        h.komisiPersen,
        h.ppnDitambahkan ? "ditambahkan" : "sudah termasuk",
        h.hargaSaran,
        s.hargaBayar,
        s.rincian.komisi,
        s.rincian.ppnKomisi,
        s.rincian.biayaTetap,
        s.rincian.layanan,
        s.rincian.iklan,
        s.rincian.pph,
        s.totalPotongan,
        s.uangBersih,
        s.untung,
        persen(s.margin),
        h.target,
        h.hargaImpas,
        o ? (h.status === "rugi" ? "Rugi" : h.status === "tipis" ? "Tipis" : "Aman") : "",
        o ? o.untung : null,
        o ? o.bocor : null,
        n(h.kenaikanRp),
        persen(h.kenaikanPersen),
        catatan(h),
      ]);
    }
  }
  return rows;
}

export function namaFileEksporFood(ekstensi: "csv" | "xlsx", tanggal = new Date()): string {
  const t = `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}-${String(tanggal.getDate()).padStart(2, "0")}`;
  return `harga-pesan-antar-${t}.${ekstensi}`;
}
