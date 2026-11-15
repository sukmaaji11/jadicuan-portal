// Impor CSV Kalkulator Harga Pesan Antar (mode banyak menu). Pembacaan CSV (pemisah otomatis,
// BOM, kutip) dan angka Indonesia dipakai ulang dari modul Kalkulator Untung Seller.
// Bentuk hasil sama dengan seller-csv (produk, barisProduk, error, ...) supaya tampilan impor
// bersama (impor-csv-ui.ts) bisa dipakai keduanya.
import { bacaAngka } from "./seller";
import { normalHeader, sel } from "./seller-csv";
import type { Menu } from "./food";

export type KolomMenu = "nama_menu" | "hpp" | "packing" | "harga_offline" | "target_rp" | "target_margin" | "diskon" | "overhead";
export const KOLOM_WAJIB_MENU: KolomMenu[] = ["nama_menu", "hpp"];
export const LABEL_KOLOM_MENU: Record<KolomMenu, string> = {
  nama_menu: "Nama menu",
  hpp: "HPP / modal per porsi",
  packing: "Packing per porsi (Rp)",
  harga_offline: "Harga di lapak (Rp)",
  target_rp: "Target untung per porsi (Rp)",
  target_margin: "Target margin (%)",
  diskon: "Diskon dari kamu (%)",
  overhead: "Overhead per porsi (Rp)",
};
const ALIAS: Record<KolomMenu, string[]> = {
  nama_menu: ["nama_menu", "nama", "menu", "nama_produk", "produk", "item", "name"],
  hpp: ["hpp", "modal", "cost", "harga_modal", "hpp_per_porsi", "modal_per_porsi"],
  packing: ["packing", "kemasan", "biaya_packing"],
  harga_offline: ["harga_offline", "harga_lapak", "harga", "harga_jual", "price", "harga_toko"],
  target_rp: ["target_rp", "target_untung", "target"],
  target_margin: ["target_margin", "target_persen", "margin"],
  diskon: ["diskon", "diskon_persen", "diskon_penjual"],
  overhead: ["overhead", "biaya_overhead"],
};

export type PemetaanMenu = Record<KolomMenu, number>;
export type HasilImporMenu = {
  produk: Menu[];
  barisProduk: number[];
  error: Array<{ baris: number; alasan: string[] }>;
  totalBaris: number;
  dipotongBatas: number;
};

export function petakanHeaderMenu(header: string[]): { pemetaan: PemetaanMenu; hilang: KolomMenu[]; dikenali: number } {
  const norm = header.map(normalHeader);
  const pemetaan = {} as PemetaanMenu;
  const terpakai = new Set<number>();
  let dikenali = 0;
  for (const k of Object.keys(ALIAS) as KolomMenu[]) {
    let idx = -1;
    for (const a of ALIAS[k]) {
      const i = norm.findIndex((h, j) => h === a && !terpakai.has(j));
      if (i >= 0) {
        idx = i;
        break;
      }
    }
    pemetaan[k] = idx;
    if (idx >= 0) {
      terpakai.add(idx);
      dikenali++;
    }
  }
  return { pemetaan, hilang: KOLOM_WAJIB_MENU.filter((k) => pemetaan[k] < 0), dikenali };
}

export function barisKeMenu(row: string[], p: PemetaanMenu): { produk: Menu } | { alasan: string[] } {
  const ambil = (k: KolomMenu) => (p[k] >= 0 ? (row[p[k]] ?? "").trim() : "");
  const alasan: string[] = [];
  const angka = (k: KolomMenu, jenis: "rp" | "persen", wajib = false) => {
    const t = ambil(k);
    if (!t) {
      if (wajib) alasan.push(`${LABEL_KOLOM_MENU[k]} kosong.`);
      return null;
    }
    const v = bacaAngka(t, jenis);
    if (v === null) alasan.push(`${LABEL_KOLOM_MENU[k]} "${t.slice(0, 30)}" bukan angka.`);
    else if (v < 0) alasan.push(`${LABEL_KOLOM_MENU[k]} tidak boleh minus.`);
    return v !== null && v >= 0 ? v : null;
  };
  const nama = ambil("nama_menu");
  if (!nama) alasan.push("Nama menu kosong.");
  const hpp = angka("hpp", "rp", true);
  if (hpp === 0) alasan.push("HPP harus lebih dari 0.");
  const menu: Menu = {
    nama,
    hpp: hpp ?? 0,
    packing: angka("packing", "rp"),
    hargaOffline: angka("harga_offline", "rp"),
    targetRp: angka("target_rp", "rp"),
    targetMarginPersen: angka("target_margin", "persen"),
    diskonPersen: angka("diskon", "persen"),
    overhead: angka("overhead", "rp"),
  };
  if ((menu.targetMarginPersen ?? 0) >= 100) alasan.push("Target margin harus di bawah 100%.");
  if ((menu.diskonPersen ?? 0) >= 100) alasan.push("Diskon harus di bawah 100%.");
  return alasan.length ? { alasan } : { produk: menu };
}

export function imporMenu(rows: string[][], pemetaan: PemetaanMenu, batas: number | null = null): HasilImporMenu {
  const data = rows.slice(1);
  const diproses = batas !== null && batas >= 0 ? data.slice(0, batas) : data;
  const hasil: HasilImporMenu = { produk: [], barisProduk: [], error: [], totalBaris: data.length, dipotongBatas: data.length - diproses.length };
  diproses.forEach((row, i) => {
    const r = barisKeMenu(row, pemetaan);
    if ("produk" in r) {
      hasil.produk.push(r.produk);
      hasil.barisProduk.push(i + 2);
    } else hasil.error.push({ baris: i + 2, alasan: r.alasan });
  });
  return hasil;
}

export const HEADER_TEMPLATE_MENU: KolomMenu[] = ["nama_menu", "hpp", "packing", "harga_offline"];

export function buatTemplateMenu(): string {
  const baris = [
    HEADER_TEMPLATE_MENU,
    ["Nasi goreng ayam", "11.500", "1.500", "20.000"],
    ["Es teh jumbo", "2.200", "800", "5.000"],
    ["Ayam geprek sambal matah", "13.000", "2.000", "22.000"],
  ];
  return "﻿" + baris.map((r) => r.map(sel).join(";")).join("\r\n") + "\r\n";
}
