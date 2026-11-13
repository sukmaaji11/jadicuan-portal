// Tampilan "Versi lengkap" Kalkulator Modal: kode akses, 3 skenario, usaha tersimpan, PDF.
// Dipasang dari <script> di src/pages/kalkulator-modal.astro lewat pasangVersiLengkap().
// Semua data tetap di perangkat (localStorage); tidak ada yang dikirim ke server atau Pixel.
import { KUNCI_PUBLIK_AKSES, SERIAL_DIBLOKIR } from "../config/kalkulator-modal";
import { PESAN_GAGAL, periksaKode, type InfoAkses } from "./akses-kode";
import {
  calculateModal,
  emptyModalInput,
  formatBulan,
  formatRibuan,
  formatRupiah,
  type ModalInput,
  type ModalResult,
} from "./modal";
import {
  NAMA_SKENARIO,
  SKENARIO_DEFAULT,
  bacaDaftar,
  formatWaktu,
  hapusUsaha,
  hitungSkenario,
  rapikanPersen,
  simpanUsaha,
  type PersenSkenario,
  type UsahaTersimpan,
} from "./modal-lengkap";
import { CATATAN_RINGKASAN_SEWA, sewaDihitungDuaKali } from "./modal-sewa";

const KEY_AKSES = "jadicuan:kalkulator-modal:akses";
const KEY_TAUTAN = "jadicuan:kalkulator-modal:kode-tautan"; // diisi skrip inline di halaman
const KEY_DAFTAR = "jadicuan:kalkulator-modal:usaha-tersimpan";
const KEY_SKENARIO = "jadicuan:kalkulator-modal:skenario";

export type KeadaanUsaha = {
  businessName: string;
  businessType: string;
  values: ModalInput;
  sewaBulananManual: boolean;
};

export type KonteksHalaman = {
  ambil(): KeadaanUsaha;
  muat(usaha: KeadaanUsaha): void; // isi ulang formulir dan tampilkan hasil
  satuan(): string;
};

