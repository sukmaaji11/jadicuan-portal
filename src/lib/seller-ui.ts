// Logika halaman /kalkulator-untung-seller/: state bersama, tab, form satu produk, Pengaturan,
// dan daftar produk. Semua perhitungan di browser; tidak ada data produk yang dikirim ke server.
// Pengaturan + draf form disimpan di localStorage (dibungkus try/catch, pola kalkulator lama).
import biaya from "../config/biaya-marketplace.json";
import {
  MARKETPLACES,
  PENGATURAN_DEFAULT,
  bacaAngka,
  formatRp,
  hitungProduk,
  terapkanTimpaan,
  type HasilProduk,
  type MarketplaceId,
  type Pengaturan,
  type ProfilBiaya,
  type Produk,
  type TimpaanProfil,
} from "./seller";
import { el, renderKartuHasil } from "./seller-tampil";
import { pasangHasil } from "./seller-hasil";

const KEY_PENGATURAN = "jadicuan:kalkulator-seller:pengaturan";
const KEY_TIMPAAN = "jadicuan:kalkulator-seller:timpaan";
const KEY_DRAF = "jadicuan:kalkulator-seller:draf";

export const PROFIL_DASAR = biaya.profil as unknown as Record<MarketplaceId, ProfilBiaya>;

// ---------- Penyimpanan aman ----------
export function bacaSimpan<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function tulisSimpan(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* penyimpanan penuh atau diblokir: abaikan */
  }
}

function $(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemen #${id} tidak ditemukan`);
  return node;
}

/** "1250000" -> "1.250.000" untuk ditampilkan di isian. */
export function ribuan(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "";
  return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
const persenTeks = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "" : String(v).replace(".", ","));

// ---------- State bersama ----------
export type ItemDaftar = { id: number; produk: Produk; sumber: "manual" | "csv"; baris?: number };

export type KonteksSeller = {
  profil(id: MarketplaceId): ProfilBiaya;
  pengaturan(): Pengaturan;
  hitung(p: Produk): HasilProduk;
  daftar(): ItemDaftar[];
  tambah(produk: Produk[], sumber: "manual" | "csv", barisAwal?: number[]): void;
  hapusSumber(sumber: "manual" | "csv"): void;
  hapusItem(id: number): void;
  onUbah(fn: () => void): void;
  bukaTab(tab: "satu" | "csv" | "banding"): void;
  isiFormBanding(p: Produk): void;
};

function muatPengaturan(): Pengaturan {
  const s = bacaSimpan<Partial<Pengaturan>>(KEY_PENGATURAN) ?? {};
  const out: Pengaturan = structuredClone(PENGATURAN_DEFAULT);
  for (const key of Object.keys(out) as Array<keyof Pengaturan>) {
    const v = s[key];
    const def = out[key];
    if (typeof def === "number" && typeof v === "number" && Number.isFinite(v)) (out as Record<string, unknown>)[key] = v;
    else if (typeof def === "boolean" && typeof v === "boolean") (out as Record<string, unknown>)[key] = v;
    else if (key === "roas" && (v === null || (typeof v === "number" && v > 0))) out.roas = v as number | null;
  }
  for (const id of MARKETPLACES) {
    const k = s.komisiPersen?.[id];
    if (k === null || (typeof k === "number" && k >= 0)) out.komisiPersen[id] = k;
    const l = s.logistik?.[id];
    if (l === null || (typeof l === "number" && l >= 0)) out.logistik[id] = l;
  }
  if (Array.isArray(s.programLainAktif)) out.programLainAktif = s.programLainAktif.filter((x) => typeof x === "string");
  return out;
}

