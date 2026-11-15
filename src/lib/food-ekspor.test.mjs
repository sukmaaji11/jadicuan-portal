import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const tr = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const F = await import(url(tr(await readFile(new URL("./food.ts", import.meta.url), "utf8"))));
const E = await import(url(tr(await readFile(new URL("./food-ekspor.ts", import.meta.url), "utf8"))));
const SE = await import(url(tr(await readFile(new URL("./seller-ekspor.ts", import.meta.url), "utf8"))));
const config = JSON.parse(await readFile(new URL("../config/biaya-pesan-antar.json", import.meta.url), "utf8"));

const menu = { nama: "Nasi goreng; spesial", hpp: 10_000, packing: 1_000, hargaOffline: 15_000 };
const hasil = ["gofood", "shopeefood"].map((id) => ({ nama: config.profil[id].nama, h: F.hitungFood(menu, id, config.profil[id], F.PENGATURAN_FOOD_DEFAULT) }));

test("ekspor: satu baris per menu per platform, angka sama dengan hasil hitung", () => {
  const rows = E.barisEksporFood([{ menu, hasil }], () => "");
  assert.equal(rows.length, 3);
  const go = Object.fromEntries(rows[0].map((k, i) => [k, rows[1][i]]));
  assert.equal(go.platform, "GoFood");
  assert.equal(go.harga_display_saran, 21_000);
  assert.equal(go.ppn_atas_komisi, "ditambahkan");
  assert.equal(go.uang_bersih, 15_338);
  assert.equal(go.untung_per_porsi, 4_338);
  assert.equal(go.harga_impas, 15_425);
  assert.equal(go.status_di_harga_lapak, "Rugi");
  assert.equal(go.untung_di_harga_lapak, -330);
  const sh = Object.fromEntries(rows[0].map((k, i) => [k, rows[2][i]]));
  assert.equal(sh.ppn_atas_komisi, "sudah termasuk");
  for (const r of rows) assert.equal(r.length, E.KOLOM_EKSPOR_FOOD.length);
});

test("ekspor: hasil tidak valid tetap satu baris dengan catatan", () => {
  const rusak = { ...menu, hpp: 0 };
  const rows = E.barisEksporFood([{ menu: rusak, hasil: [{ nama: "GoFood", h: F.hitungFood(rusak, "gofood", config.profil.gofood, F.PENGATURAN_FOOD_DEFAULT) }] }], (h) => (h.ok ? "" : F.PESAN_MASALAH[h.masalah]));
  assert.equal(rows[1].length, E.KOLOM_EKSPOR_FOOD.length);
  assert.match(String(rows[1].at(-1)), /HPP/);
});

test("CSV ekspor memakai format seller (titik koma, kutip aman)", () => {
  const csv = SE.keCsv(E.barisEksporFood([{ menu, hasil }], () => ""));
  assert.ok(csv.startsWith("﻿nama_menu;platform;hpp"));
  assert.ok(csv.includes('"Nasi goreng; spesial";GoFood'));
  assert.equal(E.namaFileEksporFood("csv", new Date(2026, 10, 15)), "harga-pesan-antar-2026-11-15.csv");
});
