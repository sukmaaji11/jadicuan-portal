// Tampilan impor CSV bersama (Kalkulator Untung Seller dan Kalkulator Harga Pesan Antar):
// unduh template, pilih/seret file, pencocokan kolom manual bila header tidak dikenali, dan daftar
// baris yang perlu diperbaiki. File dibaca di perangkat (FileReader + Web Worker csv-worker.ts);
// tidak ada yang diunggah ke server.
import { pecahCsv } from "./seller-csv";
import { el } from "./seller-tampil";

export type HasilImporUmum<T> = {
  produk: T[];
  barisProduk: number[];
  error: Array<{ baris: number; alasan: string[] }>;
  totalBaris: number;
  dipotongBatas: number;
};

export type DefinisiImpor<K extends string, T> = {
  kalkulator: "seller" | "food"; // pilih fungsi baca di worker
  judul: string;
  deskripsi: string;
  satuan: string; // "produk" / "menu"
  kolomWajib: K[];
  label: Record<K, string>;
  template: () => string;
  namaTemplate: string;
  batas: number | null; // FREE_ROW_LIMIT
  maksMb: number;
  petakan: (header: string[]) => { pemetaan: Record<K, number>; hilang: K[] };
  impor: (rows: string[][], pemetaan: Record<K, number>, batas: number | null) => HasilImporUmum<T>;
  idInput: string;
  idHasil: string; // bagian hasil yang dituju setelah impor
};

type Keluar<K extends string, T> =
  | { jenis: "hasil"; hasil: HasilImporUmum<T> }
  | { jenis: "butuh-pemetaan"; header: string[]; contoh: string[][]; pemetaan: Record<K, number>; hilang: K[] }
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

export function pasangImporCsv<K extends string, T>(
  root: HTMLElement,
  def: DefinisiImpor<K, T>,
  opsi: { onHasil: (h: HasilImporUmum<T>) => void },
): void {
  // ---------- Kerangka ----------
  const intro = el("div", "", "seller-import-intro");
  intro.append(el("h2", def.judul), el("p", def.deskripsi));
  const tombolTemplate = el("button", "Unduh template CSV", "button button-secondary");
  tombolTemplate.type = "button";
  tombolTemplate.addEventListener("click", () => unduhTeks(def.namaTemplate, def.template(), "text/csv;charset=utf-8"));

  const drop = el("label", "", "seller-drop");
  const input = el("input");
  input.type = "file";
  input.accept = ".csv,text/csv,text/plain";
  input.className = "sr-only";
  input.id = def.idInput;
  drop.htmlFor = def.idInput;
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
    worker = new Worker(new URL("./csv-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<Keluar<K, T>>) => terima(e.data);
    worker.onerror = () => {
      worker = null;
    };
  } catch {
    worker = null;
  }
  type Pesan = { jenis: "baca"; teks: string } | { jenis: "petakan"; pemetaan: Record<K, number> };
  function kirim(m: Pesan): void {
    if (worker) {
      worker.postMessage({ ...m, kalkulator: def.kalkulator, batas: def.batas });
      return;
    }
    window.setTimeout(() => {
      try {
        if (m.jenis === "baca") {
          rowsCadangan = pecahCsv(m.teks);
          if (rowsCadangan.length < 2) return terima({ jenis: "kosong" });
          const { pemetaan, hilang } = def.petakan(rowsCadangan[0]);
          if (hilang.length) return terima({ jenis: "butuh-pemetaan", header: rowsCadangan[0], contoh: rowsCadangan.slice(1, 4), pemetaan, hilang });
          terima({ jenis: "hasil", hasil: def.impor(rowsCadangan, pemetaan, def.batas) });
        } else terima({ jenis: "hasil", hasil: def.impor(rowsCadangan, m.pemetaan, def.batas) });
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
    if (file.size > def.maksMb * 1024 * 1024) {
      status.textContent = `File terlalu besar (lebih dari ${def.maksMb} MB). Pecah menjadi beberapa file.`;
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
    reader.onload = () => kirim({ jenis: "baca", teks: String(reader.result ?? "") });
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

  // ---------- Hasil ----------
  function terima(m: Keluar<K, T>): void {
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
    opsi.onHasil(h);
    const bagian = [`${h.produk.length} ${def.satuan} dari ${namaFile} sudah dihitung.`];
    if (h.error.length) bagian.push(`${h.error.length} baris perlu diperbaiki (lihat daftar di bawah); baris lain tetap dihitung.`);
    if (h.dipotongBatas > 0) bagian.push(`${h.dipotongBatas} baris terakhir belum diproses karena batas ${def.batas} baris.`);
    status.textContent = bagian.join(" ");
    status.classList.toggle("is-error", h.produk.length === 0);
    tampilError(h);
    if (h.produk.length) document.getElementById(def.idHasil)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function tampilError(h: HasilImporUmum<T>): void {
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

  function tampilPemetaan(header: string[], contoh: string[][], tebakan: Record<K, number>, hilang: K[]): void {
    status.textContent = "";
    peta.hidden = false;
    peta.replaceChildren(
      el("h3", "Cocokkan kolom file dengan isian kalkulator"),
      el("p", `Beberapa judul kolom tidak kami kenali (${hilang.map((k) => def.label[k]).join(", ")}). Pilih kolom file yang sesuai. Kolom opsional boleh dibiarkan "Tidak ada".`),
    );
    const grid = el("div", "", "seller-mapping-grid");
    const pilihan = new Map<K, HTMLSelectElement>();
    const urutan = [...def.kolomWajib, ...(Object.keys(def.label) as K[]).filter((k) => !def.kolomWajib.includes(k))];
    for (const k of urutan) {
      const wrap = el("label", "", "seller-filter");
      wrap.append(el("span", `${def.label[k]}${def.kolomWajib.includes(k) ? " (wajib)" : ""}`));
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
      const pemetaan = Object.fromEntries([...pilihan].map(([k, s]) => [k, Number(s.value)])) as Record<K, number>;
      const kurang = def.kolomWajib.filter((k) => pemetaan[k] < 0);
      if (kurang.length) {
        pesan.textContent = `Pilih kolom untuk: ${kurang.map((k) => def.label[k]).join(", ")}.`;
        return;
      }
      pesan.textContent = "";
      status.textContent = "Menghitung…";
      kirim({ jenis: "petakan", pemetaan });
    });
    peta.append(grid, pesan, pakai);
    peta.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}
