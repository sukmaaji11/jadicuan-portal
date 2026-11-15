// Tab "Impor CSV": unduh template, pilih/seret file, pencocokan kolom manual bila header tidak
// dikenali, dan daftar baris yang perlu diperbaiki. File dibaca di perangkat (FileReader +
// Web Worker); tidak ada yang diunggah ke server.
import { FREE_ROW_LIMIT, MAKS_UKURAN_MB } from "../config/kalkulator-seller";
import {
  KOLOM_WAJIB,
  LABEL_KOLOM,
  buatTemplateCsv,
  impor,
  pecahCsv,
  petakanHeader,
  type HasilImpor,
  type Kolom,
  type Pemetaan,
} from "./seller-csv";
import { el } from "./seller-tampil";
import type { KonteksSeller } from "./seller-ui";

type Keluar =
  | { jenis: "hasil"; hasil: HasilImpor }
  | { jenis: "butuh-pemetaan"; header: string[]; contoh: string[][]; pemetaan: Pemetaan; hilang: Kolom[] }
  | { jenis: "kosong" }
  | { jenis: "gagal"; pesan: string };

export function unduhTeks(nama: string, isi: BlobPart, tipe: string): void {
  const url = URL.createObjectURL(new Blob([isi], { type: tipe }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function pasangImpor(ctx: KonteksSeller, opsi: { onImpor?: (jumlahBaris: number) => void } = {}): void {
  const root = document.getElementById("csv-root")!;

  // ---------- Kerangka ----------
  const intro = el("div", "", "seller-import-intro");
  intro.append(
    el("h2", "Hitung banyak produk sekaligus"),
    el("p", "Unggah file CSV dari Excel atau Google Sheets. Kolom wajib: nama_produk, harga_jual, hpp, marketplace, kategori. Kolom lain boleh kosong dan akan memakai nilai di Pengaturan."),
  );
  const tombolTemplate = el("button", "Unduh template CSV", "button button-secondary");
  tombolTemplate.type = "button";
  tombolTemplate.addEventListener("click", () => unduhTeks("template-kalkulator-untung-seller.csv", buatTemplateCsv(), "text/csv;charset=utf-8"));

  const drop = el("label", "", "seller-drop");
  const input = el("input");
  input.type = "file";
  input.accept = ".csv,text/csv,text/plain";
  input.className = "sr-only";
  input.id = "csv-file";
  drop.htmlFor = "csv-file";
  drop.append(input, el("strong", "Pilih file CSV"), el("span", "atau seret file ke sini"));
  const privasi = el("p", "File dibaca di perangkatmu dan tidak diunggah ke server mana pun.", "seller-import-privacy");
  const status = el("p", "", "seller-import-status");
  status.setAttribute("role", "status");
  const peta = el("div", "", "seller-mapping");
  peta.hidden = true;
  const daftarError = el("div", "", "seller-errors");
  daftarError.hidden = true;
  const aksi = el("div", "", "seller-import-actions");
  aksi.append(tombolTemplate);
  root.append(intro, aksi, drop, privasi, status, peta, daftarError);

  // ---------- Worker (cadangan: proses di halaman bila worker tidak tersedia) ----------
  let worker: Worker | null = null;
  let rowsCadangan: string[][] = [];
  try {
    worker = new Worker(new URL("./seller-csv-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<Keluar>) => terima(e.data);
    worker.onerror = () => {
      worker = null;
    };
  } catch {
    worker = null;
  }
  function kirim(m: { jenis: "baca"; teks: string; batas: number | null } | { jenis: "petakan"; pemetaan: Pemetaan; batas: number | null }): void {
    if (worker) {
      worker.postMessage(m);
      return;
    }
    // Cadangan tanpa worker.
    window.setTimeout(() => {
      try {
        if (m.jenis === "baca") {
          rowsCadangan = pecahCsv(m.teks);
          if (rowsCadangan.length < 2) return terima({ jenis: "kosong" });
          const { pemetaan, hilang } = petakanHeader(rowsCadangan[0]);
          if (hilang.length) return terima({ jenis: "butuh-pemetaan", header: rowsCadangan[0], contoh: rowsCadangan.slice(1, 4), pemetaan, hilang });
          terima({ jenis: "hasil", hasil: impor(rowsCadangan, pemetaan, m.batas) });
        } else terima({ jenis: "hasil", hasil: impor(rowsCadangan, m.pemetaan, m.batas) });
      } catch (err) {
        terima({ jenis: "gagal", pesan: String(err) });
      }
    }, 0);
  }

  let namaFile = "";
  function baca(file: File): void {
    peta.hidden = true;
    daftarError.hidden = true;
    status.classList.remove("is-error");
    if (file.size > MAKS_UKURAN_MB * 1024 * 1024) {
      status.textContent = `File terlalu besar (lebih dari ${MAKS_UKURAN_MB} MB). Pecah menjadi beberapa file.`;
      status.classList.add("is-error");
      return;
    }
    if (/\.xlsx?$/i.test(file.name)) {
      status.textContent = "Ini file Excel. Simpan dulu sebagai CSV (File → Simpan sebagai → CSV), lalu unggah lagi.";
      status.classList.add("is-error");
      return;
    }
    namaFile = file.name;
    status.textContent = `Membaca ${file.name}…`;
    const reader = new FileReader();
    reader.onload = () => kirim({ jenis: "baca", teks: String(reader.result ?? ""), batas: FREE_ROW_LIMIT });
    reader.onerror = () => {
      status.textContent = "File tidak bisa dibaca. Coba simpan ulang sebagai CSV.";
      status.classList.add("is-error");
    };
    reader.readAsText(file, "utf-8");
  }
  input.addEventListener("change", () => {
    if (input.files?.[0]) baca(input.files[0]);
    input.value = "";
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("is-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("is-over");
    const f = e.dataTransfer?.files?.[0];
    if (f) baca(f);
  });

  // ---------- Hasil dari worker ----------
  function terima(m: Keluar): void {
    if (m.jenis === "kosong") {
      status.textContent = "File kosong atau hanya berisi judul kolom.";
      status.classList.add("is-error");
      return;
    }
    if (m.jenis === "gagal") {
      status.textContent = "File tidak bisa diproses. Pastikan formatnya CSV.";
      status.classList.add("is-error");
      return;
    }
    if (m.jenis === "butuh-pemetaan") {
      tampilPemetaan(m.header, m.contoh, m.pemetaan, m.hilang);
      return;
    }
    const h = m.hasil;
    peta.hidden = true;
    ctx.hapusSumber("csv");
    ctx.tambah(h.produk, "csv", h.barisProduk);
    const bagian = [`${h.produk.length} produk dari ${namaFile} sudah dihitung.`];
    if (h.error.length) bagian.push(`${h.error.length} baris perlu diperbaiki (lihat daftar di bawah); baris lain tetap dihitung.`);
    if (h.dipotongBatas > 0) bagian.push(`${h.dipotongBatas} baris terakhir belum diproses karena batas ${FREE_ROW_LIMIT} baris.`);
    status.textContent = bagian.join(" ");
    status.classList.toggle("is-error", h.produk.length === 0);
    tampilError(h);
    opsi.onImpor?.(h.totalBaris);
    if (h.produk.length) document.getElementById("seller-results")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function tampilError(h: HasilImpor): void {
    daftarError.replaceChildren();
    daftarError.hidden = h.error.length === 0;
    if (!h.error.length) return;
    const det = el("details", "", "modal-advanced");
    det.open = h.error.length <= 10;
    det.append(el("summary", `${h.error.length} baris perlu diperbaiki`));
    const ul = el("ul", "", "seller-error-list");
    for (const e of h.error.slice(0, 200)) {
      const li = el("li");
      li.append(el("strong", `Baris ${e.baris}: `), document.createTextNode(e.alasan.join(" ")));
      ul.append(li);
    }
    det.append(ul);
    if (h.error.length > 200) det.append(el("p", `Dan ${h.error.length - 200} baris lainnya.`, "seller-settings-note"));
    daftarError.append(det);
  }

  function tampilPemetaan(header: string[], contoh: string[][], tebakan: Pemetaan, hilang: Kolom[]): void {
    status.textContent = "";
    peta.hidden = false;
    peta.replaceChildren(
      el("h3", "Cocokkan kolom file dengan isian kalkulator"),
      el("p", `Beberapa judul kolom tidak kami kenali (${hilang.map((k) => LABEL_KOLOM[k]).join(", ")}). Pilih kolom file yang sesuai. Kolom opsional boleh dibiarkan "Tidak ada".`),
    );
    const grid = el("div", "", "seller-mapping-grid");
    const pilihan = new Map<Kolom, HTMLSelectElement>();
    const urutan = [...KOLOM_WAJIB, ...(Object.keys(LABEL_KOLOM) as Kolom[]).filter((k) => !KOLOM_WAJIB.includes(k))];
    for (const k of urutan) {
      const wrap = el("label", "", "seller-filter");
      wrap.append(el("span", `${LABEL_KOLOM[k]}${KOLOM_WAJIB.includes(k) ? " (wajib)" : ""}`));
      const s = el("select", "", "modal-select");
      const kosong = el("option", "Tidak ada");
      kosong.value = "-1";
      s.append(kosong);
      header.forEach((h, i) => {
        const o = el("option", `${h || `Kolom ${i + 1}`}${contoh[0]?.[i] ? ` (mis. ${contoh[0][i].slice(0, 20)})` : ""}`);
        o.value = String(i);
        s.append(o);
      });
      s.value = String(tebakan[k] ?? -1);
      wrap.append(s);
      grid.append(wrap);
      pilihan.set(k, s);
    }
    const pesan = el("p", "", "seller-import-status is-error");
    pesan.setAttribute("role", "status");
    const pakai = el("button", "Pakai pencocokan ini", "button button-primary");
    pakai.type = "button";
    pakai.addEventListener("click", () => {
      const pemetaan = Object.fromEntries([...pilihan].map(([k, s]) => [k, Number(s.value)])) as Pemetaan;
      const kurang = KOLOM_WAJIB.filter((k) => pemetaan[k] < 0);
      if (kurang.length) {
        pesan.textContent = `Pilih kolom untuk: ${kurang.map((k) => LABEL_KOLOM[k]).join(", ")}.`;
        return;
      }
      pesan.textContent = "";
      status.textContent = "Menghitung…";
      kirim({ jenis: "petakan", pemetaan, batas: FREE_ROW_LIMIT });
    });
    peta.append(grid, pesan, pakai);
    peta.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}
