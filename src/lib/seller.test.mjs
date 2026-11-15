import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./seller.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const S = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const config = JSON.parse(await readFile(new URL("../config/biaya-marketplace.json", import.meta.url), "utf8"));
const shopee = config.profil.shopee;
const tiktok = config.profil.tiktokshop;
const custom = config.profil.custom;
const atur = (o = {}) => ({ ...S.PENGATURAN_DEFAULT, ...o });

const dasar = { nama: "Kaos polos", hargaJual: 100_000, hpp: 60_000, marketplace: "shopee", kategori: "Pakaian Pria", komisiPersen: 9.5, packing: 1_000 };

test("tanpa diskon: komisi + biaya proses, margin sehat", () => {
  const h = S.hitungProduk(dasar, shopee, atur());
  assert.equal(h.hargaBersih, 100_000);
  assert.equal(h.rincian.komisi, 9_500);
  assert.equal(h.rincian.proses, 1_250);
  assert.equal(h.totalPotongan, 10_750);
  assert.equal(h.untung, 100_000 - 10_750 - 60_000 - 1_000); // 28.250
  assert.equal(h.status, "sehat");
  assert.ok(Math.abs(h.margin - 0.2825) < 1e-9);
  assert.deepEqual(h.peringatan, []);
});

test("dengan diskon penjual (Rp dan %): komisi dihitung dari harga setelah diskon", () => {
  const rp = S.hitungProduk({ ...dasar, diskonRp: 10_000 }, shopee, atur());
  const pct = S.hitungProduk({ ...dasar, diskonPersen: 10 }, shopee, atur());
  for (const h of [rp, pct]) {
    assert.equal(h.hargaBersih, 90_000);
    assert.equal(h.rincian.komisi, 8_550);
    assert.equal(h.untung, 90_000 - 8_550 - 1_250 - 60_000 - 1_000);
  }
  // Dasar sebelum diskon (bisa diatur per profil)
  const sebelum = S.hitungProduk({ ...dasar, diskonRp: 10_000 }, S.terapkanTimpaan(shopee, { dasar: "sebelum_diskon" }), atur());
  assert.equal(sebelum.rincian.komisi, 9_500);
});

test("harga impas dan harga saran (rumus tertutup), dihitung ulang memberi untung ~0", () => {
  const h = S.hitungProduk(dasar, shopee, atur());
  // 0,905 x P - 62.250 = 0 -> 68.784,53 -> dibulatkan ke atas ke Rp100
  assert.equal(h.hargaImpas, 68_800);
  assert.ok(S.untungPadaHarga(dasar, shopee, 62_250 / 0.905, atur()) > -1e-6 && S.untungPadaHarga(dasar, shopee, 62_250 / 0.905, atur()) < 1e-6);
  assert.ok(S.untungPadaHarga(dasar, shopee, h.hargaImpas, atur()) >= 0);
  assert.ok(S.untungPadaHarga(dasar, shopee, h.hargaImpas - 100, atur()) < 0);
  // Target margin 20%: 0,705 x P = 62.250 -> 88.297,87 -> 88.300
  assert.equal(h.hargaSaran, 88_300);
  const cek = S.hitungProduk({ ...dasar, hargaJual: h.hargaSaran }, shopee, atur());
  assert.ok(cek.margin >= 0.2 - 1e-4);
});

