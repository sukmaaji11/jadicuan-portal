// Rumus Kalkulator Modal & Balik Modal. Semua fungsi di sini murni (tanpa DOM,
// tanpa penyimpanan) supaya bisa diuji di src/lib/modal.test.mjs.
// Persen ditulis 0-100 di isian, lalu diubah ke pecahan saat dihitung.

export type ModalInput = {
  // Langkah 2: modal awal (Rp)
  sewaSetahun: number | null;
  peralatan: number | null;
  renovasi: number | null;
  bahanBakuAwal: number | null;
  perizinan: number | null;
  // Langkah 3: penjualan
  hargaJual: number | null;
  targetHarian: number | null;
  hariBuka: number | null;
  persenHPP: number | null;
  // Langkah 4: biaya bulanan (Rp)
  sewaBulanan: number | null;
  gajiKaryawan: number | null;
  utilitas: number | null;
  marketing: number | null;
  transport: number | null;
  lainnya: number | null;
  hitungGajiSendiri: boolean;
  gajiSendiri: number | null;
  // Pengaturan lanjutan
  persenTakTerduga: number | null;
  bulanCadangan: number | null;
  persenPlatform: number | null;
};

export type ModalField = Exclude<keyof ModalInput, "hitungGajiSendiri">;

export type RincianModal = {
  key: "sewaSetahun" | "peralatan" | "renovasi" | "bahanBakuAwal" | "perizinan" | "danaTakTerduga" | "cadanganKas";
  label: string;
  amount: number;
};

export type BepStatus =
  | "ok"
  | "tanpa-biaya" // biaya bulanan 0, jadi impas sejak porsi pertama
  | "hari-buka-nol"
  | "harga-kosong"
  | "margin-habis"; // harga jual tidak menutup bahan + platform

export type ModalResult = {
  penjualanBulanan: number;
  biayaPlatform: number;
  biayaBahan: number;
  biayaOperasionalBulanan: number;
  labaBersihBulanan: number;
  danaTakTerduga: number;
  cadanganKas: number;
  totalModalAwal: number;
  rincianModal: RincianModal[];
  balikModalBulan: number | null;
  bepHarian: number | null; // angka pecahan dari rumus
  bepHarianPorsi: number | null; // dibulatkan ke atas: porsi utuh minimal
  bepStatus: BepStatus;
  dibawahBep: boolean;
  belumDiisi: Array<"hargaJual" | "targetHarian" | "persenHPP">;
  peringatan: string[];
};

export const DEFAULTS = {
  hariBuka: 26,
  persenTakTerduga: 10,
  bulanCadangan: 3,
  persenPlatform: 0,
} as const;

export function emptyModalInput(): ModalInput {
  return {
    sewaSetahun: null,
    peralatan: null,
    renovasi: null,
    bahanBakuAwal: null,
    perizinan: null,
    hargaJual: null,
    targetHarian: null,
    hariBuka: DEFAULTS.hariBuka,
    persenHPP: null,
    sewaBulanan: null,
    gajiKaryawan: null,
    utilitas: null,
    marketing: null,
    transport: null,
    lainnya: null,
    hitungGajiSendiri: false,
    gajiSendiri: null,
    persenTakTerduga: DEFAULTS.persenTakTerduga,
    bulanCadangan: DEFAULTS.bulanCadangan,
    persenPlatform: DEFAULTS.persenPlatform,
  };
}

const LABEL: Record<ModalField, string> = {
  sewaSetahun: "Sewa tempat setahun",
  peralatan: "Peralatan dan perlengkapan",
  renovasi: "Renovasi atau gerobak",
  bahanBakuAwal: "Bahan baku awal",
  perizinan: "Perizinan",
  hargaJual: "Harga jual",
  targetHarian: "Target terjual per hari",
  hariBuka: "Hari buka per bulan",
  persenHPP: "Persen HPP",
  sewaBulanan: "Sewa per bulan",
  gajiKaryawan: "Gaji karyawan",
  utilitas: "Listrik, air, internet",
  marketing: "Marketing",
  transport: "Transport",
  lainnya: "Biaya lainnya",
  gajiSendiri: "Gaji untuk dirimu",
  persenTakTerduga: "Dana tak terduga",
  bulanCadangan: "Cadangan kas",
  persenPlatform: "Biaya platform online",
};

