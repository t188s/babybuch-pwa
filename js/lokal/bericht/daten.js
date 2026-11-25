// Babybuch PWA · Bericht · Daten zusammenstellen – 1:1 aus app.py 3.0.2 (bericht, krank_fuer_bericht, vergleich_24h,
// vorsorge_fuer_bericht, medikamente_fuer_bericht, tage_auswerten, geburtsgewicht_info, trend_eimer)

import * as t from "../tabellen.js";
import { einstellungenLesen, BERICHT_TEILE } from "../api/einstellungen.js";
import { stillenImBereich } from "../api/dateien.js";
import { STUHLFARBEN } from "../hilfen.js";
import { SYMPTOM_ARTEN, istNacht, pyRound, pyFixed, komma, gewichteAuswerten, groessenAuswerten, zeitraumAus } from "../pi/rechnen.js";
import { N, jetzt, heute, zeitText, tagText, plus, STUNDE, TAG, tageZwischen, wochentag, isoWoche } from "./naiv.js";
import { kennzahlen as ernKennzahlen } from "../../kern/ernaehrung.js";
import { svgRhythmus, svgZeitleiste, svgBalken, svgGewicht, svgGroesse } from "./grafiken.js";

const STANDARD_TEILE = ["zusammenfassung", "tage", "mahlzeiten", "notizen", "windeln", "medikamente", "gewicht", "g_rhythmus", "g_dauer", "g_gewicht"];
const sortZeit = l => t.sortiert(l, "zeit");
const imBereich = (l, feld, von, bis) => l.filter(x => x[feld] >= von && x[feld] < bis);

function tageAuswerten(eintraege, e) {
  const tage = {};
  for (const z of eintraege) {
    const tg = (tage[z.start.slice(0, 10)] ??= { anzahl: 0, minuten: 0, tag: 0, nacht: 0, L: 0, R: 0, B: 0, laengste_pause: 0 });
    tg.minuten += z.dauer; tg[z.seite] += 1;
    if (!z.fortsetzung) { tg.anzahl += 1; tg[istNacht(z.start, e) ? "nacht" : "tag"] += 1; }
    if (z.pause) tg.laengste_pause = Math.max(tg.laengste_pause, z.pause);
  }
  return tage;
}

function geburtsgewichtInfo(e, gewichte) {
  const gg = e.geburtsgewicht;
  if (!gg) return null;
  const nach = gewichte.filter(w => !e.geburtsdatum || w.datum > e.geburtsdatum);
  if (!nach.length) return { text: null };
  const tief = nach.reduce((a, b) => (b.gramm < a.gramm ? b : a));
  const info = { tief: tief.gramm < gg ? tief : null };
  info.erreicht = nach.find(w => w.gramm >= gg && (!info.tief || w.datum >= tief.datum)) || null;
  return info;
}

/** Stillen zwischen zwei Zeitpunkten (wie eintraege_im_bereich mit Zeitpunkten) */
const stillenZwischen = (vonQ, bisQ) => stillenImBereich({ von_q: vonQ, bis_q: bisQ });

async function trendEimer(vonTag, bisTag) {
  const h = N(heute());
  const ende = N(bisTag) < h ? N(bisTag) : h;
  const anfang = N(vonTag) < ende ? N(vonTag) : ende;
  const tageN = Math.round((ende - anfang) / TAG) + 1;
  let eimer, woche, n;
  if (tageN <= 31) {
    n = Math.max(3, tageN);
    eimer = Array.from({ length: n }, (_, i) => { const d = plus(ende, -(n - 1 - i) * TAG); return [d, d]; });
    woche = false;
  } else {
    n = Math.min(53, Math.ceil(tageN / 7));
    const montag = plus(ende, -wochentag(ende) * TAG);
    eimer = Array.from({ length: n }, (_, i) => { const v = plus(montag, -(n - 1 - i) * 7 * TAG); return [v, plus(v, 6 * TAG)]; });
    woche = true;
  }
  const eintraege = await stillenZwischen(tagText(eimer[0][0]), tagText(eimer[eimer.length - 1][1]) + "T99");
  const ergebnis = eimer.map(([von, bis]) => {
    const tage = {};
    for (const z of eintraege) {
      const tag = z.start.slice(0, 10);
      if (tagText(von) <= tag && tag <= tagText(bis)) { const x = (tage[tag] ??= [0, 0]); x[0] += z.fortsetzung ? 0 : 1; x[1] += z.dauer; }
    }
    const k = Object.keys(tage).length, laeuft = von <= h && h <= bis;
    const jahrDazu = woche && (n > 26 || eimer[0][0].getUTCFullYear() !== eimer[eimer.length - 1][1].getUTCFullYear());
    const [jahr, kw] = isoWoche(von);
    const text = woche ? `KW ${kw}` + (jahrDazu ? `/${String(jahr % 100).padStart(2, "0")}` : "") : `${von.getUTCDate()}.${von.getUTCMonth() + 1}.`;
    const summe = i => Object.values(tage).reduce((s, x) => s + x[i], 0);
    return { text: text + (laeuft ? "*" : ""), laeuft, mahlzeiten: k ? summe(0) / k : 0, minuten: k ? summe(1) / k : 0 };
  });
  return { eimer: ergebnis, woche, titel: woche
    ? (n >= 52 ? "1 Jahr" : n >= 26 ? "6 Monate" : n >= 13 ? "3 Monate" : `${n} Wochen`) + " · je Woche"
    : (n >= 28 ? "1 Monat" : `${n} Tage`) + " · je Tag" };
}

