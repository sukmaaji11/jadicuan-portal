import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./hpp.ts", import.meta.url), "utf8");
const { outputText, diagnostics } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
  reportDiagnostics: true,
});

assert.deepEqual(
  diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error),
  [],
);

const { calculateHpp } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

const sample = {
  portions: 10,
  ingredients: [
    {
      name: "Ayam",
      purchasePrice: 29000,
      purchaseQuantity: 1,
      purchaseUnit: "kg",
      usedQuantity: 500,
      usedUnit: "g",
    },
    {
      name: "Bumbu",
      purchasePrice: 5500,
      purchaseQuantity: 1,
      purchaseUnit: "pcs",
      usedQuantity: 1,
      usedUnit: "pcs",
    },
    {
      name: "Minyak",
      purchasePrice: 4000,
      purchaseQuantity: 1,
      purchaseUnit: "l",
      usedQuantity: 1,
      usedUnit: "l",
    },
  ],
  otherCosts: [{ name: "Gas/listrik", amount: 6000 }],
};

test("menghitung total batch, HPP, dan rincian bahan", () => {
  const result = calculateHpp(sample);

  assert.deepEqual(result.errors, []);
  assert.equal(result.ingredientCosts[0].cost, 14500);
  assert.equal(result.totalBatchCost, 30000);
  assert.equal(result.costPerPortion, 3000);
});

test("menghitung untung dan margin dari harga jual", () => {
  const result = calculateHpp({ ...sample, sellingPrice: 8000 });

  assert.equal(result.profitPerPortion, 5000);
  assert.equal(result.margin, 0.625);
});

test("menghitung harga saran untuk target margin 50% dan 60%", () => {
  const margin50 = calculateHpp({ ...sample, targetMarginPercent: 50 });
  const margin60 = calculateHpp({ ...sample, targetMarginPercent: 60 });

  assert.equal(margin50.suggestedSellingPrice, 6000);
  assert.equal(margin50.roundedSuggestedSellingPrice, 6000);
  assert.equal(margin60.suggestedSellingPrice, 7500);
  assert.equal(margin60.roundedSuggestedSellingPrice, 7500);
});

test("menolak porsi kosong atau nol tanpa menghasilkan angka tidak valid", () => {
  for (const portions of [null, 0]) {
    const result = calculateHpp({ ...sample, portions });

    assert.ok(result.errors.length > 0);
    assert.equal(result.totalBatchCost, null);
    assert.equal(result.costPerPortion, null);
  }
});

test("menolak harga dan biaya negatif", () => {
  const result = calculateHpp({
    ...sample,
    ingredients: [{ ...sample.ingredients[0], purchasePrice: -1 }],
  });

  assert.ok(result.errors.some((error) => error.includes("Harga beli")));
  assert.equal(result.totalBatchCost, null);
});

test("menolak target margin 100% atau lebih", () => {
  const result = calculateHpp({ ...sample, targetMarginPercent: 100 });

  assert.match(result.pricingError ?? "", /kurang dari 100%/);
  assert.equal(result.suggestedSellingPrice, null);
  assert.equal(result.roundedSuggestedSellingPrice, null);
});

test("menolak satuan yang tidak kompatibel", () => {
  const result = calculateHpp({
    ...sample,
    ingredients: [{ ...sample.ingredients[0], usedUnit: "ml" }],
  });

  assert.ok(result.errors.some((error) => error.includes("tidak cocok")));
  assert.equal(result.totalBatchCost, null);
});

test("menolak mode harga jual dan target margin yang dipakai bersamaan", () => {
  const result = calculateHpp({
    ...sample,
    sellingPrice: 8000,
    targetMarginPercent: 50,
  });

  assert.match(result.pricingError ?? "", /Pilih harga jual atau target margin/);
  assert.equal(result.profitPerPortion, null);
  assert.equal(result.suggestedSellingPrice, null);
});
