import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const tr = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const F = await import(`data:text/javascript;base64,${Buffer.from(tr(await readFile(new URL("./food.ts", import.meta.url), "utf8"))).toString("base64")}`);
const config = JSON.parse(await readFile(new URL("../config/biaya-pesan-antar.json", import.meta.url), "utf8"));

// Profil sederhana untuk hitungan tangan: komisi 20% sudah termasuk PPN + Rp1.000 per pesanan.
const dasar = {
  nama: "Uji",
  updatedAt: "2026-11-15",
  verified: false,
  komisiPersen: 20,
  komisiAntarSendiriPersen: null,
  rentangDilaporkan: null,
  dasar: "sebelum_diskon",
  komisiTermasukPPN: true,
  biayaTetapPerPesanan: 1000,
  biayaLayananPersen: 0,
  biayaIklanPersen: 0,
  source: [],
  catatan: "",
};
const atur = (o = {}) => ({ ...F.PENGATURAN_FOOD_DEFAULT, ...o });
const menu = { nama: "Nasi goreng", hpp: 10_000, packing: 1_000 };

test("tanpa diskon: harga impas dan harga saran (margin 20%) dengan rumus tertutup", () => {
  const h = F.hitungFood(menu, "custom", dasar, atur());
  assert.equal(h.ok, true);
  // untung(p) = 0,8p - 12.000 -> impas 15.000; margin 20%: 0,6p = 12.000 -> 20.000
  assert.equal(h.hargaImpas, 15_000);
  assert.equal(h.hargaSaran, 20_000);
  assert.equal(h.saran.rincian.komisi, 4_000);
  assert.equal(h.saran.rincian.biayaTetap, 1_000);
  assert.equal(h.saran.uangBersih, 15_000);
  assert.equal(h.saran.untung, 4_000);
  assert.equal(h.saran.margin, 0.2);
  assert.equal(h.saran.persenPotongan, 0.25);
  assert.equal(h.status, "aman");
});

test("harga impas yang dihitung ulang memberi untung ~0", () => {
  for (const p of [dasar, { ...dasar, komisiTermasukPPN: false }, { ...dasar, dasar: "setelah_diskon" }]) {
    const m = { ...menu, diskonPersen: 12.5, overhead: 750 };
    const h = F.hitungFood(m, "custom", p, atur({ pph: true }));
    const tepat = h.hargaImpas; // dibulatkan ke atas ke rupiah
    assert.ok(F.untungTepat(tepat, m, p, atur({ pph: true })) >= 0);
    assert.ok(F.untungTepat(tepat - 1, m, p, atur({ pph: true })) < 0);
    assert.ok(Math.abs(F.untungTepat(tepat, m, p, atur({ pph: true }))) < 1);
  }
});

test("dengan diskon penjual: dasar komisi sebelum vs sesudah diskon", () => {
  const m = { ...menu, diskonPersen: 10 };
  const sebelum = F.hitungFood(m, "custom", dasar, atur());
  const sesudah = F.hitungFood(m, "custom", { ...dasar, dasar: "setelah_diskon" }, atur());
  // sebelum: untung = 0,9p - 0,2p - 12.000 = 0,7p - 12.000 -> impas 17.143
  assert.equal(sebelum.hargaImpas, 17_143);
  // sesudah: untung = 0,9p - 0,18p - 12.000 = 0,72p - 12.000 -> impas 16.667
  assert.equal(sesudah.hargaImpas, 16_667);
  // pada harga yang sama, dasar sesudah diskon memotong lebih sedikit
  assert.ok(sesudah.saran.harga <= sebelum.saran.harga);
  const s20 = F.hitungFood({ ...m, hargaOffline: 20_000 }, "custom", dasar, atur()).offline;
  assert.equal(s20.hargaBayar, 18_000);
  assert.equal(s20.rincian.komisi, 4_000); // 20% x 20.000
  const t20 = F.hitungFood({ ...m, hargaOffline: 20_000 }, "custom", { ...dasar, dasar: "setelah_diskon" }, atur()).offline;
  assert.equal(t20.rincian.komisi, 3_600); // 20% x 18.000
});

