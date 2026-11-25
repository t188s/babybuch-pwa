// Babybuch PWA · Bericht · „naive“ Uhrzeiten wie Pythons datetime ohne Zeitzone
//
// Der Bericht der Pi-Version rechnet mit Wanduhrzeit (ein Tag = immer 24 h, auch bei der Zeitumstellung).
// Damit die Grafiken gleich werden, stellen wir jede Ortszeit als UTC-Zeitpunkt dar und rechnen dort.

const zwei = n => String(n).padStart(2, "0");
export const STUNDE = 3600e3, TAG = 864e5;

/** "2026-11-20" oder "2026-11-20T14:30" → naive Zeit */
export function N(text) {
  const [d, u = "00:00"] = text.slice(0, 16).split("T");
  const [j, m, t] = d.split("-").map(Number), [h, mi] = u.split(":").map(Number);
  return new Date(Date.UTC(j, m - 1, t, h, mi));
}
/** datetime.now() – Ortszeit als naive Zeit (mit Sekunden) */
export function jetzt() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}
export const heute = () => tagText(jetzt());
export const tagText = d => `${d.getUTCFullYear()}-${zwei(d.getUTCMonth() + 1)}-${zwei(d.getUTCDate())}`;
export const zeitText = d => `${tagText(d)}T${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}`;
export const plus = (d, ms) => new Date(d.getTime() + ms);
export const plusTage = (text, n) => tagText(plus(N(text), n * TAG));
export const tageZwischen = (a, b) => Math.round((N(a) - N(b)) / TAG);
/** Montag = 0 wie date.weekday() */
export const wochentag = d => (d.getUTCDay() + 6) % 7;
/** date.isocalendar() → [Jahr, Woche] */
export function isoWoche(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 3 - wochentag(t));                 // Donnerstag dieser Woche
  const jahr = t.getUTCFullYear(), erster = new Date(Date.UTC(jahr, 0, 4));
  return [jahr, 1 + Math.round((t - erster) / TAG / 7 - (3 - wochentag(erster)) / 7)];
}