function baca(key: string, area: "local" | "session" = "local"): string | null {
  try {
    return (area === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function tulis(key: string, value: string | null, area: "local" | "session" = "local"): void {
  try {
    const s = area === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* penyimpanan diblokir: fitur tetap jalan selama halaman terbuka */
  }
}
function $(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemen #${id} tidak ditemukan`);
  return node;
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
const idBaru = () =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const LABEL_ISIAN: Array<[keyof ModalInput, string, "rp" | "persen" | "hari" | "unit" | "bulan"]> = [
  ["sewaSetahun", "Sewa tempat setahun", "rp"],
  ["peralatan", "Peralatan dan perlengkapan", "rp"],
  ["renovasi", "Renovasi atau gerobak", "rp"],
  ["bahanBakuAwal", "Bahan baku awal", "rp"],
  ["perizinan", "Perizinan", "rp"],
  ["hargaJual", "Harga jual rata-rata", "rp"],
  ["targetHarian", "Target terjual per hari", "unit"],
  ["hariBuka", "Hari buka per bulan", "hari"],
  ["persenHPP", "Persen HPP", "persen"],
  ["sewaBulanan", "Sewa tempat per bulan", "rp"],
  ["gajiKaryawan", "Gaji karyawan", "rp"],
  ["utilitas", "Listrik, air, internet", "rp"],
  ["marketing", "Marketing", "rp"],
  ["transport", "Transport", "rp"],
  ["lainnya", "Lainnya", "rp"],
  ["gajiSendiri", "Gaji untuk dirimu per bulan", "rp"],
  ["persenTakTerduga", "Dana tak terduga (% dari alat + renovasi)", "persen"],
  ["bulanCadangan", "Cadangan kas", "bulan"],
  ["persenPlatform", "Biaya platform online (% dari penjualan)", "persen"],
];

function teksBalikModal(r: ModalResult): string {
  if (r.balikModalBulan === null) return "Belum balik modal dengan angka ini";
  if (r.totalModalAwal === 0) return "Modal awal belum diisi";
  return formatBulan(r.balikModalBulan);
}

export function pasangVersiLengkap(ctx: KonteksHalaman) {
  const panel = $("full-version");
  const kartuJual = $("modal-locked");
  const status = $("access-status");
  const banner = $("access-banner");
  let akses: InfoAkses | null = null;
  let aktifId: string | null = null; // usaha tersimpan yang sedang dibuka
  let persen: PersenSkenario = (() => {
    try {
      return rapikanPersen(JSON.parse(baca(KEY_SKENARIO) ?? "{}"));
    } catch {
      return { ...SKENARIO_DEFAULT };
    }
  })();
  const template = emptyModalInput();
  const daftar = () => bacaDaftar(baca(KEY_DAFTAR), template);

  // ---------- Kode akses ----------
  function tampilkanAkses(): void {
    panel.hidden = !akses;
    kartuJual.hidden = !!akses;
    if (akses) $("full-badge").textContent = `Aktif di perangkat ini · ${akses.label}`;
  }

  async function aktifkan(kode: string, dari: "tautan" | "isian" | "tersimpan"): Promise<boolean> {
    const hasil = await periksaKode(kode, KUNCI_PUBLIK_AKSES, SERIAL_DIBLOKIR);
    if (!hasil.ok) {
      if (dari === "tersimpan") tulis(KEY_AKSES, null); // kode lama diblokir: lepas diam-diam
      else {
        status.textContent = PESAN_GAGAL[hasil.alasan];
        status.classList.add("is-error");
        if (dari === "tautan") {
          banner.textContent = `Kode dari tautan tidak bisa dipakai. ${PESAN_GAGAL[hasil.alasan]}`;
          banner.classList.add("is-error");
          banner.hidden = false;
        }
      }
      return false;
    }
    akses = hasil.info;
    tulis(KEY_AKSES, hasil.info.kode);
    status.textContent = "";
    status.classList.remove("is-error");
    if (dari !== "tersimpan") {
      banner.textContent = `Versi lengkap aktif di perangkat ini (${hasil.info.label}). Fitur tambahan ada di halaman hasil.`;
      banner.classList.remove("is-error");
      banner.hidden = false;
    }
    tampilkanAkses();
    return true;
  }

  const isian = document.getElementById("access-code") as HTMLTextAreaElement | null;
  document.getElementById("access-submit")?.addEventListener("click", async () => {
    if (!isian) return;
    if (await aktifkan(isian.value, "isian")) {
      isian.value = "";
      render();
      $("full-heading").focus?.();
      panel.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });

  $("access-forget").addEventListener("click", () => {
    if (!window.confirm("Lepas kode akses dari perangkat ini? Usaha tersimpan tidak ikut terhapus. Kode yang sama bisa dimasukkan lagi kapan saja.")) return;
    tulis(KEY_AKSES, null);
    akses = null;
    banner.hidden = true;
    tampilkanAkses();
    status.textContent = "Kode akses sudah dilepas dari perangkat ini.";
  });

  // ---------- 3 skenario ----------
  const inputSepi = $("scenario-sepi") as HTMLInputElement;
  const inputRamai = $("scenario-ramai") as HTMLInputElement;
  inputSepi.value = String(persen.sepi);
  inputRamai.value = String(persen.ramai);
  function ubahPersen(): void {
    const angka = (s: string) => (s.replace(/\D/g, "") === "" ? Number.NaN : Number(s.replace(/\D/g, "")));
    persen = rapikanPersen({ sepi: angka(inputSepi.value), ramai: angka(inputRamai.value) });
    tulis(KEY_SKENARIO, JSON.stringify(persen));
    renderSkenario();
  }
  for (const input of [inputSepi, inputRamai]) {
    input.addEventListener("change", () => {
      ubahPersen();
      inputSepi.value = String(persen.sepi);
      inputRamai.value = String(persen.ramai);
    });
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 3);
    });
  }

  function renderSkenario(): void {
    const u = ctx.satuan();
    const hasil = hitungSkenario(ctx.ambil().values, persen, calculateModal);
    const kartu = hasil.map((h) => {
      const card = el("article", "", `modal-scenario is-${h.id}${h.dibawahBep ? " is-negative" : ""}`);

      // Kepala: nama skenario di kiri, balik modal (angka yang paling dicari) di kanan.
      const head = el("header", "", "modal-scenario-head");
      const judul = el("div", "", "modal-scenario-title");
      judul.append(el("strong", NAMA_SKENARIO[h.id]), el("span", h.id === "normal" ? "Sesuai targetmu" : `${h.persen}% dari target`));
      const balik = el("div", "", "modal-scenario-payback");
      const bulan = h.balikModalBulan === null ? null : formatBulan(h.balikModalBulan);
      balik.append(
        el("span", "Balik modal"),
        el("strong", h.balikModalBulan === null ? "Belum balik modal" : h.totalModalAwal === 0 ? "Modal awal belum diisi" : bulan!.replace(/ \(.*\)$/, "")),
      );
      const rincianTahun = bulan?.match(/\((.*)\)$/)?.[1];
      if (rincianTahun && h.totalModalAwal > 0) balik.append(el("small", rincianTahun));
      head.append(judul, balik);

      // Isi: tiga angka sejajar (bertumpuk di HP).
      const dl = el("dl", "", "modal-scenario-stats");
      const baris: Array<[string, string, string]> = [
        ["Terjual per hari", `${formatRibuan(h.targetHarian)} ${u}`, ""],
        ["Penjualan per bulan", formatRupiah(h.penjualanBulanan), ""],
        ["Laba bersih per bulan", formatRupiah(h.labaBersihBulanan), h.labaBersihBulanan < 0 ? "is-minus" : ""],
      ];
      for (const [k, v, cls] of baris) {
        const row = el("div", "", cls);
        row.append(el("dt", k), el("dd", v));
        dl.append(row);
      }
      card.append(head, dl);
      if (h.dibawahBep) card.append(el("p", "Di bawah titik impas: penjualan belum menutup semua biaya.", "modal-scenario-warn"));
      return card;
    });
    $("scenario-cards").replaceChildren(...kartu);
  }

  // ---------- Usaha tersimpan ----------
  function renderDaftar(): void {
    const list = $("saved-list");
    const items = daftar().map((u) => {
      const r = calculateModal(u.nilai as ModalInput);
      const li = el("li", "", u.id === aktifId ? "is-current" : "");
      const info = el("div", "", "modal-saved-info");
      info.append(el("strong", u.nama), el("span", `${teksBalikModal(r)} · modal ${formatRupiah(r.totalModalAwal)}`), el("small", `Disimpan ${formatWaktu(u.disimpan)}`));
      const aksi = el("div", "", "modal-saved-actions");
      const buka = el("button", u.id === aktifId ? "Sedang dibuka" : "Buka", "button button-secondary");
      buka.type = "button";
      buka.disabled = u.id === aktifId;
      buka.addEventListener("click", () => {
        aktifId = u.id;
        ctx.muat({ businessName: u.nama === "Usaha tanpa nama" ? "" : u.nama, businessType: u.jenis, values: u.nilai as ModalInput, sewaBulananManual: u.sewaBulananManual });
        $("save-status").textContent = `${u.nama} dibuka. Ubah angkanya lalu simpan lagi untuk memperbarui.`;
      });
      const hapus = el("button", "Hapus", "modal-text-button");
      hapus.type = "button";
      hapus.setAttribute("aria-label", `Hapus ${u.nama}`);
      hapus.addEventListener("click", () => {
        if (!window.confirm(`Hapus "${u.nama}" dari usaha tersimpan?`)) return;
        tulis(KEY_DAFTAR, JSON.stringify(hapusUsaha(daftar(), u.id)));
        if (aktifId === u.id) aktifId = null;
        $("save-status").textContent = `${u.nama} dihapus.`;
        renderDaftar();
      });
      aksi.append(buka, hapus);
      li.append(info, aksi);
      return li;
    });
    list.replaceChildren(...items);
    list.hidden = items.length === 0;
    $("save-business").textContent = aktifId ? "Simpan perubahan" : "Simpan usaha ini";
  }

  $("save-business").addEventListener("click", () => {
    const s = ctx.ambil();
    const nama = s.businessName.trim() || "Usaha tanpa nama";
    const hasil = simpanUsaha(daftar(), {
      id: aktifId ?? idBaru(),
      nama,
      jenis: s.businessType,
      nilai: { ...s.values },
      sewaBulananManual: s.sewaBulananManual,
      disimpan: new Date().toISOString(),
    } as UsahaTersimpan<ModalInput>);
    if (hasil.penuh) {
      $("save-status").textContent = "Usaha tersimpan sudah 20. Hapus salah satu dulu untuk menyimpan yang baru.";
      return;
    }
    const baru = !aktifId;
    tulis(KEY_DAFTAR, JSON.stringify(hasil.daftar));
    aktifId = hasil.daftar[0].id; // yang baru disimpan selalu paling atas (terbaru)
    $("save-status").textContent = baru
      ? `${nama} tersimpan di perangkat ini.${s.businessName.trim() ? "" : " Isi nama usaha di langkah 1 supaya mudah dibedakan."}`
      : `Perubahan ${nama} tersimpan.`;
    renderDaftar();
  });

  // ---------- PDF ----------
  $("download-pdf").addEventListener("click", async () => {
    const tombol = $("download-pdf") as HTMLButtonElement;
    const st = $("pdf-status");
    tombol.disabled = true;
    st.textContent = "Menyiapkan PDF…";
    try {
      const { buatPdf, namaFilePdf } = await import("./modal-pdf");
      const s = ctx.ambil();
      const blob = await buatPdf(dataPdf(s));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaFilePdf(s.businessName.trim() || "usaha");
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      st.textContent = "PDF sudah diunduh. Kalau tidak muncul (misalnya dibuka dari Instagram atau Facebook), buka halaman ini di Chrome lalu coba lagi.";
    } catch {
      st.textContent = "PDF gagal dibuat. Coba lagi, atau buka halaman ini di Chrome.";
    } finally {
      tombol.disabled = false;
    }
  });

  function dataPdf(s: KeadaanUsaha) {
    const r = calculateModal(s.values);
    const u = ctx.satuan();
    const nama = s.businessName.trim() || "usahaku";
    const sekarang = new Date();
    const fmt = (key: keyof ModalInput, jenis: string): string | null => {
      const v = s.values[key];
      if (typeof v !== "number") return null;
      if (jenis === "rp") return v > 0 ? formatRupiah(v) : null;
      if (jenis === "persen") return `${String(v).replace(".", ",")}%`;
      if (jenis === "hari") return `${formatRibuan(v)} hari`;
      if (jenis === "bulan") return `${formatRibuan(v)} bulan biaya`;
      return `${formatRibuan(v)} ${u}`;
    };
    const isian = LABEL_ISIAN.filter(([k]) => k !== "gajiSendiri" || s.values.hitungGajiSendiri)
      .map(([k, label, jenis]) => ({ label, nilai: fmt(k, jenis) }))
      .filter((x): x is { label: string; nilai: string } => x.nilai !== null);
    const skenario = hitungSkenario(s.values, persen, calculateModal);
    const bep =
      r.bepHarianPorsi !== null
        ? `${formatRibuan(r.bepHarianPorsi)} ${u}/hari`
        : r.bepStatus === "margin-habis"
          ? "Tidak tercapai dengan harga ini"
          : "Belum bisa dihitung";
    const catatan = [
      "Semua angka adalah estimasi dari isianmu, bukan jaminan keuntungan.",
      "Balik modal = total modal awal ÷ laba bersih per bulan. Titik impas = jumlah terjual per hari supaya penjualan menutup semua biaya.",
      "Skenario sepi dan ramai hanya mengubah jumlah terjual per hari. Harga, persen HPP, dan biaya bulanan sama.",
      ...(s.values.hitungGajiSendiri ? [] : ["Gaji untuk dirimu belum dihitung. Kalau kamu ikut bekerja di usaha ini, hasil sebenarnya lebih kecil."]),
      ...(sewaDihitungDuaKali(s.values) ? [CATATAN_RINGKASAN_SEWA.replace(/^Catatan: /, "")] : []),
    ];
    return {
      namaUsaha: nama,
      tanggal: `${sekarang.getDate()} ${["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][sekarang.getMonth()]} ${sekarang.getFullYear()}`,
      satuan: u,
      sorotan: {
        judul: "Perkiraan balik modal",
        nilai: teksBalikModal(r),
        catatan: "Estimasi berdasarkan angka yang kamu isi. Kenyataannya bisa lebih lama, terutama di bulan-bulan awal saat penjualan belum stabil.",
      },
      ringkasan: [
        { label: "Total modal awal", nilai: formatRupiah(r.totalModalAwal), tebal: true },
        { label: "Laba bersih per bulan", nilai: formatRupiah(r.labaBersihBulanan) },
        { label: "Titik impas harian", nilai: bep },
        { label: "Penjualan per bulan", nilai: formatRupiah(r.penjualanBulanan) },
      ],
      modalAwal: [
        ...r.rincianModal.filter((i) => i.amount > 0).map((i) => ({ label: i.label, nilai: formatRupiah(i.amount) })),
        { label: "Total modal awal", nilai: formatRupiah(r.totalModalAwal), tebal: true },
      ],
      bulanan: [
        { label: "Penjualan sebulan", nilai: formatRupiah(r.penjualanBulanan) },
        { label: "Modal bahan", nilai: `-${formatRupiah(r.biayaBahan)}` },
        ...(r.biayaPlatform > 0 ? [{ label: "Biaya platform", nilai: `-${formatRupiah(r.biayaPlatform)}` }] : []),
        { label: "Biaya bulanan", nilai: `-${formatRupiah(r.biayaOperasionalBulanan)}` },
        { label: "Laba bersih", nilai: formatRupiah(r.labaBersihBulanan), tebal: true },
      ],
      skenario: {
        kolom: ["", ...skenario.map((h) => (h.id === "normal" ? "Normal" : `${NAMA_SKENARIO[h.id]} (${h.persen}%)`))],
        baris: [
          { label: `Terjual per hari (${u})`, nilai: skenario.map((h) => formatRibuan(h.targetHarian)) },
          { label: "Penjualan per bulan", nilai: skenario.map((h) => formatRupiah(h.penjualanBulanan)) },
          { label: "Laba bersih per bulan", nilai: skenario.map((h) => formatRupiah(h.labaBersihBulanan)) },
          { label: "Balik modal", nilai: skenario.map((h) => (h.balikModalBulan === null ? "Belum" : h.totalModalAwal === 0 ? "-" : formatBulan(h.balikModalBulan).replace(/^sekitar /, "± ").replace(/ \(.*\)$/, ""))) },
        ],
        catatan: "Persen dihitung dari target terjual per hari. Modal awal sama di ketiga skenario.",
      },
      isian,
      catatan,
      kodeSeri: akses?.label ?? "",
    };
  }

  // ---------- Render dari halaman ----------
  function render(): void {
    if (!akses) return;
    renderSkenario();
    renderDaftar();
  }

  // Mulai: kode dari tautan (sekali), lalu kode yang tersimpan di perangkat.
  const dariTautan = baca(KEY_TAUTAN, "session");
  const tersimpan = baca(KEY_AKSES);
  const siap = (async () => {
    if (dariTautan) {
      tulis(KEY_TAUTAN, null, "session");
      if (await aktifkan(dariTautan, "tautan")) return;
    }
    if (tersimpan) await aktifkan(tersimpan, "tersimpan");
  })().then(render);

  return {
    /** Panggil setiap kali hasil digambar ulang. */
    render,
    /** "Mulai dari awal": usaha yang dibuka tidak lagi ditimpa saat menyimpan. */
    lupakanAktif(): void {
      aktifId = null;
      if (akses) renderDaftar();
    },
    /** "Hapus data saya": hapus juga usaha tersimpan dan pengaturan skenario (kode akses tetap). */
    hapusData(): void {
      tulis(KEY_DAFTAR, null);
      tulis(KEY_SKENARIO, null);
      aktifId = null;
      persen = { ...SKENARIO_DEFAULT };
      inputSepi.value = String(persen.sepi);
      inputRamai.value = String(persen.ramai);
      render();
    },
    siap,
  };
}
