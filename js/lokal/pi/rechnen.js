// Babybuch PWA · Lokaler Pi · Rechnen wie app.py der Pi-Version 3.0.2 (für CSV und Bericht)
//
// Eins zu eins übertragen, inklusive der Python-Eigenheiten, damit die Dateien gleich aussehen:
//   round()  → Banker's Rounding (pyRound) · f"{x:.1f}" → pyFixed · erf() → genaue Näherung

import { WHO_LMS, WHO_LAENGE } from "./who.js";

export const MAHLZEIT_LUECKE = 5;
export const SEITEN_NAMEN = { L: "Links", R: "Rechts", B: "Beide" };
export const SYMPTOM_ARTEN = { erbricht: "spuckt/erbricht", durchfall: "Durchfall", trinkt: "trinkt schlecht", schlapp: "schlapp",
  husten: "Husten/Schnupfen", ausschlag: "Ausschlag", atmung: "atmet schwer", notiz: "Notiz" };

const zwei = n => String(n).padStart(2, "0");

/** Python round(x): bei genau ,5 zur geraden Zahl. */
export function pyRound(x, stellen = 0) {
  const f = 10 ** stellen, y = x * f, unten = Math.floor(y), rest = y - unten;
  let r;
  if (Math.abs(rest - 0.5) < 1e-9 && Number.isInteger(x * f * 2)) r = unten % 2 === 0 ? unten : unten + 1;
  else r = Math.round(y);
  return r / f;
}
/** Python f"{x:.Nf}" – rundet den exakten Binärwert, bei echtem Gleichstand zur geraden Ziffer. */
export function pyFixed(x, stellen = 1) {
  const f = 10 ** stellen, y = x * f;
  if (Number.isInteger(y * 2) && !Number.isInteger(y)) {           // exakter Gleichstand (z. B. 37.25)
    const unten = Math.floor(y), n = unten % 2 === 0 ? unten : unten + 1;
    return (n / f).toFixed(stellen);
  }
  return x.toFixed(stellen);
}
export const komma = (zahl, stellen = 1) => pyFixed(zahl, stellen).replace(".", ",");
export const prozentText = p => `${p >= 0 ? "+" : "-"}${pyFixed(Math.abs(p), 1)} %`.replace(".", ",").replace("-", "−");
export const datumDe = t => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;
export const hm = minuten => (minuten ? `${Math.floor(minuten / 60)}:${zwei(minuten % 60)}` : "–");
/** Python f"{cm:g}" mit Komma: 52 → "52", 52.5 → "52,5" */
export const cmText = cm => String(Number(cm.toPrecision(6))).replace(".", ",");
export const csvSicher = text => (text && "=+-@".includes(text[0]) ? "'" + text : text || "");

