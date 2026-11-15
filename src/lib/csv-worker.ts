// Web Worker bersama: membaca dan memeriksa CSV di luar thread halaman, supaya file ribuan baris
// tidak membuat halaman macet. Semua tetap di perangkat; worker tidak membuat permintaan jaringan.
import { impor, pecahCsv, petakanHeader } from "./seller-csv";
import { imporMenu, petakanHeaderMenu } from "./food-csv";

const MODUL = {
  seller: { petakan: petakanHeader, impor: impor as (r: string[][], p: never, b: number | null) => unknown },
  food: { petakan: petakanHeaderMenu, impor: imporMenu as (r: string[][], p: never, b: number | null) => unknown },
};

type Masuk =
  | { jenis: "baca"; kalkulator: keyof typeof MODUL; teks: string; batas: number | null }
  | { jenis: "petakan"; kalkulator: keyof typeof MODUL; pemetaan: never; batas: number | null };

let rows: string[][] = [];

self.onmessage = (e: MessageEvent<Masuk>) => {
  try {
    const m = e.data;
    const modul = MODUL[m.kalkulator];
    if (m.jenis === "baca") {
      rows = pecahCsv(m.teks);
      if (rows.length < 2) {
        self.postMessage({ jenis: "kosong" });
        return;
      }
      const { pemetaan, hilang } = modul.petakan(rows[0]);
      if (hilang.length) {
        self.postMessage({ jenis: "butuh-pemetaan", header: rows[0], contoh: rows.slice(1, 4), pemetaan, hilang });
        return;
      }
      self.postMessage({ jenis: "hasil", hasil: modul.impor(rows, pemetaan as never, m.batas) });
    } else {
      self.postMessage({ jenis: "hasil", hasil: modul.impor(rows, m.pemetaan, m.batas) });
    }
  } catch (err) {
    self.postMessage({ jenis: "gagal", pesan: String(err) });
  }
};
