// Babybuch PWA · Lokaler „Pi“ · Fläschchen, Abpumpen, Beikost (neu in der Web-App, gleiche Art wie Stillen/Windeln)
//
// Routen wie sie die Pi-Version später bekommen soll:
//   GET  flasche|abpumpen|beikost?von=&bis=     GET  …/letzte      POST …      PATCH …/:id      DELETE …/:id
//   GET/PUT ernaehrung   (Auswahl je Kind: welche Arten angezeigt werden)

import * as t from "../tabellen.js";
import * as speicher from "../../kern/speicher.js";
import { ApiFehler, ZEIT_MUSTER, ERLAUBTE_SEITEN, NOTIZ_MAX, hat, nichtGefunden, einfach, alsZeit } from "../hilfen.js";
import { FLASCHE_ARTEN, BEIKOST_MENGEN, WAS_MAX, ML_MAX, ERNAEHRUNG_ARTEN, mlGueltig, ernaehrungAuswahl } from "../../kern/ernaehrung.js";

const notizText = n => String(n || "").trim().slice(0, NOTIZ_MAX);
const imBereich = (liste, [von, bis]) => liste.filter(z => z.zeit >= von && z.zeit < bis);

function zeitPruefen(z) {
  if (!(typeof z === "string" && ZEIT_MUSTER.test(z))) throw new ApiFehler("Uhrzeit fehlt oder ist ungültig.");
  return z;
}
function mlPruefen(ml) {
  if (!mlGueltig(ml)) throw new ApiFehler(`Menge bitte zwischen 0 und ${ML_MAX} ml.`);
  return ml;
}

// Je Tabelle: wie aus den gesendeten Daten die Spalten werden (neu = alle Pflichtfelder, sonst nur die geschickten)
const PRUEFER = {
  flasche: {
    ml: mlPruefen,
    art: a => { if (!(a in FLASCHE_ARTEN)) throw new ApiFehler("Bitte Muttermilch, Pre-Milch, Folgemilch oder Andere wählen."); return a; },
  },
  abpumpen: {
    ml: mlPruefen,
    seite: s => { if (!ERLAUBTE_SEITEN.has(s)) throw new ApiFehler("Bitte Links, Rechts oder Beide wählen."); return s; },
  },
  beikost: {
    was: w => { const x = einfach(w, WAS_MAX); if (!x) throw new ApiFehler("Bitte eintragen, was es gab."); return x; },
    menge: m => { if (!(m in BEIKOST_MENGEN)) throw new ApiFehler("Bitte eine Menge wählen."); return m; },
    neu: n => (n ? 1 : 0),
  },
};

export function routen(r) {
  for (const [tabelle, felder] of Object.entries(PRUEFER)) {
    r.get(tabelle, async ({ bereich }) => t.sortiert(imBereich(await t.alle(tabelle), bereich()), "zeit"));
    r.get(`${tabelle}/letzte`, async () => t.sortiert(await t.alle(tabelle), "zeit", true).slice(0, 20));
    r.post(tabelle, async ({ daten }) => {
      const werte = { zeit: zeitPruefen(daten.zeit) };
      for (const [f, pruefen] of Object.entries(felder)) werte[f] = pruefen(daten[f]);
      werte.notiz = notizText(daten.notiz);
      const z = await t.einfuegen(tabelle, werte);
      return [201, { id: z.id }];
    });
    r.patch(`${tabelle}/:id`, async ({ id, daten }) => {
      if (!(await t.holen(tabelle, id))) throw nichtGefunden();
      const a = {};
      if (hat(daten, "zeit")) a.zeit = zeitPruefen(daten.zeit);
      for (const [f, pruefen] of Object.entries(felder)) if (hat(daten, f)) a[f] = pruefen(daten[f]);
      if (hat(daten, "notiz")) a.notiz = notizText(daten.notiz);
      if (!Object.keys(a).length) throw new ApiFehler("Nichts zu ändern.");
      return t.aendernOderFehler(tabelle, id, a);
    });
    r.delete(`${tabelle}/:id`, ({ id }) => t.loeschen(tabelle, id));
  }

  // Auswahl je Kind – ohne gespeicherte Auswahl: Standard, Beikost ab etwa 4 Monaten
  r.get("ernaehrung", async () => {
    const roh = await t.einstellungLesen("ernaehrung");
    let gespeichert = null;
    try { gespeichert = roh ? JSON.parse(roh) : null; } catch (_) { gespeichert = null; }
    const kind = (await speicher.holen(t.kind()))?.daten || {};
    const alter = kind.geburtsdatum ? Math.floor((new Date() - alsZeit(kind.geburtsdatum)) / 864e5) : null;
    return { arten: ernaehrungAuswahl(gespeichert, alter), gespeichert: Boolean(gespeichert) };
  });
  r.put("ernaehrung", async ({ daten }) => {
    const arten = Array.isArray(daten.arten) ? ERNAEHRUNG_ARTEN.filter(a => daten.arten.includes(a)) : [];
    if (!arten.length) throw new ApiFehler("Bitte mindestens eine Art wählen.");
    await t.einstellungSetzen("ernaehrung", JSON.stringify(arten));
    return { arten, gespeichert: true };
  });
}