export function alsZeit(text) {
  const [d, u = "00:00"] = text.slice(0, 16).split("T");
  const [j, m, t] = d.split("-").map(Number), [h, mi] = u.split(":").map(Number);
  return new Date(j, m - 1, t, h, mi);
}
export const zeitText = d => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
export const uhrText = d => `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
export const endeVon = (start, dauer) => new Date(alsZeit(start).getTime() + dauer * 60000);

export function istNacht(startText, e) {
  const stunde = Number(startText.slice(11, 13)), von = e.nacht_von, bis = e.nacht_bis;
  return von > bis ? (stunde >= von || stunde < bis) : (von <= stunde && stunde < bis);
}

/** app.py mahlzeiten_markieren: Fortsetzung (Seitenwechsel ≤ 5 Min) und Abstand Beginn→Beginn. Erwartet sortierte Liste. */
export function mahlzeitenMarkieren(zeilen) {
  let mahlzeitStart = null, letztesEnde = null;
  for (const z of zeilen) {
    const start = alsZeit(z.start).getTime() / 1000;
    z.fortsetzung = Boolean(letztesEnde !== null && start - letztesEnde <= MAHLZEIT_LUECKE * 60 && start >= mahlzeitStart);
    z.pause = null;
    if (!z.fortsetzung) {
      if (mahlzeitStart !== null) z.pause = Math.floor((start - mahlzeitStart) / 60);
      mahlzeitStart = start;
    }
    const ende = start + z.dauer * 60;
    letztesEnde = letztesEnde !== null ? Math.max(letztesEnde, ende) : ende;
  }
  return zeilen;
}

// ── WHO ──
/** Fehlerfunktion, Genauigkeit ~1e-15 (W. J. Cody / Numerical Recipes erfc mit Tschebyschow-Reihe). */
export function erf(x) {
  const z = Math.abs(x), t = 2 / (2 + z), ty = 4 * t - 2;
  const c = [-1.3026537197817094, 6.4196979235649026e-1, 1.9476473204185836e-2, -9.561514786808631e-3, -9.46595344482036e-4,
    3.66839497852761e-4, 4.2523324806907e-5, -2.0278578112534e-5, -1.624290004647e-6, 1.303655835580e-6, 1.5626441722e-8,
    -8.5238095915e-8, 6.529054439e-9, 5.059343495e-9, -9.91364156e-10, -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
    -6.886027e-12, 8.94487e-13, 3.13092e-13, -1.12708e-13, 3.81e-16, 7.106e-15, -1.523e-15, -9.4e-17, 1.21e-16, -2.8e-17];
  let d = 0, dd = 0;
  for (let j = c.length - 1; j > 0; j--) { const tmp = d; d = ty * d - dd + c[j]; dd = tmp; }
  const erfc = t * Math.exp(-z * z + 0.5 * (c[0] + ty * d) - dd);
  return x >= 0 ? 1 - erfc : erfc - 1;
}
export function whoLms(alter, geschlecht, tabellen = WHO_LMS) {
  const tab = tabellen[geschlecht];
  if (!tab || alter < 0 || alter > tab[tab.length - 1][0]) return null;
  for (let i = 0; i < tab.length - 1; i++) {
    const [a0, ...w0] = tab[i], [a1, ...w1] = tab[i + 1];
    if (alter <= a1) { const f = (alter - a0) / (a1 - a0); return w0.map((x0, k) => x0 + f * (w1[k] - x0)); }
  }
  return null;
}
const perzentilAusZ = z => Math.min(99, Math.max(1, pyRound(0.5 * (1 + erf(z / Math.SQRT2)) * 100)));
export function whoPerzentil(gramm, alter, geschlecht) {
  const lms = whoLms(alter, geschlecht); if (!lms) return null;
  const [L, M, S] = lms; return perzentilAusZ(((gramm / 1000 / M) ** L - 1) / (L * S));
}
export function whoPerzentilCm(cm, alter, geschlecht) {
  const lms = whoLms(alter, geschlecht, WHO_LAENGE); if (!lms) return null;
  const [L, M, S] = lms; return perzentilAusZ(((cm / M) ** L - 1) / (L * S));
}
export function whoCm(alter, geschlecht, z) { const [L, M, S] = whoLms(alter, geschlecht, WHO_LAENGE); return M * (1 + L * S * z) ** (1 / L); }
export function whoGramm(alter, geschlecht, z) { const [L, M, S] = whoLms(alter, geschlecht); return M * (1 + L * S * z) ** (1 / L) * 1000; }

const tageZwischen = (a, b) => Math.round((alsZeit(a) - alsZeit(b)) / 864e5);
/** app.py gewichte_auswerten: Alter, ±% zum Geburtsgewicht, Perzentile. liste = Zeilen {id, datum, gramm}, sortiert. */
export function gewichteAuswerten(e, liste) {
  return liste.map(w0 => {
    const w = { id: w0.id, datum: w0.datum, gramm: w0.gramm };
    w.alter = e.geburtsdatum ? tageZwischen(w.datum, e.geburtsdatum) : null;
    if (e.geburtsgewicht) w.prozent = (w.gramm - e.geburtsgewicht) / e.geburtsgewicht * 100;
    if (e.geburtsdatum && e.geschlecht && w.alter !== null) w.perzentil = whoPerzentil(w.gramm, w.alter, e.geschlecht);
    return w;
  });
}
export function groessenAuswerten(e, liste) {
  return liste.map(g0 => {
    const g = { id: g0.id, datum: g0.datum, cm: g0.cm };
    g.alter = e.geburtsdatum ? tageZwischen(g.datum, e.geburtsdatum) : null;
    if (e.geburtsdatum && e.geschlecht && g.alter !== null) g.perzentil = whoPerzentilCm(g.cm, g.alter, e.geschlecht);
    return g;
  });
}

/** app.py zeitraum_aus_anfrage – von/bis als Tag oder Zeitpunkt; null = ungültig. */
export function zeitraumAus(von, bis, pflicht = true) {
  if (!von && !bis && !pflicht) return { von: "", bis: "", von_q: "", bis_q: "9999", tage: [], titel: "alle" };
  const gueltig = t => /^\d{4}-\d{2}-\d{2}$/.test(t) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t);
  if (!(gueltig(von) && gueltig(bis)) || von > bis) return null;
  const erster = alsZeit(von.slice(0, 10)), letzter = alsZeit(bis.slice(0, 10));
  const n = Math.round((letzter - erster) / 864e5);
  if (n > 800) return null;
  const tage = [];
  for (let i = 0; i <= n; i++) { const d = new Date(erster); d.setDate(d.getDate() + i); tage.push(zeitText(d).slice(0, 10)); }
  const mitZeit = t => (t.includes("T") ? `${datumDe(t)}, ${t.slice(11, 16)} Uhr` : datumDe(t));
  return { von, bis, von_q: von, bis_q: bis + (bis.includes("T") ? "Z" : "T99"), tage, titel: `${mitZeit(von)} – ${mitZeit(bis)}`, stunden: von.includes("T") };
}
