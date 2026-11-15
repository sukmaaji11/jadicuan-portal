import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const tr = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const dataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const sellerUrl = dataUrl(tr(await readFile(new URL("./seller.ts", import.meta.url), "utf8")));
const S = await import(sellerUrl);
const csvJs = tr(await readFile(new URL("./seller-csv.ts", import.meta.url), "utf8")).replace(/from "\.\/seller"/g, `from "${sellerUrl}"`);
const C = await import(dataUrl(csvJs));
const E = await import(dataUrl(tr(await readFile(new URL("./seller-ekspor.ts", import.meta.url), "utf8"))));
const config = JSON.parse(await readFile(new URL("../config/biaya-marketplace.json", import.meta.url), "utf8"));
const nama = (id) => config.profil[id].nama;

const p = { nama: 'Kaos "polos"; hitam', sku: "K-1", hargaJual: 100_000, hpp: 60_000, marketplace: "shopee", kategori: "Pakaian Pria", komisiPersen: 9.5, packing: 1_000, diskonPersen: 12.5, gratisOngkir: false, terjualPerBulan: 10 };
const h = S.hitungProduk(p, config.profil.shopee, S.PENGATURAN_DEFAULT);

test("baris ekspor: kolom input + semua kolom hasil, nilainya sama dengan hasil hitung", () => {
  const rows = E.barisEkspor([{ produk: p, hasil: h }], nama, () => "");
  assert.equal(rows.length, 2);
  const header = rows[0];
  const row = Object.fromEntries(header.map((k, i) => [k, rows[1][i]]));
  assert.equal(row.nama_produk, p.nama);
  assert.equal(row.marketplace, "Shopee");
  assert.equal(row.diskon_penjual, "12,5%");
  assert.equal(row.gratis_ongkir, "tidak");
  assert.equal(row.untung_bersih, h.untung);
  assert.equal(row.total_potongan, h.totalPotongan);
  assert.equal(row.harga_impas, h.hargaImpas);
  assert.equal(row.status, h.status === "sehat" ? "Sehat" : h.status === "tipis" ? "Tipis" : "Rugi");
  assert.equal(row.untung_per_bulan, h.untung * 10);
  assert.equal(row.margin_persen, Math.round(h.margin * 10000) / 100);
  for (const k of ["komisi", "biaya_proses", "pph_rp", "harga_saran"]) assert.ok(header.includes(k), k);
});

test("CSV ekspor: titik koma, koma desimal, kutip aman, dan bisa dibaca lagi oleh impor", () => {
  const rows = E.barisEkspor([{ produk: p, hasil: h }], nama, () => "Catatan; penting");
  const csv = E.keCsv(rows);
  assert.ok(csv.startsWith("﻿nama_produk;sku;marketplace"));
  const parsed = C.pecahCsv(csv);
  assert.equal(parsed[1][0], 'Kaos "polos"; hitam');
  assert.equal(parsed[1][parsed[0].indexOf("catatan")], "Catatan; penting");
  assert.equal(parsed[1][parsed[0].indexOf("komisi_persen")], "9,5");
  // Hasil ekspor bisa diimpor ulang (kolom input dikenali, kolom hasil diabaikan).
  const { pemetaan, hilang } = C.petakanHeader(parsed[0]);
  assert.deepEqual(hilang, []);
  const ulang = C.impor(parsed, pemetaan);
  assert.equal(ulang.error.length, 0);
  assert.equal(S.hitungProduk(ulang.produk[0], config.profil.shopee, S.PENGATURAN_DEFAULT).untung, h.untung);
});

test("nama file ekspor bertanggal", () => {
  assert.equal(E.namaFileEkspor("xlsx", new Date(2026, 10, 15)), "untung-bersih-seller-2026-11-15.xlsx");
});