test("batas komisi tercapai: komisi dinamis TikTok dibatasi Rp60.000, harga impas lewat pencarian biner", () => {
  const p = { nama: "Sepatu kulit", hargaJual: 2_000_000, hpp: 1_500_000, marketplace: "tiktokshop", kategori: "Sepatu", komisiPersen: 5 };
  const h = S.hitungProduk(p, tiktok, atur());
  assert.equal(h.komisiDinamisPersen, 8);
  assert.equal(h.rincian.komisiDinamis, 60_000); // 8% x 2 jt = 160 rb -> dibatasi
  assert.equal(h.rincian.komisi, 100_000);
  assert.equal(h.untung, 2_000_000 - 100_000 - 60_000 - 1_250 - 1_500_000);
  // Tanpa batas: 0,87P = 1.501.250 -> P=1.725.575 (8% = 138 rb > batas Rp60.000), jadi batas berlaku:
  // 0,95P - 60.000 - 1.250 - 1.500.000 = 0 -> P = 1.643.421,05 -> 1.643.500
  assert.equal(h.hargaImpas, 1_643_500);
  const akar = (60_000 + 1_250 + 1_500_000) / 0.95;
  assert.ok(Math.abs(S.untungPadaHarga(p, tiktok, akar, atur())) < 1e-3);
  assert.ok(S.untungPadaHarga(p, tiktok, h.hargaImpas - 100, atur()) < 0);
});

test("ROAS: biaya iklan = harga bersih / ROAS; Rp iklan diutamakan bila keduanya diisi", () => {
  const h = S.hitungProduk({ ...dasar, roas: 5 }, shopee, atur());
  assert.equal(h.rincian.iklan, 20_000);
  const rp = S.hitungProduk({ ...dasar, roas: 5, biayaIklan: 3_000 }, shopee, atur());
  assert.equal(rp.rincian.iklan, 3_000);
  const diskon = S.hitungProduk({ ...dasar, roas: 4, diskonRp: 20_000 }, shopee, atur());
  assert.equal(diskon.rincian.iklan, 20_000); // 80.000 / 4
  // Harga impas tetap konsisten dengan ROAS (iklan ikut naik bersama harga)
  assert.ok(S.untungPadaHarga({ ...dasar, roas: 5 }, shopee, h.hargaImpas, atur()) >= 0);
});

test("retur: tingkat retur x biaya per retur", () => {
  const h = S.hitungProduk({ ...dasar, returPersen: 10, biayaRetur: 15_000 }, shopee, atur());
  assert.equal(h.rincian.retur, 1_500);
});

test("PPh 0,5% dari harga bersih bila aktif (default tidak)", () => {
  assert.equal(S.hitungProduk(dasar, shopee, atur()).rincian.pph, 0);
  const h = S.hitungProduk({ ...dasar, pph: true, diskonRp: 10_000 }, shopee, atur());
  assert.equal(h.rincian.pph, 450);
  const global = S.hitungProduk(dasar, shopee, atur({ pph: true }));
  assert.equal(global.rincian.pph, 500);
});

test("hasil rugi: status Rugi, margin minus, harga impas di atas harga jual", () => {
  const h = S.hitungProduk({ ...dasar, hpp: 95_000 }, shopee, atur());
  assert.ok(h.untung < 0);
  assert.equal(h.status, "rugi");
  assert.ok(h.hargaImpas > 100_000);
});

test("status Tipis di antara 0 dan batas sehat; batas sehat bisa diatur", () => {
  const h = S.hitungProduk({ ...dasar, hpp: 80_000 }, shopee, atur()); // untung 8.250 = 8,25%
  assert.equal(h.status, "tipis");
  assert.equal(S.hitungProduk({ ...dasar, hpp: 80_000 }, shopee, atur({ batasSehatPersen: 8 })).status, "sehat");
});

test("program opsional: Promo XTRA 4,5% dengan batas Rp60.000; Gratis Ongkir tanpa persen diberi peringatan", () => {
  const mahal = { ...dasar, hargaJual: 2_000_000, hpp: 1_000_000, promo: true };
  assert.equal(S.hitungProduk(mahal, shopee, atur()).rincian.program, 60_000);
  assert.equal(S.hitungProduk({ ...dasar, promo: true }, shopee, atur()).rincian.program, 4_500);
  const go = S.hitungProduk({ ...dasar, gratisOngkir: true }, shopee, atur());
  assert.ok(go.peringatan.includes("program-persen-kosong"));
  const goIsi = S.hitungProduk({ ...dasar, gratisOngkir: true }, S.terapkanTimpaan(shopee, { program: { gratisOngkirXtra: { persen: 6 } } }), atur());
  assert.equal(goIsi.rincian.program, 6_000);
});

