// Mode "Banyak menu (CSV)" Kalkulator Harga Pesan Antar: impor lewat modul impor bersama, lalu
// ringkasan per platform dan tabel per platform yang bisa diurutkan/difilter (Rugi di atas).
import { FREE_ROW_LIMIT, MAKS_UKURAN_MB } from "../config/kalkulator-seller";
import { PESAN_MASALAH, type HasilFood, type Menu, type PlatformId, type StatusFood } from "./food";
import { KOLOM_WAJIB_MENU, LABEL_KOLOM_MENU, buatTemplateMenu, imporMenu, petakanHeaderMenu } from "./food-csv";
import { pasangImporCsv } from "./impor-csv-ui";
import { formatPersen, formatRp } from "./seller";
import { el } from "./seller-tampil";
import { badgeFood, kalimatOffline, renderRincianFood, type KonteksFood } from "./food-ui";

const PER_HALAMAN = 50;
const URUT_STATUS: Record<StatusFood, number> = { rugi: 0, tipis: 1, aman: 2 };
type Kolom = "status" | "nama" | "modal" | "offline" | "saran" | "naik" | "bersih" | "untung" | "untungOffline";
export type BarisMenu = { id: number; menu: Menu; baris: number; hasil: Record<PlatformId, HasilFood> };

