import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const tr = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const sellerUrl = url(tr(await readFile(new URL("./seller.ts", import.meta.url), "utf8")));
const csvUrl = url(tr(await readFile(new URL("./seller-csv.ts", import.meta.url), "utf8")).replace(/from "\.\/seller"/g, `from "${sellerUrl}"`));
const foodUrl = url(tr(await readFile(new URL("./food.ts", import.meta.url), "utf8")));
const M = await import(url(tr(await readFile(new URL("./food-csv.ts", import.meta.url), "utf8")).replace(/from "\.\/seller"/g, `from "${sellerUrl}"`).replace(/from "\.\/seller-csv"/g, `from "${csvUrl}"`).replace(/from "\.\/food"/g, `from "${foodUrl}"`)));
const C = await import(csvUrl);
const F = await import(foodUrl);
const config = JSON.parse(await readFile(new URL("../config/biaya-pesan-antar.json", import.meta.url), "utf8"));

const baca = (teks) => {
  const rows = C.pecahCsv(teks);
  const { pemetaan, hilang } = M.petakanHeaderMenu(rows[0]);
  return { hilang, hasil: M.imporMenu(rows, pemetaan) };
};

test("header menu dan alias, format Indonesia", () => {
  const { hilang, hasil } = baca("Menu,Modal,Kemasan,Harga Lapak\nNasi goreng,\"Rp 11.500\",1.500,20.000\n");
  assert.deepEqual(hilang, []);
  assert.deepEqual(hasil.produk[0], { nama: "Nasi goreng", hpp: 11_500, packing: 1_500, hargaOffline: 20_000, targetRp: null, targetMarginPersen: null, diskonPersen: null, overhead: null });
  assert.deepEqual(M.petakanHeaderMenu(["Barang", "Rupiah"]).hilang, ["nama_menu", "hpp", "harga_offline"]);
});

test("kolom opsional per menu menimpa Pengaturan", () => {
  const { hasil } = baca("nama_menu;hpp;harga_offline;target_rp;diskon;overhead\nEs teh;2.200;5.000;1.500;10%;300\n");
  const m = hasil.produk[0];
  assert.equal(m.targetRp, 1_500);
  assert.equal(m.diskonPersen, 10);
  assert.equal(m.overhead, 300);
});

test("baris salah dilaporkan, baris lain tetap dihitung", () => {
  const { hasil } = baca("nama_menu;hpp;packing;harga_offline\nA;10.000;;15.000\n;10.000;;15.000\nB;sepuluh;;15.000\nC;0;;15.000\nD;5.000;-500;15.000\nE;5.000;;10%x\nF;5.000;;\n");
  assert.equal(hasil.produk.length, 1);
  const per = Object.fromEntries(hasil.error.map((e) => [e.baris, e.alasan.join(" ")]));
  assert.match(per[3], /Nama menu kosong/);
  assert.match(per[4], /bukan angka/);
  assert.match(per[5], /lebih dari 0/);
  assert.match(per[6], /minus/);
  assert.match(per[7], /bukan angka/);
  assert.match(per[8], /Harga jual di lapak.*kosong/);
});

test("samples/menu-contoh.csv: 16 menu benar, 4 salah, ada yang rugi di harga lapak", async () => {
  const { hasil, hilang } = baca(await readFile(new URL("../../samples/menu-contoh.csv", import.meta.url), "utf8"));
  assert.deepEqual(hilang, []);
  assert.equal(hasil.totalBaris, 20);
  assert.equal(hasil.produk.length, 16);
  assert.equal(hasil.error.length, 4);
  const status = hasil.produk.map((m) => F.hitungFood(m, "grabfood", config.profil.grabfood, F.PENGATURAN_FOOD_DEFAULT).status);
  assert.ok(status.includes("rugi") && status.includes("aman"), status.join(","));
});

test("template menu terbaca kembali", () => {
  const { hasil, hilang } = baca(M.buatTemplateMenu());
  assert.deepEqual(hilang, []);
  assert.equal(hasil.produk.length, 3);
  assert.equal(hasil.error.length, 0);
});
