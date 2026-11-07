// Pembantu event Meta Pixel untuk halaman yang memasang <MetaPixel />.
// Aturan: kirim nama event saja. Parameter hanya boleh berisi nilai tetap
// milik situs (misalnya varian harga), JANGAN isian atau hasil hitung pengunjung.

type Fbq = (...args: unknown[]) => void;

export function trackCustomEvent(
  eventName: string,
  params?: Record<string, string>,
): void {
  const fbq = (window as Window & { fbq?: Fbq }).fbq;
  if (!fbq) return;
  if (params) fbq("trackCustom", eventName, params);
  else fbq("trackCustom", eventName);
}
