import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./modal.ts", import.meta.url), "utf8");
const { outputText, diagnostics } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.deepEqual(
  diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error),
  [],
);

const {
  calculateModal,
  emptyModalInput,
  sewaBulananDariSetahun,
  formatRupiah,
  formatRibuan,
  formatBulan,
  parseBulat,
  parsePersen,
  CONTOH_CEPAT,
} = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const input = (overrides = {}) => ({ ...emptyModalInput(), ...overrides });

// Usaha lengkap: dihitung manual di komentar.
const lengkap = input({
  sewaSetahun: 12_000_000,
  peralatan: 8_000_000,
  renovasi: 2_000_000,
  bahanBakuAwal: 1_000_000,
  perizinan: 500_000,
  hargaJual: 15_000,
  targetHarian: 40,
  hariBuka: 26,
  persenHPP: 50,
  sewaBulanan: 1_000_000,
  gajiKaryawan: 2_000_000,
  utilitas: 500_000,
  persenPlatform: 0,
});

test("usaha lengkap: penjualan, laba, modal, balik modal, BEP", () => {
  const r = calculateModal(lengkap);
  assert.equal(r.penjualanBulanan, 15_600_000); // 15.000 × 40 × 26
  assert.equal(r.biayaBahan, 7_800_000); // 50%
  assert.equal(r.biayaPlatform, 0);
  assert.equal(r.biayaOperasionalBulanan, 3_500_000);
  assert.equal(r.labaBersihBulanan, 4_300_000);
  assert.equal(r.danaTakTerduga, 1_000_000); // 10% × (8 jt + 2 jt)
  assert.equal(r.cadanganKas, 10_500_000); // 3 × 3,5 jt
  assert.equal(r.totalModalAwal, 35_000_000);
  assert.equal(r.balikModalBulan, 35_000_000 / 4_300_000);
  // 3.500.000 / (26 × 7.500) = 17,95 → minimal 18 porsi
  assert.ok(Math.abs(r.bepHarian - 3_500_000 / (26 * 7_500)) < 1e-9);
  assert.equal(r.bepHarianPorsi, 18);
  assert.equal(r.bepStatus, "ok");
  assert.equal(r.dibawahBep, false);
  assert.deepEqual(r.belumDiisi, []);
  assert.deepEqual(r.peringatan, []);
});

test("rincian modal berisi semua komponen dan jumlahnya sama dengan total", () => {
  const r = calculateModal(lengkap);
  assert.equal(r.rincianModal.length, 7);
  assert.equal(
    r.rincianModal.reduce((s, i) => s + i.amount, 0),
    r.totalModalAwal,
  );
});

test("biaya platform mengurangi laba dan menaikkan BEP", () => {
  const r = calculateModal({ ...lengkap, persenPlatform: 20 });
  assert.equal(r.biayaPlatform, 3_120_000);
  assert.equal(r.labaBersihBulanan, 1_180_000);
  // 3.500.000 / (26 × 15.000 × 0,3) = 29,9 → 30
  assert.equal(r.bepHarianPorsi, 30);
});

test("gaji sendiri hanya dihitung bila dicentang", () => {
  const tanpa = calculateModal({ ...lengkap, gajiSendiri: 3_000_000 });
  const dengan = calculateModal({ ...lengkap, gajiSendiri: 3_000_000, hitungGajiSendiri: true });
  assert.equal(tanpa.biayaOperasionalBulanan, 3_500_000);
  assert.equal(dengan.biayaOperasionalBulanan, 6_500_000);
  assert.equal(dengan.cadanganKas, 19_500_000);
});

test("usaha tanpa sewa (di rumah atau keliling)", () => {
  const r = calculateModal({ ...lengkap, sewaSetahun: null, sewaBulanan: null });
  assert.equal(r.rincianModal.find((i) => i.key === "sewaSetahun").amount, 0);
  assert.equal(r.biayaOperasionalBulanan, 2_500_000);
  assert.equal(r.totalModalAwal, 8_000_000 + 2_000_000 + 1_000_000 + 500_000 + 1_000_000 + 7_500_000);
  assert.ok(r.balikModalBulan > 0);
});

test("sewa per bulan otomatis = sewa setahun / 12, dibulatkan", () => {
  assert.equal(sewaBulananDariSetahun(12_000_000), 1_000_000);
  assert.equal(sewaBulananDariSetahun(10_000_000), 833_333);
  assert.equal(sewaBulananDariSetahun(null), null);
  assert.equal(sewaBulananDariSetahun(0), null);
});

test("laba negatif: balik modal null dan target di bawah BEP", () => {
  const r = calculateModal({ ...lengkap, targetHarian: 10 });
  assert.ok(r.labaBersihBulanan < 0);
  assert.equal(r.balikModalBulan, null);
  assert.equal(r.bepHarianPorsi, 18);
  assert.equal(r.dibawahBep, true);
});

