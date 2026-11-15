// Rumus Kalkulator Harga Display untuk aplikasi pesan antar makanan (GoFood, GrabFood,
// ShopeeFood, TikTok, Custom). Fungsi murni, diuji di src/lib/food.test.mjs.
// Profil potongan dari src/config/biaya-pesan-antar.json (+ timpaan pengguna).
//
// Notasi (persen ditulis 0-100 di input, pecahan saat dihitung):
//   p harga display, d diskon penjual, c komisi, t PPN atas komisi (0 bila sudah termasuk),
//   f biaya tetap per pesanan, s biaya layanan, a iklan/promo, h HPP, k packing, o overhead,
//   x PPh (0 atau 0,5%).
// untung(p) linear dalam p, jadi harga impas dan harga saran memakai rumus tertutup.
// Komponen dibulatkan ke rupiah di akhir; uang bersih = harga bayar - jumlah potongan yang
// sudah dibulatkan, supaya rincian pas dijumlahkan.

export type PlatformId = "gofood" | "grabfood" | "shopeefood" | "tiktok" | "custom";
export const PLATFORMS: PlatformId[] = ["gofood", "grabfood", "shopeefood", "tiktok", "custom"];

export type ProfilFood = {
  nama: string;
  updatedAt: string;
  verified: boolean;
  komisiPersen: number;
  komisiAntarSendiriPersen: number | null;
  rentangDilaporkan: number[] | null;
  dasar: "sebelum_diskon" | "setelah_diskon";
  komisiTermasukPPN: boolean | null; // null = belum diketahui, pengguna wajib memilih
  biayaTetapPerPesanan: number;
  biayaLayananPersen: number;
  rentangBiayaLayanan?: number[];
  biayaIklanPersen: number;
  source: string[];
  catatan: string;
};

export type Kemitraan = "kurir_platform" | "antar_sendiri";

/** Angka yang ditimpa pengguna per platform (undefined = pakai config). */
export type TimpaanFood = {
  komisiPersen?: number;
  komisiAntarSendiriPersen?: number;
  dasar?: "sebelum_diskon" | "setelah_diskon";
  komisiTermasukPPN?: boolean;
  biayaTetapPerPesanan?: number;
  biayaLayananPersen?: number;
  biayaIklanPersen?: number;
  kemitraan?: Kemitraan;
};

export type PengaturanFood = {
  modeTarget: "rp" | "margin";
  targetRp: number; // untung per porsi yang diinginkan
  targetMarginPersen: number; // untung / harga bayar pembeli
  diskonPersen: number;
  overhead: number;
  kelipatan: number;
  pph: boolean;
  tarifPPNPersen: number;
  platformAktif: PlatformId[];
};

export const PENGATURAN_FOOD_DEFAULT: PengaturanFood = {
  modeTarget: "margin",
  targetRp: 3000,
  targetMarginPersen: 20,
  diskonPersen: 0,
  overhead: 0,
  kelipatan: 500,
  pph: false,
  tarifPPNPersen: 11,
  platformAktif: ["gofood", "grabfood", "shopeefood", "tiktok"],
};

export type Menu = {
  nama: string;
  hpp: number;
  packing?: number | null;
  hargaOffline?: number | null;
  // Timpaan per menu (null/undefined = pakai Pengaturan)
  targetRp?: number | null;
  targetMarginPersen?: number | null;
  diskonPersen?: number | null;
  overhead?: number | null;
};

export type RincianFood = {
  komisi: number;
  ppnKomisi: number;
  biayaTetap: number;
  layanan: number;
  iklan: number;
  pph: number;
};
export const LABEL_RINCIAN_FOOD: Record<keyof RincianFood, string> = {
  komisi: "Komisi platform",
  ppnKomisi: "PPN atas komisi",
  biayaTetap: "Biaya tetap per pesanan",
  layanan: "Biaya layanan",
  iklan: "Iklan / promo platform",
  pph: "PPh 0,5%",
};

export type Titik = {
  harga: number; // harga display
  hargaBayar: number; // dibayar pembeli setelah diskon penjual
  rincian: RincianFood;
  totalPotongan: number;
  uangBersih: number;
  untung: number;
  margin: number | null; // untung / harga bayar
  persenPotongan: number | null; // total potongan / harga bayar
};

export type StatusFood = "aman" | "tipis" | "rugi";
export type PeringatanFood = "ppn-belum-dipilih" | "komisi-nol" | "komisi-antar-sendiri-kosong";
export type MasalahFood = "hpp-tidak-valid" | "diskon-100" | "potongan-100" | "target-tidak-tercapai";

