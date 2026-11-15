// Rumus Kalkulator Untung Bersih Seller Marketplace. Fungsi murni (tanpa DOM, tanpa
// penyimpanan) supaya bisa diuji di src/lib/seller.test.mjs. Profil biaya datang dari
// src/config/biaya-marketplace.json (+ timpaan pengguna), dikirim sebagai parameter.
//
// Semua komponen dihitung per 1 unit = 1 pesanan. Tiap potongan dibulatkan ke rupiah
// penuh di akhir perhitungannya, dan untung bersih = harga bersih - jumlah potongan
// yang sudah dibulatkan - HPP - packing, supaya rincian selalu pas dijumlahkan.
// Persen ditulis 0-100 di input dan config, diubah ke pecahan saat dihitung.

// ---------------- Tipe profil biaya (bentuk config JSON) ----------------
export type MarketplaceId = "shopee" | "tiktokshop" | "custom";
export const MARKETPLACES: MarketplaceId[] = ["shopee", "tiktokshop", "custom"];

type Sumber = { verified: boolean; source?: string; catatan?: string };
export type ProgramBiaya = Sumber & {
  id: string;
  nama: string;
  jenis: "gratis_ongkir" | "promo" | "lainnya";
  persen: number | null;
  batasMaks: number | null;
};
export type ProfilBiaya = {
  nama: string;
  updatedAt: string;
  source: string;
  dasar: "setelah_diskon" | "sebelum_diskon";
  komisi: Sumber & { nama: string; pilihanPersen: number[]; rentangPersen?: number[]; persenDefault: number | null; batasMaks: number | null };
  komisiDinamis: (Sumber & { nama: string; batasMaks: number | null; perKategori: Record<string, number> }) | null;
  biayaProses: Sumber & { nilai: number };
  biayaLogistik: (Sumber & { nilai: number; rentang?: number[] }) | null;
  biayaTransaksi: Sumber & { persen: number };
  program: ProgramBiaya[];
  preorder: Sumber & { persen: number };
  pph: Sumber & { persen: number };
};

// ---------------- Pengaturan global & produk ----------------
export type Pengaturan = {
  batasSehatPersen: number; // margin >= ini = Sehat (default 15)
  targetMarginPersen: number; // untuk harga saran (default 20)
  kelipatanBulat: number; // pembulatan harga impas & saran ke atas (default 100)
  // Nilai default untuk kolom opsional produk yang kosong.
  diskonPersen: number;
  affiliatePersen: number;
  biayaIklan: number;
  roas: number | null;
  packing: number;
  returPersen: number;
  biayaRetur: number;
  gratisOngkir: boolean;
  promo: boolean;
  pph: boolean;
  preorder: boolean;
  // Per marketplace: persen komisi bawaan pengguna, biaya logistik, program "lainnya" yang aktif.
  komisiPersen: Record<MarketplaceId, number | null>;
  logistik: Record<MarketplaceId, number | null>;
  programLainAktif: string[];
};

export const PENGATURAN_DEFAULT: Pengaturan = {
  batasSehatPersen: 15,
  targetMarginPersen: 20,
  kelipatanBulat: 100,
  diskonPersen: 0,
  affiliatePersen: 0,
  biayaIklan: 0,
  roas: null,
  packing: 0,
  returPersen: 0,
  biayaRetur: 0,
  gratisOngkir: false,
  promo: false,
  pph: false,
  preorder: false,
  komisiPersen: { shopee: null, tiktokshop: null, custom: 0 },
  logistik: { shopee: null, tiktokshop: null, custom: null },
  programLainAktif: [],
};

