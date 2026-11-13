// Bangun admin.html (satu file, bisa dibuka offline dengan klik dua kali) dari
// admin.template.html + core.mjs + kunci publik di src/config/kalkulator-modal.ts.
//   node tools/akses-kalkulator-modal/build-admin.mjs
// Uji src/lib/akses-kode.test.mjs gagal bila admin.html tertinggal dari sumbernya.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "..", "..");

export function bangunAdmin() {
  const template = fs.readFileSync(path.join(DIR, "admin.template.html"), "utf8");
  const core = fs.readFileSync(path.join(DIR, "core.mjs"), "utf8").replace(/^export /gm, "");
  const config = fs.readFileSync(path.join(ROOT, "src", "config", "kalkulator-modal.ts"), "utf8");
  const m = /KUNCI_PUBLIK_AKSES = \{\s*x: "([^"]+)",\s*y: "([^"]+)",?\s*\}/.exec(config);
  if (!m) throw new Error("KUNCI_PUBLIK_AKSES tidak ditemukan di src/config/kalkulator-modal.ts");
  return template.replace("/*__CORE__*/", () => core).replace("/*__PUBLIK__*/", () => JSON.stringify({ x: m[1], y: m[2] }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(path.join(DIR, "admin.html"), bangunAdmin());
  console.log("admin.html diperbarui.");
}
