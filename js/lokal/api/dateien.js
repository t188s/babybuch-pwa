// Babybuch PWA · Lokaler Pi · CSV-Export (app.py 3.0.2 Teil 7, „/export/…“)
//
// Liefert {name, text} – die Weiche gibt die Datei über das Teilen-Menü bzw. als Download aus.
// Format wie auf dem Pi: UTF-8 mit BOM, Trennzeichen ;, Zeilenende CRLF, Felder nur bei Bedarf in Anführungszeichen.
// Neu in der Web-App: flasche.csv, abpumpen.csv, beikost.csv.

import * as t from "../tabellen.js";
import { ApiFehler } from "../hilfen.js";
import { einstellungenLesen } from "./einstellungen.js";
import { U_ARTEN } from "./heft.js";
import { STUHLFARBEN } from "../hilfen.js";
import { SEITEN_NAMEN, SYMPTOM_ARTEN, datumDe, hm, komma, prozentText, cmText, csvSicher, istNacht, endeVon, uhrText,
         mahlzeitenMarkieren, gewichteAuswerten, groessenAuswerten, zeitraumAus } from "../pi/rechnen.js";
import { FLASCHE_ARTEN, BEIKOST_MENGEN } from "../../kern/ernaehrung.js";

/** Python csv.writer(delimiter=";"): Anführungszeichen nur, wenn ; " \r \n im Feld; Zeilenende \r\n. */
export function csvText(zeilen) {
  const feld = w => {
    const s = w === null || w === undefined ? "" : String(w);
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + zeilen.map(z => z.map(feld).join(";") + "\r\n").join("");
}

export const KOPF_STILLEN = ["Datum", "Beginn", "Ende", "Dauer (Min)", "Seite", "Zuletzt an", "Tag/Nacht",
  "Abstand zur vorherigen Mahlzeit – Beginn zu Beginn (Std:Min)", "Notiz"];
export const KOPF_WINDELN = ["Datum", "Uhrzeit", "Art", "Stuhlfarbe"];
export const KOPF_GEWICHT = ["Datum", "Gramm", "Veränderung zum Geburtsgewicht", "WHO-Perzentile"];
export const VORLAGEN = { stillen: ["Datum", "Beginn", "Dauer (Min)", "Seite", "Zuletzt an", "Notiz"], windeln: KOPF_WINDELN,
  gewicht: ["Datum", "Gramm"], groesse: ["Datum", "cm"] };

const dateinameFuer = (art, z) => (!z.von ? `${art}_alle.csv` : `${art}_${z.von.slice(0, 10)}_bis_${z.bis.slice(0, 10)}.csv`);
const imBereich = (liste, feld, z) => t.sortiert(liste.filter(x => x[feld] >= z.von_q && x[feld] < z.bis_q), feld);
const zeitZeile = e => [datumDe(e.zeit), e.zeit.slice(11, 16)];

/** Stillen mit Mahlzeit-Markierung ab dem Vortag (wie eintraege_im_bereich). */
export async function stillenImBereich(z) {
  const vortag = z.von_q ? (() => { const d = new Date(z.von_q.slice(0, 10) + "T12:00"); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })() : "";
  const alle = t.sortiert((await t.alle("stillen")).filter(s => s.start >= vortag && s.start < z.bis_q), "start");
  return mahlzeitenMarkieren(alle).filter(s => s.start >= z.von_q).map(s => ({ ...s, ende: uhrText(endeVon(s.start, s.dauer)) }));
}

const EXPORTE = {
  async stillen(z, e) {
    const zeilen = [KOPF_STILLEN];
    for (const s of await stillenImBereich(z))
      zeilen.push([datumDe(s.start), s.start.slice(11, 16), s.ende, s.dauer, SEITEN_NAMEN[s.seite], SEITEN_NAMEN[s.zuletzt] || "",
        istNacht(s.start, e) ? "Nacht" : "Tag", hm(s.pause || 0), csvSicher(s.notiz)]);
    return zeilen;
  },
  async windeln(z) {
    return [KOPF_WINDELN, ...imBereich(await t.alle("windeln"), "zeit", z).map(w => [datumDe(w.zeit), w.zeit.slice(11, 16), w.art, STUHLFARBEN[w.stuhlfarbe] || ""])];
  },
  async gewicht(z, e) {
    const liste = t.sortiert((await t.alle("gewicht")).filter(w => w.datum >= (z.von_q.slice(0, 10) || "") && w.datum <= z.bis_q.slice(0, 10)), "datum");
    return [KOPF_GEWICHT, ...gewichteAuswerten(e, liste).map(w => [datumDe(w.datum), w.gramm, w.prozent != null ? prozentText(w.prozent) : "", w.perzentil ? `P${w.perzentil}` : ""])];
  },
  async groesse(z, e) {
    const liste = t.sortiert((await t.alle("groesse")).filter(g => g.datum >= (z.von_q.slice(0, 10) || "") && g.datum <= z.bis_q.slice(0, 10)), "datum");
    return [["Datum", "cm", "WHO-Perzentile"], ...groessenAuswerten(e, liste).map(g => [datumDe(g.datum), cmText(g.cm), g.perzentil ? `P${g.perzentil}` : ""])];
  },
  async fieber(z) {
    return [["Datum", "Uhrzeit", "Temperatur (°C)", "Messart", "Notiz"], ...imBereich(await t.alle("fieber"), "zeit", z).map(f => [...zeitZeile(f), komma(f.temp), f.art, csvSicher(f.notiz)])];
  },
  async symptome(z) {
    return [["Datum", "Uhrzeit", "Symptom", "Menge", "Notiz"], ...imBereich(await t.alle("symptome"), "zeit", z).map(s =>
      [...zeitZeile(s), SYMPTOM_ARTEN[s.art] || s.art, ({ schwall: "Schwall" })[s.menge] ?? s.menge, csvSicher(s.notiz)])];
  },
  async medikamente(z) {
    return [["Datum", "Uhrzeit", "Medikament", "Menge (wie gegeben)", "Notiz"], ...imBereich(await t.alle("medikamente"), "zeit", z).map(m =>
      [...zeitZeile(m), csvSicher(m.name), csvSicher(m.menge), csvSicher(m.notiz)])];
  },
  async gaben(z) {
    const namen = new Map((await t.alle("taegliche_gaben")).map(g => {
      let zeiten; try { zeiten = JSON.parse(g.zeiten); } catch (_) { zeiten = []; }
      return [g.id, { ...g, zeiten }];
    }));
    let entfernt = {}; try { entfernt = JSON.parse((await t.einstellungLesen("entfernte_gaben")) || "{}"); } catch (_) { entfernt = {}; }
    return [["Datum", "Uhrzeit", "Tägliche Gabe", "geplant um", "Notiz"], ...imBereich(await t.alle("gaben"), "zeit", z).map(g => {
      const td = namen.get(g.gabe_id);
      const name = td ? td.name : entfernt[String(g.gabe_id)] || "entfernte Gabe";
      const soll = td && g.slot < td.zeiten.length ? td.zeiten[g.slot] : "";
      return [...zeitZeile(g), csvSicher(name), soll, csvSicher(g.notiz)];
    })];
  },
  async impfungen() {
    const liste = t.sortiert(await t.alle("impfungen"), "am");
    return [["Datum", "Gegen", "Impfstoff", "Charge", "Praxis", "Notiz"], ...liste.map(i => {
      let gegen; try { gegen = JSON.parse(i.gegen || "[]"); } catch (_) { gegen = []; }
      return [datumDe(i.am), gegen.join(", "), csvSicher(i.stoff), csvSicher(i.charge), csvSicher(i.praxis), csvSicher(i.notiz)];
    })];
  },
  async uheft() {
    const zeilen = (await t.alle("untersuchungen")).map(u => [u.art, u.vom ? datumDe(u.vom) : "", u.bis ? datumDe(u.bis) : "",
      u.termin ? u.termin.replace("T", " ") : "", u.am ? datumDe(u.am) : (u.erledigt ? "erledigt" : ""), csvSicher(u.praxis),
      ({ ok: "unauffällig", beob: "Beobachtung", mass: "Maßnahmen" })[u.ergebnis] || "", u.g || "", u.cm ? cmText(u.cm) : "",
      u.kopf ? cmText(u.kopf) : "", csvSicher(u.bemerkung)]);
    const pos = a => (U_ARTEN.includes(a) ? U_ARTEN.indexOf(a) : 99);
    zeilen.sort((a, b) => pos(a[0]) - pos(b[0]));
    return [["Untersuchung", "Zeitfenster vom", "bis", "Termin", "Gemacht am", "Praxis", "Ergebnis", "Gewicht (g)", "Länge (cm)", "Kopf (cm)", "Bemerkung"], ...zeilen];
  },
  // ── neu in der Web-App ──
  async flasche(z) {
    return [["Datum", "Uhrzeit", "Menge (ml)", "Art", "Notiz"], ...imBereich(await t.alle("flasche"), "zeit", z).map(f => [...zeitZeile(f), f.ml, FLASCHE_ARTEN[f.art] || f.art, csvSicher(f.notiz)])];
  },
  async abpumpen(z) {
    return [["Datum", "Uhrzeit", "Menge (ml)", "Seite", "Notiz"], ...imBereich(await t.alle("abpumpen"), "zeit", z).map(p => [...zeitZeile(p), p.ml, SEITEN_NAMEN[p.seite] || "", csvSicher(p.notiz)])];
  },
  async beikost(z) {
    return [["Datum", "Uhrzeit", "Was", "Menge", "Zum ersten Mal", "Notiz"], ...imBereich(await t.alle("beikost"), "zeit", z).map(b =>
      [...zeitZeile(b), csvSicher(b.was), BEIKOST_MENGEN[b.menge] || b.menge, b.neu ? "ja" : "", csvSicher(b.notiz)])];
  },
};
const FESTE_NAMEN = { impfungen: "impfungen.csv", uheft: "uheft.csv" };

export function routen(r) {
  r.get("export/vorlage/:datei", ({ params }) => {
    const art = params.datei.replace(/\.csv$/, "");
    if (!VORLAGEN[art]) throw new ApiFehler("Unbekannte Vorlage.", 404);
    return { name: `vorlage_${art}.csv`, text: csvText([VORLAGEN[art]]) };
  });
  r.get("export/:datei", async ({ params, query }) => {
    const art = params.datei.replace(/\.csv$/, "");
    if (!EXPORTE[art]) throw new ApiFehler("Unbekannte Tabelle.", 404);
    const z = FESTE_NAMEN[art] ? zeitraumAus("", "", false) : zeitraumAus(query.get("von") || "", query.get("bis") || "", false);
    if (!z) throw new ApiFehler("Zeitraum ungültig.");      // Impfungen und U-Heft: immer alles (wie Pi)
    const zeilen = await EXPORTE[art](z, await einstellungenLesen());
    return { name: FESTE_NAMEN[art] || dateinameFuer(art, z), text: csvText(zeilen) };
  });
}
