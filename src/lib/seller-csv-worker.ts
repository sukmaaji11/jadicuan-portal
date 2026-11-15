// Web Worker: membaca dan memeriksa CSV di luar thread halaman, supaya file ribuan baris tidak
// membuat halaman macet. Semua tetap di perangkat; worker tidak membuat permintaan jaringan.
import { impor, pecahCsv, petakanHeader, type Pemetaan } from "./seller-csv";

type Masuk = { jenis: "baca"; teks: string; batas: number | null } | { jenis: "petakan"; pemetaan: Pemetaan; batas: number | null };

let rows: string[][] = [];

self.onmessage = (e: MessageEvent<Masuk>) => {
  try {
    const m = e.data;
    if (m.jenis === "baca") {
      rows = pecahCsv(m.teks);
      if (rows.length < 2) {
        self.postMessage({ jenis: "kosong" });
        return;
      }
      const { pemetaan, hilang } = petakanHeader(rows[0]);
      if (hilang.length) {
        self.postMessage({ jenis: "butuh-pemetaan", header: rows[0], contoh: rows.slice(1, 4), pemetaan, hilang });
        return;
      }
      self.postMessage({ jenis: "hasil", hasil: impor(rows, pemetaan, m.batas) });
    } else {
      self.postMessage({ jenis: "hasil", hasil: impor(rows, m.pemetaan, m.batas) });
    }
  } catch (err) {
    self.postMessage({ jenis: "gagal", pesan: String(err) });
  }
};
