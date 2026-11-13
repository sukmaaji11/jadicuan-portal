// Logika "Versi lengkap" Kalkulator Modal: 3 skenario dan daftar usaha tersimpan.
// Fungsi murni (tanpa DOM). Rumus utama tetap di modal.ts dan dioper sebagai
// parameter `hitung`, supaya file ini bisa diuji sendiri (src/lib/modal-lengkap.test.mjs).

type Nilai = Record<string, number | null | boolean>;
type HasilInti = {
  penjualanBulanan: number;
  labaBersihBulanan: number;
  totalModalAwal: number;
  balikModalBulan: number | null;
  bepHarianPorsi: number | null;
  dibawahBep: boolean;
};

// ---------------- 3 skenario ----------------
export type SkenarioId = "sepi" | "normal" | "ramai";
export type PersenSkenario = { sepi: number; ramai: number };
export const SKENARIO_DEFAULT: PersenSkenario = { sepi: 60, ramai: 130 };
export const NAMA_SKENARIO: Record<SkenarioId, string> = { sepi: "Sepi", normal: "Normal", ramai: "Ramai" };

export type HasilSkenario = {
  id: SkenarioId;
  persen: number;
  targetHarian: number;
  penjualanBulanan: number;
  labaBersihBulanan: number;
  totalModalAwal: number;
  balikModalBulan: number | null;
  dibawahBep: boolean;
};

/** Sepi 10-100 %, ramai 100-300 % dari target normal; isian aneh kembali ke bawaan. */
export function rapikanPersen(p: Partial<PersenSkenario>): PersenSkenario {
  const bulat = (v: unknown, min: number, max: number, def: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : def;
  return { sepi: bulat(p.sepi, 10, 100, SKENARIO_DEFAULT.sepi), ramai: bulat(p.ramai, 100, 300, SKENARIO_DEFAULT.ramai) };
}

/**
 * Hitung ulang dengan target penjualan per hari dikali persen skenario (dibulatkan ke porsi utuh).
 * Hanya target yang berubah. Modal awal sama di ketiga skenario, karena cadangan kas
 * dihitung dari biaya bulanan, bukan dari penjualan.
 */
export function hitungSkenario<T extends Nilai>(nilai: T, persen: PersenSkenario, hitung: (v: T) => HasilInti): HasilSkenario[] {
  const p = rapikanPersen(persen);
  const target = typeof nilai.targetHarian === "number" ? nilai.targetHarian : 0;
  return (["sepi", "normal", "ramai"] as const).map((id) => {
    const pct = id === "sepi" ? p.sepi : id === "ramai" ? p.ramai : 100;
    const targetHarian = Math.max(0, Math.round((target * pct) / 100));
    const r = hitung({ ...nilai, targetHarian });
    return {
      id,
      persen: pct,
      targetHarian,
      penjualanBulanan: r.penjualanBulanan,
      labaBersihBulanan: r.labaBersihBulanan,
      totalModalAwal: r.totalModalAwal,
      balikModalBulan: r.balikModalBulan,
      dibawahBep: r.dibawahBep,
    };
  });
}

// ---------------- Usaha tersimpan ----------------
export const MAKS_TERSIMPAN = 20;

export type UsahaTersimpan<T extends Nilai = Nilai> = {
  id: string;
  nama: string;
  jenis: string;
  nilai: T;
  sewaBulananManual: boolean;
  disimpan: string; // ISO
};

/** Ambil hanya kunci yang dikenal dari `template`; angka tidak valid dibuang. */
export function rapikanNilai<T extends Nilai>(raw: unknown, template: T): T {
  const out = { ...template };
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  for (const key of Object.keys(template)) {
    const v = src[key];
    if (typeof template[key] === "boolean") (out as Nilai)[key] = v === true;
    else if (v === null || (typeof v === "number" && Number.isFinite(v))) (out as Nilai)[key] = v;
  }
  return out;
}

/** Baca daftar dari teks JSON di penyimpanan; data rusak diabaikan, bukan membuat halaman error. */
export function bacaDaftar<T extends Nilai>(teks: string | null, template: T): UsahaTersimpan<T>[] {
  if (!teks) return [];
  let data: unknown;
  try {
    data = JSON.parse(teks);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const hasil: UsahaTersimpan<T>[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const x = item as Record<string, unknown>;
    if (typeof x.id !== "string" || !x.id) continue;
    hasil.push({
      id: x.id.slice(0, 40),
      nama: typeof x.nama === "string" && x.nama.trim() ? x.nama.trim().slice(0, 60) : "Usaha tanpa nama",
      jenis: typeof x.jenis === "string" ? x.jenis.slice(0, 20) : "",
      nilai: rapikanNilai(x.nilai, template),
      sewaBulananManual: x.sewaBulananManual === true,
      disimpan: typeof x.disimpan === "string" && !Number.isNaN(Date.parse(x.disimpan)) ? x.disimpan : new Date(0).toISOString(),
    });
    if (hasil.length >= MAKS_TERSIMPAN) break;
  }
  return urutkan(hasil);
}

function urutkan<T extends Nilai>(daftar: UsahaTersimpan<T>[]): UsahaTersimpan<T>[] {
  return [...daftar].sort((a, b) => b.disimpan.localeCompare(a.disimpan));
}

export type HasilSimpan<T extends Nilai> = { daftar: UsahaTersimpan<T>[]; penuh: boolean };

/** Simpan baru atau timpa yang id-nya sama. Daftar penuh (20) tidak menghapus apa pun diam-diam. */
export function simpanUsaha<T extends Nilai>(daftar: UsahaTersimpan<T>[], usaha: UsahaTersimpan<T>): HasilSimpan<T> {
  const ada = daftar.some((u) => u.id === usaha.id);
  if (!ada && daftar.length >= MAKS_TERSIMPAN) return { daftar, penuh: true };
  const lain = daftar.filter((u) => u.id !== usaha.id);
  return { daftar: urutkan([usaha, ...lain]), penuh: false };
}

export function hapusUsaha<T extends Nilai>(daftar: UsahaTersimpan<T>[], id: string): UsahaTersimpan<T>[] {
  return daftar.filter((u) => u.id !== id);
}

/** "14 Nov 2026, 09.30" (zona waktu perangkat). */
export function formatWaktu(iso: string): string {
  const d = new Date(iso);
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][d.getMonth()];
  const jam = `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getDate()} ${bulan} ${d.getFullYear()}, ${jam}`;
}