async function medikamenteFuerBericht(z) {
  const plaene = new Map((await t.alle("taegliche_gaben")).map(p => [p.id, p]));
  let entfernt = {}; try { entfernt = JSON.parse((await t.einstellungLesen("entfernte_gaben")) || "{}"); } catch (_) { entfernt = {}; }
  const gaben = sortZeit(imBereich(await t.alle("gaben"), "zeit", z.von_q, z.bis_q));
  const meds = sortZeit(imBereich(await t.alle("medikamente"), "zeit", z.von_q, z.bis_q));
  const jetztText = zeitText(jetzt());
  const regel = [];
  const ids = [...new Set([...gaben.map(g => g.gabe_id), ...plaene.keys()])].sort((a, b) => a - b);
  for (const gid of ids) {
    const p = plaene.get(gid), name = p ? p.name : entfernt[String(gid)] || "Regelmäßige Gabe";
    const gegeben = gaben.filter(g => g.gabe_id === gid);
    let soll = 0;
    if (p && !p.pausiert) {
      let zeiten; try { zeiten = JSON.parse(p.zeiten); } catch (_) { zeiten = []; }
      for (const tag of z.tage) {
        if ((p.ab && tag < p.ab) || (p.bis && tag > p.bis)) continue;
        soll += zeiten.filter(u => z.von_q <= `${tag}T${u}` && `${tag}T${u}` < z.bis_q && `${tag}T${u}` <= jetztText).length;
      }
    }
    if (gegeben.length || soll) regel.push({ name, menge: p ? p.menge : "", gegeben: gegeben.length, soll, zuletzt: gegeben.length ? gegeben[gegeben.length - 1].zeit : "" });
  }
  const bedarf = new Map();
  for (const m of meds) { const b = bedarf.get(m.name) || { name: m.name, anzahl: 0, zuletzt: "" }; b.anzahl++; b.zuletzt = m.zeit; bedarf.set(m.name, b); }
  const verlauf = [...gaben.map(g => ({ zeit: g.zeit, art: "regelmäßig", name: plaene.has(g.gabe_id) ? plaene.get(g.gabe_id).name : entfernt[String(g.gabe_id)] || "Regelmäßige Gabe",
      menge: plaene.has(g.gabe_id) ? plaene.get(g.gabe_id).menge : "", notiz: g.notiz })),
    ...meds.map(m => ({ zeit: m.zeit, art: "bei Bedarf", name: m.name, menge: m.menge, notiz: m.notiz }))];
  return { regel, bedarf: [...bedarf.values()], verlauf: t.sortiert(verlauf, "zeit") };
}

