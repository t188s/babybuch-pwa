// Babybuch PWA · Lokaler Pi · CSV-Import (app.py 3.0.2 Teil 7, „/api/import/<art>“)
//
// Schritt 1 (bestaetigen=false): Vorschau – neu / schon vorhanden / fehlerhaft. Schritt 2: einspielen.
// Liest auch die CSV-Dateien der Pi-Version und älterer Babybuch-Versionen (Umzug vom Pi möglich).
// Anders als auf dem Pi: keine automatische Sicherungskopie vorher – das Fenster empfiehlt (wie auf dem Pi) vorher ein Backup.

import * as t from "../tabellen.js";
import { ApiFehler, NOTIZ_MAX, DAUER_MIN, DAUER_MAX, GRAMM_MIN, GRAMM_MAX, CM_MIN, CM_MAX, STUHLFARBEN, grammAusText, cmAusText } from "../hilfen.js";
import { SEITEN_NAMEN, datumDe, cmText, pyRound } from "../pi/rechnen.js";

export function spaltenname(text) {
  const t2 = String(text).replace(/﻿/g, "").replace(/\(.*?\)/g, " ").toLowerCase();
  return t2.replace(/_/g, " ").split(/\s+/).filter(Boolean).join(" ");
}

const SPALTEN = {
  stillen: { datum: ["datum", "date", "tag"], beginn: ["beginn", "start", "startzeit", "uhrzeit", "zeit", "von"],
    dauer: ["dauer", "minuten", "min", "dauer in minuten", "länge"], seite: ["seite", "brust", "side"],
    zuletzt: ["zuletzt an", "zuletzt", "aufgehört an", "ende an"],
    notiz: ["notiz", "notizen", "anmerkung", "anmerkungen", "bemerkung", "kommentar", "note", "notes"] },
  windeln: { datum: ["datum", "date", "tag"], uhrzeit: ["uhrzeit", "zeit", "beginn", "start"], art: ["art", "windel", "typ", "inhalt"],
    stuhlfarbe: ["stuhlfarbe", "farbe", "stuhl"] },
  gewicht: { datum: ["datum", "date", "tag"], gramm: ["gramm", "gewicht", "g", "kg", "weight"] },
  groesse: { datum: ["datum", "date", "tag"],
    cm: ["cm", "größe", "groesse", "länge", "laenge", "körperlänge", "koerperlaenge", "größe in cm", "length", "height"] },
};
const PFLICHT = { stillen: ["datum", "beginn", "dauer", "seite"], windeln: ["datum", "uhrzeit", "art"], gewicht: ["datum", "gramm"], groesse: ["datum", "cm"] };
const ART_NAMEN = { stillen: "Stillen", windeln: "Windeln", gewicht: "Gewicht", groesse: "Größe" };
const gross = f => f.charAt(0).toUpperCase() + f.slice(1);

/** Python csv.reader (Excel-Dialekt): Anführungszeichen, "" als ", Zeilenumbrüche in Anführungszeichen. */
export function csvZeilen(text, trenner) {
  const zeilen = [];
  let zeile = [], feld = "", inQ = false, i = 0, feldBegonnen = false;
  const feldEnde = () => { zeile.push(feld); feld = ""; feldBegonnen = false; };
  const zeileEnde = () => { feldEnde(); zeilen.push(zeile); zeile = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { feld += '"'; i += 2; continue; } inQ = false; i++; continue; }
      feld += c; i++; continue;
    }
    if (c === '"' && !feldBegonnen) { inQ = true; feldBegonnen = true; i++; continue; }
    if (c === trenner) { feldEnde(); i++; continue; }
    if (c === "\r" || c === "\n") { zeileEnde(); i += c === "\r" && text[i + 1] === "\n" ? 2 : 1; continue; }
    feld += c; feldBegonnen = true; i++;
  }
  if (feld !== "" || zeile.length || feldBegonnen) zeileEnde();
  return zeilen;
}
export function csvLesen(text) {
  text = text.replace(/^﻿+/, "");
  const kopf = text.split("\n", 1)[0];
  const zaehlen = z => kopf.split(z).length - 1;
  let trenner = ";";
  for (const z of [",", "\t"]) if (zaehlen(z) > zaehlen(trenner)) trenner = z;
  return csvZeilen(text, trenner).filter(z => z.some(f => f.trim()));
}