export type Produk = {
  nama: string;
  sku?: string;
  hargaJual: number;
  hpp: number;
  marketplace: MarketplaceId;
  kategori: string;
  // Opsional: undefined/null = pakai Pengaturan.
  diskonRp?: number | null; // diskon/voucher ditanggung penjual (Rp); diutamakan bila diisi
  diskonPersen?: number | null;
  affiliatePersen?: number | null;
  biayaIklan?: number | null; // Rp per pesanan; diutamakan di atas ROAS
  roas?: number | null; // biaya iklan = harga bersih / ROAS
  packing?: number | null;
  returPersen?: number | null;
  biayaRetur?: number | null;
  gratisOngkir?: boolean | null;
  promo?: boolean | null;
  pph?: boolean | null;
  preorder?: boolean | null;
  komisiPersen?: number | null; // menimpa persen komisi kategori
  komisiDinamisPersen?: number | null;
  logistik?: number | null;
  terjualPerBulan?: number | null;
  stok?: number | null;
};

export type Rincian = {
  komisi: number;
  komisiDinamis: number;
  program: number;
  preorder: number;
  transaksi: number;
  affiliate: number;
  proses: number;
  logistik: number;
  iklan: number;
  retur: number;
  pph: number;
};
export const LABEL_RINCIAN: Record<keyof Rincian, string> = {
  komisi: "Komisi / biaya admin",
  komisiDinamis: "Komisi dinamis",
  program: "Program (gratis ongkir, promo)",
  preorder: "Pre-order",
  transaksi: "Biaya transaksi",
  affiliate: "Komisi affiliate",
  proses: "Biaya proses pesanan",
  logistik: "Biaya layanan logistik",
  iklan: "Biaya iklan",
  retur: "Biaya retur",
  pph: "PPh 0,5%",
};

export type Status = "rugi" | "tipis" | "sehat";
export type Peringatan = "komisi-kosong" | "kategori-dinamis-tidak-dikenal" | "program-persen-kosong" | "harga-bersih-nol";

export type HasilProduk = {
  hargaBersih: number;
  diskon: number;
  dasar: number;
  rincian: Rincian;
  totalPotongan: number;
  hpp: number;
  packing: number;
  untung: number;
  margin: number | null; // pecahan, mis. 0.125
  status: Status;
  hargaImpas: number | null; // null = tidak bisa impas dengan potongan ini
  hargaSaran: number | null;
  untungBulanan: number | null;
  komisiPersen: number;
  komisiDinamisPersen: number;
  peringatan: Peringatan[];
};

// ---------------- Pembantu ----------------
const angka = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const pilih = <T>(...vals: Array<T | null | undefined>): T | undefined => vals.find((v) => v !== null && v !== undefined) as T | undefined;
const nonNeg = (v: number) => (v > 0 ? v : 0);
const capped = (raw: number, cap: number | null) => (cap !== null && angka(cap) && raw > cap ? cap : raw);