export type HasilFood =
  | {
      ok: true;
      platform: PlatformId;
      target: number; // untung per porsi yang dikejar pada harga saran (Rp)
      hargaImpas: number; // dibulatkan ke atas ke rupiah
      hargaSaran: number; // dibulatkan ke atas ke kelipatan
      saran: Titik; // hitung ulang pada harga saran yang sudah dibulatkan
      offline: (Titik & { bocor: number; targetPadaOffline: number }) | null;
      kenaikanRp: number | null; // harga saran - harga offline
      kenaikanPersen: number | null;
      status: StatusFood; // pada harga offline bila ada, kalau tidak pada harga saran
      peringatan: PeringatanFood[];
      komisiPersen: number;
      ppnDitambahkan: boolean;
    }
  | { ok: false; platform: PlatformId; masalah: MasalahFood; peringatan: PeringatanFood[] };

const angka = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const pilih = (...v: Array<number | null | undefined>) => v.find(angka);
const nonNeg = (v: number) => (v > 0 ? v : 0);

export function terapkanTimpaanFood(p: ProfilFood, t?: TimpaanFood): ProfilFood {
  if (!t) return p;
  const out = { ...p };
  const ok = (v: unknown): v is number => angka(v) && v >= 0;
  if (ok(t.komisiPersen)) out.komisiPersen = t.komisiPersen;
  if (ok(t.komisiAntarSendiriPersen)) out.komisiAntarSendiriPersen = t.komisiAntarSendiriPersen;
  if (t.dasar === "sebelum_diskon" || t.dasar === "setelah_diskon") out.dasar = t.dasar;
  if (typeof t.komisiTermasukPPN === "boolean") out.komisiTermasukPPN = t.komisiTermasukPPN;
  if (ok(t.biayaTetapPerPesanan)) out.biayaTetapPerPesanan = t.biayaTetapPerPesanan;
  if (ok(t.biayaLayananPersen)) out.biayaLayananPersen = t.biayaLayananPersen;
  if (ok(t.biayaIklanPersen)) out.biayaIklanPersen = t.biayaIklanPersen;
  return out;
}

type Siap = { d: number; c: number; t: number; f: number; s: number; a: number; x: number; h: number; k: number; o: number; dasarSetelah: boolean };

/** Titik pada harga display p (dengan pembulatan komponen). */
function titik(p: number, z: Siap): Titik {
  const bayarExact = p * (1 - z.d);
  const dasar = z.dasarSetelah ? bayarExact : p;
  const r: RincianFood = {
    komisi: Math.round(dasar * z.c),
    ppnKomisi: Math.round(dasar * z.c * z.t),
    biayaTetap: Math.round(z.f),
    layanan: Math.round(dasar * z.s),
    iklan: Math.round(dasar * z.a),
    pph: Math.round(z.x * bayarExact),
  };
  const hargaBayar = Math.round(bayarExact);
  const totalPotongan = Object.values(r).reduce((x, y) => x + y, 0);
  const uangBersih = hargaBayar - totalPotongan;
  const untung = uangBersih - Math.round(z.h) - Math.round(z.k) - Math.round(z.o);
  return {
    harga: p,
    hargaBayar,
    rincian: r,
    totalPotongan,
    uangBersih,
    untung,
    margin: hargaBayar > 0 ? untung / hargaBayar : null,
    persenPotongan: hargaBayar > 0 ? totalPotongan / hargaBayar : null,
  };
}

/** Untung tanpa pembulatan (untuk uji harga impas). */
export function untungTepat(p: number, menu: Menu, profil: ProfilFood, s: PengaturanFood, kemitraan: Kemitraan = "kurir_platform"): number {
  const z = siapkan(menu, profil, s, kemitraan).z;
  const bayar = p * (1 - z.d);
  const dasar = z.dasarSetelah ? bayar : p;
  return bayar - dasar * (z.c * (1 + z.t) + z.s + z.a) - z.f - z.x * bayar - z.h - z.k - z.o;
}

function siapkan(menu: Menu, profil: ProfilFood, s: PengaturanFood, kemitraan: Kemitraan) {
  const peringatan: PeringatanFood[] = [];
  let komisi = profil.komisiPersen;
  if (kemitraan === "antar_sendiri") {
    if (angka(profil.komisiAntarSendiriPersen)) komisi = profil.komisiAntarSendiriPersen;
    else peringatan.push("komisi-antar-sendiri-kosong");
  }
  if (!(komisi > 0)) peringatan.push("komisi-nol");
  // PPN belum dipilih: hitung dengan PPN ditambahkan (lebih hati-hati) dan beri peringatan.
  if (profil.komisiTermasukPPN === null) peringatan.push("ppn-belum-dipilih");
  const ppnDitambahkan = profil.komisiTermasukPPN !== true;
  const z: Siap = {
    d: Math.min(100, nonNeg(pilih(menu.diskonPersen, s.diskonPersen) ?? 0)) / 100,
    c: nonNeg(komisi) / 100,
    t: ppnDitambahkan ? nonNeg(s.tarifPPNPersen) / 100 : 0,
    f: nonNeg(profil.biayaTetapPerPesanan),
    s: nonNeg(profil.biayaLayananPersen) / 100,
    a: nonNeg(profil.biayaIklanPersen) / 100,
    x: s.pph ? 0.005 : 0,
    h: menu.hpp,
    k: nonNeg(pilih(menu.packing) ?? 0),
    o: nonNeg(pilih(menu.overhead, s.overhead) ?? 0),
    dasarSetelah: profil.dasar === "setelah_diskon",
  };
  return { z, peringatan, komisi: nonNeg(komisi), ppnDitambahkan };
}

