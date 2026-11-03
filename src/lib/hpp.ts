export type QuantityUnit = "g" | "kg" | "ml" | "l" | "pcs";

export type IngredientInput = {
  name: string;
  purchasePrice: number | null;
  purchaseQuantity: number | null;
  purchaseUnit: QuantityUnit;
  usedQuantity: number | null;
  usedUnit: QuantityUnit;
};

export type OtherCostInput = {
  name: string;
  amount: number | null;
};

export type HppInput = {
  portions: number | null;
  ingredients: IngredientInput[];
  otherCosts: OtherCostInput[];
  sellingPrice?: number | null;
  targetMarginPercent?: number | null;
};

export type HppCostLine = {
  name: string;
  cost: number;
};

export type HppResult = {
  errors: string[];
  pricingError: string | null;
  ingredientCosts: HppCostLine[];
  otherCosts: HppCostLine[];
  totalBatchCost: number | null;
  costPerPortion: number | null;
  profitPerPortion: number | null;
  margin: number | null;
  suggestedSellingPrice: number | null;
  roundedSuggestedSellingPrice: number | null;
};

const unitDefinitions: Record<
  QuantityUnit,
  { dimension: "mass" | "volume" | "count"; baseFactor: number }
> = {
  g: { dimension: "mass", baseFactor: 1 },
  kg: { dimension: "mass", baseFactor: 1000 },
  ml: { dimension: "volume", baseFactor: 1 },
  l: { dimension: "volume", baseFactor: 1000 },
  pcs: { dimension: "count", baseFactor: 1 },
};

function isNonNegativeRupiah(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0;
}

