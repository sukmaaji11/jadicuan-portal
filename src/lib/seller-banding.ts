// Tab "Bandingkan": produk yang sama dihitung untuk semua marketplace berdampingan.
// Komisi tiap marketplace berbeda, jadi pengguna bisa mengisi komisi per marketplace di sini;
// kosong = pakai komisi bawaan di Pengaturan.
import { MARKETPLACES, bacaAngka, formatPersen, formatRp, LABEL_RINCIAN, type MarketplaceId, type Produk, type Rincian } from "./seller";
import { el, badgeStatus, PESAN_PERINGATAN } from "./seller-tampil";
import type { KonteksSeller } from "./seller-ui";

export function pasangBanding(ctx: KonteksSeller): (p: Produk) => void {
  const root = document.getElementById("compare-root")!;
  let produk: Produk | null = null;
  const komisi: Partial<Record<MarketplaceId, number | null>> = {};

  const intro = el("div", "", "seller-import-intro");
  intro.append(el("h2", "Bandingkan marketplace"), el("p", "Lihat untung bersih produk yang sama di Shopee dan TikTok Shop / Tokopedia berdampingan. Isi komisi Custom kalau ingin membandingkan dengan platform lain."));
  const kosong = el("div", "", "seller-empty");
  kosong.append(el("p", "Belum ada produk. Isi produk di tab Satu produk, lalu tekan \"Bandingkan di semua marketplace\". Bisa juga dari rincian produk di tabel hasil."));
  const ke = el("button", "Ke tab Satu produk", "button button-secondary");
  ke.type = "button";
  ke.addEventListener("click", () => ctx.bukaTab("satu"));
  kosong.append(ke);
  const isiKomisi = el("div", "", "seller-compare-inputs");
  const grid = el("div", "", "seller-compare");
  root.append(intro, kosong, isiKomisi, grid);

  function renderInputKomisi(): void {
    isiKomisi.replaceChildren();
    if (!produk) return;
    isiKomisi.append(el("p", `Produk: ${produk.nama} · Harga ${formatRp(produk.hargaJual)} · HPP ${formatRp(produk.hpp)}${produk.kategori ? ` · ${produk.kategori}` : ""}`, "seller-compare-product"));
    const baris = el("div", "", "modal-grid");
    for (const id of MARKETPLACES) {
      const prof = ctx.profil(id);
      const wrap = el("div", "", "hpp-field modal-field");
      const label = el("label", `${prof.komisi.nama} ${prof.nama}`);
      const input = el("input");
      input.id = `banding-komisi-${id}`;
      label.htmlFor = input.id;
      input.type = "text";
      input.inputMode = "decimal";
      input.autocomplete = "off";
      const bawaan = ctx.pengaturan().komisiPersen[id];
      const v = komisi[id];
      input.value = v === null || v === undefined ? "" : String(v).replace(".", ",");
      input.placeholder = bawaan !== null ? `Bawaan ${String(bawaan).replace(".", ",")}` : "Isi persen";
      input.addEventListener("input", () => {
        komisi[id] = bacaAngka(input.value, "persen");
        renderKartu();
      });
      if (id === "custom") input.placeholder = "Isi untuk ikut dibandingkan";
      const box = el("div", "", "modal-input-wrap has-suffix");
      box.append(input, Object.assign(el("span", "%", "modal-affix modal-affix-end"), { ariaHidden: "true" }));
      const row = el("div", "", "modal-label-row");
      row.append(label);
      wrap.append(row, box);
      baris.append(wrap);
    }
    isiKomisi.append(baris);
  }

  function renderKartu(): void {
    grid.replaceChildren();
    kosong.hidden = !!produk;
    if (!produk) return;
    // Profil Custom baru ikut dibandingkan bila sudah diatur (komisi atau biaya proses > 0);
    // kalau masih 0 semua, "untungnya" pasti paling besar dan menyesatkan.
    const komisiCustom = komisi.custom ?? ctx.pengaturan().komisiPersen.custom ?? 0;
    const customDiatur = komisiCustom > 0 || ctx.profil("custom").biayaProses.nilai > 0;
    const hasil = MARKETPLACES.filter((id) => id !== "custom" || customDiatur).map((id) => {
      const p: Produk = { ...produk!, marketplace: id, komisiPersen: komisi[id] ?? null, logistik: id === produk!.marketplace ? produk!.logistik : null };
      return { id, p, h: ctx.hitung(p) };
    });
    const terbaik = Math.max(...hasil.map((x) => x.h.untung));
    for (const { id, h } of hasil) {
      const card = el("article", "", `seller-compare-card is-${h.status}`);
      const head = el("header");
      head.append(el("strong", ctx.profil(id).nama), badgeStatus(h.status));
      card.append(head);
      if (h.untung === terbaik && hasil.filter((x) => x.h.untung === terbaik).length === 1) card.append(el("span", "Untung paling besar", "seller-compare-best"));
      const untung = el("div", "", "seller-result-profit");
      untung.append(el("span", "Untung bersih per pesanan"), el("strong", formatRp(h.untung)), el("small", `Margin ${formatPersen(h.margin)}`));
      card.append(untung);
      const dl = el("dl", "", "seller-compare-list");
      const tambah = (k: string, v: string) => {
        const d = el("div");
        d.append(el("dt", k), el("dd", v));
        dl.append(d);
      };
      tambah("Total potongan", formatRp(h.totalPotongan));
      for (const key of Object.keys(LABEL_RINCIAN) as Array<keyof Rincian>) if (h.rincian[key]) tambah(LABEL_RINCIAN[key], `−${formatRp(h.rincian[key])}`);
      tambah("Harga impas", h.hargaImpas === null ? "Tidak bisa impas" : formatRp(h.hargaImpas));
      tambah(`Harga saran (margin ${String(ctx.pengaturan().targetMarginPersen).replace(".", ",")}%)`, h.hargaSaran === null ? "Tidak tercapai" : formatRp(h.hargaSaran));
      card.append(dl);
      if (h.peringatan.length) {
        const ul = el("ul", "", "seller-warnings");
        for (const w of h.peringatan) ul.append(el("li", PESAN_PERINGATAN[w]));
        card.append(ul);
      }
      grid.append(card);
    }
  }

  ctx.onUbah(() => {
    renderInputKomisi();
    renderKartu();
  });
  renderKartu();

  return (p: Produk) => {
    produk = { ...p };
    for (const id of MARKETPLACES) komisi[id] = id === p.marketplace ? p.komisiPersen ?? null : komisi[id] ?? null;
    renderInputKomisi();
    renderKartu();
  };
}
