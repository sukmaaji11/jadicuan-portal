// Logika halaman /kalkulator-harga-pesan-antar/: state, form satu menu, kartu per platform,
// perbandingan dengan harga lapak, rincian potongan, Salin harga, dan Pengaturan.
// Semua dihitung di browser; pengaturan + draf di localStorage (try/catch).
import biaya from "../config/biaya-pesan-antar.json";
import {
  LABEL_RINCIAN_FOOD,
  PENGATURAN_FOOD_DEFAULT,
  PESAN_MASALAH,
  PESAN_PERINGATAN_FOOD,
  PLATFORMS,
  hitungFood,
  terapkanTimpaanFood,
  type HasilFood,
  type Kemitraan,
  type Menu,
  type PengaturanFood,
  type PlatformId,
  type ProfilFood,
  type RincianFood,
  type StatusFood,
  type TimpaanFood,
} from "./food";
import { bacaAngka, formatPersen, formatRp } from "./seller";
import { el } from "./seller-tampil";
import { bacaSimpan, persenTeks, ribuan, tulisSimpan } from "./penyimpanan";
import { centang, grup, kolomAngka, pilihan } from "./form-pengaturan";
import { pasangBanyakMenu } from "./food-banyak";

const KEY_PENGATURAN = "jadicuan:kalkulator-pesan-antar:pengaturan";
const KEY_TIMPAAN = "jadicuan:kalkulator-pesan-antar:timpaan";
const KEY_DRAF = "jadicuan:kalkulator-pesan-antar:draf";
export const PROFIL_FOOD = biaya.profil as unknown as Record<PlatformId, ProfilFood>;
const REFERENSI = "Angka referensi, belum diverifikasi";

export const LABEL_STATUS_FOOD: Record<StatusFood, string> = { aman: "Aman", tipis: "Tipis", rugi: "Rugi" };
const KELAS_STATUS: Record<StatusFood, string> = { aman: "is-sehat", tipis: "is-tipis", rugi: "is-rugi" };
export function badgeFood(s: StatusFood): HTMLSpanElement {
  return el("span", LABEL_STATUS_FOOD[s], `seller-status ${KELAS_STATUS[s]}`);
}

export type KonteksFood = {
  pengaturan(): PengaturanFood;
  profil(id: PlatformId): ProfilFood;
  kemitraan(id: PlatformId): Kemitraan;
  diverifikasiPengguna(id: PlatformId): boolean; // komisi sudah diisi sendiri
  platformAktif(): PlatformId[];
  hitung(menu: Menu, id: PlatformId): HasilFood;
  onUbah(fn: () => void): void;
  lacak: { mulai(): void; selesai(): void; salin(): void };
};

function muatPengaturan(): PengaturanFood {
  const s = bacaSimpan<Partial<PengaturanFood>>(KEY_PENGATURAN) ?? {};
  const out: PengaturanFood = structuredClone(PENGATURAN_FOOD_DEFAULT);
  const num = (k: keyof PengaturanFood) => {
    const v = s[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) (out as Record<string, unknown>)[k] = v;
  };
  for (const k of ["targetRp", "targetMarginPersen", "diskonPersen", "overhead", "kelipatan", "tarifPPNPersen"] as const) num(k);
  if (s.modeTarget === "rp" || s.modeTarget === "margin") out.modeTarget = s.modeTarget;
  if (typeof s.pph === "boolean") out.pph = s.pph;
  if (Array.isArray(s.platformAktif)) out.platformAktif = s.platformAktif.filter((x): x is PlatformId => PLATFORMS.includes(x as PlatformId));
  if (out.kelipatan < 1) out.kelipatan = 500;
  return out;
}

function $(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemen #${id} tidak ditemukan`);
  return node;
}

