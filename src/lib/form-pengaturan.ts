// Pembantu umum untuk panel Pengaturan kalkulator: kolom angka (Rp/%/angka), centang, pilihan,
// dan grup. Memakai kelas form portal (modal-field, modal-input-wrap). Teks lewat textContent.
import { bacaAngka } from "./seller";
import { el } from "./seller-tampil";
import { persenTeks, ribuan } from "./penyimpanan";

let urut = 0;
const idBaru = (awalan: string) => `${awalan}-${++urut}`;

export type OpsiKolom = {
  label: string;
  kind: "rupiah" | "persen" | "angka";
  nilai: number | null | undefined;
  placeholder?: string;
  hint?: string;
  tanda?: string; // mis. "Angka referensi, belum diverifikasi"
  sumber?: string[]; // link sumber
  simpan: (v: number | null) => void;
};

export function kolomAngka(o: OpsiKolom): HTMLElement {
  const wrap = el("div", "", "hpp-field modal-field");
  const id = idBaru("set");
  const row = el("div", "", "modal-label-row");
  const label = el("label", o.label);
  label.htmlFor = id;
  row.append(label);
  if (o.tanda) row.append(el("span", o.tanda, "seller-unverified"));
  const box = el("div", "", `modal-input-wrap${o.kind === "rupiah" ? " has-prefix" : ""}${o.kind === "persen" ? " has-suffix" : ""}`);
  if (o.kind === "rupiah") {
    const a = el("span", "Rp", "modal-affix modal-affix-start");
    a.setAttribute("aria-hidden", "true");
    box.append(a);
  }
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
  if (o.kind === "persen") {
    const a = el("span", "%", "modal-affix modal-affix-end");
    a.setAttribute("aria-hidden", "true");
    box.append(a);
  }
  wrap.append(row, box);
  if (o.hint || o.sumber?.length) {
    const hint = el("p", o.hint ?? "", "modal-hint");
    o.sumber?.forEach((url, i) => {
      const a = el("a", `sumber ${i + 1}`);
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      hint.append(i === 0 ? (o.hint ? " " : "") : ", ", a);
    });
    wrap.append(hint);
  }
  return wrap;
}

export function centang(label: string, nilai: boolean, simpan: (v: boolean) => void): HTMLElement {
  const l = el("label", "", "modal-check");
  const i = el("input");
  i.type = "checkbox";
  i.checked = nilai;
  i.addEventListener("change", () => simpan(i.checked));
  l.append(i, el("span", label));
  return l;
}

export function pilihan<T extends string>(label: string, opsi: Array<[T, string]>, nilai: T, simpan: (v: T) => void, tanda?: string): HTMLElement {
  const wrap = el("div", "", "hpp-field modal-field");
  const id = idBaru("pil");
  const row = el("div", "", "modal-label-row");
  const l = el("label", label);
  l.htmlFor = id;
  row.append(l);
  if (tanda) row.append(el("span", tanda, "seller-unverified"));
  const s = el("select", "", "modal-select");
  s.id = id;
  for (const [v, t] of opsi) {
    const o = el("option", t);
    o.value = v;
    s.append(o);
  }
  s.value = nilai;
  s.addEventListener("change", () => simpan(s.value as T));
  wrap.append(row, s);
  return wrap;
}

export function grup(judul: string, keterangan: string, ...isi: HTMLElement[]): HTMLElement {
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
}
