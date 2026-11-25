// Babybuch PWA · Kern · Fläschchen, Abpumpen, Beikost – feste Werte und Rechnen (reine Logik, testbar)
//
// Neu in der Web-App 0.7.0 (noch nicht in der Pi-Version). Datenform so gewählt, dass die Pi-Version sie 1:1
// als Tabellen übernehmen kann (siehe docs/UEBERGABE_ERNAEHRUNG.md, sobald geschrieben):
//   flasche   { id, zeit "JJJJ-MM-TTTHH:MM", ml, art, notiz }
//   abpumpen  { id, zeit, ml, seite "L"|"R"|"B", notiz }
//   beikost   { id, zeit, was, menge, neu (0|1), notiz }

export const ML_MIN = 0, ML_MAX = 400;
export const FLASCHE_ARTEN = { muttermilch: "Muttermilch", pre: "Pre-Milch", folge: "Folgemilch", andere: "Andere" };
export const BEIKOST_MENGEN = { probiert: "probiert", wenig: "ein paar Löffel", halb: "halbe Portion", ganz: "ganze Portion" };
export const WAS_MAX = 60;

/** Welche Arten zu füttern werden angezeigt? Einstellung je Kind. */
export const ERNAEHRUNG_ARTEN = ["stillen", "flasche", "abpumpen", "beikost"];
export const ERNAEHRUNG_NAMEN = { stillen: "Brust", flasche: "Fläschchen", abpumpen: "Abpumpen", beikost: "Beikost" };
export const ERNAEHRUNG_STANDARD = ["stillen", "flasche", "abpumpen"];
export const BEIKOST_AB_TAGEN = 120;          // ab etwa 4 Monaten taucht „Beikost“ von selbst auf (nur Anzeige, keine Empfehlung)

/** Gespeicherte Auswahl lesen; ohne Auswahl: Standard, Beikost automatisch ab ~4 Monaten. */
export function ernaehrungAuswahl(gespeichert, alterTage) {
  if (Array.isArray(gespeichert)) {
    const g = ERNAEHRUNG_ARTEN.filter(a => gespeichert.includes(a));
    if (g.length) return g;
  }
  return alterTage != null && alterTage >= BEIKOST_AB_TAGEN ? [...ERNAEHRUNG_STANDARD, "beikost"] : [...ERNAEHRUNG_STANDARD];
}

export const mlGueltig = ml => Number.isInteger(ml) && ml >= ML_MIN && ml <= ML_MAX;

/** Summen je Tag für Diagramme/Kennzahlen. tage = Liste "JJJJ-MM-TT". */
export function jeTag(tage, flaschen = [], pumpen = [], beikost = []) {
  const leer = () => ({ flaschen: 0, flascheMl: 0, pumpen: 0, pumpenMl: 0, beikost: 0 });
  const m = new Map(tage.map(t => [t, leer()]));
  const tag = z => m.get(z.slice(0, 10));
  for (const f of flaschen) { const t = tag(f.zeit); if (t) { t.flaschen++; t.flascheMl += f.ml || 0; } }
  for (const p of pumpen) { const t = tag(p.zeit); if (t) { t.pumpen++; t.pumpenMl += p.ml || 0; } }
  for (const b of beikost) { const t = tag(b.zeit); if (t) t.beikost++; }
  return tage.map(t => ({ tag: t, ...m.get(t) }));
}

/** Kennzahlen über einen Zeitraum (tage = Anzahl Kalendertage, für Ø/Tag). */
export function kennzahlen({ flaschen = [], pumpen = [], beikost = [], tage = 1 }) {
  const summe = (l, f) => l.reduce((s, x) => s + (x[f] || 0), 0);
  const fMl = summe(flaschen, "ml"), pMl = summe(pumpen, "ml");
  const neu = [...new Set(beikost.filter(b => b.neu).map(b => b.was))];
  const artenMl = {};
  for (const f of flaschen) artenMl[f.art] = (artenMl[f.art] || 0) + (f.ml || 0);
  return {
    flaschen: flaschen.length, flascheMl: fMl, flascheMlProTag: fMl / Math.max(1, tage),
    flascheMlSchnitt: flaschen.length ? fMl / flaschen.length : null, artenMl,
    pumpen: pumpen.length, pumpenMl: pMl, pumpenMlProTag: pMl / Math.max(1, tage),
    beikost: beikost.length, beikostNeu: neu,
  };
}

/** Kurzer Text für einen Eintrag („120 ml Pre-Milch“, „80 ml · Links“, „Karotte · ein paar Löffel“). */
export function eintragText(typ, e) {
  if (typ === "flasche") return `${e.ml} ml ${FLASCHE_ARTEN[e.art] || ""}`.trim();
  if (typ === "abpumpen") return `${e.ml} ml · ${{ L: "Links", R: "Rechts", B: "Beide" }[e.seite] || ""}`;
  if (typ === "beikost") return [e.was || "Beikost", BEIKOST_MENGEN[e.menge] || "", e.neu ? "zum ersten Mal" : ""].filter(Boolean).join(" · ");
  return "";
}