test("PPN ditambahkan di atas komisi vs sudah termasuk", () => {
  const off = { ...menu, hargaOffline: 20_000 };
  const termasuk = F.hitungFood(off, "custom", dasar, atur()).offline;
  const ditambah = F.hitungFood(off, "custom", { ...dasar, komisiTermasukPPN: false }, atur({ tarifPPNPersen: 11 })).offline;
  assert.equal(termasuk.rincian.ppnKomisi, 0);
  assert.equal(ditambah.rincian.komisi, 4_000);
  assert.equal(ditambah.rincian.ppnKomisi, 440);
  assert.equal(ditambah.untung, termasuk.untung - 440);
  // 0,778p = 12.000 -> 15.424,2 -> 15.425
  assert.equal(F.hitungFood(menu, "custom", { ...dasar, komisiTermasukPPN: false }, atur()).hargaImpas, 15_425);
});

test("status PPN belum dipilih: dihitung dengan PPN ditambahkan + peringatan", () => {
  const h = F.hitungFood(menu, "gofood", config.profil.gofood, atur());
  assert.ok(h.peringatan.includes("ppn-belum-dipilih"));
  assert.equal(h.ppnDitambahkan, true);
  const shopee = F.hitungFood(menu, "shopeefood", config.profil.shopeefood, atur());
  assert.ok(!shopee.peringatan.includes("ppn-belum-dipilih"));
  assert.equal(shopee.ppnDitambahkan, false);
  const dipilih = F.hitungFood(menu, "gofood", F.terapkanTimpaanFood(config.profil.gofood, { komisiTermasukPPN: true }), atur());
  assert.deepEqual(dipilih.peringatan, []);
});

test("biaya tetap per pesanan (GoFood Rp1.000) ikut di rincian", () => {
  const h = F.hitungFood({ ...menu, hargaOffline: 25_000 }, "gofood", config.profil.gofood, atur());
  assert.equal(h.offline.rincian.biayaTetap, 1_000);
  assert.equal(h.offline.rincian.komisi, 5_000);
  assert.equal(h.offline.rincian.ppnKomisi, 550);
  assert.equal(h.offline.uangBersih, 25_000 - 5_000 - 550 - 1_000);
});

test("PPh 0,5% dari harga bayar pembeli bila aktif", () => {
  const h = F.hitungFood({ ...menu, hargaOffline: 20_000, diskonPersen: 10 }, "custom", dasar, atur({ pph: true }));
  assert.equal(h.offline.rincian.pph, 90); // 0,5% x 18.000
  assert.equal(F.hitungFood({ ...menu, hargaOffline: 20_000 }, "custom", dasar, atur()).offline.rincian.pph, 0);
});

test("harga disamakan dengan lapak: rugi, tipis, aman + bocor dan kenaikan harga", () => {
  const rugi = F.hitungFood({ ...menu, hargaOffline: 12_000 }, "custom", dasar, atur());
  assert.equal(rugi.offline.untung, 12_000 - 2_400 - 1_000 - 11_000);
  assert.equal(rugi.status, "rugi");
  const tipis = F.hitungFood({ ...menu, hargaOffline: 15_000 }, "custom", dasar, atur());
  assert.equal(tipis.offline.untung, 0);
  assert.equal(tipis.status, "tipis");
  assert.equal(tipis.offline.targetPadaOffline, 3_000); // 20% x 15.000
  assert.equal(tipis.offline.bocor, 3_000);
  assert.equal(tipis.kenaikanRp, 5_000); // saran 20.000 - 15.000
  assert.ok(Math.abs(tipis.kenaikanPersen - 1 / 3) < 1e-9);
  const aman = F.hitungFood({ ...menu, hargaOffline: 25_000 }, "custom", dasar, atur());
  assert.equal(aman.status, "aman");
  assert.equal(aman.offline.bocor, 0);
});

test("target untung dalam rupiah", () => {
  const h = F.hitungFood(menu, "custom", dasar, atur({ modeTarget: "rp", targetRp: 3_000 }));
  // 0,8p = 15.000 -> 18.750 -> kelipatan 500 -> 19.000
  assert.equal(h.hargaSaran, 19_000);
  assert.equal(h.saran.untung, 3_200);
  assert.equal(h.target, 3_000);
  // target per menu menimpa Pengaturan
  assert.equal(F.hitungFood({ ...menu, targetRp: 5_000 }, "custom", dasar, atur()).target, 5_000);
});