/** Huruf kecil, buang tanda baca: "Ponsel & Elektronik" -> "ponselelektronik". */
export function normalKategori(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

/** Cari persen komisi dinamis untuk kategori: cocok persis, atau satu-satunya yang mengandung. */
export function cariKomisiDinamis(profil: ProfilBiaya, kategori: string): number | null {
  const tabel = profil.komisiDinamis?.perKategori;
  if (!tabel) return null;
  const k = normalKategori(kategori);
  if (!k) return null;
  const entri = Object.entries(tabel);
  const persis = entri.find(([nama]) => normalKategori(nama) === k);
  if (persis) return persis[1];
  const mirip = entri.filter(([nama]) => normalKategori(nama).includes(k) || k.includes(normalKategori(nama)));
  return mirip.length === 1 ? mirip[0][1] : null;
}

/** Nilai efektif tiap input, setelah digabung dengan Pengaturan. */
function siapkan(p: Produk, profil: ProfilBiaya, s: Pengaturan) {
  const peringatan: Peringatan[] = [];
  let komisiPersen = pilih(p.komisiPersen, s.komisiPersen[p.marketplace], profil.komisi.persenDefault);
  if (!angka(komisiPersen)) {
    peringatan.push("komisi-kosong");
    komisiPersen = 0;
  }
  let dinamisPersen = 0;
  if (profil.komisiDinamis) {
    const d = pilih(p.komisiDinamisPersen, cariKomisiDinamis(profil, p.kategori));
    if (angka(d)) dinamisPersen = d;
    else peringatan.push("kategori-dinamis-tidak-dikenal");
  }
  const gratisOngkir = pilih(p.gratisOngkir, s.gratisOngkir) === true;
  const promo = pilih(p.promo, s.promo) === true;
  const program = profil.program.filter(
    (pr) => (pr.jenis === "gratis_ongkir" && gratisOngkir) || (pr.jenis === "promo" && promo) || (pr.jenis === "lainnya" && s.programLainAktif.includes(pr.id)),
  );
  if (program.some((pr) => !angka(pr.persen))) peringatan.push("program-persen-kosong");
  return {
    peringatan,
    komisiPersen: nonNeg(komisiPersen),
    dinamisPersen: nonNeg(dinamisPersen),
    program,
    diskonRp: angka(p.diskonRp) ? nonNeg(p.diskonRp) : null,
    diskonPersen: Math.min(100, nonNeg(pilih(p.diskonPersen, s.diskonPersen) ?? 0)),
    affiliatePersen: nonNeg(pilih(p.affiliatePersen, s.affiliatePersen) ?? 0),
    biayaIklan: pilih(p.biayaIklan, angka(p.roas) ? null : s.biayaIklan),
    roas: pilih(p.roas, s.roas),
    packing: nonNeg(pilih(p.packing, s.packing) ?? 0),
    returPersen: Math.min(100, nonNeg(pilih(p.returPersen, s.returPersen) ?? 0)),
    biayaRetur: nonNeg(pilih(p.biayaRetur, s.biayaRetur) ?? 0),
    pph: pilih(p.pph, s.pph) === true,
    preorder: pilih(p.preorder, s.preorder) === true,
    logistik: nonNeg(pilih(p.logistik, s.logistik[p.marketplace], profil.biayaLogistik?.nilai) ?? 0),
    hpp: nonNeg(p.hpp),
  };
}
type Siap = ReturnType<typeof siapkan>;

/** Komponen biaya pada harga jual `harga` (tanpa pembulatan). */
function komponen(harga: number, x: Siap, profil: ProfilBiaya, tanpaBatas = false) {
  const diskon = x.diskonRp !== null ? Math.min(x.diskonRp, harga) : (harga * x.diskonPersen) / 100;
  const hargaBersih = nonNeg(harga - diskon);
  const dasar = profil.dasar === "sebelum_diskon" ? harga : hargaBersih;
  const batas = (cap: number | null) => (tanpaBatas ? null : cap);
  const iklan =
    angka(x.biayaIklan) && x.biayaIklan > 0 ? x.biayaIklan : angka(x.roas) && x.roas > 0 ? hargaBersih / x.roas : 0;
  const rincian: Rincian = {
    komisi: capped((x.komisiPersen / 100) * dasar, batas(profil.komisi.batasMaks)),
    komisiDinamis: capped((x.dinamisPersen / 100) * dasar, batas(profil.komisiDinamis?.batasMaks ?? null)),
    program: x.program.reduce((t, pr) => t + capped(((pr.persen ?? 0) / 100) * dasar, batas(pr.batasMaks)), 0),
    preorder: x.preorder ? (profil.preorder.persen / 100) * dasar : 0,
    transaksi: (profil.biayaTransaksi.persen / 100) * dasar,
    affiliate: (x.affiliatePersen / 100) * dasar,
    proses: profil.biayaProses.nilai,
    logistik: x.logistik,
    iklan,
    retur: (x.returPersen / 100) * x.biayaRetur,
    pph: x.pph ? (profil.pph.persen / 100) * hargaBersih : 0,
  };
  const total = Object.values(rincian).reduce((a, b) => a + b, 0);
  return { diskon, hargaBersih, dasar, rincian, untung: hargaBersih - total - x.hpp - x.packing };
}

/**
 * Harga jual terkecil (dibulatkan ke atas ke `kelipatan`) yang membuat
 * untung - target x harga bersih >= 0. Rumus tertutup selama tidak ada batas biaya
 * yang tercapai; kalau ada, pencarian biner. null = tidak mungkin (potongan persen >= 100%).
 */
function cariHarga(x: Siap, profil: ProfilBiaya, target: number, kelipatan: number): number | null {
  const f = (h: number, tanpaBatas = false) => {
    const k = komponen(h, x, profil, tanpaBatas);
    return k.untung - target * k.hargaBersih;
  };
  const awal = x.diskonRp ?? 0; // di bawah diskon Rp, harga bersih 0
  // Rumus tertutup (garis lurus tanpa batas biaya).
  const p1 = awal + 1_000_000;
  const p2 = awal + 2_000_000;
  const kemiringan = (f(p2, true) - f(p1, true)) / (p2 - p1);
  let akar: number | null = null;
  if (kemiringan > 1e-12) {
    const tutup = p1 - f(p1, true) / kemiringan;
    const kandidat = Math.max(awal, tutup);
    if (Math.abs(f(kandidat) - f(kandidat, true)) < 1e-6 && f(kandidat) >= -1e-6) akar = kandidat;
  }
  if (akar === null) {
    // Pencarian biner: cari batas atas dulu.
    let lo = awal;
    if (f(lo) >= 0) akar = lo;
    else {
      let hi = Math.max(awal * 2, 1000);
      while (f(hi) < 0 && hi < 1e13) hi *= 2;
      if (f(hi) < 0) return null;
      for (let i = 0; i < 200 && hi - lo > 1e-4; i++) {
        const mid = (lo + hi) / 2;
        if (f(mid) >= 0) hi = mid;
        else lo = mid;
      }
      akar = hi;
    }
  }
  const k = kelipatan > 0 ? kelipatan : 1;
  let harga = Math.ceil((akar - 1e-7) / k) * k;
  // Jaga-jaga pembulatan: naikkan satu kelipatan bila masih sedikit di bawah nol.
  if (f(harga) < -1e-6) harga += k;
  return harga;
}

export function hitungProduk(p: Produk, profil: ProfilBiaya, pengaturan: Pengaturan = PENGATURAN_DEFAULT): HasilProduk {
  const x = siapkan(p, profil, pengaturan);
  const hargaJual = nonNeg(p.hargaJual);
  const k = komponen(hargaJual, x, profil);
  const rincian = Object.fromEntries(Object.entries(k.rincian).map(([key, v]) => [key, Math.round(v)])) as Rincian;
  const totalPotongan = Object.values(rincian).reduce((a, b) => a + b, 0);
  const hargaBersih = Math.round(k.hargaBersih);
  const hpp = Math.round(x.hpp);
  const packing = Math.round(x.packing);
  const untung = hargaBersih - totalPotongan - hpp - packing;
  const margin = hargaBersih > 0 ? untung / hargaBersih : null;
  if (hargaBersih <= 0) x.peringatan.push("harga-bersih-nol");
  const sehat = pengaturan.batasSehatPersen / 100;
  const status: Status = untung < 0 ? "rugi" : margin !== null && margin >= sehat ? "sehat" : "tipis";
  const terjual = angka(p.terjualPerBulan) ? nonNeg(p.terjualPerBulan) : null;
  return {
    hargaBersih,
    diskon: Math.round(k.diskon),
    dasar: Math.round(k.dasar),
    rincian,
    totalPotongan,
    hpp,
    packing,
    untung,
    margin,
    status,
    hargaImpas: cariHarga(x, profil, 0, pengaturan.kelipatanBulat),
    hargaSaran: cariHarga(x, profil, pengaturan.targetMarginPersen / 100, pengaturan.kelipatanBulat),
    untungBulanan: terjual === null ? null : untung * terjual,
    komisiPersen: x.komisiPersen,
    komisiDinamisPersen: x.dinamisPersen,
    peringatan: x.peringatan,
  };
}

/** Untung pada harga tertentu tanpa pembulatan (untuk uji dan grafik). */
export function untungPadaHarga(p: Produk, profil: ProfilBiaya, harga: number, pengaturan: Pengaturan = PENGATURAN_DEFAULT): number {
  return komponen(harga, siapkan(p, profil, pengaturan), profil).untung;
}

// ---------------- Profil + timpaan pengguna ----------------
/** Angka yang bisa ditimpa pengguna di Pengaturan (null/undefined = pakai config). */
export type TimpaanProfil = {
  komisiBatasMaks?: number | null;
  komisiDinamisBatasMaks?: number | null;
  komisiDinamisPerKategori?: Record<string, number>;
  biayaProses?: number | null;
  biayaTransaksiPersen?: number | null;
  preorderPersen?: number | null;
  pphPersen?: number | null;
  dasar?: "setelah_diskon" | "sebelum_diskon";
  program?: Record<string, { persen?: number | null; batasMaks?: number | null }>;
};

export function terapkanTimpaan(profil: ProfilBiaya, t: TimpaanProfil | undefined): ProfilBiaya {
  if (!t) return profil;
  const ada = (v: unknown): v is number => angka(v) && v >= 0;
  const out: ProfilBiaya = structuredClone(profil);
  if (t.komisiBatasMaks !== undefined) out.komisi.batasMaks = ada(t.komisiBatasMaks) ? t.komisiBatasMaks : null;
  if (out.komisiDinamis) {
    if (t.komisiDinamisBatasMaks !== undefined) out.komisiDinamis.batasMaks = ada(t.komisiDinamisBatasMaks) ? t.komisiDinamisBatasMaks : null;
    for (const [k, v] of Object.entries(t.komisiDinamisPerKategori ?? {})) if (ada(v)) out.komisiDinamis.perKategori[k] = v;
  }
  if (ada(t.biayaProses)) out.biayaProses.nilai = t.biayaProses;
  if (ada(t.biayaTransaksiPersen)) out.biayaTransaksi.persen = t.biayaTransaksiPersen;
  if (ada(t.preorderPersen)) out.preorder.persen = t.preorderPersen;
  if (ada(t.pphPersen)) out.pph.persen = t.pphPersen;
  if (t.dasar === "setelah_diskon" || t.dasar === "sebelum_diskon") out.dasar = t.dasar;
  for (const pr of out.program) {
    const o = t.program?.[pr.id];
    if (!o) continue;
    if (ada(o.persen)) pr.persen = o.persen;
    if (o.batasMaks !== undefined) pr.batasMaks = ada(o.batasMaks) ? o.batasMaks : null;
  }
  return out;
}

/** Daftar angka di profil yang belum terverifikasi (untuk banner). */
export function belumTerverifikasi(profil: ProfilBiaya): string[] {
  const out: string[] = [];
  const cek = (nama: string, s: Sumber | null | undefined) => {
    if (s && !s.verified) out.push(nama);
  };
  cek(profil.komisi.nama, profil.komisi);
  cek(profil.komisiDinamis?.nama ?? "", profil.komisiDinamis);
  cek("Biaya proses pesanan", profil.biayaProses);
  cek("Biaya layanan logistik", profil.biayaLogistik);
  cek("Biaya transaksi", profil.biayaTransaksi);
  for (const pr of profil.program) cek(pr.nama, pr);
  cek("Pre-order", profil.preorder);
  cek("PPh 0,5%", profil.pph);
  return out.filter(Boolean);
}

// ---------------- Ringkasan ----------------
export type Ringkasan = {
  jumlah: number;
  rugi: number;
  tipis: number;
  sehat: number;
  rataMargin: number | null;
  untungBulanan: number | null; // null bila tidak ada data terjual sama sekali
};

export function ringkas(hasil: HasilProduk[]): Ringkasan {
  const margins = hasil.map((h) => h.margin).filter((m): m is number => m !== null);
  const bulanan = hasil.map((h) => h.untungBulanan).filter((v): v is number => v !== null);
  return {
    jumlah: hasil.length,
    rugi: hasil.filter((h) => h.status === "rugi").length,
    tipis: hasil.filter((h) => h.status === "tipis").length,
    sehat: hasil.filter((h) => h.status === "sehat").length,
    rataMargin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
    untungBulanan: bulanan.length ? bulanan.reduce((a, b) => a + b, 0) : null,
  };
}

// ---------------- Format ----------------
/** "Rp 25.000" (dengan spasi, sesuai brief). */
export function formatRp(v: number): string {
  const r = Math.round(v);
  return `${r < 0 ? "-" : ""}Rp ${String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** 0.125 -> "12,5%". */
export function formatPersen(pecahan: number | null, desimal = 1): string {
  if (pecahan === null || !Number.isFinite(pecahan)) return "-";
  const v = Math.round(pecahan * 100 * 10 ** desimal) / 10 ** desimal;
  return `${String(v).replace(".", ",")}%`;
}

// ---------------- Membaca angka format Indonesia ----------------
/**
 * Membaca angka dari isian atau CSV: "Rp 25.000", "25.000", "25000", "1.250,5", "12,5%", "12.5".
 * jenis "rp": koma diikuti tepat 3 angka dianggap pemisah ribuan ("25,000" = 25000).
 * jenis "persen"/"angka": koma = desimal ("12,5" = 12.5).
 * Kembali null bila kosong atau bukan angka.
 */
export function bacaAngka(teks: unknown, jenis: "rp" | "persen" | "angka" = "angka"): number | null {
  if (typeof teks === "number") return Number.isFinite(teks) ? teks : null;
  if (typeof teks !== "string") return null;
  let s = teks.trim().replace(/^rp\.?/i, "").replace(/[\s%]/g, "").replace(/ /g, "");
  if (!s) return null;
  const minus = /^[-−(]/.test(s) || /\)$/.test(s);
  s = s.replace(/^[-−(+]/, "").replace(/\)$/, "");
  if (!/^[0-9.,]+$/.test(s)) return null;
  const titik = s.includes(".");
  const koma = s.includes(",");
  if (titik && koma) {
    // Pemisah yang muncul terakhir = desimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (titik) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); // 25.000 / 1.250.000
    else if ((s.match(/\./g) ?? []).length > 1) return null;
  } else if (koma) {
    if (jenis === "rp" && /^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");
    else if ((s.match(/,/g) ?? []).length > 1) return null;
    else s = s.replace(",", ".");
  }
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return minus ? -v : v;
}

/** ya/tidak, y/n, true/false, 1/0, iya/ga (tidak peka huruf besar). null = kosong/tidak dikenal. */
export function bacaYaTidak(teks: unknown): boolean | null {
  if (typeof teks === "boolean") return teks;
  if (typeof teks === "number") return teks === 1 ? true : teks === 0 ? false : null;
  if (typeof teks !== "string") return null;
  const t = teks.trim().toLowerCase();
  if (["ya", "y", "iya", "yes", "true", "1", "aktif", "ikut"].includes(t)) return true;
  if (["tidak", "t", "n", "no", "false", "0", "ga", "gak", "nggak", "tdk", "tidak ikut"].includes(t)) return false;
  return null;
}

/** "shopee", "TikTok Shop", "tokopedia", "tts", "custom" -> id marketplace. */
export function bacaMarketplace(teks: unknown): MarketplaceId | null {
  if (typeof teks !== "string") return null;
  const t = teks.toLowerCase().replace(/[^a-z]/g, "");
  if (t === "shopee") return "shopee";
  if (["tiktok", "tiktokshop", "tokopedia", "tts", "tiktokshoptokopedia", "tokped"].includes(t)) return "tiktokshop";
  if (["custom", "lainnya", "lain"].includes(t)) return "custom";
  return null;
}
