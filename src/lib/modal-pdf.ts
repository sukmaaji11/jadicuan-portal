// PDF ringkasan Kalkulator Modal (Versi lengkap). Dibuat di browser pembeli dengan jsPDF,
// dimuat hanya saat tombol "Unduh PDF" ditekan. Data dikirim sudah dalam bentuk teks
// (rupiah sudah diformat), jadi file ini hanya mengurus tata letak.
// Warna mengikuti jadicuan.co.id (src/styles/global.css): navy, biru, toska.
// Font bawaan jsPDF (Helvetica) hanya mendukung huruf Latin dasar: teks dirapikan oleh amanPdf().

export type BarisPdf = { label: string; nilai: string; tebal?: boolean };
export type DataPdf = {
  namaUsaha: string;
  tanggal: string;
  satuan: string;
  sorotan: { judul: string; nilai: string; catatan: string };
  ringkasan: BarisPdf[];
  modalAwal: BarisPdf[];
  bulanan: BarisPdf[];
  skenario: { kolom: string[]; baris: { label: string; nilai: string[] }[]; catatan: string };
  isian: BarisPdf[];
  catatan: string[];
  kodeSeri: string;
};

type RGB = [number, number, number];
const NAVY: RGB = [16, 43, 86];
const BLUE: RGB = [22, 119, 232];
const TEAL: RGB = [40, 199, 192];
const MUTED: RGB = [100, 116, 139];
const TEXT: RGB = [51, 72, 100];
const LINE: RGB = [226, 234, 245];
const ZEBRA: RGB = [247, 250, 255];
const WHITE: RGB = [255, 255, 255];
// Warna skenario = warna kategori di beranda (sepi oranye, normal biru, ramai hijau toska).
const SKENARIO_WARNA: Array<{ teks: RGB; latar: RGB }> = [
  { teks: [212, 122, 67], latar: [255, 244, 236] },
  { teks: BLUE, latar: [237, 246, 255] },
  { teks: [25, 155, 140], latar: [233, 250, 245] },
];
const LOGO_URL = "/brand/jadicuan-logo-pdf.png";

export function namaFilePdf(namaUsaha: string): string {
  const slug = namaUsaha
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `ringkasan-modal-${slug || "usaha"}.pdf`;
}

/** Ganti karakter yang tidak ada di font bawaan PDF. */
export function amanPdf(teks: string): string {
  return teks
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/−/g, "-")
    .replace(/→/g, "->")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7E -ÿ–—]/g, "");
}

async function muatLogo(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null; // tanpa logo pun PDF tetap dibuat
  }
}

