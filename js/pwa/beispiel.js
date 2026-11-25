// Babybuch PWA · Demo zum Ausprobieren und Vorführen (Entscheidung 25.11.: zwei Kinder, ersetzt das einzelne Beispielkind)
//
//   „Lea (Demo)“ – 4 Monate: gestillt, ab Woche 3 abgepumpt und abends ein Fläschchen Muttermilch, in den letzten Tagen
//                  erste Beikost; Wachstum, Vitamin D, Impfungen mit 2 Monaten (leichte Impfreaktion), eine Erkältung,
//                  U1–U4 erledigt, U5 mit Termin.
//   „Ben (Demo)“ – 8 Tage: Fläschchen (Pre-Milch), Windeln, Gewichtsverlauf der ersten Tage, U1/U2, Abhakliste Geburt.
// Alles frei erfunden, fester Zufall (jedes Mal gleich). Echte Kinder werden nicht angefasst.
// Entfernen: Einstellungen › „Demo entfernen“ (Kinder liegen danach 30 Tage im Papierkorb).

import * as speicher from "../kern/speicher.js";
import * as t from "../lokal/tabellen.js";
import { heftEinrichten } from "../lokal/api/heft.js";
import { whoGramm } from "../lokal/pi/rechnen.js";

const zwei = n => String(n).padStart(2, "0");
const datum = d => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
const zeit = d => `${datum(d)}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;

/** Fester Zufall (immer dieselben Beispiele) */
function zufall(start) {
  let s = start >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

/** Grundgerüst: Kind anlegen, Zeilen sammeln, am Ende in einem Rutsch schreiben. */
async function geruest({ name, tage, stunde, geschlecht, gramm, saat }) {
  const jetzt = new Date(), ich = await speicher.geraet(), z = zufall(saat);
  const geburt = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - tage, stunde, 40);
  const tagNr = n => new Date(geburt.getFullYear(), geburt.getMonth(), geburt.getDate() + n);
  const bei = (n, h, m = 0) => { const d = tagNr(n); d.setHours(h, m, 0, 0); return d; };
  const { datensatz: kind } = await speicher.speichern({ typ: "kind", kind: null,
    daten: { name, geburtsdatum: datum(geburt), geschlecht, geburtsgewicht: gramm, beispiel: true } });
  const zeilen = [], basis = Date.now() * 1000 + Math.floor(z() * 500) * 1000;
  let nr = 0;
  const zeile = (typ, daten) => {
    const id = basis + nr++;
    zeilen.push({ uid: "e" + id, typ, kind: kind.uid, daten: { ...daten, id }, erstellt: Date.now() + nr, geaendert: Date.now(), geraet: ich, geloescht: null });
    return id;
  };
  return { kind, z, geburt, tagNr, bei, vergangen: d => d <= jetzt, zeile, zeilen, tage };
}

async function fertig(g, { ernaehrung, heft }) {
  await speicher.standSchreiben(g.zeilen);
  t.kindSetzen(g.kind.uid);
  await t.einstellungSetzen("ernaehrung", JSON.stringify(ernaehrung));
  await heftEinrichten();
  const u = await t.alle("untersuchungen"), art = a => u.find(x => x.art === a);
  for (const [a, werte] of Object.entries(heft.u)) await t.aendern("untersuchungen", art(a).id, werte);
  const scr = await t.alle("screenings");
  for (const [i, s] of scr.entries()) if (heft.screenings[i] != null) await t.aendern("screenings", s.id, { am: datum(g.tagNr(heft.screenings[i])), erledigt: 1 });
}

function windeln(g, bisTag, { stuhlSeltenAb = 999, flasche = false } = {}) {
  const { z, bei, vergangen, zeile } = g;
  for (let n = 0; n <= bisTag; n++) {
    const anzahl = n < 3 ? 3 + n : n < 60 ? 6 + Math.floor(z() * 3) : 5 + Math.floor(z() * 3);
    for (let i = 0; i < anzahl; i++) {
      const d = bei(n, 1 + Math.floor(i * 23 / anzahl), Math.floor(z() * 50));
      if ((n === 0 && d < bei(0, 8)) || !vergangen(d)) continue;
      const pVoll = n < 14 ? 0.5 : n < stuhlSeltenAb ? 0.35 : 0.12;
      const voll = z() < pVoll, nass = !voll || z() < 0.4;
      const farbe = !voll ? "" : n < 2 ? "mekonium" : n < 5 ? "uebergang" : z() < 0.15 ? "" : flasche ? (z() < 0.5 ? "gelb" : "andere") : "gelb";
      zeile("windeln", { zeit: zeit(d), art: voll && nass ? "beides" : voll ? "voll" : "nass", stuhlfarbe: farbe });
    }
  }
}

function vitaminD(g, ab, bis, vergessen = []) {
  const id = g.zeile("taegliche_gaben", { name: "Vitamin D", menge: "1 Tablette", zeiten: '["08:00"]', ab: datum(g.tagNr(ab)), bis: "", pausiert: 0, erinnern: 1, widget: 1 });
  for (let n = ab; n <= bis; n++) {
    if (vergessen.includes(n)) continue;
    const d = g.bei(n, 8, Math.floor(g.z() * 40));
    if (g.vergangen(d)) g.zeile("gaben", { gabe_id: id, slot: 0, zeit: zeit(d), notiz: "" });
  }
}

// ════════ Lea, 4 Monate ════════
async function leaAnlegen() {
  const T = 122;
  const g = await geruest({ name: "Lea (Demo)", tage: T, stunde: 6, geschlecht: "w", gramm: 3350, saat: 20261124 });
  const { z, tagNr, bei, vergangen, zeile } = g;

  // Stillen: anfangs 8–10 Mahlzeiten, mit 3–4 Monaten 6–7 und nachts eine längere Pause
  const notizen = ["gut angelegt", "unruhig", "eingeschlafen", "viel gespuckt", "Clusterfeeding", ""];
  let seite = "L", uhr = bei(0, 7, 30);
  while (vergangen(uhr)) {
    const n = Math.floor((uhr - g.geburt) / 864e5);
    const dauer = (n < 30 ? 10 : 8) + Math.floor(z() * (n < 30 ? 18 : 12));
    const notiz = z() < 0.15 ? notizen[Math.floor(z() * notizen.length)] : "";
    zeile("stillen", { start: zeit(uhr), dauer, seite, notiz, zuletzt: "" });
    let ende = new Date(uhr.getTime() + dauer * 60000);
    if (z() < 0.35) {
      const zweite = seite === "L" ? "R" : "L", d2 = 5 + Math.floor(z() * 10), beginn2 = new Date(ende.getTime() + 60000);
      if (vergangen(new Date(beginn2.getTime() + d2 * 60000))) { zeile("stillen", { start: zeit(beginn2), dauer: d2, seite: zweite, notiz: "", zuletzt: "" }); seite = zweite; }
    } else seite = seite === "L" ? "R" : "L";
    const basis = n < 30 ? 140 : n < 75 ? 165 : 195;
    let abstand = basis + Math.floor(z() * 70);
    if (n > 45 && (uhr.getHours() >= 22 || uhr.getHours() < 2)) abstand += 90 + Math.floor(z() * 90);   // längerer Nachtschlaf
    uhr = new Date(uhr.getTime() + abstand * 60000);
  }

  // Abpumpen morgens ab Woche 3, abends ein Fläschchen Muttermilch (Papa), selten Pre
  for (let n = 14; n <= T; n++) {
    const pumpe = bei(n, 9, Math.floor(z() * 40));
    if (vergangen(pumpe) && z() < 0.8) zeile("abpumpen", { zeit: zeit(pumpe), ml: 60 + 5 * Math.floor(z() * (n < 60 ? 13 : 20)), seite: z() < 0.7 ? "B" : "L", notiz: "" });
    const fl = bei(n, 20, 30 + Math.floor(z() * 25));
    if (vergangen(fl) && z() < 0.75) {
      const pre = z() < 0.12;
      zeile("flasche", { zeit: zeit(fl), ml: Math.min(150, 50 + n + 10 * Math.floor(z() * 4)), art: pre ? "pre" : "muttermilch", notiz: pre ? "zugefüttert" : "" });
    }
  }
  // Erste Beikost in den letzten Tagen (ab Beginn des 5. Monats)
  for (const [n, was, menge, neu] of [[119, "Karotte", "probiert", 1], [120, "Karotte", "wenig", 0], [121, "Karotte", "wenig", 0], [122, "Pastinake", "probiert", 1]]) {
    const d = bei(n, 12, 10 + Math.floor(z() * 30));
    if (vergangen(d)) zeile("beikost", { zeit: zeit(d), was, menge, neu, notiz: n === 119 ? "viel wieder ausgespuckt" : "" });
  }

  windeln(g, T, { stuhlSeltenAb: 45 });

  // Wachstum: Tiefpunkt Tag 3, danach etwa entlang der WHO-Mitte
  const gewichte = [[0, 3350], [3, 3150], [5, 3200], [8, 3310], [12, 3420]];
  for (let n = 19; n <= T; n += 7) gewichte.push([n, Math.round(whoGramm(n, "w", 0.15) / 10) * 10]);
  for (const [n, gr] of gewichte) if (vergangen(bei(n, 10))) zeile("gewicht", { datum: datum(tagNr(n)), gramm: gr });
  for (const [n, cm] of [[0, 51], [5, 51.5], [31, 54.5], [99, 60.5]]) zeile("groesse", { datum: datum(tagNr(n)), cm });
  for (const [n, cm] of [[0, 34.5], [5, 35], [31, 37], [99, 39.8]]) zeile("kopfumfang", { datum: datum(tagNr(n)), cm });

  // Impfungen mit 2 Monaten, abends leichte Impfreaktion; Erkältung vor gut einer Woche
  const impfTag = 63;
  zeile("impfungen", { am: datum(tagNr(impfTag)), gegen: '["Tetanus","Diphtherie","Pertussis","Hib","Poliomyelitis","Hepatitis B"]', stoff: "Sechsfach-Impfstoff", charge: "DEMO-6F1", praxis: "Kinderarztpraxis Beispiel", notiz: "" });
  zeile("impfungen", { am: datum(tagNr(impfTag)), gegen: '["Pneumokokken"]', stoff: "Pneumokokken-Impfstoff", charge: "DEMO-PN1", praxis: "Kinderarztpraxis Beispiel", notiz: "" });
  zeile("impfungen", { am: datum(tagNr(impfTag)), gegen: '["Rotaviren"]', stoff: "Rotavirus-Schluckimpfung", charge: "DEMO-RV1", praxis: "Kinderarztpraxis Beispiel", notiz: "1. Dosis" });
  zeile("impfungen", { am: datum(tagNr(91)), gegen: '["Rotaviren"]', stoff: "Rotavirus-Schluckimpfung", charge: "DEMO-RV2", praxis: "Kinderarztpraxis Beispiel", notiz: "2. Dosis" });
  zeile("impfplan", { gegen: '["Tetanus","Diphtherie","Pertussis","Hib","Poliomyelitis","Hepatitis B","Pneumokokken"]', dosis: "2. Dosis", alter_text: "4 Monate",
    ab: datum(tagNr(122)), nachholen: "", termin: `${datum(tagNr(126))}T09:30`, impfung_id: null, notiz: "Sechsfach-Impfung und Pneumokokken" });
  for (const [h, m, temp] of [[19, 30, 38.1], [23, 0, 37.8]]) zeile("fieber", { zeit: zeit(bei(impfTag, h, m)), temp, art: "Po", notiz: "nach der Impfung" });
  zeile("fieber", { zeit: zeit(bei(impfTag + 1, 8, 0)), temp: 37.2, art: "Po", notiz: "" });
  const krank = T - 9;
  for (const [h, m, temp] of [[9, 10, 37.6], [13, 40, 38.2], [18, 5, 38.0], [22, 30, 37.5]]) zeile("fieber", { zeit: zeit(bei(krank, h, m)), temp, art: "Po", notiz: "" });
  zeile("fieber", { zeit: zeit(bei(krank + 1, 8, 15)), temp: 37.1, art: "Po", notiz: "wieder munter" });
  zeile("symptome", { zeit: zeit(bei(krank, 9, 20)), art: "husten", menge: "", notiz: "Schnupfen" });
  zeile("symptome", { zeit: zeit(bei(krank, 14, 0)), art: "trinkt", menge: "", notiz: "" });
  for (const [h, m] of [[10, 0], [19, 30]]) zeile("medikamente", { zeit: zeit(bei(krank, h, m)), name: "Nasentropfen (Kochsalz)", menge: "1 Tropfen je Seite", notiz: "" });
  zeile("arztbesuche", { am: datum(tagNr(krank)), termin: "", grund: "Telefonat Kinderarztpraxis (Fieber)", praxis: "Kinderarztpraxis Beispiel",
    ergebnis: "beobachten, bei über 38,5 °C oder schlechtem Trinken vorbeikommen", g: null, cm: null, kopf: null });
  zeile("arztbesuche", { am: datum(tagNr(3)), termin: "", grund: "Hebammenbesuch", praxis: "Hebamme Beispiel", ergebnis: "Nabel gut, Stillen klappt", g: 3150, cm: null, kopf: null });
  zeile("massnahmen", { text: "Hüft-Ultraschall in 4 Wochen kontrollieren", von: "U3", faellig: datum(tagNr(59)), erledigt: datum(tagNr(58)) });

  vitaminD(g, 7, T, [17, 29, 80]);
  const gU4 = Math.round(whoGramm(99, "w", 0.15) / 10) * 10;
  await fertig(g, {
    ernaehrung: ["stillen", "flasche", "abpumpen", "beikost"],
    heft: {
      u: {
        U1: { am: datum(tagNr(0)), erledigt: 1, ergebnis: "ok", g: 3350, cm: 51, kopf: 34.5, praxis: "Geburtsklinik" },
        U2: { am: datum(tagNr(5)), erledigt: 1, ergebnis: "ok", g: 3200, cm: 51.5, kopf: 35, praxis: "Kinderarztpraxis Beispiel" },
        U3: { am: datum(tagNr(31)), erledigt: 1, ergebnis: "mass", impfstatus: "ja", g: 4040, cm: 54.5, kopf: 37, praxis: "Kinderarztpraxis Beispiel", bemerkung: "Hüfte: Kontrolle in 4 Wochen" },
        U4: { am: datum(tagNr(99)), erledigt: 1, ergebnis: "ok", impfstatus: "ja", g: gU4, cm: 60.5, kopf: 39.8, praxis: "Kinderarztpraxis Beispiel" },
        U5: { termin: `${datum(tagNr(185))}T10:15`, praxis: "Kinderarztpraxis Beispiel" },
      },
      screenings: [2, 2, 2, 2, 58, 0, 5, 31],
    },
  });
  return g.kind;
}

// ════════ Ben, 8 Tage, Fläschchen ════════
async function benAnlegen() {
  const T = 8;
  const g = await geruest({ name: "Ben (Demo)", tage: T, stunde: 3, geschlecht: "m", gramm: 3520, saat: 20261125 });
  const { z, tagNr, bei, vergangen, zeile } = g;
  let uhr = bei(0, 6, 15);
  while (vergangen(uhr)) {
    const n = Math.floor((uhr - g.geburt) / 864e5);
    zeile("flasche", { zeit: zeit(uhr), ml: Math.min(90, 20 + n * 8 + 5 * Math.floor(z() * 3)), art: "pre", notiz: z() < 0.08 ? "viel gespuckt" : "" });
    uhr = new Date(uhr.getTime() + (150 + Math.floor(z() * 60)) * 60000);
  }
  windeln(g, T, { flasche: true });
  for (const [n, gr] of [[0, 3520], [3, 3310], [4, 3330], [6, 3400], [8, 3480]]) if (vergangen(bei(n, 10))) zeile("gewicht", { datum: datum(tagNr(n)), gramm: gr });
  zeile("groesse", { datum: datum(tagNr(0)), cm: 52 });
  zeile("kopfumfang", { datum: datum(tagNr(0)), cm: 35 });
  zeile("arztbesuche", { am: datum(tagNr(2)), termin: "", grund: "Hebammenbesuch", praxis: "Hebamme Beispiel", ergebnis: "trinkt gut aus der Flasche", g: 3330, cm: null, kopf: null });
  vitaminD(g, 7, T);
  await fertig(g, {
    ernaehrung: ["flasche"],
    heft: {
      u: {
        U1: { am: datum(tagNr(0)), erledigt: 1, ergebnis: "ok", g: 3520, cm: 52, kopf: 35, praxis: "Geburtsklinik" },
        U2: { am: datum(tagNr(4)), erledigt: 1, ergebnis: "ok", g: 3330, cm: 52, kopf: 35, praxis: "Kinderarztpraxis Beispiel" },
        U3: { termin: `${datum(tagNr(31))}T08:45`, praxis: "Kinderarztpraxis Beispiel" },
      },
      screenings: [1, 1, 1, 1, null, 0, 4, null],
    },
  });
  return g.kind;
}

/** Beide Demo-Kinder anlegen. Ergebnis: [Lea, Ben] */
export async function demoAnlegen() {
  const lea = await leaAnlegen();
  const ben = await benAnlegen();
  return [lea, ben];
}