test("pre-order 3% dan biaya logistik TikTok", () => {
  const p = { nama: "Tas", hargaJual: 200_000, hpp: 100_000, marketplace: "tiktokshop", kategori: "Koper & Tas", komisiPersen: 6, preorder: true, logistik: 2_000 };
  const h = S.hitungProduk(p, tiktok, atur());
  assert.equal(h.rincian.preorder, 6_000);
  assert.equal(h.rincian.logistik, 2_000);
  assert.equal(h.rincian.komisiDinamis, 16_000);
});

test("komisi belum diisi dan kategori tidak dikenal: dihitung 0 dengan peringatan", () => {
  const h = S.hitungProduk({ nama: "X", hargaJual: 50_000, hpp: 20_000, marketplace: "tiktokshop", kategori: "Barang aneh" }, tiktok, atur());
  assert.deepEqual(h.peringatan.sort(), ["kategori-dinamis-tidak-dikenal", "komisi-kosong"]);
  assert.equal(h.rincian.komisi, 0);
  // Komisi dari Pengaturan global per marketplace
  const g = S.hitungProduk({ nama: "X", hargaJual: 50_000, hpp: 20_000, marketplace: "tiktokshop", kategori: "Sepatu" }, tiktok, atur({ komisiPersen: { shopee: null, tiktokshop: 4, custom: 0 } }));
  assert.equal(g.rincian.komisi, 2_000);
  assert.deepEqual(g.peringatan, []);
});

test("pencocokan kategori komisi dinamis: persis, sebagian unik, atau tidak ada", () => {
  assert.equal(S.cariKomisiDinamis(tiktok, "sepatu"), 8);
  assert.equal(S.cariKomisiDinamis(tiktok, "Ponsel & elektronik"), 3);
  assert.equal(S.cariKomisiDinamis(tiktok, "Elektronik"), 3);
  assert.equal(S.cariKomisiDinamis(tiktok, "Pakaian"), null); // ambigu: pria / wanita
  assert.equal(S.cariKomisiDinamis(shopee, "Sepatu"), null); // Shopee tidak punya komisi dinamis
});

test("tidak mungkin impas bila potongan persen >= 100%", () => {
  const h = S.hitungProduk({ ...dasar, komisiPersen: 60, affiliatePersen: 45 }, shopee, atur());
  assert.equal(h.hargaImpas, null);
  assert.equal(h.hargaSaran, null);
});

test("rincian selalu pas dijumlahkan dengan untung bersih (pembulatan per komponen)", () => {
  const p = { ...dasar, hargaJual: 33_333, hpp: 12_345, komisiPersen: 8.25, roas: 7, returPersen: 3.3, biayaRetur: 12_345, pph: true, promo: true, diskonPersen: 7 };
  const h = S.hitungProduk(p, shopee, atur());
  const total = Object.values(h.rincian).reduce((a, b) => a + b, 0);
  assert.equal(total, h.totalPotongan);
  assert.equal(h.untung, h.hargaBersih - h.totalPotongan - h.hpp - h.packing);
  for (const v of Object.values(h.rincian)) assert.ok(Number.isInteger(v));
});

test("untung bulanan dan ringkasan", () => {
  const a = S.hitungProduk({ ...dasar, terjualPerBulan: 30 }, shopee, atur());
  const b = S.hitungProduk({ ...dasar, hpp: 95_000 }, shopee, atur());
  const c = S.hitungProduk({ ...dasar, hpp: 80_000, terjualPerBulan: 10 }, shopee, atur());
  assert.equal(a.untungBulanan, a.untung * 30);
  assert.equal(b.untungBulanan, null);
  const r = S.ringkas([a, b, c]);
  assert.deepEqual([r.jumlah, r.rugi, r.tipis, r.sehat], [3, 1, 1, 1]);
  assert.equal(r.untungBulanan, a.untung * 30 + c.untung * 10);
  assert.equal(S.ringkas([b]).untungBulanan, null);
});

