#!/usr/bin/env node
// Alat Owner untuk kode akses Versi lengkap Kalkulator Modal (OFFLINE, jangan diunggah).
//
//   node tools/akses-kalkulator-modal/admin.mjs init                  buat kunci (sekali saja)
//   node tools/akses-kalkulator-modal/admin.mjs buat --nama "Bu Ani" --catatan "Scalev #1234"
//   node tools/akses-kalkulator-modal/admin.mjs buat --jumlah 5        beberapa kode sekaligus
//   node tools/akses-kalkulator-modal/admin.mjs riwayat                daftar kode yang pernah dibuat
//
// Kunci rahasia: %USERPROFILE%\Documents\JadiCuanAdmin\kalkulator-modal-kunci-rahasia.json
// (ubah dengan JADICUAN_KM_KEY_FILE). Riwayat: riwayat-kode-kalkulator-modal.csv di folder yang sama.
// Cara termudah tanpa terminal: buka admin.html (klik dua kali).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { bacaKunci, buatKode, buatPasanganKunci, formatKode, pesanWhatsApp } from "./core.mjs";

const KEY_FILE = process.env.JADICUAN_KM_KEY_FILE ?? path.join(os.homedir(), "Documents", "JadiCuanAdmin", "kalkulator-modal-kunci-rahasia.json");
const RIWAYAT = path.join(path.dirname(KEY_FILE), "riwayat-kode-kalkulator-modal.csv");

const [cmd, ...rest] = process.argv.slice(2);
const opt = (name, def = "") => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] !== undefined ? rest[i + 1] : def;
};
const csv = (s) => `"${String(s).replace(/"/g, '""')}"`;

if (cmd === "init") {
  if (fs.existsSync(KEY_FILE)) {
    console.error(`Kunci sudah ada: ${KEY_FILE}\nTidak ditimpa. Kunci baru membuat semua kode lama tidak berlaku.`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  const k = await buatPasanganKunci();
  fs.writeFileSync(KEY_FILE, JSON.stringify(k, null, 2), { mode: 0o600 });
  console.log(`Kunci rahasia dibuat: ${KEY_FILE}`);
  console.log("CADANGKAN file ini di dua tempat aman. Jangan di-commit, jangan dikirim lewat chat.\n");
  console.log("Tempel kunci PUBLIK ini ke src/config/kalkulator-modal.ts (KUNCI_PUBLIK_AKSES):");
  console.log(JSON.stringify(k.publik, null, 2));
} else if (cmd === "buat") {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`Kunci belum ada di ${KEY_FILE}. Jalankan "init" dulu, atau set JADICUAN_KM_KEY_FILE.`);
    process.exit(1);
  }
  const kunci = await bacaKunci(fs.readFileSync(KEY_FILE, "utf8"));
  const jumlah = Math.max(1, Math.min(100, Number(opt("jumlah", "1")) || 1));
  const nama = opt("nama");
  const catatan = opt("catatan");
  if (!fs.existsSync(RIWAYAT)) fs.writeFileSync(RIWAYAT, "﻿nomor_seri,tanggal,nama,catatan,kode,tautan\n");
  for (let i = 0; i < jumlah; i++) {
    const h = await buatKode(kunci);
    fs.appendFileSync(RIWAYAT, [h.label, h.tanggal, nama, catatan, h.kode, h.tautan].map(csv).join(",") + "\n");
    console.log(`\n=== ${h.label} (${h.tanggal}) ===`);
    console.log(`Kode  : ${formatKode(h.kode)}`);
    console.log(`Tautan: ${h.tautan}`);
    console.log("\n--- Pesan WhatsApp ---\n" + pesanWhatsApp(h, nama));
  }
  console.log(`\nRiwayat: ${RIWAYAT}`);
} else if (cmd === "riwayat") {
  console.log(fs.existsSync(RIWAYAT) ? fs.readFileSync(RIWAYAT, "utf8") : "Belum ada kode yang dibuat.");
} else {
  console.log("Perintah: init | buat [--nama X] [--catatan X] [--jumlah N] | riwayat");
  process.exit(cmd ? 1 : 0);
}