export function pasangBanyakMenu(ctx: KonteksFood, opsi: { onImpor?: (n: number) => void; aksiTambahan?: (bar: HTMLElement, data: () => BarisMenu[]) => void } = {}): void {
  const section = document.getElementById("food-table-section")!;
  const root = document.getElementById("food-table-root")!;
  let menu: Array<{ id: number; menu: Menu; baris: number }> = [];
  let data: BarisMenu[] = [];
  let platform: PlatformId = ctx.platformAktif()[0] ?? "gofood";
  let filter = { status: "" as "" | StatusFood, cari: "" };
  let urut: { k: Kolom; naik: boolean } = { k: "status", naik: true };
  let halaman = 0;
  let terbuka: number | null = null;

  pasangImporCsv(
    document.getElementById("food-csv-root")!,
    {
      kalkulator: "food",
      judul: "Hitung banyak menu sekaligus",
      deskripsi: "Unggah file CSV dari Excel atau Google Sheets. Kolom wajib: nama_menu dan hpp. Kolom packing dan harga_offline boleh kosong. Target, diskon, dan potongan platform memakai Pengaturan.",
      satuan: "menu",
      kolomWajib: KOLOM_WAJIB_MENU,
      label: LABEL_KOLOM_MENU,
      template: buatTemplateMenu,
      namaTemplate: "template-kalkulator-harga-pesan-antar.csv",
      batas: FREE_ROW_LIMIT,
      maksMb: MAKS_UKURAN_MB,
      petakan: petakanHeaderMenu,
      impor: imporMenu,
      idInput: "food-csv-file",
      idHasil: "food-table-section",
    },
    {
      onHasil: (h) => {
        menu = h.produk.map((m, i) => ({ id: i + 1, menu: m, baris: h.barisProduk[i] }));
        terbuka = null;
        halaman = 0;
        hitungUlang();
        render();
        opsi.onImpor?.(h.totalBaris);
      },
    },
  );

  // ---------- Kerangka ----------
  const ringkasan = el("div", "", "food-summary");
  const kontrol = el("div", "", "seller-filters");
  const info = el("p", "", "seller-table-info");
  const wrap = el("div", "", "seller-table-wrap");
  wrap.tabIndex = 0;
  wrap.setAttribute("role", "region");
  wrap.setAttribute("aria-label", "Tabel harga per menu (geser ke samping di HP)");
  const tabel = el("table", "", "seller-table food-table");
  wrap.append(tabel);
  const nav = el("div", "", "seller-pager");
  const detail = el("div", "", "seller-detail");
  const aksi = el("div", "", "seller-results-actions");
  root.append(ringkasan, kontrol, info, wrap, nav, detail, aksi);

  const pilih = (label: string, onUbah: (v: string) => void) => {
    const w = el("label", "", "seller-filter");
    w.append(el("span", label));
    const s = el("select", "", "modal-select");
    s.addEventListener("change", () => onUbah(s.value));
    w.append(s);
    return { w, s };
  };
  const fPlat = pilih("Platform", (v) => {
    platform = v as PlatformId;
    terbuka = null;
    render();
  });
  const fStatus = pilih("Status di harga lapak", (v) => {
    filter.status = v as StatusFood;
    halaman = 0;
    render();
  });
  for (const [v, t] of [["", "Semua"], ["rugi", "Rugi"], ["tipis", "Tipis"], ["aman", "Aman"]]) fStatus.s.append(Object.assign(el("option", t), { value: v }));
  const cariW = el("label", "", "seller-filter seller-filter-search");
  cariW.append(el("span", "Cari menu"));
  const cari = el("input");
  cari.type = "search";
  cari.placeholder = "Nama menu";
  cari.addEventListener("input", () => {
    filter.cari = cari.value.trim().toLowerCase();
    halaman = 0;
    render();
  });
  cariW.append(cari);
  kontrol.append(fPlat.w, fStatus.w, cariW);
  opsi.aksiTambahan?.(aksi, () => data);

  function hitungUlang(): void {
    const aktif = ctx.platformAktif();
    data = menu.map((m) => ({ ...m, hasil: Object.fromEntries(aktif.map((p) => [p, ctx.hitung(m.menu, p)])) as Record<PlatformId, HasilFood> }));
    if (!aktif.includes(platform)) platform = aktif[0] ?? "gofood";
  }

  const ok = (h: HasilFood | undefined): h is Extract<HasilFood, { ok: true }> => !!h && h.ok;
  function nilai(b: BarisMenu, k: Kolom): number | string {
    const h = b.hasil[platform];
    const g = ok(h) ? h : null;
    switch (k) {
      case "status":
        return g ? URUT_STATUS[g.status] * 1e9 - (g.kenaikanRp ?? 0) : -1;
      case "nama":
        return b.menu.nama.toLowerCase();
      case "modal":
        return b.menu.hpp + (b.menu.packing ?? 0);
      case "offline":
        return b.menu.hargaOffline ?? -1;
      case "saran":
        return g?.hargaSaran ?? 1e15;
      case "naik":
        return g?.kenaikanPersen ?? -1e9;
      case "bersih":
        return g?.saran.uangBersih ?? -1e15;
      case "untung":
        return g?.saran.untung ?? -1e15;
      case "untungOffline":
        return g?.offline?.untung ?? -1e15;
    }
  }

  const KOLOM: Array<{ k: Kolom; label: string; angka?: boolean }> = [
    { k: "status", label: "Status di harga lapak" },
    { k: "nama", label: "Menu" },
    { k: "modal", label: "HPP + packing", angka: true },
    { k: "offline", label: "Harga lapak", angka: true },
    { k: "untungOffline", label: "Untung di harga lapak", angka: true },
    { k: "saran", label: "Harga display saran", angka: true },
    { k: "naik", label: "Naik dari lapak", angka: true },
    { k: "bersih", label: "Uang bersih", angka: true },
    { k: "untung", label: "Untung per porsi", angka: true },
  ];

  function render(): void {
    section.hidden = menu.length === 0;
    if (!menu.length) return;
    const aktif = ctx.platformAktif();
    // Ringkasan per platform (status di harga lapak)
    ringkasan.replaceChildren(
      ...aktif.map((p) => {
        const hs = data.map((d) => d.hasil[p]).filter(ok);
        const n = (s: StatusFood) => hs.filter((h) => h.status === s).length;
        const card = el("button", "", `food-summary-card${p === platform ? " is-active" : ""}`) as HTMLButtonElement;
        card.type = "button";
        card.setAttribute("aria-pressed", String(p === platform));
        card.addEventListener("click", () => {
          platform = p;
          terbuka = null;
          render();
        });
        const angka = el("div", "", "food-summary-counts");
        angka.append(el("span", `${n("rugi")} rugi`, "is-rugi"), el("span", `${n("tipis")} tipis`, "is-tipis"), el("span", `${n("aman")} aman`, "is-aman"));
        card.append(el("strong", ctx.profil(p).nama), angka);
        return card;
      }),
    );
    fPlat.s.replaceChildren(...aktif.map((p) => Object.assign(el("option", ctx.profil(p).nama), { value: p })));
    fPlat.s.value = platform;

    const arah = urut.naik ? 1 : -1;
    const tampil = data
      .filter((b) => {
        const h = b.hasil[platform];
        return (!filter.status || (ok(h) && h.status === filter.status)) && (!filter.cari || b.menu.nama.toLowerCase().includes(filter.cari));
      })
      .sort((a, b) => {
        const x = nilai(a, urut.k);
        const y = nilai(b, urut.k);
        return (x < y ? -1 : x > y ? 1 : 0) * arah;
      });
    const maks = Math.max(0, Math.ceil(tampil.length / PER_HALAMAN) - 1);
    halaman = Math.min(halaman, maks);
    const potong = tampil.slice(halaman * PER_HALAMAN, (halaman + 1) * PER_HALAMAN);
    info.textContent = `${tampil.length === data.length ? `${data.length} menu` : `${tampil.length} dari ${data.length} menu`} di ${ctx.profil(platform).nama}. Ketuk menu untuk rinciannya.`;

    const thead = el("thead");
    const tr = el("tr");
    for (const c of KOLOM) {
      const th = el("th", "", c.angka ? "is-num" : "");
      th.scope = "col";
      const aktifK = urut.k === c.k;
      th.setAttribute("aria-sort", aktifK ? (urut.naik ? "ascending" : "descending") : "none");
      const b = el("button", c.label);
      b.type = "button";
      if (aktifK) b.append(el("span", urut.naik ? " ▲" : " ▼", "seller-sort"));
      b.addEventListener("click", () => {
        urut = { k: c.k, naik: aktifK ? !urut.naik : !c.angka };
        render();
      });
      th.append(b);
      tr.append(th);
    }
    thead.append(tr);
    const tbody = el("tbody");
    for (const b of potong) {
      const h = b.hasil[platform];
      const row = el("tr", "", `is-${ok(h) ? h.status : "rugi"}${terbuka === b.id ? " is-open" : ""}`.replace("is-aman", "is-sehat"));
      row.tabIndex = 0;
      const sel = (t: string | Node, cls = "") => {
        const td = el("td", "", cls);
        td.append(t);
        return td;
      };
      const nama = el("div", "", "seller-cell-name");
      nama.append(el("strong", b.menu.nama), el("small", `Baris ${b.baris}`));
      if (!ok(h)) {
        row.append(sel("-"), sel(nama), sel(formatRp(b.menu.hpp + (b.menu.packing ?? 0)), "is-num"));
        const td = el("td", PESAN_MASALAH[h!.masalah], "food-cell-problem");
        td.colSpan = KOLOM.length - 3;
        row.append(td);
      } else {
        const off = h.offline;
        row.append(
          sel(off ? badgeFood(h.status) : el("span", "Tanpa harga lapak", "food-cell-muted")),
          sel(nama),
          sel(formatRp(b.menu.hpp + (b.menu.packing ?? 0)), "is-num"),
          sel(off ? formatRp(off.harga) : "-", "is-num"),
          sel(off ? formatRp(off.untung) : "-", `is-num${off && off.untung < 0 ? " is-minus" : ""}`),
          sel(formatRp(h.hargaSaran), "is-num food-cell-price"),
          sel(h.kenaikanRp === null ? "-" : `${h.kenaikanRp >= 0 ? "+" : "−"}${formatRp(Math.abs(h.kenaikanRp))} (${formatPersen(h.kenaikanPersen)})`, "is-num"),
          sel(formatRp(h.saran.uangBersih), "is-num"),
          sel(formatRp(h.saran.untung), "is-num"),
        );
      }
      const buka = () => {
        terbuka = terbuka === b.id ? null : b.id;
        render();
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
      const t = (teks: string, ke: number, mati: boolean) => {
        const x = el("button", teks, "button button-secondary");
        x.type = "button";
        x.disabled = mati;
        x.addEventListener("click", () => {
          halaman = ke;
          render();
          wrap.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        return x;
      };
      nav.append(t("← Sebelumnya", halaman - 1, halaman === 0), el("span", `Halaman ${halaman + 1} dari ${maks + 1}`), t("Berikutnya →", halaman + 1, halaman >= maks));
    }

    // Rincian menu yang dibuka (platform terpilih)
    detail.replaceChildren();
    const b = data.find((x) => x.id === terbuka);
    detail.hidden = !b;
    if (b) {
      const h = b.hasil[platform];
      const card = el("article", "", "food-card food-detail");
      card.append(el("h3", `${b.menu.nama} di ${ctx.profil(platform).nama}`));
      if (!ok(h)) card.append(el("p", PESAN_MASALAH[h!.masalah], "food-problem"));
      else {
        if (h.offline) card.append(el("p", kalimatOffline(ctx.profil(platform).nama, h), "food-detail-sentence"));
        card.append(el("p", `Harga display saran ${formatRp(h.hargaSaran)}: uang bersih ${formatRp(h.saran.uangBersih)}, untung ${formatRp(h.saran.untung)} per porsi.`, "food-detail-sentence"));
        card.append(renderRincianFood(h.saran, { hpp: Math.round(b.menu.hpp), packing: Math.round(b.menu.packing ?? 0), overhead: Math.round(b.menu.overhead ?? ctx.pengaturan().overhead) }));
      }
      const tutup = el("button", "Tutup rincian", "modal-text-button");
      tutup.type = "button";
      tutup.addEventListener("click", () => {
        terbuka = null;
        render();
      });
      card.append(tutup);
      detail.append(card);
    }
  }

  ctx.onUbah(() => {
    if (!menu.length) return;
    hitungUlang();
    render();
  });
}