const PERCENT_FIELDS: ModalField[] = ["persenHPP", "persenTakTerduga", "persenPlatform"];

/** Sewa per bulan otomatis dari sewa setahun, dibulatkan ke rupiah penuh. */
export function sewaBulananDariSetahun(sewaSetahun: number | null): number | null {
  if (sewaSetahun === null || !Number.isFinite(sewaSetahun) || sewaSetahun <= 0) return null;
  return Math.round(sewaSetahun / 12);
}

/**
 * Membersihkan isian: kosong menjadi 0, angka minus menjadi 0, persen dibatasi
 * 0-100, hari buka dibatasi 0-31. Tidak memblokir: setiap koreksi dicatat
 * sebagai pesan ramah di `peringatan`.
 */
function sanitize(input: ModalInput, peringatan: string[]): Record<ModalField, number> {
  const out = {} as Record<ModalField, number>;
  for (const key of Object.keys(LABEL) as ModalField[]) {
    let value = input[key];
    if (value === null || value === undefined || !Number.isFinite(value)) {
      value = key in DEFAULTS ? DEFAULTS[key as keyof typeof DEFAULTS] : 0;
    }
    if (value < 0) {
      peringatan.push(`${LABEL[key]} tidak bisa minus, jadi kami anggap 0 dulu.`);
      value = 0;
    }
    if (PERCENT_FIELDS.includes(key) && value > 100) {
      peringatan.push(`${LABEL[key]} maksimal 100%, jadi kami pakai 100%.`);
      value = 100;
    }
    if (key === "hariBuka" && value > 31) {
      peringatan.push("Hari buka per bulan maksimal 31, jadi kami pakai 31.");
      value = 31;
    }
    out[key] = value;
  }
  return out;
}

export function calculateModal(input: ModalInput): ModalResult {
  const peringatan: string[] = [];
  const v = sanitize(input, peringatan);

  const belumDiisi: ModalResult["belumDiisi"] = [];
  if (input.hargaJual === null || input.hargaJual <= 0) belumDiisi.push("hargaJual");
  if (input.targetHarian === null || input.targetHarian <= 0) belumDiisi.push("targetHarian");
  if (input.persenHPP === null) belumDiisi.push("persenHPP");

  const hpp = v.persenHPP / 100;
  const platform = v.persenPlatform / 100;

  // Penjualan dan biaya bulanan, semua dibulatkan ke rupiah penuh.
  const penjualanBulanan = Math.round(v.hargaJual * v.targetHarian * v.hariBuka);
  const biayaPlatform = Math.round(penjualanBulanan * platform);
  const biayaBahan = Math.round(penjualanBulanan * hpp);
  const biayaOperasionalBulanan = Math.round(
    v.sewaBulanan +
      v.gajiKaryawan +
      v.utilitas +
      v.marketing +
      v.transport +
      v.lainnya +
      (input.hitungGajiSendiri ? v.gajiSendiri : 0),
  );
  const labaBersihBulanan =
    penjualanBulanan - biayaPlatform - biayaBahan - biayaOperasionalBulanan;

  // Modal awal.
  const danaTakTerduga = Math.round((v.persenTakTerduga / 100) * (v.peralatan + v.renovasi));
  const cadanganKas = Math.round(v.bulanCadangan * biayaOperasionalBulanan);
  const rincianModal: RincianModal[] = [
    { key: "sewaSetahun", label: "Sewa tempat setahun", amount: Math.round(v.sewaSetahun) },
    { key: "peralatan", label: "Peralatan dan perlengkapan", amount: Math.round(v.peralatan) },
    { key: "renovasi", label: "Renovasi atau gerobak", amount: Math.round(v.renovasi) },
    { key: "bahanBakuAwal", label: "Bahan baku awal", amount: Math.round(v.bahanBakuAwal) },
    { key: "perizinan", label: "Perizinan", amount: Math.round(v.perizinan) },
    { key: "danaTakTerduga", label: "Dana tak terduga", amount: danaTakTerduga },
    { key: "cadanganKas", label: "Cadangan kas", amount: cadanganKas },
  ];
  const totalModalAwal = rincianModal.reduce((sum, item) => sum + item.amount, 0);

  const balikModalBulan = labaBersihBulanan > 0 ? totalModalAwal / labaBersihBulanan : null;

  // Titik impas harian: biaya bulanan / (hari buka × untung kotor per porsi).
  const untungPerPorsi = v.hargaJual * (1 - hpp - platform);
  let bepHarian: number | null = null;
  let bepStatus: BepStatus;
  if (v.hargaJual <= 0) {
    bepStatus = "harga-kosong";
  } else if (v.hariBuka <= 0) {
    bepStatus = "hari-buka-nol";
  } else if (untungPerPorsi <= 0) {
    bepStatus = "margin-habis";
  } else if (biayaOperasionalBulanan === 0) {
    bepStatus = "tanpa-biaya";
    bepHarian = 0;
  } else {
    bepStatus = "ok";
    bepHarian = biayaOperasionalBulanan / (v.hariBuka * untungPerPorsi);
  }
  // Pembulatan ke atas dengan toleransi kecil agar 40.0000000001 tetap 40.
  const bepHarianPorsi =
    bepHarian === null ? null : Math.max(0, Math.ceil(bepHarian - 1e-9));

  const dibawahBep =
    v.targetHarian > 0 &&
    (bepStatus === "margin-habis" ||
      (bepHarianPorsi !== null && v.targetHarian < bepHarianPorsi));

  return {
    penjualanBulanan,
    biayaPlatform,
    biayaBahan,
    biayaOperasionalBulanan,
    labaBersihBulanan,
    danaTakTerduga,
    cadanganKas,
    totalModalAwal,
    rincianModal,
    balikModalBulan,
    bepHarian,
    bepHarianPorsi,
    bepStatus,
    dibawahBep,
    belumDiisi,
    peringatan,
  };
}

