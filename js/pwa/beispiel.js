// Babybuch PWA · Beispielkind zum Ausprobieren und Vorführen (Entscheidung 24.11.: Demo-Knopf, 6 Wochen, alles)
//
// Legt ein eigenes Kind „Lea (Beispiel)“ an – etwa 6 Wochen alt – mit Stillen, Windeln, Wachstum, einer kleinen
// Fieber-Episode, Vitamin D, U-Heft und Impfplan. Alles frei erfunden. Echte Kinder werden nicht angefasst.
// Entfernen: Kinder, Backup & Abgleich › Ändern › „Kind entfernen“.

import * as speicher from "../kern/speicher.js";
import * as t from "../lokal/tabellen.js";
import { heftEinrichten } from "../lokal/api/heft.js";

const TAG = 864e5;
const zwei = n => String(n).padStart(2, "0");
const datum = d => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
const zeit = d => `${datum(d)}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;

/** Fester Zufall (immer dieselben Beispiele): kleiner Zahlengenerator */
function zufall(start) {
  let s = start >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

export async function beispielkindAnlegen() {
  const jetzt = new Date(), ich = await speicher.geraet(), z = zufall(20261124);
  const geburt = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - 42, 6, 40);
  const tagNr = n => new Date(geburt.getFullYear(), geburt.getMonth(), geburt.getDate() + n);
  const bei = (n, h, m = 0) => { const d = tagNr(n); d.setHours(h, m, 0, 0); return d; };
  const vergangen = d => d <= jetzt;

  // Kind
  const { datensatz: kind } = await speicher.speichern({ typ: "kind", kind: null,
    daten: { name: "Lea (Beispiel)", geburtsdatum: datum(geburt), geschlecht: "w", geburtsgewicht: 3350, beispiel: true } });
  const k = kind.uid;
  const zeilen = [];
  let nr = 0;
  const basis = Date.now() * 1000;
  const zeile = (typ, daten) => {
    const id = basis + nr++;
    zeilen.push({ uid: "e" + id, typ, kind: k, daten: { ...daten, id }, erstellt: Date.now() + nr, geaendert: Date.now(), geraet: ich, geloescht: null });
    return id;
  };

  // ── Stillen: 8–10 Mahlzeiten am Tag, ab und zu mit Seitenwechsel, Notiz-Bausteine ──
  const notizen = ["gut angelegt", "unruhig", "eingeschlafen", "viel gespuckt", "Clusterfeeding", ""];
  let seite = "L";
  for (let n = 0; n <= 42; n++) {
    let uhr = n === 0 ? bei(0, 7, 30) : bei(n, 0, 30 + Math.floor(z() * 40));
    while (uhr.getDate() === tagNr(n).getDate() && vergangen(uhr)) {
      const dauer = 10 + Math.floor(z() * 18);
      const wechsel = z() < 0.35;
      const notiz = z() < 0.18 ? notizen[Math.floor(z() * notizen.length)] : "";
      zeile("stillen", { start: zeit(uhr), dauer, seite, notiz, zuletzt: "" });
      let ende = new Date(uhr.getTime() + dauer * 60000);
      if (wechsel) {
        const zweite = seite === "L" ? "R" : "L", d2 = 5 + Math.floor(z() * 10);
        const beginn2 = new Date(ende.getTime() + 60000);
        if (vergangen(new Date(beginn2.getTime() + d2 * 60000))) { zeile("stillen", { start: zeit(beginn2), dauer: d2, seite: zweite, notiz: "", zuletzt: "" }); seite = zweite; }
      } else seite = seite === "L" ? "R" : "L";
      uhr = new Date(uhr.getTime() + (140 + Math.floor(z() * 70)) * 60000);    // Abstand ca. 2⅓–3½ Std (Beginn zu Beginn)
    }
  }

  // ── Windeln: 6–8 am Tag, Stuhlfarbe wie in den ersten Wochen üblich ──
  for (let n = 0; n <= 42; n++) {
    const anzahl = n < 3 ? 3 + n : 6 + Math.floor(z() * 3);
    for (let i = 0; i < anzahl; i++) {
      const d = bei(n, 1 + Math.floor(i * 23 / anzahl), Math.floor(z() * 50));
      if (n === 0 && d < bei(0, 8)) continue;
      if (!vergangen(d)) continue;
      const voll = z() < (n < 14 ? 0.5 : 0.35), nass = !voll || z() < 0.4;
      const art = voll && nass ? "beides" : voll ? "voll" : "nass";
      const farbe = !voll ? "" : n < 2 ? "mekonium" : n < 5 ? "uebergang" : z() < 0.15 ? "" : "gelb";
      zeile("windeln", { zeit: zeit(d), art, stuhlfarbe: farbe });
    }
  }

  // ── Wachstum (Geburt 3350 g, Tiefpunkt Tag 3, Geburtsgewicht nach ~10 Tagen wieder erreicht) ──
  for (const [n, g] of [[0, 3350], [3, 3150], [5, 3200], [8, 3310], [12, 3420], [19, 3660], [26, 3890], [31, 4040], [38, 4280], [42, 4390]])
    if (vergangen(bei(n, 10))) zeile("gewicht", { datum: datum(tagNr(n)), gramm: g });
  for (const [n, cm] of [[0, 51], [5, 51.5], [31, 54.5]]) zeile("groesse", { datum: datum(tagNr(n)), cm });
  for (const [n, cm] of [[0, 34.5], [5, 35], [31, 37]]) zeile("kopfumfang", { datum: datum(tagNr(n)), cm });

  // ── Fieber & Co.: kleine Erkältung vor 3 Tagen (mit Anruf in der Praxis) ──
  const krank = 39;
  for (const [h, m, temp] of [[9, 10, 37.6], [13, 40, 38.2], [18, 5, 38.0], [22, 30, 37.5]]) zeile("fieber", { zeit: zeit(bei(krank, h, m)), temp, art: "Po", notiz: "" });
  zeile("fieber", { zeit: zeit(bei(krank + 1, 8, 15)), temp: 37.1, art: "Po", notiz: "wieder munter" });
  zeile("symptome", { zeit: zeit(bei(krank, 9, 20)), art: "husten", menge: "", notiz: "Schnupfen" });
  zeile("symptome", { zeit: zeit(bei(krank, 14, 0)), art: "trinkt", menge: "", notiz: "" });
  zeile("symptome", { zeit: zeit(bei(krank, 16, 30)), art: "erbricht", menge: "wenig", notiz: "" });
  for (const [h, m] of [[10, 0], [19, 30]]) zeile("medikamente", { zeit: zeit(bei(krank, h, m)), name: "Nasentropfen (Kochsalz)", menge: "1 Tropfen je Seite", notiz: "" });
  zeile("arztbesuche", { am: datum(tagNr(krank)), termin: "", grund: "Telefonat Kinderarztpraxis (Fieber)", praxis: "Kinderarztpraxis Beispiel",
    ergebnis: "beobachten, bei über 38,5 °C oder schlechtem Trinken vorbeikommen", g: null, cm: null, kopf: null });
  zeile("arztbesuche", { am: datum(tagNr(3)), termin: "", grund: "Hebammenbesuch", praxis: "Hebamme Beispiel", ergebnis: "Nabel gut, Stillen klappt", g: 3150, cm: null, kopf: null });

  // ── Vitamin D täglich ab Tag 7, zwei Tage vergessen ──
  const vitD = zeile("taegliche_gaben", { name: "Vitamin D", menge: "1 Tablette", zeiten: '["08:00"]', ab: datum(tagNr(7)), bis: "", pausiert: 0, erinnern: 1, widget: 1 });
  for (let n = 7; n <= 42; n++) {
    if (n === 17 || n === 29) continue;
    const d = bei(n, 8, Math.floor(z() * 40));
    if (vergangen(d)) zeile("gaben", { gabe_id: vitD, slot: 0, zeit: zeit(d), notiz: "" });
  }

  // ── Vorsorge: Impfplan und vereinbarte Maßnahme ──
  zeile("impfplan", { gegen: '["Rotaviren"]', dosis: "1. Dosis", alter_text: "ab 6 Wochen", ab: datum(tagNr(42)), nachholen: "", termin: "", impfung_id: null, notiz: "Schluckimpfung" });
  zeile("impfplan", { gegen: '["Tetanus","Diphtherie","Pertussis","Hib","Poliomyelitis","Hepatitis B","Pneumokokken"]', dosis: "1. Dosis", alter_text: "2 Monate",
    ab: datum(tagNr(61)), nachholen: "", termin: `${datum(tagNr(63))}T09:30`, impfung_id: null, notiz: "Sechsfach-Impfung und Pneumokokken" });
  zeile("massnahmen", { text: "Hüft-Ultraschall in 4 Wochen kontrollieren", von: "U3", faellig: datum(tagNr(59)), erledigt: "" });

  await speicher.standSchreiben(zeilen);

  // ── U-Heft: U1–U3 erledigt, U4 mit Termin; Abhakliste Geburt zum Teil erledigt ──
  t.kindSetzen(k);
  await heftEinrichten();
  const heft = await t.alle("untersuchungen"), u = art => heft.find(x => x.art === art);
  await t.aendern("untersuchungen", u("U1").id, { am: datum(tagNr(0)), erledigt: 1, ergebnis: "ok", g: 3350, cm: 51, kopf: 34.5, praxis: "Geburtsklinik" });
  await t.aendern("untersuchungen", u("U2").id, { am: datum(tagNr(5)), erledigt: 1, ergebnis: "ok", g: 3200, cm: 51.5, kopf: 35, praxis: "Kinderarztpraxis Beispiel" });
  await t.aendern("untersuchungen", u("U3").id, { am: datum(tagNr(31)), erledigt: 1, ergebnis: "mass", impfstatus: "ja", g: 4040, cm: 54.5, kopf: 37,
    praxis: "Kinderarztpraxis Beispiel", bemerkung: "Hüfte: Kontrolle in 4 Wochen" });
  await t.aendern("untersuchungen", u("U4").id, { termin: `${datum(tagNr(96))}T10:15`, praxis: "Kinderarztpraxis Beispiel" });
  const scr = await t.alle("screenings");
  const erledigtAm = [2, 2, 2, 2, null, 0, 5, 31];          // Hüft-Ultraschall (Nr. 4) steht noch aus
  for (const [i, s] of scr.entries()) if (erledigtAm[i] != null) await t.aendern("screenings", s.id, { am: datum(tagNr(erledigtAm[i])), erledigt: 1 });
  return kind;
}