test("pembulatan ke atas tidak pernah membuat untung di bawah target (2.000 kombinasi acak)", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let i = 0; i < 2000; i++) {
    const p = { ...dasar, komisiPersen: Math.round(rnd() * 35 * 4) / 4, komisiTermasukPPN: rnd() < 0.5, biayaTetapPerPesanan: Math.round(rnd() * 3000), biayaLayananPersen: Math.round(rnd() * 5), dasar: rnd() < 0.5 ? "sebelum_diskon" : "setelah_diskon" };
    const m = { nama: "x", hpp: 1000 + Math.round(rnd() * 60000), packing: Math.round(rnd() * 3000), diskonPersen: Math.round(rnd() * 30) };
    const s = atur({ modeTarget: rnd() < 0.5 ? "rp" : "margin", targetRp: Math.round(rnd() * 8000), targetMarginPersen: Math.round(rnd() * 30), kelipatan: [1, 100, 500, 1000][Math.floor(rnd() * 4)], pph: rnd() < 0.3 });
    const h = F.hitungFood(m, "custom", p, s);
    if (!h.ok) continue;
    const target = Math.round(s.modeTarget === "rp" ? s.targetRp : (s.targetMarginPersen / 100) * h.saran.hargaBayar);
    assert.ok(h.saran.untung >= target, JSON.stringify({ i, p, m, s, h: h.saran }));
    assert.equal(h.hargaSaran % s.kelipatan, 0);
    const total = Object.values(h.saran.rincian).reduce((a, b) => a + b, 0);
    assert.equal(h.saran.uangBersih, h.saran.hargaBayar - total);
  }
});

test("input tidak valid: pesan jelas, tidak crash, tidak tak hingga", () => {
  assert.equal(F.hitungFood({ ...menu, hpp: 0 }, "custom", dasar, atur()).masalah, "hpp-tidak-valid");
  assert.equal(F.hitungFood({ ...menu, hpp: -500 }, "custom", dasar, atur()).masalah, "hpp-tidak-valid");
  assert.equal(F.hitungFood({ ...menu, hpp: Number.NaN }, "custom", dasar, atur()).masalah, "hpp-tidak-valid");
  assert.equal(F.hitungFood(menu, "custom", { ...dasar, komisiPersen: 60, biayaLayananPersen: 40 }, atur()).masalah, "potongan-100");
  assert.equal(F.hitungFood(menu, "custom", { ...dasar, komisiPersen: 95, komisiTermasukPPN: false }, atur()).masalah, "potongan-100");
  assert.equal(F.hitungFood(menu, "custom", dasar, atur({ targetMarginPersen: 85 })).masalah, "target-tidak-tercapai");
  assert.equal(F.hitungFood({ ...menu, diskonPersen: 100 }, "custom", dasar, atur()).masalah, "diskon-100");
  for (const k of ["hpp-tidak-valid", "diskon-100", "potongan-100", "target-tidak-tercapai"]) assert.ok(F.PESAN_MASALAH[k]);
});

test("TikTok komisi 0% dan antar sendiri tanpa angka: peringatan", () => {
  const t = F.hitungFood(menu, "tiktok", config.profil.tiktok, atur());
  assert.ok(t.peringatan.includes("komisi-nol"));
  const g = F.hitungFood(menu, "grabfood", config.profil.grabfood, atur(), "antar_sendiri");
  assert.ok(g.peringatan.includes("komisi-antar-sendiri-kosong"));
  assert.equal(g.komisiPersen, 30);
  const g2 = F.hitungFood(menu, "grabfood", F.terapkanTimpaanFood(config.profil.grabfood, { komisiAntarSendiriPersen: 20 }), atur(), "antar_sendiri");
  assert.equal(g2.komisiPersen, 20);
});

test("config: semua profil ada, semua angka verified:false, sumber https", () => {
  for (const id of F.PLATFORMS) {
    const p = config.profil[id];
    assert.ok(p, id);
    assert.equal(p.verified, false, id);
    for (const s of p.source) assert.match(s, /^https:\/\//);
  }
  assert.equal(config.profil.gofood.komisiPersen, 20);
  assert.equal(config.profil.gofood.biayaTetapPerPesanan, 1000);
  assert.equal(config.profil.grabfood.komisiPersen, 30);
  assert.equal(config.profil.shopeefood.komisiTermasukPPN, true);
  assert.equal(config.profil.tiktok.komisiPersen, 0);
  for (const id of ["gofood", "grabfood", "tiktok"]) assert.equal(config.profil[id].komisiTermasukPPN, null);
});