/** "Rp12.500.000" (pemisah ribuan titik, tanpa spasi, rupiah penuh). */
export function formatRupiah(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}Rp${formatRibuan(Math.abs(rounded))}`;
}

/** Bilangan bulat dengan pemisah ribuan titik: 12500000 → "12.500.000". */
export function formatRibuan(value: number): string {
  return String(Math.trunc(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Membaca isian rupiah atau bilangan bulat: "12.500.000" → 12500000, "" → null. */
export function parseBulat(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits.slice(0, 15));
}

/** Membaca isian persen dengan koma atau titik desimal: "44,5" → 44.5. */
export function parsePersen(text: string): number | null {
  const cleaned = text.replace(/\s|%/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Lama balik modal untuk dibaca orang awam, dibulatkan ke atas per bulan. */
export function formatBulan(bulan: number): string {
  if (bulan < 1) return "kurang dari 1 bulan";
  const total = Math.ceil(bulan - 1e-9);
  if (total < 12) return `sekitar ${total} bulan`;
  const tahun = Math.floor(total / 12);
  const sisa = total % 12;
  return `sekitar ${total} bulan (${tahun} tahun${sisa ? ` ${sisa} bulan` : ""})`;
}

/*
 * Contoh Cepat. Hanya mengisi harga jual, persen HPP, dan target harian.
 * Sumber: harga bahan dari PIHPS Bank Indonesia lewat iNews.id, 3 November
 * 2026, dipakai untuk memperkirakan modal bahan per porsi. Harga jual, target
 * penjualan, dan resep per porsi adalah asumsi, bukan data lapak tertentu.
 */
export const CONTOH_CEPAT = [
  { id: "es-teh", nama: "Es teh jumbo", hargaJual: 5000, persenHPP: 44, hppRupiah: 2215, targetHarian: 100, satuan: "gelas" },
  { id: "nasi-goreng", nama: "Nasi goreng", hargaJual: 15000, persenHPP: 58, hppRupiah: 8740, targetHarian: 40, satuan: "porsi" },
  { id: "sate-ayam", nama: "Sate ayam", hargaJual: 20000, persenHPP: 61, hppRupiah: 12250, targetHarian: 50, satuan: "porsi" },
] as const;
