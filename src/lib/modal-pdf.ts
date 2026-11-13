// PDF ringkasan Kalkulator Modal (Versi lengkap). Dibuat di browser pembeli dengan jsPDF,
// dimuat hanya saat tombol "Unduh PDF" ditekan. Data dikirim sudah dalam bentuk teks
// (rupiah sudah diformat), jadi file ini hanya mengurus tata letak.
// Font bawaan jsPDF (Helvetica) hanya mendukung huruf Latin dasar: hindari karakter
// di luar Latin-1 di teks yang dikirim ke sini.

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

const NAVY: [number, number, number] = [16, 43, 86];
const BLUE: [number, number, number] = [22, 119, 232];
const MUTED: [number, number, number] = [100, 116, 139];
const LINE: [number, number, number] = [226, 234, 245];

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

export async function buatPdf(data: DataPdf): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 18;
  const H = 297;
  let y = M;

  const warna = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const halamanBaru = () => {
    doc.addPage();
    y = M;
  };
  const butuh = (mm: number) => {
    if (y + mm > H - 22) halamanBaru();
  };
  const teks = (s: string, x: number, opts: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    warna(opts.color ?? NAVY);
    doc.text(amanPdf(s), x, y, { align: opts.align ?? "left" });
  };
  const paragraf = (s: string, size = 9, color = MUTED) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    warna(color);
    const lines = doc.splitTextToSize(amanPdf(s), W - 2 * M) as string[];
    for (const line of lines) {
      butuh(5);
      doc.text(line, M, y);
      y += size * 0.45;
    }
  };
  const judulBagian = (s: string) => {
    butuh(16);
    y += 4;
    teks(s, M, { size: 12, bold: true });
    y += 2.5;
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 6;
  };
  const tabel = (rows: BarisPdf[]) => {
    for (const r of rows) {
      doc.setFont("helvetica", r.tebal ? "bold" : "normal");
      doc.setFontSize(10);
      const kiri = doc.splitTextToSize(amanPdf(r.label), 110) as string[];
      butuh(kiri.length * 5 + 2);
      warna(r.tebal ? NAVY : [51, 72, 100]);
      doc.text(kiri, M, y);
      doc.setFont("helvetica", "bold");
      warna(NAVY);
      doc.text(amanPdf(r.nilai), W - M, y, { align: "right" });
      y += kiri.length * 4.6 + 2.2;
    }
  };

  // Kepala
  teks("JadiCuan", M, { size: 11, bold: true, color: BLUE });
  teks("Kalkulator Modal & Balik Modal", W - M, { size: 9, color: MUTED, align: "right" });
  y += 10;
  teks(`Ringkasan modal ${data.namaUsaha}`, M, { size: 18, bold: true });
  y += 6.5;
  teks(`Dibuat ${data.tanggal} - ESTIMASI, bukan jaminan keuntungan.`, M, { size: 9, color: MUTED });
  y += 8;

  // Kartu sorotan
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.roundedRect(M, y, W - 2 * M, 24, 3, 3, "F");
  y += 8;
  teks(data.sorotan.judul.toUpperCase(), M + 6, { size: 8, bold: true, color: [255, 255, 255] });
  y += 8;
  teks(data.sorotan.nilai, M + 6, { size: 16, bold: true, color: [255, 255, 255] });
  y += 14;
  paragraf(data.sorotan.catatan);
  y += 2;

  judulBagian("Ringkasan");
  tabel(data.ringkasan);
  judulBagian("Rincian modal awal");
  tabel(data.modalAwal);
  judulBagian("Ke mana penjualan sebulan pergi");
  tabel(data.bulanan);

  // Skenario: tabel 4 kolom
  judulBagian("3 skenario penjualan");
  const kolomX = [M, 96, 140, W - M];
  doc.setFontSize(9);
  butuh(8);
  data.skenario.kolom.forEach((k, i) => teks(k, kolomX[i], { size: 9, bold: true, color: MUTED, align: i === 0 ? "left" : "right" }));
  y += 6;
  for (const b of data.skenario.baris) {
    butuh(7);
    teks(b.label, kolomX[0], { size: 10 });
    b.nilai.forEach((n, i) => teks(n, kolomX[i + 1], { size: 10, bold: true, align: "right" }));
    y += 6.2;
  }
  y += 1;
  paragraf(data.skenario.catatan);

  judulBagian("Angka yang kamu isi");
  tabel(data.isian);

  judulBagian("Catatan");
  for (const c of data.catatan) {
    paragraf(`- ${c}`, 9, [51, 72, 100]);
    y += 1;
  }

  // Kaki setiap halaman
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    warna(MUTED);
    doc.text(amanPdf(`Estimasi, bukan jaminan. Dihitung di jadicuan.co.id - Versi lengkap ${data.kodeSeri}`), M, H - 10);
    doc.text(`${i}/${total}`, W - M, H - 10, { align: "right" });
  }
  return doc.output("blob");
}
