// Hasil daftar produk Kalkulator Untung Seller: kartu ringkasan, tabel yang bisa diurutkan dan
// difilter (Rugi di atas secara default), dan rincian per produk. Tabel ditampilkan per halaman
// supaya ribuan baris tetap ringan.
import { formatPersen, formatRp, ringkas, type HasilProduk, type MarketplaceId, type Status } from "./seller";
import { el, LABEL_STATUS, badgeStatus, renderKartuHasil } from "./seller-tampil";
import type { ItemDaftar, KonteksSeller } from "./seller-ui";

const PER_HALAMAN = 50;
type Kolom = "status" | "nama" | "marketplace" | "harga" | "untung" | "margin" | "impas" | "saran" | "bulanan";
const URUTAN_STATUS: Record<Status, number> = { rugi: 0, tipis: 1, sehat: 2 };

export type BarisHasil = { item: ItemDaftar; hasil: HasilProduk };

export function pasangHasil(ctx: KonteksSeller): { baris(): BarisHasil[] } {
  const root = document.getElementById("results-root")!;
  const section = document.getElementById("seller-results")!;
  let baris: BarisHasil[] = [];
  let filter = { status: "" as "" | Status, marketplace: "" as "" | MarketplaceId, kategori: "", cari: "" };
  let urut: { kolom: Kolom; naik: boolean } = { kolom: "status", naik: true };
  let halaman = 0;
  let terbuka: number | null = null;

  // Kerangka (dibuat sekali, isinya diperbarui).
  const ringkasan = el("div", "", "seller-summary");
  const kontrol = el("div", "", "seller-filters");
  const info = el("p", "", "seller-table-info");
  const tabelWrap = el("div", "", "seller-table-wrap");
  const tabel = el("table", "", "seller-table");
  const nav = el("div", "", "seller-pager");
  const detail = el("div", "", "seller-detail");
  const aksi = el("div", "", "seller-results-actions");
  tabelWrap.append(tabel);
  tabelWrap.tabIndex = 0;
  tabelWrap.setAttribute("role", "region");
  tabelWrap.setAttribute("aria-label", "Tabel hasil produk (geser ke samping di HP)");
  root.append(ringkasan, kontrol, info, tabelWrap, nav, detail, aksi);

  const pilihan = (label: string, opsi: Array<[string, string]>, onUbah: (v: string) => void) => {
    const wrap = el("label", "", "seller-filter");
    wrap.append(el("span", label));
    const s = el("select", "", "modal-select");
    for (const [v, t] of opsi) {
      const o = el("option", t);
      o.value = v;
      s.append(o);
    }
    s.addEventListener("change", () => onUbah(s.value));
    wrap.append(s);
    return { wrap, s };
  };
  const fStatus = pilihan("Status", [["", "Semua"], ["rugi", "Rugi"], ["tipis", "Tipis"], ["sehat", "Sehat"]], (v) => {
    filter.status = v as Status;
    halaman = 0;
    render();
  });
  const fMp = pilihan("Marketplace", [["", "Semua"], ["shopee", "Shopee"], ["tiktokshop", "TikTok Shop / Tokopedia"], ["custom", "Custom"]], (v) => {
    filter.marketplace = v as MarketplaceId;
    halaman = 0;
    render();
  });
  const fKat = pilihan("Kategori", [["", "Semua"]], (v) => {
    filter.kategori = v;
    halaman = 0;
    render();
  });
  const cariWrap = el("label", "", "seller-filter seller-filter-search");
  cariWrap.append(el("span", "Cari produk"));
  const cari = el("input");
  cari.type = "search";
  cari.placeholder = "Nama atau SKU";
  cari.addEventListener("input", () => {
    filter.cari = cari.value.trim().toLowerCase();
    halaman = 0;
    render();
  });
  cariWrap.append(cari);
  kontrol.append(fStatus.wrap, fMp.wrap, fKat.wrap, cariWrap);

  const hapusManual = el("button", "Hapus produk yang diisi manual", "modal-text-button");
  hapusManual.type = "button";
  hapusManual.addEventListener("click", () => {
    if (window.confirm("Hapus semua produk yang ditambahkan manual dari daftar?")) ctx.hapusSumber("manual");
  });
  const hapusCsv = el("button", "Hapus produk dari CSV", "modal-text-button");
  hapusCsv.type = "button";
  hapusCsv.addEventListener("click", () => {
    if (window.confirm("Hapus semua produk hasil impor CSV dari daftar?")) ctx.hapusSumber("csv");
  });
  aksi.append(hapusManual, hapusCsv);

  function hitungUlang(): void {
    baris = ctx.daftar().map((item) => ({ item, hasil: ctx.hitung(item.produk) }));
  }

  function nilaiUrut(b: BarisHasil, k: Kolom): number | string {
    const h = b.hasil;
    switch (k) {
      case "status":
        return URUTAN_STATUS[h.status] * 1e6 + (h.margin ?? -1e5);
      case "nama":
        return b.item.produk.nama.toLowerCase();
      case "marketplace":
        return b.item.produk.marketplace;
      case "harga":
        return b.item.produk.hargaJual;
      case "untung":
        return h.untung;
      case "margin":
        return h.margin ?? -1e9;
      case "impas":
        return h.hargaImpas ?? 1e15;
      case "saran":
        return h.hargaSaran ?? 1e15;
      case "bulanan":
        return h.untungBulanan ?? -1e15;
    }
  }

  function tersaring(): BarisHasil[] {
    const out = baris.filter(
      (b) =>
        (!filter.status || b.hasil.status === filter.status) &&
        (!filter.marketplace || b.item.produk.marketplace === filter.marketplace) &&
        (!filter.kategori || b.item.produk.kategori === filter.kategori) &&
        (!filter.cari || `${b.item.produk.nama} ${b.item.produk.sku ?? ""}`.toLowerCase().includes(filter.cari)),
    );
    const arah = urut.naik ? 1 : -1;
    return out.sort((a, b) => {
      const x = nilaiUrut(a, urut.kolom);
      const y = nilaiUrut(b, urut.kolom);
      return (x < y ? -1 : x > y ? 1 : 0) * arah;
    });
  }

  const KOLOM: Array<{ k: Kolom; label: string; angka?: boolean }> = [
    { k: "status", label: "Status" },
    { k: "nama", label: "Produk" },
    { k: "marketplace", label: "Marketplace" },
    { k: "harga", label: "Harga jual", angka: true },
    { k: "untung", label: "Untung bersih", angka: true },
    { k: "margin", label: "Margin", angka: true },
    { k: "impas", label: "Harga impas", angka: true },
    { k: "saran", label: "Harga saran", angka: true },
    { k: "bulanan", label: "Untung/bulan", angka: true },
  ];

  function renderRingkasan(): void {
    const r = ringkas(baris.map((b) => b.hasil));
    const kartu = (label: string, nilai: string, cls = "", klik?: () => void) => {
      const d = el(klik ? "button" : "div", "", `seller-summary-card ${cls}`) as HTMLElement;
      if (klik) {
        (d as HTMLButtonElement).type = "button";
        d.addEventListener("click", klik);
      }
      d.append(el("span", label), el("strong", nilai));
      return d;
    };
    const saring = (s: Status) => () => {
      filter.status = s;
      fStatus.s.value = s;
      halaman = 0;
      render();
    };
    ringkasan.replaceChildren(
      kartu("Jumlah produk", String(r.jumlah)),
      kartu("Rugi", String(r.rugi), "is-rugi", saring("rugi")),
      kartu("Tipis", String(r.tipis), "is-tipis", saring("tipis")),
      kartu("Sehat", String(r.sehat), "is-sehat", saring("sehat")),
      kartu("Rata-rata margin", formatPersen(r.rataMargin)),
      ...(r.untungBulanan !== null ? [kartu("Total untung per bulan", formatRp(r.untungBulanan), r.untungBulanan < 0 ? "is-rugi" : "")] : []),
    );
  }

  function renderKategori(): void {
    const kat = [...new Set(baris.map((b) => b.item.produk.kategori).filter(Boolean))].sort();
    const now = fKat.s.value;
    fKat.s.replaceChildren(...[["", "Semua"], ...kat.map((k) => [k, k])].map(([v, t]) => Object.assign(el("option", t), { value: v })));
    fKat.s.value = kat.includes(now) ? now : "";
    if (!kat.includes(now)) filter.kategori = "";
  }

  function renderTabel(): void {
    const data = tersaring();
    const maks = Math.max(0, Math.ceil(data.length / PER_HALAMAN) - 1);
    halaman = Math.min(halaman, maks);
    const potong = data.slice(halaman * PER_HALAMAN, (halaman + 1) * PER_HALAMAN);
    info.textContent =
      data.length === baris.length ? `${baris.length} produk. Ketuk baris untuk melihat rincian potongannya.` : `${data.length} dari ${baris.length} produk sesuai filter.`;

    const thead = el("thead");
    const tr = el("tr");
    for (const c of KOLOM) {
      const th = el("th", "", c.angka ? "is-num" : "");
      th.scope = "col";
      const b = el("button", c.label);
      b.type = "button";
      const aktif = urut.kolom === c.k;
      th.setAttribute("aria-sort", aktif ? (urut.naik ? "ascending" : "descending") : "none");
      if (aktif) b.append(el("span", urut.naik ? " ▲" : " ▼", "seller-sort"));
      b.addEventListener("click", () => {
        urut = { kolom: c.k, naik: aktif ? !urut.naik : !c.angka || c.k === "impas" || c.k === "saran" };
        render();
      });
      th.append(b);
      tr.append(th);
    }
    thead.append(tr);
    const tbody = el("tbody");
    for (const b of potong) {
      const p = b.item.produk;
      const h = b.hasil;
      const row = el("tr", "", `is-${h.status}${terbuka === b.item.id ? " is-open" : ""}`);
      row.tabIndex = 0;
      row.setAttribute("aria-label", `${p.nama}: ${LABEL_STATUS[h.status]}, untung ${formatRp(h.untung)}. Tekan untuk rincian.`);
      const sel = (t: string | Node, cls = "") => {
        const td = el("td", "", cls);
        td.append(t);
        return td;
      };
      const nama = el("div", "", "seller-cell-name");
      nama.append(el("strong", p.nama), el("small", [p.sku, p.kategori].filter(Boolean).join(" · ")));
      if (h.peringatan.length) nama.append(el("small", "Perlu dicek", "seller-cell-warn"));
      row.append(
        sel(badgeStatus(h.status)),
        sel(nama),
        sel(ctx.profil(p.marketplace).nama),
        sel(formatRp(p.hargaJual), "is-num"),
        sel(formatRp(h.untung), `is-num${h.untung < 0 ? " is-minus" : ""}`),
        sel(formatPersen(h.margin), "is-num"),
        sel(h.hargaImpas === null ? "-" : formatRp(h.hargaImpas), "is-num"),
        sel(h.hargaSaran === null ? "-" : formatRp(h.hargaSaran), "is-num"),
        sel(h.untungBulanan === null ? "-" : formatRp(h.untungBulanan), "is-num"),
      );
      const buka = () => {
        terbuka = terbuka === b.item.id ? null : b.item.id;
        renderDetail();
        renderTabel();
        if (terbuka !== null) detail.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      row.addEventListener("click", buka);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          buka();
        }
      });
      tbody.append(row);
    }
    tabel.replaceChildren(thead, tbody);

    nav.replaceChildren();
    if (maks > 0) {
      const tombol = (t: string, ke: number, mati: boolean) => {
        const b = el("button", t, "button button-secondary");
        b.type = "button";
        b.disabled = mati;
        b.addEventListener("click", () => {
          halaman = ke;
          renderTabel();
          tabelWrap.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        return b;
      };
      nav.append(tombol("← Sebelumnya", halaman - 1, halaman === 0), el("span", `Halaman ${halaman + 1} dari ${maks + 1}`), tombol("Berikutnya →", halaman + 1, halaman >= maks));
    }
  }

  function renderDetail(): void {
    const b = baris.find((x) => x.item.id === terbuka);
    detail.replaceChildren();
    detail.hidden = !b;
    if (!b) return;
    const tutup = el("button", "Tutup rincian", "modal-text-button");
    tutup.type = "button";
    tutup.addEventListener("click", () => {
      terbuka = null;
      renderDetail();
      renderTabel();
    });
    const hapus = el("button", "Hapus dari daftar", "modal-text-button");
    hapus.type = "button";
    hapus.addEventListener("click", () => {
      terbuka = null;
      ctx.hapusItem(b.item.id);
    });
    const banding = el("button", "Bandingkan di semua marketplace", "button button-secondary");
    banding.type = "button";
    banding.addEventListener("click", () => {
      ctx.isiFormBanding(b.item.produk);
      ctx.bukaTab("banding");
      document.getElementById("panel-banding")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    const bar = el("div", "", "seller-detail-actions");
    bar.append(banding, hapus, tutup);
    detail.append(renderKartuHasil(b.item.produk, b.hasil, { targetMarginPersen: ctx.pengaturan().targetMarginPersen, namaMarketplace: ctx.profil(b.item.produk.marketplace).nama }), bar);
  }

  function render(): void {
    hapusManual.hidden = !baris.some((b) => b.item.sumber === "manual");
    hapusCsv.hidden = !baris.some((b) => b.item.sumber === "csv");
    section.hidden = baris.length === 0;
    if (!baris.length) return;
    renderRingkasan();
    renderTabel();
    renderDetail();
  }

  ctx.onUbah(() => {
    hitungUlang();
    if (terbuka !== null && !baris.some((b) => b.item.id === terbuka)) terbuka = null;
    renderKategori();
    render();
  });
  return { baris: () => baris };
}