test("laba tepat nol: balik modal null, target sama dengan BEP tidak dianggap di bawah", () => {
  // Untung per porsi 10.000 × 50% = 5.000; 26 hari × 20 porsi × 5.000 = 2.600.000
  const r = calculateModal(input({ hargaJual: 10_000, targetHarian: 20, persenHPP: 50, gajiKaryawan: 2_600_000 }));
  assert.equal(r.labaBersihBulanan, 0);
  assert.equal(r.balikModalBulan, null);
  assert.equal(r.bepHarianPorsi, 20);
  assert.equal(r.dibawahBep, false);
});

test("persen HPP 0%: seluruh harga jual jadi untung kotor", () => {
  const r = calculateModal({ ...lengkap, persenHPP: 0 });
  assert.equal(r.biayaBahan, 0);
  assert.equal(r.labaBersihBulanan, 15_600_000 - 3_500_000);
  assert.equal(r.bepHarianPorsi, Math.ceil(3_500_000 / (26 * 15_000)));
});

test("persen HPP 100%: tidak pernah impas, BEP tidak bisa dihitung", () => {
  const r = calculateModal({ ...lengkap, persenHPP: 100 });
  assert.equal(r.biayaBahan, r.penjualanBulanan);
  assert.equal(r.bepStatus, "margin-habis");
  assert.equal(r.bepHarian, null);
  assert.equal(r.balikModalBulan, null);
  assert.equal(r.dibawahBep, true);
});

test("HPP + platform melebihi 100%: pembagi negatif ditangani", () => {
  const r = calculateModal({ ...lengkap, persenHPP: 80, persenPlatform: 30 });
  assert.equal(r.bepStatus, "margin-habis");
  assert.equal(r.bepHarian, null);
  assert.ok(r.labaBersihBulanan < 0);
});

test("hari buka 0: penjualan 0 dan BEP tidak bisa dihitung", () => {
  const r = calculateModal({ ...lengkap, hariBuka: 0 });
  assert.equal(r.penjualanBulanan, 0);
  assert.equal(r.bepStatus, "hari-buka-nol");
  assert.equal(r.bepHarian, null);
  assert.equal(r.balikModalBulan, null);
});

test("biaya bulanan 0: BEP 0 porsi", () => {
  const r = calculateModal(input({ hargaJual: 5_000, targetHarian: 10, persenHPP: 40 }));
  assert.equal(r.bepStatus, "tanpa-biaya");
  assert.equal(r.bepHarianPorsi, 0);
});

test("semua isian kosong: tidak error, semua 0, kolom wajib ditandai", () => {
  const r = calculateModal(emptyModalInput());
  assert.equal(r.penjualanBulanan, 0);
  assert.equal(r.labaBersihBulanan, 0);
  assert.equal(r.totalModalAwal, 0);
  assert.equal(r.balikModalBulan, null);
  assert.equal(r.bepStatus, "harga-kosong");
  assert.deepEqual(r.belumDiisi, ["hargaJual", "targetHarian", "persenHPP"]);
  assert.deepEqual(r.peringatan, []);
});

test("isian kosong untuk pengaturan lanjutan memakai nilai bawaan", () => {
  const r = calculateModal({ ...lengkap, persenTakTerduga: null, bulanCadangan: null, hariBuka: null });
  assert.equal(r.danaTakTerduga, 1_000_000);
  assert.equal(r.cadanganKas, 10_500_000);
  assert.equal(r.penjualanBulanan, 15_600_000);
});

test("angka minus dan persen di atas 100 dikoreksi dengan pesan ramah, tidak memblokir", () => {
  const r = calculateModal({ ...lengkap, peralatan: -5, persenHPP: 150, hariBuka: 40 });
  assert.equal(r.rincianModal.find((i) => i.key === "peralatan").amount, 0);
  assert.equal(r.biayaBahan, Math.round(15_000 * 40 * 31));
  assert.equal(r.peringatan.length, 3);
  assert.match(r.peringatan[0], /tidak bisa minus/);
});

test("angka sangat besar tetap terhingga dan bulat", () => {
  const besar = 999_999_999_999;
  const r = calculateModal({
    ...lengkap,
    peralatan: besar,
    renovasi: besar,
    hargaJual: 50_000_000,
    targetHarian: 10_000,
  });
  for (const key of ["penjualanBulanan", "biayaBahan", "labaBersihBulanan", "totalModalAwal", "danaTakTerduga"]) {
    assert.ok(Number.isFinite(r[key]), key);
    assert.ok(Number.isInteger(r[key]), key);
  }
  assert.ok(r.balikModalBulan > 0);
  assert.equal(formatRupiah(r.totalModalAwal).startsWith("Rp"), true);
});

