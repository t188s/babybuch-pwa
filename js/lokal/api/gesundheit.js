// Babybuch PWA · Lokaler Pi · Gesundheit: Fieber & Co., Medikamente, regelmäßige Gaben (wie app.py Teil 4b)
// Grundsatz: Das Babybuch NOTIERT nur. Keine Dosis-Berechnung, keine Diagnose.

import * as t from "../tabellen.js";
import { ApiFehler, DATUM_MUSTER, UHRZEIT_MUSTER, NAME_LAENGE, hat, istGanzzahl, textFeld, zeitFeld, pyRound, heute, nichtGefunden } from "../hilfen.js";

const TEMP_MIN = 34.0, TEMP_MAX = 43.0;
const MESSARTEN = ["Po", "Ohr", "Stirn", "Achsel"];
const SYMPTOM_ARTEN = ["erbricht", "durchfall", "trinkt", "schlapp", "husten", "ausschlag", "atmung", "notiz"];
const MENGEN = ["", "wenig", "schwall"];

function fieberPruefen(daten, alles = true) {
  const w = {};
  if (hat(daten, "zeit") || alles) w.zeit = zeitFeld(daten);
  if (hat(daten, "temp") || alles) {
    const roh = Number(String(daten.temp).replace(",", "."));
    const temp = Number.isFinite(roh) && daten.temp !== null && daten.temp !== "" ? pyRound(roh, 1) : null;
    if (temp == null || temp < TEMP_MIN || temp > TEMP_MAX) throw new ApiFehler("Bitte die Temperatur in °C eingeben, z. B. 38,2.");
    w.temp = temp;
  }
  if (hat(daten, "art") || alles) w.art = MESSARTEN.includes(daten.art) ? daten.art : "";
  if (hat(daten, "notiz") || alles) w.notiz = textFeld(daten, "notiz");
  return w;
}

function symptomPruefen(daten, alles = true) {
  const w = {};
  if (hat(daten, "zeit") || alles) w.zeit = zeitFeld(daten);
  if (hat(daten, "art") || alles) {
    if (!SYMPTOM_ARTEN.includes(daten.art)) throw new ApiFehler("Unbekanntes Symptom.");
    w.art = daten.art;
  }
  if (hat(daten, "menge") || alles) w.menge = MENGEN.includes(daten.menge) ? daten.menge : "";
  if (hat(daten, "notiz") || alles) w.notiz = textFeld(daten, "notiz");
  if (w.art === "notiz" && alles && !w.notiz) throw new ApiFehler("Bitte eine Notiz eingeben.");
  if (hat(w, "art") && w.art !== "erbricht") w.menge = "";
  return w;
}

function medikamentPruefen(daten, alles = true) {
  const w = {};
  if (hat(daten, "zeit") || alles) w.zeit = zeitFeld(daten);
  if (hat(daten, "name") || alles) {
    w.name = textFeld(daten, "name", NAME_LAENGE);
    if (!w.name) throw new ApiFehler("Bitte eintragen, was gegeben wurde.");
  }
  if (hat(daten, "menge") || alles) w.menge = textFeld(daten, "menge", NAME_LAENGE);
  if (hat(daten, "notiz") || alles) w.notiz = textFeld(daten);
  return w;
}

async function gabePruefen(daten, alles = true) {
  const w = {};
  if (hat(daten, "gabe_id") || alles) {
    const tg = istGanzzahl(daten.gabe_id) ? await t.holen("taegliche_gaben", daten.gabe_id) : null;
    if (!tg) throw new ApiFehler("Diese tägliche Gabe gibt es nicht (mehr).");
    w.gabe_id = tg.id;
  }
  if (hat(daten, "slot") || alles) {
    const slot = hat(daten, "slot") ? daten.slot : 0;
    if (!istGanzzahl(slot) || slot < 0 || slot > 2) throw new ApiFehler("Ungültige Uhrzeit-Nummer.");
    w.slot = slot;
  }
  if (hat(daten, "zeit") || alles) w.zeit = zeitFeld(daten);
  if (hat(daten, "notiz") || alles) w.notiz = textFeld(daten, "notiz");
  return w;
}

const GESUNDHEIT = { fieber: fieberPruefen, symptome: symptomPruefen, medikamente: medikamentPruefen, gaben: gabePruefen };

// ── Tägliche Gaben ──
function gabeAusZeile(z) {
  let zeiten;
  try { zeiten = JSON.parse(z.zeiten).filter(x => UHRZEIT_MUSTER.test(x)); } catch (_) { zeiten = []; }
  return { ...z, zeiten: zeiten.length ? zeiten : ["08:00"], pausiert: Boolean(z.pausiert), erinnern: Boolean(z.erinnern), widget: Boolean(z.widget) };
}