function isValidQuantity(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function isBlankIngredient(ingredient: IngredientInput): boolean {
  return (
    ingredient.name.trim() === "" &&
    ingredient.purchasePrice === null &&
    ingredient.purchaseQuantity === null &&
    ingredient.usedQuantity === null
  );
}

function isBlankOtherCost(cost: OtherCostInput): boolean {
  return cost.name.trim() === "" && cost.amount === null;
}

function emptyResult(errors: string[]): HppResult {
  return {
    errors,
    pricingError: null,
    ingredientCosts: [],
    otherCosts: [],
    totalBatchCost: null,
    costPerPortion: null,
    profitPerPortion: null,
    margin: null,
    suggestedSellingPrice: null,
    roundedSuggestedSellingPrice: null,
  };
}

export function calculateHpp(input: HppInput): HppResult {
  const errors: string[] = [];

  if (
    input.portions === null ||
    !Number.isSafeInteger(input.portions) ||
    input.portions <= 0
  ) {
    errors.push("Jumlah porsi harus bilangan bulat lebih dari 0.");
  }

  const ingredientCosts: HppCostLine[] = [];
  const ingredients = input.ingredients.filter(
    (ingredient) => !isBlankIngredient(ingredient),
  );

  for (const [index, ingredient] of ingredients.entries()) {
    const rowNumber = index + 1;
    const name = ingredient.name.trim();
    const purchaseUnit = unitDefinitions[ingredient.purchaseUnit];
    const usedUnit = unitDefinitions[ingredient.usedUnit];

    if (!name) errors.push(`Nama bahan pada baris ${rowNumber} belum diisi.`);
    if (!isNonNegativeRupiah(ingredient.purchasePrice)) {
      errors.push(
        `Harga beli bahan pada baris ${rowNumber} harus berupa Rupiah bulat yang tidak negatif.`,
      );
    }
    if (
      !isValidQuantity(ingredient.purchaseQuantity) ||
      ingredient.purchaseQuantity <= 0
    ) {
      errors.push(
        `Jumlah yang dibeli pada baris ${rowNumber} harus lebih dari 0.`,
      );
    }
    if (!isValidQuantity(ingredient.usedQuantity)) {
      errors.push(
        `Jumlah yang dipakai pada baris ${rowNumber} harus berupa angka yang tidak negatif.`,
      );
    }
    if (!purchaseUnit || !usedUnit) {
      errors.push(`Satuan bahan pada baris ${rowNumber} tidak dikenali.`);
      continue;
    }
    if (purchaseUnit.dimension !== usedUnit.dimension) {
      errors.push(
        `Satuan beli dan pakai untuk bahan pada baris ${rowNumber} tidak cocok.`,
      );
      continue;
    }
    if (
      !isNonNegativeRupiah(ingredient.purchasePrice) ||
      !isValidQuantity(ingredient.purchaseQuantity) ||
      ingredient.purchaseQuantity <= 0 ||
      !isValidQuantity(ingredient.usedQuantity)
    ) {
      continue;
    }

    const purchasedInBaseUnits =
      ingredient.purchaseQuantity * purchaseUnit.baseFactor;
    const usedInBaseUnits = ingredient.usedQuantity * usedUnit.baseFactor;
    const cost =
      (ingredient.purchasePrice / purchasedInBaseUnits) * usedInBaseUnits;

    if (
      !Number.isFinite(purchasedInBaseUnits) ||
      purchasedInBaseUnits <= 0 ||
      !Number.isFinite(usedInBaseUnits) ||
      !Number.isFinite(cost)
    ) {
      errors.push(
        `Jumlah atau biaya bahan pada baris ${rowNumber} terlalu besar untuk dihitung.`,
      );
      continue;
    }

    ingredientCosts.push({ name, cost });
  }

  const otherCosts: HppCostLine[] = [];
  const enteredOtherCosts = input.otherCosts.filter(
    (cost) => !isBlankOtherCost(cost),
  );

  for (const [index, cost] of enteredOtherCosts.entries()) {
    const rowNumber = index + 1;
    if (!isNonNegativeRupiah(cost.amount)) {
      errors.push(
        `Biaya tambahan pada baris ${rowNumber} harus berupa Rupiah bulat yang tidak negatif.`,
      );
      continue;
    }
    otherCosts.push({
      name: cost.name.trim() || "Biaya lainnya",
      cost: cost.amount,
    });
  }

  if (ingredients.length + enteredOtherCosts.length === 0) {
    errors.push("Isi minimal satu bahan atau biaya tambahan.");
  }

  if (errors.length > 0 || input.portions === null) {
    return emptyResult(errors);
  }

  const totalBatchCost = [...ingredientCosts, ...otherCosts].reduce(
    (total, line) => total + line.cost,
    0,
  );
  const costPerPortion = totalBatchCost / input.portions;

  if (!Number.isFinite(totalBatchCost) || !Number.isFinite(costPerPortion)) {
    return emptyResult(["Total biaya terlalu besar untuk dihitung."]);
  }

  const hasSellingPrice =
    input.sellingPrice !== null && input.sellingPrice !== undefined;
  const hasTargetMargin =
    input.targetMarginPercent !== null &&
    input.targetMarginPercent !== undefined;
  let pricingError: string | null = null;
  let profitPerPortion: number | null = null;
  let margin: number | null = null;
  let suggestedSellingPrice: number | null = null;
  let roundedSuggestedSellingPrice: number | null = null;

  if (hasSellingPrice && hasTargetMargin) {
    pricingError = "Pilih harga jual atau target margin, bukan keduanya.";
  } else if (hasSellingPrice) {
    const sellingPrice = input.sellingPrice;
    if (
      sellingPrice === null ||
      sellingPrice === undefined ||
      !isNonNegativeRupiah(sellingPrice)
    ) {
      pricingError = "Harga jual harus berupa Rupiah bulat yang tidak negatif.";
    } else if (sellingPrice === 0) {
      pricingError =
        "Harga jual harus lebih dari Rp0 agar margin bisa dihitung.";
    } else {
      profitPerPortion = sellingPrice - costPerPortion;
      margin = profitPerPortion / sellingPrice;
    }
  } else if (hasTargetMargin) {
    const targetMarginPercent = input.targetMarginPercent;
    if (
      targetMarginPercent === null ||
      targetMarginPercent === undefined ||
      !Number.isFinite(targetMarginPercent) ||
      targetMarginPercent < 0 ||
      targetMarginPercent >= 100
    ) {
      pricingError = "Target margin harus dari 0% hingga kurang dari 100%.";
    } else {
      suggestedSellingPrice =
        costPerPortion / (1 - targetMarginPercent / 100);
      roundedSuggestedSellingPrice =
        Math.ceil(suggestedSellingPrice / 500) * 500;
      if (
        !Number.isFinite(suggestedSellingPrice) ||
        !Number.isFinite(roundedSuggestedSellingPrice)
      ) {
        pricingError = "Target harga terlalu besar untuk dihitung.";
        suggestedSellingPrice = null;
        roundedSuggestedSellingPrice = null;
      }
    }
  }

  return {
    errors,
    pricingError,
    ingredientCosts,
    otherCosts,
    totalBatchCost,
    costPerPortion,
    profitPerPortion,
    margin,
    suggestedSellingPrice,
    roundedSuggestedSellingPrice,
  };
}