test("timpaan pengguna dan daftar angka belum terverifikasi", () => {
  const t = S.terapkanTimpaan(shopee, { biayaProses: 0, komisiBatasMaks: 5_000 });
  const h = S.hitungProduk(dasar, t, atur());
  assert.equal(h.rincian.proses, 0);
  assert.equal(h.rincian.komisi, 5_000);
  assert.equal(shopee.biayaProses.nilai, 1_250); // config asli tidak berubah
  const belum = S.belumTerverifikasi(shopee);
  assert.ok(belum.includes("Gratis Ongkir XTRA") && belum.includes("PPh 0,5%"));
  assert.ok(!belum.includes("Biaya administrasi") && !belum.includes("Promo XTRA"));
  assert.ok(S.belumTerverifikasi(tiktok).includes("Komisi dinamis"));
  assert.ok(S.belumTerverifikasi(custom).length > 0);
});

test("format Indonesia", () => {
  assert.equal(S.formatRp(25_000), "Rp 25.000");
  assert.equal(S.formatRp(-1_500.4), "-Rp 1.500");
  assert.equal(S.formatPersen(0.125), "12,5%");
  assert.equal(S.formatPersen(null), "-");
});

test("config: setiap profil lengkap dan angka verified:true punya sumber https", () => {
  for (const [id, p] of Object.entries(config.profil)) {
    for (const key of ["komisi", "biayaProses", "biayaTransaksi", "preorder", "pph"]) assert.ok(p[key], `${id}.${key}`);
    for (const s of [p.komisi, p.komisiDinamis, p.biayaProses, p.biayaLogistik, p.biayaTransaksi, p.preorder, p.pph, ...p.program]) {
      if (s?.verified) assert.match(s.source, /^https:\/\//, `${id}: ${s.nama ?? ""}`);
    }
  }
});

test("membaca angka format Indonesia dan ekspor Excel", () => {
  const rp = (t) => S.bacaAngka(t, "rp");
  assert.equal(rp("Rp 25.000"), 25_000);
  assert.equal(rp("Rp25.000"), 25_000);
  assert.equal(rp("25.000"), 25_000);
  assert.equal(rp("25000"), 25_000);
  assert.equal(rp("1.250.000"), 1_250_000);
  assert.equal(rp("25,000"), 25_000);
  assert.equal(rp("1.250,50"), 1_250.5);
  assert.equal(rp("1,250.50"), 1_250.5);
  assert.equal(rp(" Rp 2.500 "), 2_500);
  assert.equal(rp("-5.000"), -5_000);
  assert.equal(rp(""), null);
  assert.equal(rp("abc"), null);
  assert.equal(rp("1.2.3"), null);
  const pct = (t) => S.bacaAngka(t, "persen");
  assert.equal(pct("12,5%"), 12.5);
  assert.equal(pct("12.5"), 12.5);
  assert.equal(pct("10"), 10);
  assert.equal(pct("8,25 %"), 8.25);
  assert.equal(S.bacaAngka(42), 42);
});

test("membaca ya/tidak dan nama marketplace", () => {
  for (const t of ["ya", "Y", "true", "1", "Iya"]) assert.equal(S.bacaYaTidak(t), true);
  for (const t of ["tidak", "n", "FALSE", "0", "ga"]) assert.equal(S.bacaYaTidak(t), false);
  assert.equal(S.bacaYaTidak(""), null);
  assert.equal(S.bacaYaTidak("mungkin"), null);
  assert.equal(S.bacaMarketplace("Shopee"), "shopee");
  for (const t of ["TikTok Shop", "tokopedia", "TTS", "Tiktok"]) assert.equal(S.bacaMarketplace(t), "tiktokshop");
  assert.equal(S.bacaMarketplace("Lazada"), null);
});