function taeglichPruefen(daten, alles = true) {
  const w = {};
  if (hat(daten, "name") || alles) {
    w.name = textFeld(daten, "name", NAME_LAENGE);
    if (!w.name) throw new ApiFehler("Bitte eintragen, was gegeben wird.");
  }
  if (hat(daten, "menge") || alles) w.menge = textFeld(daten, "menge", NAME_LAENGE);
  if (hat(daten, "zeiten") || alles) {
    const zeiten = hat(daten, "zeiten") ? daten.zeiten : ["08:00"];
    if (!Array.isArray(zeiten) || zeiten.length < 1 || zeiten.length > 3 || !zeiten.every(z => typeof z === "string" && UHRZEIT_MUSTER.test(z)))
      throw new ApiFehler("Bitte 1 bis 3 Uhrzeiten angeben (z. B. 08:00).");
    w.zeiten = JSON.stringify([...new Set(zeiten)].sort());
  }
  for (const feld of ["ab", "bis"]) {
    if (hat(daten, feld) || (alles && feld === "ab")) {
      let wert = String(daten[feld] || "");
      if (feld === "ab" && !wert) wert = heute();
      if (wert && !DATUM_MUSTER.test(wert)) throw new ApiFehler("Datum ungültig.");
      w[feld] = wert;
    }
  }
  if (w.ab && w.bis && w.bis < w.ab) throw new ApiFehler("Der letzte Tag liegt vor dem ersten.");
  for (const feld of ["pausiert", "erinnern", "widget"])
    if (hat(daten, feld) || alles) w[feld] = (hat(daten, feld) ? daten[feld] : feld !== "pausiert") ? 1 : 0;
  return w;
}

export function routen(r) {
  r.get("gesundheit", async ({ bereich }) => {
    const [von, bis] = bereich();
    const antwort = {};
    for (const tabelle of Object.keys(GESUNDHEIT))
      antwort[tabelle] = t.sortiert((await t.alle(tabelle)).filter(z => z.zeit >= von && z.zeit < bis), "zeit");
    antwort.entfernte_gaben = JSON.parse((await t.einstellungLesen("entfernte_gaben")) || "{}");
    return antwort;
  });

  for (const [tabelle, pruefen] of Object.entries(GESUNDHEIT)) {
    r.post(tabelle, async ({ daten }) => {
      const w = await pruefen(daten);
      if (tabelle === "gaben") {               // Doppel-Tipp / zweites Handy: dieselbe Uhrzeit am selben Tag nur einmal
        const tag = w.zeit.slice(0, 10);
        const schon = (await t.alle("gaben")).find(g => g.gabe_id === w.gabe_id && g.slot === w.slot && g.zeit >= tag && g.zeit < tag + "T99");
        if (schon) return [200, { id: schon.id, doppelt: true }];
      }
      const z = await t.einfuegen(tabelle, w);
      return [201, { id: z.id }];
    });
    r.patch(`${tabelle}/:id`, async ({ id, daten }) => {
      const w = await pruefen(daten, false);
      if (!Object.keys(w).length) throw new ApiFehler("Nichts zu ändern.");
      return t.aendernOderFehler(tabelle, id, w);
    });
    r.delete(`${tabelle}/:id`, ({ id }) => t.loeschen(tabelle, id));
  }

  r.get("taegliche-gaben", async () => (await t.alle("taegliche_gaben")).map(gabeAusZeile));
  const TAEGLICH_LEER = { name: "", menge: "", zeiten: '["08:00"]', ab: "", bis: "", pausiert: 0, erinnern: 1, widget: 1 };   // DEFAULT wie in SQLite
  r.post("taegliche-gaben", async ({ daten }) => [201, gabeAusZeile(await t.einfuegen("taegliche_gaben", { ...TAEGLICH_LEER, ...taeglichPruefen(daten) }))]);
  r.patch("taegliche-gaben/:id", async ({ id, daten }) => {
    const w = taeglichPruefen(daten, false);
    if (!Object.keys(w).length) throw new ApiFehler("Nichts zu ändern.");
    const alt = await t.holen("taegliche_gaben", id);
    if (!alt) throw nichtGefunden();
    const ab = w.ab || alt.ab, bis = hat(w, "bis") ? w.bis : alt.bis;
    if (ab && bis && bis < ab) throw new ApiFehler("Der letzte Tag liegt vor dem ersten.");
    return gabeAusZeile(await t.aendernOderFehler("taegliche_gaben", id, w));
  });
  r.delete("taegliche-gaben/:id", async ({ id }) => {
    // Entfernt nur die Vorlage – bisher Abgehaktes bleibt in der Auswertung (Name wird dort aus dieser Liste genommen)
    const z = await t.holen("taegliche_gaben", id);
    if (!z) throw nichtGefunden();
    const alte = JSON.parse((await t.einstellungLesen("entfernte_gaben")) || "{}");
    alte[String(id)] = z.name;
    await t.einstellungSetzen("entfernte_gaben", JSON.stringify(alte));
    return t.loeschen("taegliche_gaben", id);
  });
  r.post("taegliche-gaben/:id/wiederherstellen", async ({ id, daten }) => {
    const w = taeglichPruefen(daten);
    if (await t.existiert("taegliche_gaben", id)) throw new ApiFehler("Gibt es schon.");
    await t.einfuegen("taegliche_gaben", { ...TAEGLICH_LEER, ...w }, id);
    return [201, { ok: true }];
  });
}
