import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const tr = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const dataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const sellerUrl = dataUrl(tr(await readFile(new URL("./seller.ts", import.meta.url), "utf8")));
const csvJs = tr(await readFile(new URL("./seller-csv.ts", import.meta.url), "utf8")).replace(/from "\.\/seller"/g, `from "${sellerUrl}"`);
const C = await import(dataUrl(csvJs));
const S = await import(sellerUrl);
const config = JSON.parse(await readFile(new URL("../config/biaya-marketplace.json", import.meta.url), "utf8"));

const bacaFile = (teks) => {
  const rows = C.pecahCsv(teks);
  const { pemetaan, hilang } = C.petakanHeader(rows[0]);
  return { rows, pemetaan, hilang, hasil: C.impor(rows, pemetaan) };
};

test("pemisah koma dan titik koma terdeteksi otomatis, BOM diabaikan", () => {
  assert.equal(C.tebakPemisah("nama;harga;hpp\nA;1;2"), ";");
  assert.equal(C.tebakPemisah("﻿nama,harga,hpp\nA,1,2"), ",");
  assert.equal(C.tebakPemisah("nama\tharga\thpp"), "\t");
  assert.equal(C.tebakPemisah('"a;b",c,d'), ","); // ; di dalam kutip tidak dihitung
  const rows = C.pecahCsv("﻿nama_produk;harga_jual\r\nKaos;75.000\r\n");
  assert.deepEqual(rows, [["nama_produk", "harga_jual"], ["Kaos", "75.000"]]);
});

test("tanda kutip, koma di dalam sel, dan baris kosong dari Excel", () => {
  const rows = C.pecahCsv('nama,harga\n"Kaos, hitam",75000\n"Topi ""keren""",20000\n,,\n\n');
  assert.deepEqual(rows, [["nama", "harga"], ["Kaos, hitam", "75000"], ['Topi "keren"', "20000"]]);
});

test("header bahasa Indonesia dan alias umum, tidak peka huruf besar", () => {
  const { pemetaan, hilang } = C.petakanHeader(["Nama", "Price", "MODAL", "Platform", "Category", "Diskon"]);
  assert.deepEqual(hilang, []);
  assert.equal(pemetaan.nama_produk, 0);
  assert.equal(pemetaan.harga_jual, 1);
  assert.equal(pemetaan.hpp, 2);
  assert.equal(pemetaan.marketplace, 3);
  assert.equal(pemetaan.diskon_penjual, 5);
  assert.equal(pemetaan.sku, -1);
  const kurang = C.petakanHeader(["produk", "harga"]);
  assert.deepEqual(kurang.hilang, ["hpp", "marketplace", "kategori"]);
  const asing = C.petakanHeader(["Barang", "Rupiah", "Ongkos"]);
  assert.equal(asing.dikenali, 0);
});

test("angka format Indonesia, persen, dan ya/tidak di CSV", () => {
  const { hasil } = bacaFile(
    "nama_produk;harga_jual;hpp;marketplace;kategori;komisi_persen;diskon_penjual;gratis_ongkir;promo;terjual_per_bulan\n" +
      "Kaos;Rp 75.000;42000;shopee;Pakaian Pria;8,25%;10%;Y;0;1.200\n" +
      "Sepatu;189,000;120.000;TikTok Shop;Sepatu;6.5;5.000;true;ya;\n",
  );
  assert.equal(hasil.error.length, 0);
  const [a, b] = hasil.produk;
  assert.equal(a.hargaJual, 75_000);
  assert.equal(a.hpp, 42_000);
  assert.equal(a.komisiPersen, 8.25);
  assert.equal(a.diskonPersen, 10);
  assert.equal(a.diskonRp, null);
  assert.equal(a.gratisOngkir, true);
  assert.equal(a.promo, false);
  assert.equal(a.terjualPerBulan, 1_200);
  assert.equal(b.hargaJual, 189_000);
  assert.equal(b.marketplace, "tiktokshop");
  assert.equal(b.komisiPersen, 6.5);
  assert.equal(b.diskonRp, 5_000);
  assert.equal(b.terjualPerBulan, null); // kosong -> pakai Pengaturan
});

