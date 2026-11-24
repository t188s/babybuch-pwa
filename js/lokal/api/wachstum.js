// Babybuch PWA · Lokaler Pi · Gewicht, Größe, Kopfumfang (wie app.py Teil 4 und 4c)

import * as t from "../tabellen.js";
import { ApiFehler, DATUM_MUSTER, grammAusText, cmAusText, CM_MIN, CM_MAX, hat } from "../hilfen.js";

function gewichtPruefen(daten, allesNoetig = true) {
  const w = {};
  if (hat(daten, "datum") || allesNoetig) {
    if (!(typeof daten.datum === "string" && DATUM_MUSTER.test(daten.datum))) throw new ApiFehler("Datum fehlt oder ist ungültig.");
    w.datum = daten.datum;
  }
  if (hat(daten, "gramm") || allesNoetig) {
    const g = grammAusText(daten.gramm);
    if (g == null) throw new ApiFehler("Gewicht bitte in Gramm (z. B. 3790) oder Kilogramm (z. B. 3,79) angeben.");
    w.gramm = g;
  }
  return w;
}

function groessePruefen(daten, allesNoetig = true) {
  const w = {};
  if (hat(daten, "datum") || allesNoetig) {
    if (!(typeof daten.datum === "string" && DATUM_MUSTER.test(daten.datum))) throw new ApiFehler("Datum fehlt oder ist ungültig.");
    w.datum = daten.datum;
  }
  if (hat(daten, "cm") || allesNoetig) {
    const cm = cmAusText(daten.cm);
    if (cm == null) throw new ApiFehler(`Größe bitte in cm angeben (z. B. 52 oder 52,5), ${CM_MIN}–${CM_MAX} cm.`);
    w.cm = cm;
  }
  return w;
}

export function routen(r) {
  for (const [tabelle, pruefen, feld] of [["gewicht", gewichtPruefen, "gramm"], ["groesse", groessePruefen, "cm"]]) {
    r.get(tabelle, async () => t.sortiert(await t.alle(tabelle), "datum"));
    r.post(tabelle, async ({ daten }) => {
      const w = pruefen(daten);
      const z = await t.einfuegen(tabelle, w);
      return [201, { id: z.id, [feld]: w[feld] }];
    });
    r.patch(`${tabelle}/:id`, async ({ id, daten }) => {
      const w = pruefen(daten, false);
      if (!Object.keys(w).length) throw new ApiFehler("Nichts zu ändern.");
      return t.aendernOderFehler(tabelle, id, w);
    });
    r.delete(`${tabelle}/:id`, ({ id }) => t.loeschen(tabelle, id));
  }
  r.get("kopfumfang", async () => t.sortiert(await t.alle("kopfumfang"), "datum"));
}
