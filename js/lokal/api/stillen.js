// Babybuch PWA · Lokaler Pi · Stillen, Windeln, Stoppuhr (wie app.py Teil 4)

import * as t from "../tabellen.js";
import { ApiFehler, ZEIT_MUSTER, SEKUNDEN_MUSTER, ERLAUBTE_SEITEN, WINDEL_ARTEN, STUHLFARBEN, NOTIZ_MAX,
         DAUER_MIN, DAUER_MAX, hat, istGanzzahl, nichtGefunden } from "../hilfen.js";

const imBereich = (liste, feld, [von, bis]) => liste.filter(z => z[feld] >= von && z[feld] < bis);
const dauerGueltig = d => istGanzzahl(d) && d >= DAUER_MIN && d <= DAUER_MAX;
const zuletztPruefen = (seite, zuletzt) => (seite === "B" && (zuletzt === "L" || zuletzt === "R") ? zuletzt : "");
const stuhlfarbePruefen = (art, farbe) => ((art === "voll" || art === "beides") && farbe in STUHLFARBEN ? farbe : "");
const notizText = n => String(n || "").trim().slice(0, NOTIZ_MAX);

export function routen(r) {
  // ── Stillen ──
  r.get("stillen", async ({ bereich }) => t.sortiert(imBereich(await t.alle("stillen"), "start", bereich()), "start"));
  r.get("stillen/letzte", async () => t.sortiert(await t.alle("stillen"), "start", true).slice(0, 12));
  r.post("stillen", async ({ daten }) => {
    const { start, dauer, seite } = daten;
    if (!(typeof start === "string" && ZEIT_MUSTER.test(start))) throw new ApiFehler("Startzeit fehlt oder ist ungültig.");
    if (!dauerGueltig(dauer)) throw new ApiFehler(`Dauer bitte zwischen ${DAUER_MIN} und ${DAUER_MAX} Minuten wählen.`);
    if (!ERLAUBTE_SEITEN.has(seite)) throw new ApiFehler("Bitte Links, Rechts oder Beide wählen.");
    const z = await t.einfuegen("stillen", { start, dauer, seite, notiz: notizText(daten.notiz), zuletzt: zuletztPruefen(seite, daten.zuletzt) });
    return [201, { id: z.id }];
  });
  r.patch("stillen/:id", async ({ id, daten }) => {
    const alt = await t.holen("stillen", id);
    if (!alt) throw nichtGefunden();
    const a = {};
    if (hat(daten, "start")) { if (!(typeof daten.start === "string" && ZEIT_MUSTER.test(daten.start))) throw new ApiFehler("Beginn ist ungültig."); a.start = daten.start; }
    if (hat(daten, "dauer")) { if (!dauerGueltig(daten.dauer)) throw new ApiFehler(`Dauer bitte zwischen ${DAUER_MIN} und ${DAUER_MAX} Minuten wählen.`); a.dauer = daten.dauer; }
    if (hat(daten, "seite")) { if (!ERLAUBTE_SEITEN.has(daten.seite)) throw new ApiFehler("Bitte Links, Rechts oder Beide wählen."); a.seite = daten.seite; }
    if (hat(daten, "notiz")) a.notiz = notizText(daten.notiz);
    if (hat(daten, "zuletzt") || hat(a, "seite")) a.zuletzt = zuletztPruefen(a.seite ?? alt.seite, hat(daten, "zuletzt") ? daten.zuletzt : alt.zuletzt);
    if (!Object.keys(a).length) throw new ApiFehler("Nichts zu ändern.");
    return t.aendernOderFehler("stillen", id, a);
  });
  r.delete("stillen/:id", ({ id }) => t.loeschen("stillen", id));

  // ── Windeln ──
  r.get("windeln", async ({ bereich }) => t.sortiert(imBereich(await t.alle("windeln"), "zeit", bereich()), "zeit"));
  r.post("windeln", async ({ daten }) => {
    if (!(typeof daten.zeit === "string" && ZEIT_MUSTER.test(daten.zeit))) throw new ApiFehler("Uhrzeit fehlt oder ist ungültig.");
    if (!WINDEL_ARTEN.has(daten.art)) throw new ApiFehler("Bitte nass, voll oder beides wählen.");
    const z = await t.einfuegen("windeln", { zeit: daten.zeit, art: daten.art, stuhlfarbe: stuhlfarbePruefen(daten.art, daten.stuhlfarbe) });
    return [201, { id: z.id }];
  });
  r.patch("windeln/:id", async ({ id, daten }) => {
    const alt = await t.holen("windeln", id);
    if (!alt) throw nichtGefunden();
    const a = {};
    if (hat(daten, "zeit")) { if (!(typeof daten.zeit === "string" && ZEIT_MUSTER.test(daten.zeit))) throw new ApiFehler("Uhrzeit ist ungültig."); a.zeit = daten.zeit; }
    if (hat(daten, "art")) { if (!WINDEL_ARTEN.has(daten.art)) throw new ApiFehler("Bitte nass, voll oder beides wählen."); a.art = daten.art; }
    if (hat(daten, "stuhlfarbe") || hat(a, "art")) a.stuhlfarbe = stuhlfarbePruefen(a.art ?? alt.art, hat(daten, "stuhlfarbe") ? daten.stuhlfarbe : alt.stuhlfarbe);
    if (!Object.keys(a).length) throw new ApiFehler("Nichts zu ändern.");
    return t.aendernOderFehler("windeln", id, a);
  });
  r.delete("windeln/:id", ({ id }) => t.loeschen("windeln", id));

  // ── Stoppuhr (je Kind; beim Partner nur über das Backup sichtbar) ──
  r.get("stoppuhr", async () => ({ stoppuhr: await stoppuhrLesen() }));
  r.put("stoppuhr", async ({ daten }) => {
    const uhr = daten.stoppuhr;
    if (!stoppuhrGueltig(uhr)) throw new ApiFehler("Stoppuhr-Daten sind ungültig.");
    const sauber = { abschnitte: uhr.abschnitte.map(a => ({ seite: a.seite, start: a.start, ende: a.ende ?? null })) };
    await t.einstellungSetzen("stoppuhr", JSON.stringify(sauber));
    return { stoppuhr: sauber };
  });
  r.delete("stoppuhr", async () => { await t.einstellungLoeschen("stoppuhr"); return { stoppuhr: null }; });
}

async function stoppuhrLesen() {
  const wert = await t.einstellungLesen("stoppuhr");
  if (!wert) return null;
  try { const uhr = JSON.parse(wert); return stoppuhrGueltig(uhr) ? uhr : null; } catch (_) { return null; }
}

function stoppuhrGueltig(uhr) {
  if (!uhr || typeof uhr !== "object" || !Array.isArray(uhr.abschnitte)) return false;
  if (uhr.abschnitte.length < 1 || uhr.abschnitte.length > 50) return false;
  return uhr.abschnitte.every(a => a && typeof a === "object" && (a.seite === "L" || a.seite === "R") &&
    typeof a.start === "string" && SEKUNDEN_MUSTER.test(a.start) &&
    (a.ende == null || (typeof a.ende === "string" && SEKUNDEN_MUSTER.test(a.ende))));
}