export function pasangKalkulatorSeller(): KonteksSeller {
  let pengaturan = muatPengaturan();
  let timpaan = (bacaSimpan<Record<string, TimpaanProfil>>(KEY_TIMPAAN) ?? {}) as Partial<Record<MarketplaceId, TimpaanProfil>>;
  let profilCache = new Map<MarketplaceId, ProfilBiaya>();
  const pendengar: Array<() => void> = [];
  let daftar: ItemDaftar[] = [];
  let idBerikut = 1;

  const ctx: KonteksSeller = {
    profil(id) {
      if (!profilCache.has(id)) profilCache.set(id, terapkanTimpaan(PROFIL_DASAR[id], timpaan[id]));
      return profilCache.get(id)!;
    },
    pengaturan: () => pengaturan,
    hitung: (p) => hitungProduk(p, ctx.profil(p.marketplace), pengaturan),
    daftar: () => daftar,
    tambah(produk, sumber, barisAwal) {
      daftar = daftar.concat(produk.map((p, i) => ({ id: idBerikut++, produk: p, sumber, baris: barisAwal?.[i] })));
      ubah();
    },
    hapusSumber(sumber) {
      daftar = daftar.filter((d) => d.sumber !== sumber);
      ubah();
    },
    hapusItem(id) {
      daftar = daftar.filter((d) => d.id !== id);
      ubah();
    },
    onUbah: (fn) => pendengar.push(fn),
    bukaTab: (tab) => pilihTab(tab),
    isiFormBanding: () => undefined, // diisi oleh modul Bandingkan (tahap 4)
  };
  function ubah(): void {
    for (const fn of pendengar) fn();
  }
  function simpanPengaturan(): void {
    tulisSimpan(KEY_PENGATURAN, pengaturan);
    tulisSimpan(KEY_TIMPAAN, timpaan);
    profilCache = new Map();
    ubah();
  }

  // ---------- Tab ----------
  const tabs = [...document.querySelectorAll<HTMLButtonElement>(".seller-tab")];
  function pilihTab(nama: "satu" | "csv" | "banding", fokus = false): void {
    for (const t of tabs) {
      const aktif = t.id === `tab-${nama}`;
      t.setAttribute("aria-selected", String(aktif));
      t.tabIndex = aktif ? 0 : -1;
      $(t.getAttribute("aria-controls")!).hidden = !aktif;
      if (aktif && fokus) t.focus();
    }
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => pilihTab(t.id.replace("tab-", "") as "satu"));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      pilihTab(next.id.replace("tab-", "") as "satu", true);
    });
  });

  // ---------- Bantuan istilah ("?") ----------
  document.addEventListener("click", (e) => {
    const btn = (e.target as Element | null)?.closest<HTMLButtonElement>("[data-help-toggle]");
    if (!btn || !btn.closest(".seller-page")) return;
    const text = document.getElementById(btn.getAttribute("aria-controls") ?? "");
    if (!text) return;
    const buka = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(buka));
    text.hidden = !buka;
  });
  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-open-settings]")) {
    a.addEventListener("click", () => {
      ($("seller-settings") as HTMLDetailsElement).open = true;
    });
  }

  // ---------- Form satu produk ----------
  const form = $("seller-form") as HTMLFormElement;
  const isian = () => [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-sfield]")];
  const nilai = (field: string) => form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-sfield="${field}"]`);

  function bacaForm(): Produk | null {
    const ambil = (f: string) => (nilai(f) as HTMLInputElement | null)?.value ?? "";
    const centang = (f: string) => ((nilai(f) as HTMLInputElement | null)?.checked ? true : null);
    const hargaJual = bacaAngka(ambil("hargaJual"), "rp");
    const hpp = bacaAngka(ambil("hpp"), "rp");
    if (hargaJual === null || hpp === null || hargaJual <= 0) return null;
    const diskonTeks = ambil("diskon").trim();
    const diskon = diskonTeks ? bacaAngka(diskonTeks, diskonTeks.includes("%") ? "persen" : "rp") : null;
    return {
      nama: ambil("nama").trim() || "Produk tanpa nama",
      sku: ambil("sku").trim() || undefined,
      hargaJual,
      hpp,
      marketplace: (nilai("marketplace") as HTMLSelectElement).value as MarketplaceId,
      kategori: ambil("kategori").trim(),
      komisiPersen: bacaAngka(ambil("komisiPersen"), "persen"),
      diskonRp: diskon !== null && !diskonTeks.includes("%") ? diskon : null,
      diskonPersen: diskon !== null && diskonTeks.includes("%") ? diskon : null,
      affiliatePersen: bacaAngka(ambil("affiliatePersen"), "persen"),
      biayaIklan: bacaAngka(ambil("biayaIklan"), "rp"),
      roas: bacaAngka(ambil("roas"), "persen"),
      packing: bacaAngka(ambil("packing"), "rp"),
      logistik: bacaAngka(ambil("logistik"), "rp"),
      returPersen: bacaAngka(ambil("returPersen"), "persen"),
      biayaRetur: bacaAngka(ambil("biayaRetur"), "rp"),
      terjualPerBulan: bacaAngka(ambil("terjualPerBulan"), "rp"),
      gratisOngkir: centang("gratisOngkir"),
      promo: centang("promo"),
      preorder: centang("preorder"),
      pph: centang("pph"),
    };
  }

  function simpanDraf(): void {
    const draf: Record<string, string | boolean> = {};
    for (const f of isian()) draf[f.dataset.sfield!] = f instanceof HTMLInputElement && f.type === "checkbox" ? f.checked : f.value;
    tulisSimpan(KEY_DRAF, draf);
  }
  function muatDraf(): void {
    const draf = bacaSimpan<Record<string, string | boolean>>(KEY_DRAF);
    if (!draf) return;
    for (const f of isian()) {
      const v = draf[f.dataset.sfield!];
      if (f instanceof HTMLInputElement && f.type === "checkbox") f.checked = v === true;
      else if (typeof v === "string") f.value = v.slice(0, 80);
    }
  }

  function petunjukKomisi(): void {
    const mp = (nilai("marketplace") as HTMLSelectElement).value as MarketplaceId;
    const hint = document.getElementById("seller-komisiPersen-hint");
    const input = nilai("komisiPersen") as HTMLInputElement;
    const bawaan = pengaturan.komisiPersen[mp];
    input.placeholder = bawaan !== null ? persenTeks(bawaan) : mp === "shopee" ? "Contoh: 8,25" : "Contoh: 6";
    if (hint) {
      hint.textContent =
        mp === "shopee"
          ? "Pilih sesuai sub-kategori di seller center (2,5% sampai 10%). Sudah termasuk PPN."
          : mp === "tiktokshop"
            ? "Komisi platform 2,5% sampai 12,2% menurut kategori (cek seller center). Komisi dinamis dihitung otomatis dari kategori."
            : "Isi sesuai platformmu.";
    }
    const logistik = nilai("logistik")?.closest(".hpp-field") as HTMLElement | null;
    if (logistik) logistik.hidden = mp === "shopee";
  }
  // Hint komisi dibuat lewat atribut hint kosong di SellerField; pastikan elemennya ada.
  (() => {
    const field = nilai("komisiPersen")?.closest(".hpp-field");
    if (field && !document.getElementById("seller-komisiPersen-hint")) {
      const p = el("p", "", "modal-hint");
      p.id = "seller-komisiPersen-hint";
      field.append(p);
    }
  })();

  const kartu = $("single-body");
  function renderSatu(): void {
    const p = bacaForm();
    $("single-result").hidden = !p;
    $("single-empty").hidden = !!p;
    if (!p) return;
    const h = ctx.hitung(p);
    kartu.replaceChildren(renderKartuHasil(p, h, { targetMarginPersen: pengaturan.targetMarginPersen, namaMarketplace: ctx.profil(p.marketplace).nama }));
  }

  form.addEventListener("input", () => {
    petunjukKomisi();
    renderSatu();
    simpanDraf();
  });
  form.addEventListener("change", () => {
    petunjukKomisi();
    renderSatu();
    simpanDraf();
  });
  // Rapikan ribuan saat keluar dari kolom rupiah.
  form.addEventListener("focusout", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset?.kind === "rupiah" || t.dataset?.kind === "bulat") {
      const v = bacaAngka(t.value, "rp");
      if (v !== null) t.value = ribuan(v);
    }
  });
  form.addEventListener("submit", (e) => e.preventDefault());

  $("add-to-list").addEventListener("click", () => {
    const p = bacaForm();
    const st = $("add-status");
    if (!p) return;
    if (p.nama === "Produk tanpa nama") {
      st.textContent = "Isi nama produk dulu supaya mudah dikenali di daftar.";
      (nilai("nama") as HTMLInputElement).focus();
      return;
    }
    ctx.tambah([p], "manual");
    st.textContent = `${p.nama} ditambahkan ke daftar. Tambah produk lain, atau lihat hasilnya di bawah.`;
  });
  $("compare-this").addEventListener("click", () => {
    const p = bacaForm();
    if (!p) return;
    ctx.isiFormBanding(p);
    pilihTab("banding", true);
  });

  // ---------- Pengaturan ----------
  const body = $("settings-body");
  function kolom(o: {
    label: string;
    kind: "rupiah" | "persen" | "angka";
    nilai: number | null | undefined;
    placeholder?: string;
    hint?: string;
    tanda?: string; // "Belum terverifikasi"
    sumber?: string;
    simpan: (v: number | null) => void;
  }): HTMLElement {
    const wrap = el("div", "", "hpp-field modal-field");
    const id = `set-${Math.random().toString(36).slice(2, 9)}`;
    const row = el("div", "", "modal-label-row");
    const label = el("label", o.label);
    label.htmlFor = id;
    row.append(label);
    if (o.tanda) row.append(el("span", o.tanda, "seller-unverified"));
    const box = el("div", "", `modal-input-wrap${o.kind === "rupiah" ? " has-prefix" : ""}${o.kind === "persen" ? " has-suffix" : ""}`);
    if (o.kind === "rupiah") box.append(Object.assign(el("span", "Rp", "modal-affix modal-affix-start"), { ariaHidden: "true" }));
    const input = el("input");
    input.id = id;
    input.type = "text";
    input.inputMode = o.kind === "rupiah" ? "numeric" : "decimal";
    input.autocomplete = "off";
    input.value = o.kind === "rupiah" ? ribuan(o.nilai) : persenTeks(o.nilai);
    if (o.placeholder) input.placeholder = o.placeholder;
    input.addEventListener("change", () => {
      const v = bacaAngka(input.value, o.kind === "rupiah" ? "rp" : "persen");
      o.simpan(v !== null && v >= 0 ? v : null);
      if (v !== null && o.kind === "rupiah") input.value = ribuan(v);
    });
    box.append(input);
    if (o.kind === "persen") box.append(Object.assign(el("span", "%", "modal-affix modal-affix-end"), { ariaHidden: "true" }));
    wrap.append(row, box);
    if (o.hint || o.sumber) {
      const hint = el("p", o.hint ?? "", "modal-hint");
      if (o.sumber) {
        const a = el("a", "sumber", "");
        a.href = o.sumber;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        hint.append(o.hint ? " " : "", "(", a, ")");
      }
      wrap.append(hint);
    }
    return wrap;
  }
  function centang(label: string, nilai: boolean, simpan: (v: boolean) => void): HTMLElement {
    const l = el("label", "", "modal-check");
    const i = el("input");
    i.type = "checkbox";
    i.checked = nilai;
    i.addEventListener("change", () => simpan(i.checked));
    l.append(i, el("span", label));
    return l;
  }
  const grup = (judul: string, keterangan: string, ...isi: HTMLElement[]) => {
    const fs = el("fieldset", "", "seller-settings-group");
    fs.append(el("legend", judul));
    if (keterangan) fs.append(el("p", keterangan, "seller-settings-note"));
    const grid = el("div", "", "modal-grid");
    grid.append(...isi.filter((x) => !x.classList.contains("modal-check")));
    fs.append(grid);
    const checks = isi.filter((x) => x.classList.contains("modal-check"));
    if (checks.length) {
      const c = el("div", "", "seller-settings-checks");
      c.append(...checks);
      fs.append(c);
    }
    return fs;
  };
  const tanda = (verified: boolean | undefined) => (verified ? undefined : "Belum terverifikasi");

  function setP<K extends keyof Pengaturan>(key: K, v: Pengaturan[K]): void {
    pengaturan = { ...pengaturan, [key]: v };
    simpanPengaturan();
  }
  function setT(id: MarketplaceId, patch: TimpaanProfil): void {
    timpaan = { ...timpaan, [id]: { ...(timpaan[id] ?? {}), ...patch } };
    simpanPengaturan();
  }

  function renderPengaturan(): void {
    const s = pengaturan;
    const umum = grup(
      "Batas hasil",
      "",
      kolom({ label: "Batas margin sehat", kind: "persen", nilai: s.batasSehatPersen, hint: "Margin di bawah ini dianggap Tipis.", simpan: (v) => setP("batasSehatPersen", v ?? 15) }),
      kolom({ label: "Target margin untuk harga saran", kind: "persen", nilai: s.targetMarginPersen, simpan: (v) => setP("targetMarginPersen", Math.min(v ?? 20, 95)) }),
      kolom({ label: "Bulatkan harga ke atas ke kelipatan", kind: "rupiah", nilai: s.kelipatanBulat, hint: "Untuk harga impas dan harga saran.", simpan: (v) => setP("kelipatanBulat", v && v >= 1 ? v : 100) }),
    );
    const bawaan = grup(
      "Nilai bawaan produk",
      "Dipakai bila kolom opsional sebuah produk kosong, termasuk baris CSV.",
      kolom({ label: "Diskon / voucher dari kamu", kind: "persen", nilai: s.diskonPersen, simpan: (v) => setP("diskonPersen", v ?? 0) }),
      kolom({ label: "Komisi affiliate", kind: "persen", nilai: s.affiliatePersen, simpan: (v) => setP("affiliatePersen", v ?? 0) }),
      kolom({ label: "Biaya iklan per pesanan", kind: "rupiah", nilai: s.biayaIklan, simpan: (v) => setP("biayaIklan", v ?? 0) }),
      kolom({ label: "ROAS iklan", kind: "angka", nilai: s.roas, hint: "Kosongkan bila tidak beriklan.", simpan: (v) => setP("roas", v && v > 0 ? v : null) }),
      kolom({ label: "Biaya packing per pesanan", kind: "rupiah", nilai: s.packing, simpan: (v) => setP("packing", v ?? 0) }),
      kolom({ label: "Tingkat retur", kind: "persen", nilai: s.returPersen, simpan: (v) => setP("returPersen", v ?? 0) }),
      kolom({ label: "Biaya per retur", kind: "rupiah", nilai: s.biayaRetur, simpan: (v) => setP("biayaRetur", v ?? 0) }),
      centang("Ikut program gratis ongkir", s.gratisOngkir, (v) => setP("gratisOngkir", v)),
      centang("Ikut program promo", s.promo, (v) => setP("promo", v)),
      centang("Produk pre-order", s.preorder, (v) => setP("preorder", v)),
      centang("Hitung PPh 0,5% dari omzet", s.pph, (v) => setP("pph", v)),
    );
    const perMp = MARKETPLACES.map((id) => {
      const base = PROFIL_DASAR[id];
      const t = timpaan[id] ?? {};
      const isi: HTMLElement[] = [
        kolom({
          label: `${base.komisi.nama} bawaan`,
          kind: "persen",
          nilai: s.komisiPersen[id],
          placeholder: base.komisi.pilihanPersen.length ? `Pilihan: ${base.komisi.pilihanPersen.map((x) => persenTeks(x)).join(" / ")}` : base.komisi.rentangPersen ? `${persenTeks(base.komisi.rentangPersen[0])}-${persenTeks(base.komisi.rentangPersen[1])}` : "",
          hint: "Dipakai bila komisi produk kosong.",
          tanda: tanda(base.komisi.verified),
          sumber: base.komisi.source || undefined,
          simpan: (v) => setP("komisiPersen", { ...s.komisiPersen, [id]: v }),
        }),
        kolom({ label: "Batas maksimum komisi per barang", kind: "rupiah", nilai: t.komisiBatasMaks ?? base.komisi.batasMaks, placeholder: "Tanpa batas", simpan: (v) => setT(id, { komisiBatasMaks: v }) }),
      ];
      if (base.komisiDinamis) {
        isi.push(
          kolom({
            label: "Batas komisi dinamis per barang",
            kind: "rupiah",
            nilai: t.komisiDinamisBatasMaks !== undefined ? t.komisiDinamisBatasMaks : base.komisiDinamis.batasMaks,
            tanda: tanda(base.komisiDinamis.verified),
            hint: base.komisiDinamis.catatan,
            sumber: base.komisiDinamis.source,
            simpan: (v) => setT(id, { komisiDinamisBatasMaks: v }),
          }),
        );
      }
      isi.push(
        kolom({ label: "Biaya proses per pesanan", kind: "rupiah", nilai: t.biayaProses ?? base.biayaProses.nilai, tanda: tanda(base.biayaProses.verified), sumber: base.biayaProses.source || undefined, simpan: (v) => setT(id, { biayaProses: v }) }),
      );
      if (base.biayaLogistik) {
        isi.push(kolom({ label: "Biaya layanan logistik bawaan", kind: "rupiah", nilai: s.logistik[id] ?? base.biayaLogistik.nilai, tanda: tanda(base.biayaLogistik.verified), hint: base.biayaLogistik.catatan, simpan: (v) => setP("logistik", { ...s.logistik, [id]: v }) }));
      }
      isi.push(
        kolom({ label: "Biaya transaksi", kind: "persen", nilai: t.biayaTransaksiPersen ?? base.biayaTransaksi.persen, tanda: tanda(base.biayaTransaksi.verified), hint: base.biayaTransaksi.catatan, simpan: (v) => setT(id, { biayaTransaksiPersen: v }) }),
        kolom({ label: "Biaya pre-order", kind: "persen", nilai: t.preorderPersen ?? base.preorder.persen, tanda: tanda(base.preorder.verified), simpan: (v) => setT(id, { preorderPersen: v }) }),
        kolom({ label: "PPh", kind: "persen", nilai: t.pphPersen ?? base.pph.persen, tanda: tanda(base.pph.verified), hint: base.pph.catatan, simpan: (v) => setT(id, { pphPersen: v }) }),
      );
      for (const pr of base.program) {
        const o = t.program?.[pr.id] ?? {};
        isi.push(
          kolom({
            label: `${pr.nama} (${pr.jenis === "gratis_ongkir" ? "gratis ongkir" : pr.jenis === "promo" ? "promo" : "opsional"})`,
            kind: "persen",
            nilai: o.persen ?? pr.persen,
            placeholder: "Isi persen",
            tanda: tanda(pr.verified),
            hint: `${pr.batasMaks ? `Maks ${formatRp(o.batasMaks ?? pr.batasMaks)} per barang. ` : ""}${pr.catatan ?? ""}`,
            sumber: pr.source,
            simpan: (v) => setT(id, { program: { ...(t.program ?? {}), [pr.id]: { ...o, persen: v } } }),
          }),
        );
        if (pr.jenis === "lainnya") {
          isi.push(centang(`Ikutkan ${pr.nama} di semua produk ${base.nama}`, s.programLainAktif.includes(pr.id), (v) => setP("programLainAktif", v ? [...s.programLainAktif, pr.id] : s.programLainAktif.filter((x) => x !== pr.id))));
        }
      }
      const dasar = el("label", "", "modal-check");
      const dasarInput = el("input");
      dasarInput.type = "checkbox";
      dasarInput.checked = (t.dasar ?? base.dasar) === "sebelum_diskon";
      dasarInput.addEventListener("change", () => setT(id, { dasar: dasarInput.checked ? "sebelum_diskon" : "setelah_diskon" }));
      dasar.append(dasarInput, el("span", "Hitung biaya dari harga sebelum diskon penjual"));
      isi.push(dasar);
      return grup(base.nama, id === "custom" ? "Atur semua angka sendiri untuk marketplace lain atau kesepakatan khusus." : `Diperbarui ${base.updatedAt}. Angka bertanda "Belum terverifikasi" perlu dicek di seller center.`, ...isi);
    });
    const reset = el("button", "Kembalikan semua ke bawaan", "modal-text-button");
    reset.type = "button";
    reset.addEventListener("click", () => {
      if (!window.confirm("Kembalikan semua pengaturan dan angka biaya ke bawaan?")) return;
      pengaturan = structuredClone(PENGATURAN_DEFAULT);
      timpaan = {};
      tulisSimpan(KEY_PENGATURAN, null);
      tulisSimpan(KEY_TIMPAAN, null);
      profilCache = new Map();
      renderPengaturan();
      ubah();
    });
    const catatan = el("p", "Pengaturan disimpan di perangkat ini saja.", "seller-settings-note");
    body.replaceChildren(umum, bawaan, ...perMp, catatan, reset);
  }

  // ---------- Mulai ----------
  ctx.onUbah(() => {
    petunjukKomisi();
    renderSatu();
  });
  pasangHasil(ctx);
  muatDraf();
  renderPengaturan();
  petunjukKomisi();
  renderSatu();
  return ctx;
}