test("baris salah tidak menggagalkan file: alasan jelas dengan nomor baris", () => {
  const { hasil } = bacaFile(
    "nama_produk,harga_jual,hpp,marketplace,kategori,gratis_ongkir\n" +
      "Kaos,75000,42000,Shopee,Pakaian Pria,ya\n" +
      ",50000,20000,Shopee,Pakaian Pria,\n" +
      "Jaket,seratus ribu,60000,Shopee,Pakaian Pria,\n" +
      "Topi,45000,25000,Lazada,Aksesoris,\n" +
      "Masker,12000,5000,Shopee,Kesehatan,mungkin\n" +
      "Payung,0,30000,Shopee,Rumah,\n",
  );
  assert.equal(hasil.produk.length, 1);
  assert.deepEqual(hasil.barisProduk, [2]);
  const per = Object.fromEntries(hasil.error.map((e) => [e.baris, e.alasan.join(" ")]));
  assert.match(per[3], /Nama produk kosong/);
  assert.match(per[4], /bukan angka/);
  assert.match(per[5], /tidak dikenal/);
  assert.match(per[6], /ya atau tidak/);
  assert.match(per[7], /lebih dari 0/);
});

test("file contoh samples/produk-contoh.csv: 24 baris benar, 6 baris salah, ada yang rugi", async () => {
  const teks = await readFile(new URL("../../samples/produk-contoh.csv", import.meta.url), "utf8");
  const { hasil, hilang } = bacaFile(teks);
  assert.deepEqual(hilang, []);
  assert.equal(hasil.totalBaris, 30);
  assert.equal(hasil.produk.length, 24);
  assert.equal(hasil.error.length, 6);
  const atur = { ...S.PENGATURAN_DEFAULT };
  const status = hasil.produk.map((p) => S.hitungProduk(p, config.profil[p.marketplace], atur).status);
  assert.ok(status.filter((s) => s === "rugi").length >= 3, status.join(","));
  assert.ok(status.includes("sehat") && status.includes("tipis"), status.join(","));
});

test("template CSV terbaca kembali tanpa error", () => {
  const { hasil, hilang } = bacaFile(C.buatTemplateCsv());
  assert.deepEqual(hilang, []);
  assert.equal(hasil.produk.length, 3);
  assert.equal(hasil.error.length, 0);
});

test("batas baris (FREE_ROW_LIMIT) dan 5.000 baris cepat", () => {
  const header = "nama_produk,harga_jual,hpp,marketplace,kategori\n";
  const isi = Array.from({ length: 5000 }, (_, i) => `Produk ${i},${20000 + i},${10000 + i},${i % 2 ? "Shopee" : "TikTok Shop"},Sepatu`).join("\n");
  const t = performance.now();
  const rows = C.pecahCsv(header + isi);
  const { pemetaan } = C.petakanHeader(rows[0]);
  const semua = C.impor(rows, pemetaan);
  assert.equal(semua.produk.length, 5000);
  assert.ok(performance.now() - t < 2000);
  const dibatasi = C.impor(rows, pemetaan, 100);
  assert.equal(dibatasi.produk.length, 100);
  assert.equal(dibatasi.dipotongBatas, 4900);
  assert.equal(C.rentangBaris(30), "1-50");
  assert.equal(C.rentangBaris(5000), "2000+");
});

test("sel CSV diberi kutip bila perlu", () => {
  assert.equal(C.sel("Kaos, hitam"), '"Kaos, hitam"');
  assert.equal(C.sel('Topi "keren"'), '"Topi ""keren"""');
  assert.equal(C.sel(1200), "1200");
  assert.equal(C.sel(null), "");
});