export function hitungFood(
  menu: Menu,
  platform: PlatformId,
  profil: ProfilFood,
  s: PengaturanFood = PENGATURAN_FOOD_DEFAULT,
  kemitraan: Kemitraan = "kurir_platform",
): HasilFood {
  const { z, peringatan, komisi, ppnDitambahkan } = siapkan(menu, profil, s, kemitraan);
  if (!angka(menu.hpp) || menu.hpp <= 0) return { ok: false, platform, masalah: "hpp-tidak-valid", peringatan };
  if (z.d >= 1) return { ok: false, platform, masalah: "diskon-100", peringatan };

  // untung(p) = A*p - B
  const faktorDasar = z.dasarSetelah ? 1 - z.d : 1;
  const A = (1 - z.d) * (1 - z.x) - faktorDasar * (z.c * (1 + z.t) + z.s + z.a);
  const B = z.f + z.h + z.k + z.o;
  if (A <= 1e-9) return { ok: false, platform, masalah: "potongan-100", peringatan };

  const modeRp = pilih(menu.targetRp) !== undefined || (s.modeTarget === "rp" && pilih(menu.targetMarginPersen) === undefined);
  const targetRp = nonNeg(pilih(menu.targetRp, s.targetRp) ?? 0);
  const m = Math.min(99, nonNeg(pilih(menu.targetMarginPersen, s.targetMarginPersen) ?? 0)) / 100;

  // Harga saran (tepat), lalu dibulatkan ke atas ke kelipatan.
  let tepat: number;
  if (modeRp) tepat = (B + targetRp) / A;
  else {
    const A2 = A - m * (1 - z.d);
    if (A2 <= 1e-9) return { ok: false, platform, masalah: "target-tidak-tercapai", peringatan };
    tepat = B / A2;
  }
  const k = s.kelipatan > 0 ? s.kelipatan : 1;
  let hargaSaran = Math.ceil((tepat - 1e-7) / k) * k;
  let saran = titik(hargaSaran, z);
  // Target dalam rupiah bulat (uang tidak punya sen).
  const targetPada = (t: Titik) => Math.round(modeRp ? targetRp : m * t.hargaBayar);
  // Pembulatan komponen bisa membuat untung kurang 1-2 rupiah dari target: naikkan per kelipatan.
  for (let i = 0; i < 10 && saran.untung < targetPada(saran); i++) {
    hargaSaran += k;
    saran = titik(hargaSaran, z);
  }
  const hargaImpas = Math.ceil(B / A - 1e-7);

  const off = angka(menu.hargaOffline) && menu.hargaOffline > 0 ? titik(menu.hargaOffline, z) : null;
  const offline = off ? { ...off, targetPadaOffline: targetPada(off), bocor: Math.max(0, targetPada(off) - off.untung) } : null;
  const nilaiStatus = offline ?? saran;
  const target = targetPada(nilaiStatus);
  const status: StatusFood = nilaiStatus.untung < 0 ? "rugi" : nilaiStatus.untung < target ? "tipis" : "aman";

  return {
    ok: true,
    platform,
    target: targetPada(saran),
    hargaImpas,
    hargaSaran,
    saran,
    offline,
    kenaikanRp: offline ? hargaSaran - menu.hargaOffline! : null,
    kenaikanPersen: offline ? (hargaSaran - menu.hargaOffline!) / menu.hargaOffline! : null,
    status,
    peringatan,
    komisiPersen: komisi,
    ppnDitambahkan,
  };
}

export const PESAN_MASALAH: Record<MasalahFood, string> = {
  "hpp-tidak-valid": "Isi HPP atau modal per porsi lebih dari Rp 0.",
  "diskon-100": "Diskon 100% membuat pembeli tidak membayar apa pun. Kecilkan diskonnya.",
  "potongan-100": "Total potongan platform 100% atau lebih, jadi harga berapa pun tidak bisa menutup modal. Cek lagi angka komisi dan biaya di Pengaturan.",
  "target-tidak-tercapai": "Target margin terlalu tinggi untuk potongan platform ini. Turunkan target margin.",
};

export const PESAN_PERINGATAN_FOOD: Record<PeringatanFood, string> = {
  "ppn-belum-dipilih": "Status PPN atas komisi belum dipilih, jadi dihitung dengan PPN ditambahkan (lebih hati-hati). Pilih di Pengaturan sesuai laporan mitramu.",
  "komisi-nol": "Komisi masih 0%. Isi angka dari laporan di aplikasi mitramu di Pengaturan.",
  "komisi-antar-sendiri-kosong": "Komisi untuk antar sendiri belum diisi, jadi dipakai komisi kurir platform.",
};