async function krankFuerBericht(z) {
  const fieber = sortZeit(imBereich(await t.alle("fieber"), "zeit", z.von_q, z.bis_q));
  const symptome = sortZeit(imBereich(await t.alle("symptome"), "zeit", z.von_q, z.bis_q));
  const med = await medikamenteFuerBericht(z);
  const werte = { anzahl: fieber.length };
  if (fieber.length) {
    werte.hoch = fieber.reduce((a, b) => (b.temp > a.temp ? b : a));
    werte.tief = fieber.reduce((a, b) => (b.temp < a.temp ? b : a));
    werte.erste_fieber = fieber.find(f => f.temp >= 38.0) || null;
    werte.letzte = fieber[fieber.length - 1];
    werte.fiebertage = new Set(fieber.filter(f => f.temp >= 38.0).map(f => f.zeit.slice(0, 10))).size;
    werte.unter = fieber.some(f => f.temp < 36.5);
  }
  const zaehl = new Map();
  for (const s of symptome) {
    const x = zaehl.get(s.art) || { name: SYMPTOM_ARTEN[s.art] || s.art, anzahl: 0, schwall: 0 };
    x.anzahl++; x.schwall += s.menge === "schwall" ? 1 : 0; zaehl.set(s.art, x);
  }
  const verlauf = [
    ...fieber.map(f => ({ zeit: f.zeit, was: "Temperatur", wert: `${pyFixed(f.temp, 1)} °C`.replace(".", ",") + (f.art ? ` · ${f.art}` : ""), notiz: f.notiz, auffaellig: f.temp >= 38.0 || f.temp < 36.5 })),
    ...symptome.filter(s => s.art !== "notiz").map(s => ({ zeit: s.zeit, was: "Symptom", wert: (SYMPTOM_ARTEN[s.art] || s.art) + (s.menge === "schwall" ? " · Schwall" : ""), notiz: s.notiz })),
    ...symptome.filter(s => s.art === "notiz").map(s => ({ zeit: s.zeit, was: "Notiz", wert: s.notiz, notiz: "" })),
    ...med.verlauf.map(v => ({ zeit: v.zeit, was: v.art === "bei Bedarf" ? "Medikament" : "Regelmäßig", wert: v.name + (v.menge ? ` · ${v.menge}` : ""), notiz: v.notiz })),
  ];
  return { fieber, symptome, werte, zaehl: [...zaehl.values()], medikamente: med, verlauf: t.sortiert(verlauf, "zeit") };
}

async function vergleich24h(z) {
  const ende = z.bis.includes("T") ? N(z.bis) : new Date(Math.min(jetzt(), plus(N(z.bis), TAG)));
  const windeln = await t.alle("windeln");
  const block = async (a, b) => {
    const eintr = (await stillenZwischen(zeitText(a), zeitText(b))).filter(x => x.start < zeitText(b));
    const pausen = eintr.filter(x => x.pause).map(x => x.pause);
    const w = windeln.filter(x => x.zeit >= zeitText(a) && x.zeit < zeitText(b));
    return { mahlzeiten: eintr.filter(x => !x.fortsetzung).length, minuten: eintr.reduce((s, x) => s + x.dauer, 0),
      laengste: pausen.length ? Math.max(...pausen) : 0, nass: w.filter(x => x.art === "nass" || x.art === "beides").length,
      voll: w.filter(x => x.art === "voll" || x.art === "beides").length };
  };
  const jetztB = await block(plus(ende, -24 * STUNDE), ende), davor = await block(plus(ende, -48 * STUNDE), plus(ende, -24 * STUNDE));
  const diff = k => {
    const a = jetztB[k], b = davor[k];
    if (!b) return "";
    const p = pyRound((a - b) / b * 100);
    return Math.abs(p) < 10 ? "≈ gleich" : `${p > 0 ? "+" : "−"}${Math.abs(p)} %`;
  };
  return { jetzt: jetztB, davor, diff: Object.fromEntries(Object.keys(jetztB).map(k => [k, diff(k)])), ende: zeitText(ende) };
}

async function vorsorgeFuerBericht(z) {
  const u = await t.alle("untersuchungen");                     // Anlege-Reihenfolge = U1 … Z6 (wie ORDER BY id)
  const h = heute();
  const erledigt = u.filter(x => x.am || x.erledigt);
  const offen = u.filter(x => !(x.am || x.erledigt) && x.art.startsWith("U")).slice(0, 2);
  const impf = t.sortiert(await t.alle("impfungen"), "am").map(i => { let g; try { g = typeof i.gegen === "string" ? JSON.parse(i.gegen) : i.gegen; } catch (_) { g = []; } return { ...i, gegen: g }; });
  const massn = (await t.alle("massnahmen")).filter(m => m.erledigt === "");
  const arzt = t.sortiert((await t.alle("arztbesuche")).filter(a => (a.am >= z.von.slice(0, 10) && a.am <= z.bis.slice(0, 10)) || (a.am === "" && a.termin >= h))
    .map(a => ({ ...a, _s: a.am || a.termin })), "_s");
  return { erledigt, offen, impfungen: impf, massnahmen: massn, arzt };
}

