// Potongan tampilan bersama Kalkulator Untung Seller: kartu hasil, rincian potongan + grafik
// batang, label status, dan pesan peringatan. Semua teks dibuat lewat textContent (aman dari
// isi CSV yang aneh).
import {
  LABEL_RINCIAN,
  formatPersen,
  formatRp,
  type HasilProduk,
  type Peringatan,
  type Produk,
  type Rincian,
  type Status,
} from "./seller";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export const LABEL_STATUS: Record<Status, string> = { rugi: "Rugi", tipis: "Tipis", sehat: "Sehat" };
export const PENJELASAN_STATUS: Record<Status, string> = {
  rugi: "Setiap pesanan produk ini mengurangi uangmu.",
  tipis: "Masih untung, tapi sisanya kecil. Sedikit kenaikan biaya bisa membuatnya rugi.",
  sehat: "Untungnya sudah di atas batas sehat yang kamu atur.",
};

export const PESAN_PERINGATAN: Record<Peringatan, string> = {
  "komisi-kosong": "Komisi/biaya admin belum diisi, jadi dihitung 0%. Isi sesuai kategori produkmu di seller center.",
  "kategori-dinamis-tidak-dikenal": "Kategori tidak cocok dengan daftar komisi dinamis TikTok Shop, jadi komisi dinamis dihitung 0%. Pilih kategori dari daftar saran.",
  "program-persen-kosong": "Ada program yang persennya belum diisi (misalnya Gratis Ongkir XTRA), jadi dihitung 0%. Isi di Pengaturan.",
  "harga-bersih-nol": "Harga setelah diskon Rp 0, jadi margin tidak bisa dihitung.",
};

export function badgeStatus(status: Status): HTMLSpanElement {
  return el("span", LABEL_STATUS[status], `seller-status is-${status}`);
}

/** Rincian potongan per pesanan: daftar + grafik batang relatif terhadap harga bersih. */
export function renderRincian(h: HasilProduk): HTMLElement {
  const wrap = el("div", "", "seller-breakdown");
  const skala = Math.max(h.hargaBersih, 1);
  const baris: Array<{ label: string; nilai: number; jenis: "potongan" | "modal" | "hasil" | "dasar" }> = [
    { label: "Harga setelah diskon", nilai: h.hargaBersih, jenis: "dasar" },
  ];
  for (const key of Object.keys(LABEL_RINCIAN) as Array<keyof Rincian>) {
    if (h.rincian[key] !== 0) baris.push({ label: LABEL_RINCIAN[key], nilai: -h.rincian[key], jenis: "potongan" });
  }
  baris.push({ label: "HPP / modal", nilai: -h.hpp, jenis: "modal" });
  if (h.packing) baris.push({ label: "Packing", nilai: -h.packing, jenis: "modal" });
  baris.push({ label: "Untung bersih", nilai: h.untung, jenis: "hasil" });

  const list = el("ul", "", "seller-breakdown-list");
  for (const b of baris) {
    const li = el("li", "", `is-${b.jenis}${b.jenis === "hasil" && b.nilai < 0 ? " is-minus" : ""}`);
    const atas = el("div", "", "seller-breakdown-row");
    atas.append(el("span", b.label), el("strong", b.jenis === "potongan" || b.jenis === "modal" ? `−${formatRp(-b.nilai)}` : formatRp(b.nilai)));
    const bar = el("div", "", "seller-bar");
    const isi = el("span");
    isi.style.width = `${Math.min(100, (Math.abs(b.nilai) / skala) * 100).toFixed(1)}%`;
    bar.append(isi);
    bar.setAttribute("aria-hidden", "true");
    li.append(atas, bar);
    list.append(li);
  }
  wrap.append(list);
  return wrap;
}

/** Kartu hasil satu produk (dipakai di tab Satu produk dan rincian dari tabel). */
export function renderKartuHasil(p: Produk, h: HasilProduk, opsi: { targetMarginPersen: number; namaMarketplace: string }): HTMLElement {
  const card = el("article", "", `seller-result is-${h.status}`);
  const head = el("header", "", "seller-result-head");
  const judul = el("div");
  judul.append(el("strong", p.nama || "Produk tanpa nama"), el("span", `${opsi.namaMarketplace}${p.kategori ? ` · ${p.kategori}` : ""}`));
  head.append(judul, badgeStatus(h.status));

  const utama = el("div", "", "seller-result-main");
  const untung = el("div", "", "seller-result-profit");
  untung.append(el("span", "Untung bersih per pesanan"), el("strong", formatRp(h.untung)), el("small", `Margin ${formatPersen(h.margin)} dari harga setelah diskon`));
  utama.append(untung, el("p", PENJELASAN_STATUS[h.status], "seller-result-explain"));

  const metrik = el("dl", "", "seller-result-metrics");
  const tambah = (label: string, nilai: string, catatan: string) => {
    const d = el("div");
    d.append(el("dt", label), el("dd", nilai), el("small", catatan));
    metrik.append(d);
  };
  tambah("Harga impas", h.hargaImpas === null ? "Tidak bisa impas" : formatRp(h.hargaImpas), "Harga terendah supaya tidak rugi.");
  tambah(
    `Harga saran (margin ${String(opsi.targetMarginPersen).replace(".", ",")}%)`,
    h.hargaSaran === null ? "Tidak tercapai" : formatRp(h.hargaSaran),
    "Harga terendah untuk mencapai target margin.",
  );
  if (h.untungBulanan !== null) tambah("Untung per bulan", formatRp(h.untungBulanan), `Dari ${p.terjualPerBulan} pesanan per bulan.`);

  card.append(head, utama, metrik);
  if (h.peringatan.length) {
    const warn = el("ul", "", "seller-warnings");
    for (const w of h.peringatan) warn.append(el("li", PESAN_PERINGATAN[w]));
    card.append(warn);
  }
  const rincianJudul = el("h3", "Rincian potongan per pesanan", "seller-breakdown-title");
  card.append(rincianJudul, renderRincian(h));
  card.append(el("p", "Estimasi, bukan jaminan. Cek ulang biaya di seller center resmi.", "seller-result-note"));
  return card;
}
