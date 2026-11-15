// Ekspor XLSX bersama untuk kalkulator (SheetJS 0.20.3, dimuat hanya saat tombol ditekan).
// Kolom pertama dibuat lebar, header diberi filter otomatis. Semua dibuat di browser.
import type { Sel } from "./seller-ekspor";
import { unduhTeks } from "./impor-csv-ui";

export async function unduhXlsx(rows: Sel[][], namaFile: string, namaSheet: string): Promise<void> {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = rows[0].map((h, i) => ({ wch: i === 0 ? 28 : Math.max(10, String(h).length + 2) }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: rows[0].length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, namaSheet.slice(0, 31));
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  unduhTeks(namaFile, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