/** Alle Werte für die Vorlage. q = URLSearchParams wie /bericht?von=…&bis=…&teile=…&fuer=…&anliegen=… */
export async function berichtDaten(q) {
  const z = zeitraumAus(q.get("von") || "", q.get("bis") || "");
  if (!z) return null;
  const gewaehlt = (q.get("teile") || "").split(",").filter(x => BERICHT_TEILE.includes(x));
  const teile = gewaehlt.length ? gewaehlt : STANDARD_TEILE;
  const e = await einstellungenLesen();
  const eintraege = await stillenImBereich(z);
  for (const x of eintraege) x.nacht = istNacht(x.start, e);
  const tage = tageAuswerten(eintraege, e);
  const mahlzeiten = eintraege.filter(x => !x.fortsetzung), pausen = eintraege.filter(x => x.pause).map(x => x.pause);
  const summeSeite = s => eintraege.filter(x => x.seite === s).reduce((a, x) => a + x.dauer, 0);
  const gesamt = { anzahl: mahlzeiten.length, minuten: eintraege.reduce((a, x) => a + x.dauer, 0), tage: Object.keys(tage).length,
    tag: mahlzeiten.filter(x => !x.nacht).length, nacht: mahlzeiten.filter(x => x.nacht).length,
    laengste_pause: pausen.length ? Math.max(...pausen) : 0, abstand: pausen.length ? pyRound(pausen.reduce((a, b) => a + b, 0) / pausen.length) : 0,
    L: summeSeite("L"), R: summeSeite("R"), B: summeSeite("B") };
  const windelListe = sortZeit(imBereich(await t.alle("windeln"), "zeit", z.von_q, z.bis_q));
  const windeln = {};
  for (const w of windelListe) {
    const x = (windeln[w.zeit.slice(0, 10)] ??= { nass: 0, voll: 0, farben: [] });
    if (w.art === "nass" || w.art === "beides") x.nass++;
    if (w.art === "voll" || w.art === "beides") x.voll++;
    if (w.stuhlfarbe && !x.farben.includes(STUHLFARBEN[w.stuhlfarbe])) x.farben.push(STUHLFARBEN[w.stuhlfarbe]);
  }
  const wv = Object.values(windeln);
  const windelGesamt = { nass: wv.reduce((a, x) => a + x.nass, 0), voll: wv.reduce((a, x) => a + x.voll, 0), tage: wv.length, hell: windelListe.some(w => w.stuhlfarbe === "hell") };
  const bisTag = z.bis_q.slice(0, 10), vonTag = z.von.slice(0, 10);
  const alleGewichte = gewichteAuswerten(e, t.sortiert((await t.alle("gewicht")).filter(w => w.datum <= bisTag), "datum"));
  const gewichte = alleGewichte.filter(w => w.datum >= vonTag), vorher = alleGewichte.filter(w => w.datum < vonTag);
  const tabelleGewichte = [...vorher.slice(-1), ...gewichte].slice(-20);
  tabelleGewichte.forEach((w, i) => {
    if (!i) return;
    const v = tabelleGewichte[i - 1], d = tageZwischen(w.datum, v.datum);
    w.diff = w.gramm - v.gramm; w.pro_tag = d > 0 ? pyRound(w.diff / d) : null;
  });

  const grafiken = {};
  if (teile.includes("g_rhythmus")) grafiken.rhythmus = svgRhythmus(z, eintraege, windelListe, e);
  if (teile.includes("g_dauer")) {
    const h = heute();
    grafiken.dauer = svgBalken(z.tage.filter(x => x <= h).slice(-31).map(x => [`${x.slice(8, 10)}.${x.slice(5, 7)}.`, tage[x]?.minuten ?? 0, x in tage ? String(tage[x].anzahl) : ""]),
      "Stilldauer pro Tag", "Minuten pro Tag · Zahl über der Säule = Mahlzeiten", v => String(pyRound(v)));
  }
  if (teile.includes("g_trend")) {
    const tr = await trendEimer((z.von || z.bis).slice(0, 10), z.bis.slice(0, 10));
    const breit = tr.eimer.length > 10, laeuft = new Set(tr.eimer.map((w, i) => (w.laeuft ? i : -1)).filter(i => i >= 0)), B = breit ? 760 : 380;
    grafiken.trend_mahlzeiten = svgBalken(tr.eimer.map(w => [w.text, w.mahlzeiten, w.mahlzeiten ? (tr.woche ? komma(w.mahlzeiten) : String(pyRound(w.mahlzeiten))) : ""]),
      "Trend Mahlzeiten", "Ø Mahlzeiten pro Tag", v => komma(v, 0), B, laeuft);
    grafiken.trend_minuten = svgBalken(tr.eimer.map(w => [w.text, w.minuten, w.minuten ? String(pyRound(w.minuten)) : ""]),
      "Trend Stillminuten", "Ø Stillminuten pro Tag", v => String(pyRound(v)), B, laeuft);
    Object.assign(grafiken, { trend_titel: tr.titel, trend_breit: breit, trend_woche: tr.woche, trend_laeuft: tr.eimer.some(w => w.laeuft) });
  }
  if (teile.includes("g_gewicht") && alleGewichte.length) grafiken.gewicht = svgGewicht(alleGewichte, e);
  const alleGroessen = groessenAuswerten(e, t.sortiert((await t.alle("groesse")).filter(g => g.datum <= bisTag), "datum"));
  if (teile.includes("g_groesse") && alleGroessen.length) grafiken.groesse = svgGroesse(alleGroessen, e);
  const groessen = [...alleGroessen.filter(g => g.datum < vonTag).slice(-1), ...alleGroessen.filter(g => g.datum >= vonTag)].slice(-20);
  groessen.forEach((g, i) => { if (i) g.diff = pyRound(g.cm - groessen[i - 1].cm, 1); });

  const medikamente = teile.includes("medikamente") ? await medikamenteFuerBericht(z) : null;
  const fuer = ["hebamme", "kinderaerztin"].includes(q.get("fuer")) ? q.get("fuer") : "";
  const anliegen = (q.get("anliegen") || "").trim().slice(0, 600);
  gesamt.zugefuettert = eintraege.filter(x => (x.notiz || "").toLowerCase().includes("zugefüttert")).length;
  const krank = ["krank", "zeitleiste", "verlauf"].some(x => teile.includes(x)) ? await krankFuerBericht(z) : null;
  if (krank && teile.includes("zeitleiste")) grafiken.zeitleiste = svgZeitleiste(z, krank, eintraege, windelListe, e);
  const vergleich = teile.includes("vergleich") ? await vergleich24h(z) : null;
  let kopfListe = [];
  if (teile.includes("kopf")) {
    const alleK = t.sortiert((await t.alle("kopfumfang")).filter(k => k.datum <= z.bis.slice(0, 10)), "datum");
    kopfListe = [...alleK.filter(k => k.datum < vonTag).slice(-1), ...alleK.filter(k => k.datum >= vonTag)].slice(-20);
    kopfListe.forEach((k, i) => { if (i) k.diff = pyRound(k.cm - kopfListe[i - 1].cm, 1); });
  }
  const vorsorge = teile.includes("vorsorge") ? await vorsorgeFuerBericht(z) : null;
  let alterText = "";
  if (e.geburtsdatum) {
    const alter = tageZwischen(z.bis.slice(0, 10), e.geburtsdatum);
    if (alter >= 0) alterText = alter < 56 ? `${alter} Tage` : `${Math.floor(alter / 7)} Wochen`;
  }
  // Web-App: Fläschchen, Abpumpen, Beikost – erscheint nur, wenn es im Zeitraum Einträge gibt
  const ern = {};
  for (const typ of ["flasche", "abpumpen", "beikost"]) ern[typ] = sortZeit(imBereich(await t.alle(typ), "zeit", z.von_q, z.bis_q));
  const ernaehrung = ern.flasche.length || ern.abpumpen.length || ern.beikost.length
    ? { ...ern, k: ernKennzahlen({ flaschen: ern.flasche, pumpen: ern.abpumpen, beikost: ern.beikost, tage: z.stunden ? 1 : z.tage.length }) } : null;
  const alleTage = [...new Set([...Object.keys(tage), ...(teile.includes("windeln") ? Object.keys(windeln) : [])])].sort();
  return { groessen, letzte_groesse: alleGroessen[alleGroessen.length - 1] || null, z, gewaehlt: teile, tage, eintraege, gesamt, windeln,
    windel_gesamt: windelGesamt, windel_liste: windelListe, gewichte: tabelleGewichte, letztes_gewicht: alleGewichte[alleGewichte.length - 1] || null,
    gg_info: geburtsgewichtInfo(e, alleGewichte), grafiken, e, alter_text: alterText, medikamente, fuer, anliegen, krank, vergleich,
    kopf_liste: kopfListe, vorsorge, alle_tage: alleTage, ernaehrung };
}
