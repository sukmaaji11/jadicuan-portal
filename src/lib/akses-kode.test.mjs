import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { buatKode, buatPasanganKunci, bacaKunci, formatKode as formatAdmin, pesanWhatsApp } from "../../tools/akses-kalkulator-modal/core.mjs";

const source = await readFile(new URL("./akses-kode.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const site = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const kunciFile = await buatPasanganKunci();
const kunci = await bacaKunci(JSON.stringify(kunciFile));
const publik = kunciFile.publik;

test("kode dari alat admin diterima situs", async () => {
  const hasil = await buatKode(kunci, { serial: 0x1a2b3c4d, hari: 317 });
  assert.equal(hasil.kode.length, site.PANJANG_KODE);
  const cek = await site.periksaKode(hasil.kode, publik);
  assert.equal(cek.ok, true);
  assert.equal(cek.info.serial, 0x1a2b3c4d);
  assert.equal(cek.info.label, "KM-1A2B3C4D");
  assert.equal(cek.info.dibuat.toISOString().slice(0, 10), "2026-11-14");
  assert.equal(hasil.label, "KM-1A2B3C4D");
});

test("kode dengan spasi, tanda hubung, huruf kecil, dan baris baru tetap diterima", async () => {
  const { kode } = await buatKode(kunci);
  const berantakan = `  ${formatAdmin(kode).toLowerCase().replace(/-(.{4})-/, "-$1\n")}  `;
  assert.equal((await site.periksaKode(berantakan, publik)).ok, true);
});

test("kode yang diubah satu huruf ditolak", async () => {
  const { kode } = await buatKode(kunci);
  const i = 40;
  const ganti = kode[i] === "A" ? "B" : "A";
  const palsu = kode.slice(0, i) + ganti + kode.slice(i + 1);
  const cek = await site.periksaKode(palsu, publik);
  assert.equal(cek.ok, false);
  assert.equal(cek.alasan, "tidak-cocok");
});

test("kode dari kunci lain ditolak", async () => {
  const lain = await bacaKunci(await buatPasanganKunci());
  const { kode } = await buatKode(lain);
  assert.equal((await site.periksaKode(kode, publik)).alasan, "tidak-cocok");
});

test("kode terpotong atau kosong ditolak dengan pesan yang jelas", async () => {
  const { kode } = await buatKode(kunci);
  assert.equal((await site.periksaKode(kode.slice(0, 100), publik)).alasan, "format");
  assert.equal((await site.periksaKode("   ", publik)).alasan, "kosong");
  assert.equal((await site.periksaKode("!!!", publik)).alasan, "kosong");
  for (const alasan of ["kosong", "format", "tidak-cocok", "diblokir", "tidak-didukung"]) assert.ok(site.PESAN_GAGAL[alasan]);
});

test("nomor seri yang diblokir ditolak", async () => {
  const hasil = await buatKode(kunci, { serial: 77 });
  assert.equal((await site.periksaKode(hasil.kode, publik, [77])).alasan, "diblokir");
  assert.equal((await site.periksaKode(hasil.kode, publik, [78])).ok, true);
});

test("tautan memuat kode, pesan WA memuat tautan dan nomor seri", async () => {
  const hasil = await buatKode(kunci, { serial: 5 });
  assert.equal(hasil.tautan, `https://jadicuan.co.id/kalkulator-modal/#kode=${hasil.kode}`);
  const pesan = pesanWhatsApp(hasil, "Bu Ani");
  assert.match(pesan, /Halo Bu Ani/);
  assert.ok(pesan.includes(hasil.tautan));
  assert.ok(pesan.includes("KM-00000005"));
});

test("base32 bolak-balik dan menolak sisa bit", () => {
  const bytes = Uint8Array.from({ length: 72 }, (_, i) => (i * 37) & 255);
  const text = site.base32Encode(bytes);
  assert.deepEqual([...site.base32Decode(text, 72)], [...bytes]);
  assert.equal(site.base32Decode(text.slice(0, -1) + "Z", 72), null);
});

test("file kunci yang salah ditolak alat admin", async () => {
  await assert.rejects(() => bacaKunci('{"hello":1}'), /bukan file kunci/);
});

test("admin.html sudah dibangun dari sumber terbaru (jalankan npm run admin:kode)", async () => {
  const { bangunAdmin } = await import("../../tools/akses-kalkulator-modal/build-admin.mjs");
  const ada = await readFile(new URL("../../tools/akses-kalkulator-modal/admin.html", import.meta.url), "utf8");
  assert.equal(ada, bangunAdmin());
});
