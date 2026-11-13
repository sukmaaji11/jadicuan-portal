import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function load(file) {
  const source = await readFile(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const L = await load("./modal-lengkap.ts");
const M = await load("./modal.ts");

// Contoh es teh di video (angka sama dengan rekaman halaman live).
function esTeh() {
  return {
    ...M.emptyModalInput(),
    peralatan: 3_500_000,
    renovasi: 2_500_000,
    bahanBakuAwal: 750_000,
    hargaJual: 5000,
    targetHarian: 100,
    persenHPP: 44,
    utilitas: 150_000,
    marketing: 100_000,
    transport: 200_000,
    lainnya: 400_000,
    hitungGajiSendiri: true,
    gajiSendiri: 2_500_000,
  };
}

test("skenario normal sama persis dengan hasil utama", () => {
  const v = esTeh();
  const [, normal] = L.hitungSkenario(v, L.SKENARIO_DEFAULT, M.calculateModal);
  const utama = M.calculateModal(v);
  assert.equal(normal.targetHarian, 100);
  assert.equal(normal.labaBersihBulanan, utama.labaBersihBulanan);
  assert.equal(normal.labaBersihBulanan, 3_930_000);
  assert.equal(normal.balikModalBulan, utama.balikModalBulan);
});

test("sepi 60 % dan ramai 130 % mengubah target, modal awal tetap", () => {
  const [sepi, normal, ramai] = L.hitungSkenario(esTeh(), L.SKENARIO_DEFAULT, M.calculateModal);
  assert.deepEqual([sepi.targetHarian, normal.targetHarian, ramai.targetHarian], [60, 100, 130]);
  assert.equal(sepi.penjualanBulanan, 5000 * 60 * 26);
  assert.equal(sepi.totalModalAwal, normal.totalModalAwal);
  assert.equal(ramai.totalModalAwal, normal.totalModalAwal);
  assert.ok(sepi.labaBersihBulanan < normal.labaBersihBulanan && normal.labaBersihBulanan < ramai.labaBersihBulanan);
  assert.equal(sepi.dibawahBep, false); // titik impas 47 gelas, sepi 60 gelas
});

test("skenario sepi di bawah titik impas: laba minus, balik modal tidak ada", () => {
  const [sepi] = L.hitungSkenario(esTeh(), { sepi: 40, ramai: 130 }, M.calculateModal);
  assert.equal(sepi.targetHarian, 40);
  assert.ok(sepi.labaBersihBulanan < 0);
  assert.equal(sepi.balikModalBulan, null);
  assert.equal(sepi.dibawahBep, true);
});

test("persen skenario dirapikan ke batas aman", () => {
  assert.deepEqual(L.rapikanPersen({ sepi: 0, ramai: 999 }), { sepi: 10, ramai: 300 });
  assert.deepEqual(L.rapikanPersen({ sepi: 150, ramai: 50 }), { sepi: 100, ramai: 100 });
  assert.deepEqual(L.rapikanPersen({ sepi: Number.NaN }), L.SKENARIO_DEFAULT);
  assert.deepEqual(L.rapikanPersen({ sepi: 72.6, ramai: 120.4 }), { sepi: 73, ramai: 120 });
});

test("target kosong: semua skenario 0, tidak error", () => {
  const hasil = L.hitungSkenario({ ...M.emptyModalInput() }, L.SKENARIO_DEFAULT, M.calculateModal);
  assert.deepEqual(hasil.map((h) => h.targetHarian), [0, 0, 0]);
});

const template = M.emptyModalInput();
const usaha = (id, disimpan, nama = id) => ({ id, nama, jenis: "minuman", nilai: esTeh(), sewaBulananManual: false, disimpan });

test("simpan, timpa, dan hapus usaha", () => {
  let { daftar } = L.simpanUsaha([], usaha("a", "2026-11-14T01:00:00.000Z"));
  ({ daftar } = L.simpanUsaha(daftar, usaha("b", "2026-11-14T02:00:00.000Z")));
  assert.deepEqual(daftar.map((u) => u.id), ["b", "a"]); // terbaru di atas
  ({ daftar } = L.simpanUsaha(daftar, usaha("a", "2026-11-14T03:00:00.000Z", "Es teh baru")));
  assert.equal(daftar.length, 2);
  assert.equal(daftar[0].nama, "Es teh baru");
  assert.deepEqual(L.hapusUsaha(daftar, "a").map((u) => u.id), ["b"]);
});

test("daftar penuh (20) tidak menghapus usaha lama diam-diam", () => {
  let daftar = [];
  for (let i = 0; i < L.MAKS_TERSIMPAN; i++) daftar = L.simpanUsaha(daftar, usaha(`u${i}`, `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`)).daftar;
  const hasil = L.simpanUsaha(daftar, usaha("baru", "2026-12-01T00:00:00.000Z"));
  assert.equal(hasil.penuh, true);
  assert.equal(hasil.daftar.length, 20);
  assert.equal(L.simpanUsaha(daftar, usaha("u3", "2026-12-01T00:00:00.000Z")).penuh, false); // menimpa tetap boleh
});

test("daftar dari penyimpanan: data rusak diabaikan, kunci asing dibuang", () => {
  assert.deepEqual(L.bacaDaftar(null, template), []);
  assert.deepEqual(L.bacaDaftar("{rusak", template), []);
  assert.deepEqual(L.bacaDaftar('{"a":1}', template), []);
  const teks = JSON.stringify([
    { id: "x", nama: "  ", nilai: { hargaJual: 5000, targetHarian: "100", jahat: "<script>", hitungGajiSendiri: "ya" }, disimpan: "bukan tanggal" },
    { nama: "tanpa id" },
    7,
  ]);
  const [u, ...lain] = L.bacaDaftar(teks, template);
  assert.equal(lain.length, 0);
  assert.equal(u.nama, "Usaha tanpa nama");
  assert.equal(u.nilai.hargaJual, 5000);
  assert.equal(u.nilai.targetHarian, null); // teks bukan angka
  assert.equal(u.nilai.hitungGajiSendiri, false);
  assert.equal("jahat" in u.nilai, false);
  assert.equal(u.disimpan, new Date(0).toISOString());
});

test("format waktu", () => {
  const d = new Date(2026, 10, 14, 9, 5);
  assert.equal(L.formatWaktu(d.toISOString()), "14 Nov 2026, 09.05");
});