test("semua angka rupiah dibulatkan ke rupiah penuh", () => {
  const r = calculateModal({ ...lengkap, hargaJual: 3_333, persenHPP: 33.3, persenPlatform: 7.7, persenTakTerduga: 12.5 });
  for (const key of ["penjualanBulanan", "biayaPlatform", "biayaBahan", "labaBersihBulanan", "danaTakTerduga", "cadanganKas", "totalModalAwal"]) {
    assert.ok(Number.isInteger(r[key]), key);
  }
});

test("tiga contoh cepat cocok dengan data sumber", () => {
  const byId = Object.fromEntries(CONTOH_CEPAT.map((c) => [c.id, c]));
  assert.deepEqual(
    [byId["es-teh"].hargaJual, byId["es-teh"].persenHPP, byId["es-teh"].targetHarian],
    [5_000, 44, 100],
  );
  assert.deepEqual(
    [byId["nasi-goreng"].hargaJual, byId["nasi-goreng"].persenHPP, byId["nasi-goreng"].targetHarian],
    [15_000, 58, 40],
  );
  assert.deepEqual(
    [byId["sate-ayam"].hargaJual, byId["sate-ayam"].persenHPP, byId["sate-ayam"].targetHarian],
    [20_000, 61, 50],
  );
  // Persen HPP sesuai HPP rupiah per porsi (dibulatkan ke persen terdekat).
  for (const c of CONTOH_CEPAT) {
    assert.equal(Math.round((c.hppRupiah / c.hargaJual) * 100), c.persenHPP, c.id);
  }
});

test("contoh cepat tanpa biaya lain: hasil per contoh", () => {
  const hasil = Object.fromEntries(
    CONTOH_CEPAT.map((c) => [
      c.id,
      calculateModal(input({ hargaJual: c.hargaJual, persenHPP: c.persenHPP, targetHarian: c.targetHarian })),
    ]),
  );
  // Es teh: 5.000 × 100 × 26 = 13.000.000; bahan 44% = 5.720.000
  assert.equal(hasil["es-teh"].penjualanBulanan, 13_000_000);
  assert.equal(hasil["es-teh"].labaBersihBulanan, 7_280_000);
  // Nasi goreng: 15.000 × 40 × 26 = 15.600.000; bahan 58% = 9.048.000
  assert.equal(hasil["nasi-goreng"].penjualanBulanan, 15_600_000);
  assert.equal(hasil["nasi-goreng"].labaBersihBulanan, 6_552_000);
  // Sate ayam: 20.000 × 50 × 26 = 26.000.000; bahan 61% = 15.860.000
  assert.equal(hasil["sate-ayam"].penjualanBulanan, 26_000_000);
  assert.equal(hasil["sate-ayam"].labaBersihBulanan, 10_140_000);
  // Modal awal belum diisi, jadi tidak ada angka balik modal palsu.
  for (const r of Object.values(hasil)) assert.equal(r.totalModalAwal, 0);
});

test("contoh es teh dengan biaya bulanan: BEP harian", () => {
  const r = calculateModal(input({ hargaJual: 5_000, persenHPP: 44, targetHarian: 100, sewaBulanan: 1_500_000, gajiKaryawan: 1_800_000 }));
  // 3.300.000 / (26 × 5.000 × 0,56) = 45,3 → 46 gelas
  assert.equal(r.bepHarianPorsi, 46);
  assert.equal(r.dibawahBep, false);
});

test("format dan parsing angka", () => {
  assert.equal(formatRupiah(12_500_000), "Rp12.500.000");
  assert.equal(formatRupiah(0), "Rp0");
  assert.equal(formatRupiah(-1_250_000), "-Rp1.250.000");
  assert.equal(formatRupiah(1234.6), "Rp1.235");
  assert.equal(formatRibuan(1000), "1.000");
  assert.equal(parseBulat("12.500.000"), 12_500_000);
  assert.equal(parseBulat("Rp 5.000"), 5_000);
  assert.equal(parseBulat(""), null);
  assert.equal(parseBulat("abc"), null);
  assert.equal(parsePersen("44,5"), 44.5);
  assert.equal(parsePersen("10%"), 10);
  assert.equal(parsePersen(""), null);
});

test("format lama balik modal", () => {
  assert.equal(formatBulan(0.4), "kurang dari 1 bulan");
  assert.equal(formatBulan(8.14), "sekitar 9 bulan");
  assert.equal(formatBulan(9), "sekitar 9 bulan");
  assert.equal(formatBulan(12), "sekitar 12 bulan (1 tahun)");
  assert.equal(formatBulan(26.2), "sekitar 27 bulan (2 tahun 3 bulan)");
});
