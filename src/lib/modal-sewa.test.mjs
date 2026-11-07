import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./modal-sewa.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { sewaDihitungDuaKali, adaSewaBulanan } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("penjelasan sewa tampil bila sewa setahun dan sewa per bulan diisi", () => {
  assert.equal(sewaDihitungDuaKali({ sewaSetahun: 12_000_000, sewaBulanan: 1_000_000 }), true);
});

test("penjelasan sewa tidak tampil tanpa sewa (usaha di rumah atau keliling)", () => {
  assert.equal(sewaDihitungDuaKali({ sewaSetahun: null, sewaBulanan: null }), false);
  assert.equal(sewaDihitungDuaKali({ sewaSetahun: 0, sewaBulanan: 0 }), false);
});

test("penjelasan sewa tidak tampil bila hanya sewa per bulan", () => {
  assert.equal(sewaDihitungDuaKali({ sewaSetahun: null, sewaBulanan: 1_000_000 }), false);
  assert.equal(sewaDihitungDuaKali({ sewaSetahun: 0, sewaBulanan: 1_000_000 }), false);
});

test("penjelasan sewa tidak tampil bila sewa per bulan dikosongkan atau 0", () => {
  assert.equal(sewaDihitungDuaKali({ sewaSetahun: 12_000_000, sewaBulanan: null }), false);
  assert.equal(sewaDihitungDuaKali({ sewaSetahun: 12_000_000, sewaBulanan: 0 }), false);
});

test("catatan titik impas hanya bila sewa per bulan lebih dari 0", () => {
  assert.equal(adaSewaBulanan({ sewaSetahun: null, sewaBulanan: 1_000_000 }), true);
  assert.equal(adaSewaBulanan({ sewaSetahun: 12_000_000, sewaBulanan: 0 }), false);
  assert.equal(adaSewaBulanan({ sewaSetahun: null, sewaBulanan: null }), false);
});