const pyStrip = s => s.replace(/^[\s ]+|[\s ]+$/g, "");
function gueltigesDatum(j, m, t) {
  const d = new Date(j, m - 1, t);
  return d.getFullYear() === j && d.getMonth() === m - 1 && d.getDate() === t && j >= 1;
}
export function datumLesen(text) {
  text = pyStrip(text).split(" ")[0].split("T")[0];
  let j, mo, t, m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text))) [, j, mo, t] = m;
  else if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/.exec(text))) { [, t, mo, j] = m; if (j.length === 2) j = "20" + j; }
  else return null;
  [j, mo, t] = [Number(j), Number(mo), Number(t)];
  if (!gueltigesDatum(j, mo, t)) return null;
  return `${String(j).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
}
export function uhrzeitLesen(text) {
  const m = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?(?:\s*uhr)?$/.exec(pyStrip(text).toLowerCase());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}
export function zeitpunktLesen(datumFeld, zeitFeld) {
  let tag = datumLesen(datumFeld);
  let uhr = pyStrip(zeitFeld) ? uhrzeitLesen(zeitFeld) : null;
  if (uhr === null && pyStrip(datumFeld).includes(" ")) uhr = uhrzeitLesen(pyStrip(datumFeld).split(" ").slice(1).join(" "));
  if (uhr === null && zeitFeld.includes("T")) { tag = tag || datumLesen(zeitFeld); uhr = uhrzeitLesen(zeitFeld.split("T").slice(1).join("T").slice(0, 5)); }
  return [tag && uhr ? `${tag}T${uhr}` : null, tag, uhr];
}
export function notizLesen(text) {
  text = pyStrip(text.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  if (text.length > 1 && text[0] === "'" && "=+-@".includes(text[1])) text = text.slice(1);
  return text.slice(0, NOTIZ_MAX);
}
export function seiteAusText(text) {
  const woerter = String(text || "").trim().toLowerCase().match(/[a-zäöü]+/g) || [];
  if (!woerter.length) return [null, ""];
  const rest = woerter.slice(1);
  if (["b", "beide", "beides", "both"].includes(woerter[0]))
    return ["B", rest.includes("links") || rest.includes("l") ? "L" : rest.includes("rechts") || rest.includes("r") ? "R" : ""];
  return [({ l: "L", links: "L", left: "L", r: "R", rechts: "R", right: "R" })[woerter[0]] || null, ""];
}
export function windelArtLesen(text) {
  const t2 = (text.toLowerCase().match(/[a-zäöü]+/g) || []).join(" ");
  if (["nass", "pipi", "urin", "wet", "n"].includes(t2)) return "nass";
  if (["voll", "stuhl", "kacka", "dirty", "v"].includes(t2)) return "voll";
  if (["beides", "beide", "b", "both"].includes(t2) || (t2.includes("nass") && (t2.includes("voll") || t2.includes("stuhl")))) return "beides";
  return null;
}
export function stuhlfarbeLesen(text) {
  const t2 = text.trim().toLowerCase();
  if (!t2) return "";
  for (const [k, name] of Object.entries(STUHLFARBEN)) if (t2 === k || t2 === name.toLowerCase()) return k;
  if (t2.includes("mekonium") || t2.includes("schwarz")) return "mekonium";
  if (["hell", "weiß", "weiss", "grau"].some(w => t2.includes(w))) return "hell";
  if (t2.includes("gelb")) return "gelb";
  if (["grün", "gruen", "braun", "übergang"].some(w => t2.includes(w))) return "uebergang";
  return "andere";
}
const zuletztPruefen = (seite, zuletzt) => (seite === "B" && (zuletzt === "L" || zuletzt === "R") ? zuletzt : "");
const stuhlfarbePruefen = (art, farbe) => ((art === "voll" || art === "beides") && farbe in STUHLFARBEN ? farbe : "");
const dauerGueltig = d => Number.isInteger(d) && d >= DAUER_MIN && d <= DAUER_MAX;

export async function importAuswerten(art, text) {
  const zeilen = csvLesen(text);
  if (!zeilen.length) return { fehler_datei: "Die Datei ist leer." };
  const kopf = zeilen[0].map(spaltenname), zuordnung = {};
  for (const [feld, namen] of Object.entries(SPALTEN[art]))
    for (const [i, k] of kopf.entries()) if (namen.includes(k) && !Object.values(zuordnung).includes(i)) { zuordnung[feld] = i; break; }
  const fehlend = PFLICHT[art].filter(f => !(f in zuordnung));
  if (fehlend.length) {
    const andere = Object.keys(SPALTEN).filter(a => a !== art && PFLICHT[a].every(f => kopf.some(k => SPALTEN[a][f].includes(k)))).map(a => ART_NAMEN[a]);
    return { fehler_datei: `Das ist keine ${ART_NAMEN[art]}-Datei: Spalte(n) ${fehlend.map(gross).join(", ")} fehlen in der ersten Zeile.${andere.length ? ` Das sieht nach einer ${andere[0]}-Datei aus.` : ""}` };
  }
  const schl = { stillen: z => `${z.start}|${z.seite}`, windeln: z => `${z.zeit}|${z.art}`, groesse: z => `${z.datum}|${z.cm}`, gewicht: z => `${z.datum}|${z.gramm}` }[art];
  const vorhanden = new Set((await t.alle(art)).map(schl));
  const neu = [], fehler = [];
  let doppelt = 0;
  for (const [i, zeile] of zeilen.slice(1).entries()) {
    const nummer = i + 2;
    const feld = name => (name in zuordnung && zuordnung[name] < zeile.length ? pyStrip(zeile[zuordnung[name]]) : "");
    let grund = null, eintrag = null;
    if (art === "stillen") {
      const [start, tag, uhr] = zeitpunktLesen(feld("datum"), feld("beginn"));
      const dm = /^\s*(\d+(?:[.,]\d+)?)/.exec(feld("dauer"));
      const dauer = dm ? pyRound(Number(dm[1].replace(",", "."))) : null;
      const [seite] = seiteAusText(feld("seite"));
      if (!tag) grund = `Datum „${feld("datum")}“ nicht lesbar`;
      else if (!uhr) grund = `Beginn „${feld("beginn")}“ nicht lesbar`;
      else if (!dauerGueltig(dauer)) grund = `Dauer „${feld("dauer")}“ nicht zwischen ${DAUER_MIN} und ${DAUER_MAX} Min`;
      else if (!seite) grund = `Seite „${feld("seite")}“ unbekannt (Links, Rechts oder Beide)`;
      else eintrag = { start, dauer, seite, zuletzt: zuletztPruefen(seite, seiteAusText(feld("zuletzt"))[0]), notiz: notizLesen(feld("notiz")) };
    } else if (art === "windeln") {
      const [zeit, tag, uhr] = zeitpunktLesen(feld("datum"), feld("uhrzeit"));
      const windel = windelArtLesen(feld("art"));
      if (!tag) grund = `Datum „${feld("datum")}“ nicht lesbar`;
      else if (!uhr) grund = `Uhrzeit „${feld("uhrzeit")}“ nicht lesbar`;
      else if (!windel) grund = `Art „${feld("art")}“ unbekannt (nass, voll oder beides)`;
      else eintrag = { zeit, art: windel, stuhlfarbe: stuhlfarbePruefen(windel, stuhlfarbeLesen(feld("stuhlfarbe"))) };
    } else if (art === "groesse") {
      const tag = datumLesen(feld("datum")), cm = cmAusText(feld("cm"));
      if (!tag) grund = `Datum „${feld("datum")}“ nicht lesbar`;
      else if (cm === null) grund = `Größe „${feld("cm")}“ nicht lesbar (${CM_MIN}–${CM_MAX} cm)`;
      else eintrag = { datum: tag, cm };
    } else {
      const tag = datumLesen(feld("datum")), gramm = grammAusText(feld("gramm"));
      if (!tag) grund = `Datum „${feld("datum")}“ nicht lesbar`;
      else if (gramm === null) grund = `Gewicht „${feld("gramm")}“ nicht lesbar (${GRAMM_MIN}–${GRAMM_MAX} g)`;
      else eintrag = { datum: tag, gramm };
    }
    if (grund) fehler.push({ zeile: nummer, grund });
    else if (vorhanden.has(schl(eintrag))) doppelt++;
    else { vorhanden.add(schl(eintrag)); neu.push(eintrag); }
  }
  return { neu, vorhanden: doppelt, fehler };
}

export function eintragKurz(art, e) {
  if (art === "stillen")
    return `${datumDe(e.start)} ${e.start.slice(11)} · ${SEITEN_NAMEN[e.seite]}${e.zuletzt ? `, zuletzt ${SEITEN_NAMEN[e.zuletzt].toLowerCase()}` : ""} · ${e.dauer} Min` +
      (e.notiz ? ` · „${[...e.notiz].slice(0, 40).join("")}“` : "");
  if (art === "windeln") return `${datumDe(e.zeit)} ${e.zeit.slice(11)} · ${e.art}` + (e.stuhlfarbe ? ` · ${STUHLFARBEN[e.stuhlfarbe]}` : "");
  if (art === "groesse") return `${datumDe(e.datum)} · ${cmText(e.cm)} cm`;
  return `${datumDe(e.datum)} · ${e.gramm} g`;
}

export function routen(r) {
  r.post("import/:art", async ({ params, daten }) => {
    const art = params.art;
    if (!SPALTEN[art]) throw new ApiFehler("Unbekannte Datenart.", 404);
    if (typeof daten.text !== "string" || !daten.text.trim()) throw new ApiFehler("Bitte eine CSV-Datei auswählen.");
    const e = await importAuswerten(art, daten.text);
    if (e.fehler_datei) throw new ApiFehler(e.fehler_datei);
    const antwort = { art, neu: e.neu.length, vorhanden: e.vorhanden, fehler: e.fehler.slice(0, 50), fehler_anzahl: e.fehler.length,
      beispiele: e.neu.slice(0, 5).map(x => eintragKurz(art, x)) };
    if (!daten.bestaetigen) return antwort;
    for (const x of e.neu) await t.einfuegen(art, x);
    antwort.eingespielt = e.neu.length;
    return antwort;
  });
}
