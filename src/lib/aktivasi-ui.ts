// Halaman aktivasi Versi Lengkap Kalkulator Modal: tempel kode -> periksa (kunci publik, di browser)
// -> simpan di localStorage dengan kunci yang sama dengan kalkulator -> tampilkan "Mulai hitung".
// Tautan lama (#kode=...) tetap didukung: kode diisi dan diperiksa otomatis.
import { KUNCI_PUBLIK_AKSES, KUNCI_SIMPAN_AKSES, SERIAL_DIBLOKIR } from "../config/kalkulator-modal";
import { PESAN_GAGAL, periksaKode, type InfoAkses } from "./akses-kode";

function baca(): string | null {
  try {
    return window.localStorage.getItem(KUNCI_SIMPAN_AKSES);
  } catch {
    return null;
  }
}
function tulis(v: string | null): boolean {
  try {
    if (v === null) window.localStorage.removeItem(KUNCI_SIMPAN_AKSES);
    else window.localStorage.setItem(KUNCI_SIMPAN_AKSES, v);
    return true;
  } catch {
    return false;
  }
}
const KUNCI_KODE_TAUTAN = "jadicuan:kalkulator-modal:kode-tautan";
const $ = (id: string) => document.getElementById(id)!;

export function pasangAktivasi(): void {
  const sudah = $("aktivasi-sudah");
  const form = $("aktivasi-form");
  const isian = $("aktivasi-kode") as HTMLTextAreaElement;
  const status = $("aktivasi-status");
  const tombol = $("aktivasi-tombol") as HTMLButtonElement;

  function tampilAktif(info: InfoAkses, fokus: boolean): void {
    $("aktivasi-seri").textContent = info.label;
    sudah.hidden = false;
    form.hidden = true;
    if (fokus) $("aktivasi-sudah-title").focus();
  }

  async function aktifkan(teks: string, fokus: boolean): Promise<void> {
    tombol.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Memeriksa kode…";
    const hasil = await periksaKode(teks, KUNCI_PUBLIK_AKSES, SERIAL_DIBLOKIR);
    tombol.disabled = false;
    if (!hasil.ok) {
      status.textContent = PESAN_GAGAL[hasil.alasan];
      status.classList.add("is-error");
      return;
    }
    status.textContent = tulis(hasil.info.kode)
      ? ""
      : "Kode benar, tapi browser ini tidak mengizinkan penyimpanan (mode penyamaran?). Versi lengkap hanya aktif selama halaman ini terbuka.";
    tampilAktif(hasil.info, fokus);
  }

  $("aktivasi-isi").addEventListener("submit", (e) => {
    e.preventDefault();
    void aktifkan(isian.value, true);
  });
  $("aktivasi-ganti").addEventListener("click", () => {
    sudah.hidden = true;
    form.hidden = false;
    isian.value = "";
    isian.focus();
  });

  // Tautan lama dengan #kode=...: skrip inline di halaman sudah memindahkan kodenya ke sessionStorage.
  let dariTautan: string | null = null;
  try {
    dariTautan = window.sessionStorage.getItem(KUNCI_KODE_TAUTAN);
    window.sessionStorage.removeItem(KUNCI_KODE_TAUTAN);
  } catch {
    /* abaikan */
  }
  if (dariTautan) {
    isian.value = dariTautan;
    void aktifkan(dariTautan, true);
    return;
  }
  // Sudah aktif sebelumnya di perangkat ini.
  const tersimpan = baca();
  if (tersimpan) {
    void periksaKode(tersimpan, KUNCI_PUBLIK_AKSES, SERIAL_DIBLOKIR).then((h) => {
      if (h.ok) tampilAktif(h.info, false);
      else tulis(null);
    });
  }
}