/** Rincian potongan + HPP/packing/overhead dengan grafik batang (kelas sama dengan kalkulator seller). */
export function renderRincianFood(h: Extract<HasilFood, { ok: true }>["saran"], modal: { hpp: number; packing: number; overhead: number }): HTMLElement {
  const skala = Math.max(h.hargaBayar, 1);
  const baris: Array<{ label: string; nilai: number; jenis: string }> = [{ label: "Dibayar pembeli", nilai: h.hargaBayar, jenis: "dasar" }];
  for (const k of Object.keys(LABEL_RINCIAN_FOOD) as Array<keyof RincianFood>) if (h.rincian[k]) baris.push({ label: LABEL_RINCIAN_FOOD[k], nilai: -h.rincian[k], jenis: "potongan" });
  baris.push({ label: "Uang bersih diterima", nilai: h.uangBersih, jenis: "dasar" });
  baris.push({ label: "HPP / modal", nilai: -modal.hpp, jenis: "modal" });
  if (modal.packing) baris.push({ label: "Packing", nilai: -modal.packing, jenis: "modal" });
  if (modal.overhead) baris.push({ label: "Overhead (gas, listrik, tenaga)", nilai: -modal.overhead, jenis: "modal" });
  baris.push({ label: "Untung per porsi", nilai: h.untung, jenis: "hasil" });
  const list = el("ul", "", "seller-breakdown-list");
  for (const b of baris) {
    const li = el("li", "", `is-${b.jenis}${b.jenis === "hasil" && b.nilai < 0 ? " is-minus" : ""}`);
    const row = el("div", "", "seller-breakdown-row");
    row.append(el("span", b.label), el("strong", b.jenis === "potongan" || b.jenis === "modal" ? `−${formatRp(-b.nilai)}` : formatRp(b.nilai)));
    const bar = el("div", "", "seller-bar");
    bar.setAttribute("aria-hidden", "true");
    const isi = el("span");
    isi.style.width = `${Math.min(100, (Math.abs(b.nilai) / skala) * 100).toFixed(1)}%`;
    bar.append(isi);
    li.append(row, bar);
    list.append(li);
  }
  const wrap = el("div", "", "seller-breakdown");
  wrap.append(list);
  return wrap;
}

/** Kalimat sederhana untuk harga yang disamakan dengan harga lapak. */
export function kalimatOffline(nama: string, h: Extract<HasilFood, { ok: true }>): string {
  const o = h.offline!;
  let t = `${nama}: kamu jual ${formatRp(o.harga)}, tapi uang masuk ${formatRp(o.uangBersih)}. `;
  if (o.untung < 0) t += `Setiap porsi rugi ${formatRp(-o.untung)}.`;
  else t += `Untung tinggal ${formatRp(o.untung)}${o.bocor > 0 ? `, kurang ${formatRp(o.bocor)} dari targetmu` : ""}.`;
  if (h.kenaikanRp !== null && h.kenaikanRp > 0) t += ` Harga yang aman ${formatRp(h.hargaSaran)} (naik ${formatRp(h.kenaikanRp)} atau ${formatPersen(h.kenaikanPersen)}).`;
  return t;
}