export async function buatPdf(data: DataPdf): Promise<Blob> {
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), muatLogo()]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 18;
  const KANAN = W - M;
  const BAWAH = H - 24; // batas isi sebelum kaki halaman
  let y = 0;

  const isi = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const warna = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const garis = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const huruf = (size: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
  };
  const teks = (s: string, x: number, yy: number, opt: { align?: "left" | "right" | "center"; charSpace?: number } = {}) =>
    doc.text(amanPdf(s), x, yy, { align: opt.align ?? "left", charSpace: opt.charSpace });

  /** Pita gradasi biru -> toska (jsPDF tidak punya gradasi: disusun dari potongan tipis). */
  const gradasi = (x: number, yy: number, w: number, h: number, langkah = 70) => {
    const lebar = w / langkah;
    for (let i = 0; i < langkah; i++) {
      const t = i / (langkah - 1);
      isi([0, 1, 2].map((k) => Math.round(BLUE[k] + (TEAL[k] - BLUE[k]) * t)) as RGB);
      doc.rect(x + i * lebar, yy, lebar + 0.2, h, "F");
    }
  };

  const ubinLogo = (x: number, yy: number, size: number) => {
    isi(WHITE);
    doc.roundedRect(x, yy, size, size, size * 0.24, size * 0.24, "F");
    if (logo) doc.addImage(logo, "PNG", x + size * 0.08, yy + size * 0.08, size * 0.84, size * 0.84);
  };

  // ---------- Kepala halaman ----------
  const kepalaUtama = () => {
    gradasi(0, 0, W, 40);
    ubinLogo(M, 9, 22);
    warna(WHITE);
    huruf(20, true);
    teks("JadiCuan", M + 28, 19);
    huruf(10);
    teks("Kalkulator Modal & Balik Modal", M + 28, 25.5);
    huruf(9.5, true);
    teks(data.tanggal, KANAN, 19, { align: "right" });
    if (data.kodeSeri) {
      huruf(8.5);
      teks(`Versi lengkap ${data.kodeSeri}`, KANAN, 25.5, { align: "right" });
    }
    y = 52;
  };
  const kepalaLanjutan = () => {
    gradasi(0, 0, W, 14);
    ubinLogo(M, 3, 8);
    warna(WHITE);
    huruf(10, true);
    teks("JadiCuan", M + 11, 8.6);
    huruf(8.5);
    teks(`Ringkasan modal ${data.namaUsaha}`, KANAN, 8.6, { align: "right" });
    y = 26;
  };
  const butuh = (mm: number) => {
    if (y + mm > BAWAH) {
      doc.addPage();
      kepalaLanjutan();
    }
  };

  // ---------- Komponen ----------
  const paragraf = (s: string, size = 9, c: RGB = MUTED, lebar = W - 2 * M, x = M) => {
    huruf(size);
    warna(c);
    const lines = doc.splitTextToSize(amanPdf(s), lebar) as string[];
    for (const line of lines) {
      butuh(5);
      doc.text(line, x, y);
      y += size * 0.45;
    }
  };

  const tinggiTabel = (rows: BarisPdf[]) =>
    rows.reduce((t, r) => {
      huruf(10, r.tebal);
      return t + (doc.splitTextToSize(amanPdf(r.label), 112) as string[]).length * 4.6 + 2.4;
    }, 1);
  /** Judul bagian; `isiMm` = tinggi isi yang ingin tetap satu halaman dengan judulnya (maks. 1 halaman). */
  const judulBagian = (s: string, isiMm = 0) => {
    butuh(Math.min(18 + isiMm, BAWAH - 30));
    y += 5;
    isi(BLUE);
    doc.roundedRect(M, y - 4.2, 1.6, 5.4, 0.8, 0.8, "F");
    huruf(12.5, true);
    warna(NAVY);
    teks(s, M + 4.5, y);
    y += 6;
  };

  const tabel = (rows: BarisPdf[]) => {
    rows.forEach((r, i) => {
      huruf(10, r.tebal);
      const kiri = doc.splitTextToSize(amanPdf(r.label), 112) as string[];
      const tinggi = kiri.length * 4.6 + 2.4;
      butuh(tinggi + 1);
      if (r.tebal) {
        garis(BLUE);
        doc.setLineWidth(0.35);
        doc.line(M, y, KANAN, y);
        isi([237, 246, 255]);
        doc.rect(M, y, W - 2 * M, tinggi, "F");
      } else if (i % 2 === 0) {
        isi(ZEBRA);
        doc.rect(M, y, W - 2 * M, tinggi, "F");
      }
      const base = y + 4.6;
      warna(r.tebal ? NAVY : TEXT);
      doc.text(kiri, M + 3, base);
      huruf(10, true);
      warna(NAVY);
      teks(r.nilai, KANAN - 3, base, { align: "right" });
      y += tinggi;
    });
    y += 1;
  };

  // ---------- Halaman 1 ----------
  kepalaUtama();

  // Judul + label estimasi
  huruf(8, true);
  warna(BLUE);
  teks("RINGKASAN MODAL", M, y, { charSpace: 0.5 });
  y += 8;
  huruf(22, true);
  warna(NAVY);
  const judul = doc.splitTextToSize(amanPdf(data.namaUsaha), W - 2 * M) as string[];
  doc.text(judul, M, y);
  y += (judul.length - 1) * 9 + 6;
  const label = "ESTIMASI  -  bukan jaminan keuntungan";
  huruf(8, true);
  const lw = doc.getTextWidth(label) + 8;
  isi([234, 243, 253]);
  doc.roundedRect(M, y, lw, 6.4, 3.2, 3.2, "F");
  warna(BLUE);
  teks(label, M + 4, y + 4.3);
  y += 12;

  // Kartu utama: balik modal + dua angka kunci
  const kartuH = 34;
  isi(BLUE);
  doc.roundedRect(M, y, W - 2 * M, kartuH, 4, 4, "F");
  isi([19, 142, 228]);
  doc.roundedRect(118, y, KANAN - 118, kartuH, 4, 4, "F");
  doc.rect(118, y, 6, kartuH, "F");
  warna(WHITE);
  huruf(7.5, true);
  teks(data.sorotan.judul.toUpperCase(), M + 7, y + 10, { charSpace: 0.5 });
  huruf(22, true);
  teks(data.sorotan.nilai.replace(/ \(.*\)$/, ""), M + 7, y + 21);
  const rincianTahun = data.sorotan.nilai.match(/\((.*)\)$/)?.[1];
  if (rincianTahun) {
    huruf(9);
    teks(rincianTahun, M + 7, y + 27.5);
  }
  const kunci = data.ringkasan.filter((r) => /Total modal awal|Titik impas/.test(r.label)).slice(0, 2);
  kunci.forEach((r, i) => {
    const yy = y + 11 + i * 13;
    huruf(7.5, true);
    warna([214, 233, 252]);
    teks(r.label.toUpperCase(), 125, yy, { charSpace: 0.3 });
    huruf(12, true);
    warna(WHITE);
    teks(r.nilai, 125, yy + 5.6);
  });
  y += kartuH + 6;
  paragraf(data.sorotan.catatan);
  y += 1;

  judulBagian("Ringkasan", tinggiTabel(data.ringkasan));
  tabel(data.ringkasan);
  judulBagian("Rincian modal awal", tinggiTabel(data.modalAwal));
  tabel(data.modalAwal);
  judulBagian("Ke mana penjualan sebulan pergi", tinggiTabel(data.bulanan));
  tabel(data.bulanan);

  // ---------- 3 skenario ----------
  judulBagian("3 skenario penjualan", 12 + data.skenario.baris.length * 7.2);
  const kolomKanan = [96, 140, KANAN - 3];
  butuh(10 + data.skenario.baris.length * 8);
  data.skenario.kolom.slice(1).forEach((k, i) => {
    const w = SKENARIO_WARNA[i] ?? SKENARIO_WARNA[1];
    huruf(8.5, true);
    const tw = doc.getTextWidth(amanPdf(k)) + 7;
    isi(w.latar);
    doc.roundedRect(kolomKanan[i] - tw + 2, y - 1, tw, 6.4, 3.2, 3.2, "F");
    warna(w.teks);
    teks(k, kolomKanan[i] - 1.5, y + 3.4, { align: "right" });
  });
  y += 8;
  data.skenario.baris.forEach((b, i) => {
    const tinggi = 7.2;
    if (i % 2 === 0) {
      isi(ZEBRA);
      doc.rect(M, y, W - 2 * M, tinggi, "F");
    }
    huruf(10);
    warna(TEXT);
    teks(b.label, M + 3, y + 5);
    b.nilai.forEach((n, j) => {
      huruf(10, true);
      warna(/^-/.test(n) ? [163, 57, 43] : NAVY);
      teks(n, kolomKanan[j], y + 5, { align: "right" });
    });
    y += tinggi;
  });
  y += 4;
  paragraf(data.skenario.catatan);

  judulBagian("Angka yang kamu isi", tinggiTabel(data.isian));
  tabel(data.isian);

  // ---------- Catatan ----------
  huruf(9);
  const barisCatatan = data.catatan.map((c) => doc.splitTextToSize(amanPdf(c), W - 2 * M - 6) as string[]);
  judulBagian("Catatan", barisCatatan.reduce((t, l) => t + l.length * 4.2 + 1.8, 0));
  for (const c of data.catatan) {
    huruf(9);
    const lines = doc.splitTextToSize(amanPdf(c), W - 2 * M - 6) as string[];
    butuh(lines.length * 4.2 + 2);
    isi(TEAL);
    doc.circle(M + 1.3, y - 1.2, 0.9, "F");
    warna(TEXT);
    doc.text(lines, M + 5, y);
    y += lines.length * 4.2 + 1.8;
  }

  // ---------- Kaki setiap halaman ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    gradasi(M, H - 17, W - 2 * M, 0.7, 40);
    huruf(8);
    warna(MUTED);
    teks("Estimasi, bukan jaminan. Dihitung di", M, H - 11);
    const lebarAwal = doc.getTextWidth("Estimasi, bukan jaminan. Dihitung di ");
    huruf(8, true);
    warna(BLUE);
    teks("jadicuan.co.id", M + lebarAwal, H - 11);
    huruf(8);
    warna(MUTED);
    teks(`Halaman ${i} dari ${total}`, KANAN, H - 11, { align: "right" });
  }
  return doc.output("blob");
}
