// Tab "Impor CSV" Kalkulator Untung Seller. Tampilan dan worker memakai modul impor bersama
// (impor-csv-ui.ts + csv-worker.ts); di sini hanya definisi kolom dan apa yang terjadi setelah impor.
import { FREE_ROW_LIMIT, MAKS_UKURAN_MB } from "../config/kalkulator-seller";
import { KOLOM_WAJIB, LABEL_KOLOM, buatTemplateCsv, impor, petakanHeader } from "./seller-csv";
import { pasangImporCsv } from "./impor-csv-ui";
import type { KonteksSeller } from "./seller-ui";

export { unduhTeks } from "./impor-csv-ui";

export function pasangImpor(ctx: KonteksSeller, opsi: { onImpor?: (jumlahBaris: number) => void } = {}): void {
  pasangImporCsv(
    document.getElementById("csv-root")!,
    {
      kalkulator: "seller",
      judul: "Hitung banyak produk sekaligus",
      deskripsi:
        "Unggah file CSV dari Excel atau Google Sheets. Kolom wajib: nama_produk, harga_jual, hpp, marketplace, kategori. Kolom lain boleh kosong dan akan memakai nilai di Pengaturan.",
      satuan: "produk",
      kolomWajib: KOLOM_WAJIB,
      label: LABEL_KOLOM,
      template: buatTemplateCsv,
      namaTemplate: "template-kalkulator-untung-seller.csv",
      batas: FREE_ROW_LIMIT,
      maksMb: MAKS_UKURAN_MB,
      petakan: petakanHeader,
      impor,
      idInput: "csv-file",
      idHasil: "seller-results",
    },
    {
      onHasil: (h) => {
        ctx.hapusSumber("csv");
        ctx.tambah(h.produk, "csv", h.barisProduk);
        opsi.onImpor?.(h.totalBaris);
      },
    },
  );
}