export function pasangKalkulatorFood(): KonteksFood {
  let pengaturan = muatPengaturan();
  let timpaan = (bacaSimpan<Record<string, TimpaanFood>>(KEY_TIMPAAN) ?? {}) as Partial<Record<PlatformId, TimpaanFood>>;
  const pendengar: Array<() => void> = [];
  const ubah = () => pendengar.forEach((f) => f());

  const ctx: KonteksFood = {
    pengaturan: () => pengaturan,
    profil: (id) => terapkanTimpaanFood(PROFIL_FOOD[id], timpaan[id]),
    kemitraan: (id) => timpaan[id]?.kemitraan ?? "kurir_platform",
    diverifikasiPengguna: (id) => {
      const t = timpaan[id];
      if (!t) return false;
      return (ctx.kemitraan(id) === "antar_sendiri" ? t.komisiAntarSendiriPersen : t.komisiPersen) !== undefined;
    },
    platformAktif: () => PLATFORMS.filter((p) => pengaturan.platformAktif.includes(p)),
    hitung: (menu, id) => hitungFood(menu, id, ctx.profil(id), pengaturan, ctx.kemitraan(id)),
    onUbah: (fn) => pendengar.push(fn),
    lacak: { mulai: () => undefined, selesai: () => undefined, salin: () => undefined }, // diisi tahap event
  };

  function simpanSemua(): void {
    tulisSimpan(KEY_PENGATURAN, pengaturan);
    tulisSimpan(KEY_TIMPAAN, timpaan);
    ubah();
  }
  function setP<K extends keyof PengaturanFood>(k: K, v: PengaturanFood[K]): void {
    pengaturan = { ...pengaturan, [k]: v };
    simpanSemua();
  }
  function setT(id: PlatformId, patch: TimpaanFood): void {
    const baru: TimpaanFood = { ...(timpaan[id] ?? {}), ...patch };
    for (const k of Object.keys(baru) as Array<keyof TimpaanFood>) if (baru[k] === undefined || baru[k] === null) delete baru[k];
    timpaan = { ...timpaan, [id]: baru };
    simpanSemua();
  }

  // ---------- Tab ----------
  const tabs = [...document.querySelectorAll<HTMLButtonElement>(".food-page .seller-tab")];
  function pilihTab(id: string, fokus = false): void {
    for (const t of tabs) {
      const aktif = t.id === id;
      t.setAttribute("aria-selected", String(aktif));
      t.tabIndex = aktif ? 0 : -1;
      $(t.getAttribute("aria-controls")!).hidden = !aktif;
      if (aktif && fokus) t.focus();
    }
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => pilihTab(t.id));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      pilihTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id, true);
    });
  });

  // ---------- Bantuan "?" dan tautan ke Pengaturan ----------
  document.addEventListener("click", (e) => {
    const btn = (e.target as Element | null)?.closest<HTMLButtonElement>("[data-help-toggle]");
    if (!btn || !btn.closest(".food-page")) return;
    const text = document.getElementById(btn.getAttribute("aria-controls") ?? "");
    if (!text) return;
    const buka = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(buka));
    text.hidden = !buka;
  });
  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-open-settings]")) a.addEventListener("click", () => (($("food-settings") as HTMLDetailsElement).open = true));

  // ---------- Form satu menu ----------
  const form = $("food-form") as HTMLFormElement;
  const field = (f: string) => form.querySelector<HTMLInputElement>(`[data-sfield="${f}"]`)!;
  const modeRadios = [...form.querySelectorAll<HTMLInputElement>("[data-target-mode]")];
  const inMargin = $("food-target-margin") as HTMLInputElement;
  const inRp = $("food-target-rp") as HTMLInputElement;

  function isiTarget(): void {
    for (const r of modeRadios) r.checked = r.value === pengaturan.modeTarget;
    inMargin.value = persenTeks(pengaturan.targetMarginPersen);
    inRp.value = ribuan(pengaturan.targetRp);
    for (const w of form.querySelectorAll<HTMLElement>("[data-target-wrap]")) w.hidden = w.dataset.targetWrap !== pengaturan.modeTarget;
  }
  for (const r of modeRadios) r.addEventListener("change", () => r.checked && setP("modeTarget", r.value as "rp" | "margin"));
  inMargin.addEventListener("change", () => {
    const v = bacaAngka(inMargin.value, "persen");
    if (v !== null && v >= 0) setP("targetMarginPersen", Math.min(v, 95));
    inMargin.value = persenTeks(pengaturan.targetMarginPersen);
  });
  inRp.addEventListener("change", () => {
    const v = bacaAngka(inRp.value, "rp");
    if (v !== null && v >= 0) setP("targetRp", v);
    inRp.value = ribuan(pengaturan.targetRp);
  });

  function bacaMenu(): Menu | null {
    const hpp = bacaAngka(field("hpp").value, "rp");
    if (hpp === null) return null;
    return {
      nama: field("nama").value.trim() || "Menu tanpa nama",
      hpp,
      packing: bacaAngka(field("packing").value, "rp"),
      hargaOffline: bacaAngka(field("hargaOffline").value, "rp"),
    };
  }
  function simpanDraf(): void {
    tulisSimpan(KEY_DRAF, Object.fromEntries(["nama", "hpp", "packing", "hargaOffline"].map((f) => [f, field(f).value])));
  }
  function muatDraf(): void {
    const d = bacaSimpan<Record<string, string>>(KEY_DRAF);
    if (!d) return;
    for (const f of ["nama", "hpp", "packing", "hargaOffline"]) if (typeof d[f] === "string") field(f).value = d[f].slice(0, 80);
  }

  const kartu = $("food-cards");
  const statusSalin = el("p", "", "modal-copy-status");
  statusSalin.setAttribute("role", "status");

  function renderSatu(): void {
    const menu = bacaMenu();
    $("food-results").hidden = !menu;
    $("food-empty").hidden = !!menu;
    if (!menu) return;
    const aktif = ctx.platformAktif();
    const hasil = aktif.map((id) => ({ id, h: ctx.hitung(menu, id) }));
    kartu.replaceChildren(...hasil.map(({ id, h }) => renderKartu(menu, id, h)));
    if (!aktif.length) kartu.append(el("p", "Belum ada platform yang aktif. Pilih platform di Pengaturan.", "seller-empty"));
    kartu.after(statusSalin);
    // Kalimat harga lapak
    const ok = hasil.filter((x): x is { id: PlatformId; h: Extract<HasilFood, { ok: true }> } => x.h.ok && x.h.offline !== null);
    $("food-offline").hidden = ok.length === 0;
    $("food-offline-list").replaceChildren(
      ...ok.map(({ id, h }) => {
        const li = el("li", "", `is-${h.status}`);
        li.append(badgeFood(h.status), document.createTextNode(` ${kalimatOffline(ctx.profil(id).nama, h)}`));
        return li;
      }),
    );
  }

  function renderKartu(menu: Menu, id: PlatformId, h: HasilFood): HTMLElement {
    const prof = ctx.profil(id);
    const card = el("article", "", `food-card is-${h.ok ? h.status : "rugi"}`);
    const head = el("header", "", "food-card-head");
    head.append(el("strong", prof.nama));
    if (h.ok) {
      const badge = badgeFood(h.status);
      // Status mengacu ke harga lapak bila diisi; tulis jelas supaya tidak dikira status harga saran.
      if (h.offline) badge.textContent = `${LABEL_STATUS_FOOD[h.status]} di harga lapak`;
      head.append(badge);
    }
    card.append(head);
    if (!h.ok) {
      card.append(el("p", PESAN_MASALAH[h.masalah], "food-problem"));
      return card;
    }
    const meta = el("p", "", "food-card-meta");
    const k = ctx.kemitraan(id);
    meta.append(
      document.createTextNode(
        `Komisi ${persenTeks(h.komisiPersen)}%${h.ppnDitambahkan ? ` + PPN ${persenTeks(pengaturan.tarifPPNPersen)}%` : " (sudah termasuk PPN)"}${prof.biayaTetapPerPesanan ? ` + ${formatRp(prof.biayaTetapPerPesanan)}/pesanan` : ""} · ${k === "antar_sendiri" ? "antar sendiri" : "kurir platform"}`,
      ),
    );
    if (!ctx.diverifikasiPengguna(id)) meta.append(el("span", REFERENSI, "seller-unverified"));
    card.append(meta);

    const harga = el("div", "", "food-price");
    harga.append(el("span", "Harga display saran"), el("strong", formatRp(h.hargaSaran)));
    const salin = el("button", "Salin harga", "button button-secondary food-copy");
    salin.type = "button";
    salin.setAttribute("aria-label", `Salin harga ${prof.nama} ${formatRp(h.hargaSaran)}`);
    salin.addEventListener("click", async () => {
      const teks = String(h.hargaSaran);
      let ok = false;
      try {
        await navigator.clipboard.writeText(teks);
        ok = true;
      } catch {
        ok = false;
      }
      statusSalin.textContent = ok ? `Harga ${prof.nama} ${formatRp(h.hargaSaran)} tersalin. Tempel di kolom harga aplikasi mitra.` : `Salin manual: ${ribuan(h.hargaSaran)}`;
      ctx.lacak.salin();
    });
    harga.append(salin);
    card.append(harga);

    const dl = el("dl", "", "food-metrics");
    const m = (label: string, nilai: string, cls = "") => {
      const d = el("div", "", cls);
      d.append(el("dt", label), el("dd", nilai));
      dl.append(d);
    };
    const s = h.saran;
    m("Uang bersih diterima", formatRp(s.uangBersih));
    m("Untung per porsi", formatRp(s.untung), s.untung < 0 ? "is-minus" : "");
    m("Total potongan", `${formatRp(s.totalPotongan)} · ${formatPersen(s.persenPotongan)}`);
    m("Harga impas", formatRp(h.hargaImpas));
    card.append(dl);
    card.append(
      el(
        "p",
        h.offline ? `Status ${LABEL_STATUS_FOOD[h.status]} dihitung bila harga disamakan dengan harga lapak ${formatRp(h.offline.harga)}.` : `Status pada harga saran. Isi harga di lapak untuk membandingkan.`,
        "food-status-note",
      ),
    );
    if (h.peringatan.length) {
      const ul = el("ul", "", "seller-warnings");
      for (const w of h.peringatan) ul.append(el("li", PESAN_PERINGATAN_FOOD[w]));
      card.append(ul);
    }
    const det = el("details", "", "food-breakdown");
    det.append(el("summary", "Rincian potongan pada harga saran"));
    det.append(renderRincianFood(s, { hpp: Math.round(menu.hpp), packing: Math.round(menu.packing ?? 0), overhead: Math.round(menu.overhead ?? pengaturan.overhead) }));
    card.append(det);
    return card;
  }

  form.addEventListener("input", () => {
    ctx.lacak.mulai();
    renderSatu();
    simpanDraf();
  });
  form.addEventListener("focusout", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset?.kind === "rupiah") {
      const v = bacaAngka(t.value, "rp");
      if (v !== null) t.value = ribuan(v);
    }
  });
  form.addEventListener("submit", (e) => e.preventDefault());

  // ---------- Pengaturan ----------
  const body = $("food-settings-body");
  function renderPengaturan(): void {
    const s = pengaturan;
    const umum = grup(
      "Untuk semua menu",
      "Bisa ditimpa per menu lewat kolom CSV.",
      kolomAngka({ label: "Diskon dari kamu di aplikasi", kind: "persen", nilai: s.diskonPersen, hint: "Diskon yang kamu tanggung sendiri, bukan promo dari platform.", simpan: (v) => setP("diskonPersen", Math.min(v ?? 0, 99)) }),
      kolomAngka({ label: "Overhead per porsi", kind: "rupiah", nilai: s.overhead, hint: "Gas, listrik, tenaga. Isi 0 bila sudah masuk HPP.", simpan: (v) => setP("overhead", v ?? 0) }),
      pilihan("Bulatkan harga display ke atas ke kelipatan", [["100", "Rp100"], ["500", "Rp500"], ["1000", "Rp1.000"]], String(s.kelipatan) as "100" | "500" | "1000", (v) => setP("kelipatan", Number(v))),
      kolomAngka({ label: "Tarif PPN atas komisi", kind: "persen", nilai: s.tarifPPNPersen, tanda: REFERENSI, hint: "Dipakai bila PPN ditambahkan di atas komisi.", simpan: (v) => setP("tarifPPNPersen", v ?? 11) }),
      centang("Hitung PPh 0,5% dari omzet", s.pph, (v) => setP("pph", v)),
    );
    const aktif = grup(
      "Platform yang dihitung",
      "",
      ...PLATFORMS.map((id) => centang(PROFIL_FOOD[id].nama, s.platformAktif.includes(id), (v) => setP("platformAktif", v ? [...s.platformAktif, id] : s.platformAktif.filter((x) => x !== id)))),
    );
    const per = PLATFORMS.map((id) => {
      const base = PROFIL_FOOD[id];
      const t = timpaan[id] ?? {};
      const tanda = (k: keyof TimpaanFood) => (t[k] === undefined ? REFERENSI : undefined);
      const ppn = t.komisiTermasukPPN ?? base.komisiTermasukPPN;
      return grup(
        base.nama,
        `${base.catatan} Diperbarui ${base.updatedAt}.`,
        pilihan("Jenis kemitraan", [["kurir_platform", "Pakai kurir platform"], ["antar_sendiri", "Antar sendiri"]], ctx.kemitraan(id), (v) => setT(id, { kemitraan: v })),
        kolomAngka({
          label: "Komisi (kurir platform)",
          kind: "persen",
          nilai: t.komisiPersen ?? base.komisiPersen,
          tanda: tanda("komisiPersen"),
          hint: base.rentangDilaporkan ? `Dilaporkan ${base.rentangDilaporkan.map((x) => persenTeks(x)).join("-")}%.` : "",
          sumber: base.source,
          simpan: (v) => setT(id, { komisiPersen: v ?? undefined }),
        }),
        kolomAngka({ label: "Komisi (antar sendiri)", kind: "persen", nilai: t.komisiAntarSendiriPersen ?? base.komisiAntarSendiriPersen, placeholder: "Isi dari laporan mitra", simpan: (v) => setT(id, { komisiAntarSendiriPersen: v ?? undefined }) }),
        pilihan<"" | "ya" | "tidak">(
          "Komisi sudah termasuk PPN?",
          [["", "Belum dipilih (dihitung dengan PPN ditambahkan)"], ["ya", "Ya, sudah termasuk PPN"], ["tidak", "Tidak, PPN ditambahkan di atas komisi"]],
          ppn === null ? "" : ppn ? "ya" : "tidak",
          (v) => setT(id, { komisiTermasukPPN: v === "" ? undefined : v === "ya" }),
          tanda("komisiTermasukPPN"),
        ),
        pilihan("Komisi dihitung dari", [["sebelum_diskon", "Harga display (sebelum diskon kamu)"], ["setelah_diskon", "Harga setelah diskon kamu"]], t.dasar ?? base.dasar, (v) => setT(id, { dasar: v }), tanda("dasar")),
        kolomAngka({ label: "Biaya tetap per pesanan", kind: "rupiah", nilai: t.biayaTetapPerPesanan ?? base.biayaTetapPerPesanan, tanda: tanda("biayaTetapPerPesanan"), simpan: (v) => setT(id, { biayaTetapPerPesanan: v ?? undefined }) }),
        kolomAngka({
          label: "Biaya layanan tambahan",
          kind: "persen",
          nilai: t.biayaLayananPersen ?? base.biayaLayananPersen,
          tanda: tanda("biayaLayananPersen"),
          hint: base.rentangBiayaLayanan ? `Dilaporkan ${base.rentangBiayaLayanan.join("-")}%.` : "",
          simpan: (v) => setT(id, { biayaLayananPersen: v ?? undefined }),
        }),
        kolomAngka({ label: "Iklan / promo platform yang kamu ikuti", kind: "persen", nilai: t.biayaIklanPersen ?? base.biayaIklanPersen, hint: "Isi 0 bila tidak ikut.", simpan: (v) => setT(id, { biayaIklanPersen: v ?? undefined }) }),
      );
    });
    const reset = el("button", "Kembalikan semua ke angka referensi", "modal-text-button");
    reset.type = "button";
    reset.addEventListener("click", () => {
      if (!window.confirm("Kembalikan semua pengaturan dan angka potongan ke angka referensi?")) return;
      pengaturan = structuredClone(PENGATURAN_FOOD_DEFAULT);
      timpaan = {};
      tulisSimpan(KEY_PENGATURAN, null);
      tulisSimpan(KEY_TIMPAAN, null);
      renderPengaturan();
      isiTarget();
      ubah();
    });
    body.replaceChildren(umum, aktif, ...per, el("p", "Pengaturan disimpan di perangkat ini saja.", "seller-settings-note"), reset);
  }

  // ---------- Mulai ----------
  ctx.onUbah(() => {
    isiTarget();
    renderSatu();
  });
  ctx.onUbah(() => {
    // Pengaturan perlu digambar ulang supaya tanda "angka referensi" ikut berubah, tapi tanpa
    // mencuri fokus: hanya bila panel tidak sedang dipakai mengetik.
    if (!body.contains(document.activeElement)) renderPengaturan();
  });
  body.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!body.contains(document.activeElement)) renderPengaturan();
    }, 0);
  });
  pasangBanyakMenu(ctx);
  muatDraf();
  isiTarget();
  renderPengaturan();
  renderSatu();
  return ctx;
}
