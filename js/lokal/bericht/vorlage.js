// Babybuch PWA · Bericht · HTML-Vorlage – 1:1 aus templates/bericht.html der Pi-Version 3.0.2 (Jinja → JavaScript)
// Alles, was die Familie eingetragen hat, wird wie bei Jinja maskiert (esc). Grafiken sind fertiges SVG.

import { hm, komma, prozentText, cmText, datumDe as datum, SEITEN_NAMEN as seiten, pyRound } from "../pi/rechnen.js";
import { esc } from "./grafiken.js";
import { FLASCHE_ARTEN, BEIKOST_MENGEN } from "../../kern/ernaehrung.js";

const tausender = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const mitVorzeichen = n => (n >= 0 ? "+" : "-") + Math.abs(n);          // Python "%+d"
const wenn = (b, text) => (b ? text : "");
const alle = (liste, f) => liste.map(f).join("");
const STIL = `
    :root {
      --hintergrund: #ffffff; --text: #17150f; --text-leise: #6f685c; --linie: #e3ddd1; --gold: #8d6f3c; --zart: #f6f1e7;
      --schrift-titel: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      --schrift-text: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color-scheme: light;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--hintergrund); color: var(--text); font-family: var(--schrift-text);
           font-size: 13px; line-height: 1.45; }
    main { max-width: 820px; margin: 0 auto;
           padding-top: max(24px, env(safe-area-inset-top, 0px)); padding-bottom: 40px;
           padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
    h1, h2 { font-family: var(--schrift-titel); font-weight: 500; margin: 0; }
    h1 { font-size: 26px; }
    h2 { font-size: 17px; margin: 26px 0 8px; break-after: avoid; }
    .eyebrow { margin: 0; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: var(--gold); }
    .leise { color: var(--text-leise); }
    .klein { font-size: 11px; margin: 4px 0 0; }
    header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap;
             border-bottom: 1px solid var(--text); padding-bottom: 12px; }
    .kennzahlen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 12px; }
    .gruppe { display: grid; grid-template-columns: 74px 1fr; gap: 12px; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--linie); }
    .gruppe h3 { margin: 0; font-family: var(--schrift-titel); font-weight: 500; font-size: 15px; color: var(--gold); }
    .gruppe .kennzahlen div { border-top: none; padding-top: 0; }
    .kennzahlen div { border-top: 1px solid var(--linie); padding-top: 6px; }
    .kennzahlen b { display: block; font-family: var(--schrift-titel); font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; }
    .kennzahlen span { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--text-leise); }
    .anliegen { border: 1.5px solid var(--gold); border-radius: 10px; padding: 10px 14px; background: var(--zart); }
    .anliegen h2 { margin-top: 2px; }
    .klein { font-size: 11px; }
    .hinweis { margin-top: 12px; border-left: 2px solid var(--gold); padding: 4px 10px; background: var(--zart); }
    .tabelle { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    th { text-align: left; font-weight: 500; font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
         color: var(--text-leise); border-bottom: 1px solid var(--text); padding: 6px 8px 6px 0; white-space: nowrap; }
    td { border-bottom: 1px solid var(--linie); padding: 6px 8px 6px 0; vertical-align: top; }
    td.zahl, th.zahl { text-align: right; }
    tr.tagkopf td { background: var(--zart); font-family: var(--schrift-titel); font-size: 14px; padding-left: 6px; }
    .notiz { font-style: italic; white-space: pre-line; }
    .grafik { display: block; width: 100%; height: auto; margin-top: 4px; }
    .erklaerung { margin: -2px 0 6px; font-size: 11px; }
    .erklaerung b { color: var(--text); font-weight: 600; }
    .zwei { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .zwei h3 { margin: 0; font-size: 11px; font-weight: 500; color: var(--text-leise); letter-spacing: .06em; text-transform: uppercase; }
    button { font: inherit; min-height: 42px; padding: 0 16px; border-radius: 10px; cursor: pointer;
             background: var(--text); color: var(--hintergrund); border: none; }
    .knoepfe { display: flex; gap: 8px; flex-wrap: wrap; }
    .knoepfe a { display: inline-flex; align-items: center; min-height: 42px; padding: 0 14px; border-radius: 10px;
                 border: 1px solid var(--linie); color: var(--text); text-decoration: none; }
    section { break-inside: avoid-page; }
    @media (max-width: 560px) { .kennzahlen { grid-template-columns: repeat(2, 1fr); } .gruppe { grid-template-columns: 1fr; gap: 4px; } .zwei { grid-template-columns: 1fr; } }
    @media print {
      .knoepfe { display: none; }
      main { padding: 0; max-width: none; }
      tr { break-inside: avoid; }
      @page { margin: 14mm; }
    }`;

/**
 * @param w Werte aus berichtDaten()
 * @param {{gespeichert?: boolean, erstellt?: Date, knoepfe?: string}} o  knoepfe = zusätzliche Knöpfe der Web-App (z. B. Teilen)
 */
export function berichtHtml(w, { gespeichert = false, erstellt = null, knoepfe = "" } = {}) {
  const { e, z, gewaehlt: g, gesamt, grafiken: gr } = w, hat = x => g.includes(x);
  const zwei = n => String(n).padStart(2, "0");
  const teile = [];
  teile.push(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Babybuch${wenn(e.name, " " + esc(e.name))} · ${esc(z.titel)}</title>
  <style>${STIL}
  </style>
</head>
<body>
<main>
  <header>
    <div>
      <p class="eyebrow">Babybuch${wenn(e.name, " · " + esc(e.name))} · ${w.fuer === "hebamme" ? "Bericht für die Hebamme" : w.fuer === "kinderaerztin" ? "Bericht für die Kinderärztin" : "Protokoll für Hebamme &amp; Kinderarzt"}</p>
      <h1>${esc(z.titel)}</h1>
      <p class="leise" style="margin:4px 0 0">
        ${wenn(e.geburtsdatum, `Geboren ${datum(e.geburtsdatum)}${wenn(w.alter_text, ` (am Ende des Zeitraums ${w.alter_text} alt)`)} · `)}
        ${wenn(e.geburtsgewicht, `Geburtsgewicht ${tausender(e.geburtsgewicht)} g · `)}
        Nacht = ${e.nacht_von}–${e.nacht_bis} Uhr · Abstände gemessen von Beginn zu Beginn · Seitenwechsel innerhalb von 5 Min = eine Mahlzeit
      </p>
    </div>
    <div class="knoepfe">
      <button type="button" onclick="window.print()">Drucken / als PDF</button>
      ${knoepfe}${wenn(!gespeichert, '<a href="./">Zurück</a>')}
    </div>
  </header>
`);
  if (w.anliegen) teile.push(`<section class="anliegen"><h2>Fragen &amp; Anliegen</h2><p style="white-space:pre-line;margin:0">${esc(w.anliegen)}</p></section>`);

  const v = w.vergleich;
  if (v) teile.push(`<section>
  <h2>Trinken &amp; Windeln – letzte 24 h im Vergleich</h2>
  <div class="tabelle"><table>
    <thead><tr><th></th><th class="zahl">letzte 24 h</th><th class="zahl">24 h davor</th><th class="zahl">Veränderung</th></tr></thead>
    <tbody>
      <tr><td>Mahlzeiten</td><td class="zahl">${v.jetzt.mahlzeiten}</td><td class="zahl">${v.davor.mahlzeiten}</td><td class="zahl">${v.diff.mahlzeiten}</td></tr>
      <tr><td>Stilldauer (Std:Min)</td><td class="zahl">${hm(v.jetzt.minuten)}</td><td class="zahl">${hm(v.davor.minuten)}</td><td class="zahl">${v.diff.minuten}</td></tr>
      <tr><td>Längster Abstand</td><td class="zahl">${hm(v.jetzt.laengste)}</td><td class="zahl">${hm(v.davor.laengste)}</td><td class="zahl">${v.diff.laengste}</td></tr>
      <tr><td>Nasse Windeln</td><td class="zahl">${v.jetzt.nass}</td><td class="zahl">${v.davor.nass}</td><td class="zahl">${v.diff.nass}</td></tr>
      <tr><td>Volle Windeln</td><td class="zahl">${v.jetzt.voll}</td><td class="zahl">${v.davor.voll}</td><td class="zahl">${v.diff.voll}</td></tr>
    </tbody></table></div>
  <p class="leise klein">Bezogen auf das Ende des Zeitraums (${datum(v.ende.slice(0, 10))} ${v.ende.slice(11)} Uhr). Abstand von Beginn zu Beginn.</p>
  </section>`);

  const k = w.krank;
  if (hat("krank") && k) {
    const kw = k.werte, zt = x => `${datum(x.zeit.slice(0, 10))} ${x.zeit.slice(11)}`;
    let s = `<section>\n  <h2>Fieber &amp; Symptome</h2>`;
    if (kw.anzahl) s += `<div class="kennzahlen">` +
      wenn(kw.erste_fieber, `<div><b>${komma(kw.erste_fieber?.temp ?? 0)} °C</b><span>erstes Fieber · ${kw.erste_fieber ? zt(kw.erste_fieber) : ""}</span></div>`) +
      `<div><b>${komma(kw.hoch.temp)} °C</b><span>höchster Wert · ${zt(kw.hoch)}${wenn(kw.hoch.art, " · " + esc(kw.hoch.art))}</span></div>` +
      `<div><b>${komma(kw.tief.temp)} °C</b><span>niedrigster Wert${wenn(kw.tief.temp < 36.5, " – unter 36,5 °C")}</span></div>` +
      `<div><b>${komma(kw.letzte.temp)} °C</b><span>zuletzt · ${zt(kw.letzte)}${wenn(kw.letzte.art, " · " + esc(kw.letzte.art))}</span></div>` +
      `<div><b>${kw.anzahl}</b><span>Messungen</span></div><div><b>${kw.fiebertage}</b><span>Tage mit Fieber ab 38,0 °C</span></div></div>`;
    else s += `<p class="leise">Keine Temperatur gemessen.</p>`;
    if (k.zaehl.length) s += `<h3 style="margin-top:12px">Symptome</h3><p style="margin:4px 0 0">` +
      k.zaehl.map((x, i) => (x.name !== "Notiz" ? `<b>${x.anzahl}×</b> ${esc(x.name)}${wenn(x.schwall, ` (davon ${x.schwall}× Schwall)`)}${wenn(i < k.zaehl.length - 1, " · ")}` : "")).join("") + `</p>`;
    s += `<p class="leise klein">Notiert wie gemessen (Messart in Klammern). Das Babybuch stellt keine Diagnose.</p></section>`;
    teile.push(s);
  }
  if (gr.zeitleiste) teile.push(`<section><h2>Zeitleiste</h2><p class="leise erklaerung">Fieberkurve (Linien bei 38,0 und 36,5 °C), darunter Symptome ◆, Medikamente ■ (grün = regelmäßige Gabe), Stillen und nasse Windeln. Höchstens die letzten 14 Tage des Zeitraums. Nacht hinterlegt.</p>${gr.zeitleiste}</section>`);

  if (hat("zusammenfassung")) {
    const ss = gesamt.L + gesamt.R + gesamt.B, ganz = x => pyRound(x * 100 / ss);
    let s = `<section><div class="gruppe"><h3>Stillen</h3><div class="kennzahlen">` +
      `<div><b>${gesamt.anzahl}</b><span>Mahlzeiten${wenn(z.stunden, " in 24 h")}</span></div>` +
      wenn(!z.stunden, `<div><b>${gesamt.tage ? komma(gesamt.anzahl / gesamt.tage) : "–"}</b><span>Ø pro Tag</span></div>`) +
      `<div><b>${gesamt.tag} / ${gesamt.nacht}</b><span>davon Tag / Nacht</span></div>` +
      `<div><b>${hm(gesamt.minuten)}</b><span>Stilldauer Std:Min</span></div>` +
      `<div><b>${gesamt.anzahl ? Math.floor(gesamt.minuten / gesamt.anzahl) : "–"}</b><span>Ø Min pro Mahlzeit</span></div>` +
      `<div><b>${hm(gesamt.abstand)}</b><span>Ø Abstand Std:Min</span></div>` +
      `<div><b>${hm(gesamt.laengste_pause)}</b><span>Längster Abstand</span></div>` +
      wenn(gesamt.zugefuettert, `<div><b>${gesamt.zugefuettert}</b><span>mit Notiz „zugefüttert“</span></div>`) +
      `<div><b>${ss ? `${ganz(gesamt.L)} / ${ganz(gesamt.R)}${wenn(gesamt.B, ` / ${ganz(gesamt.B)}`)} %` : "–"}</b><span>Minuten L / R${wenn(gesamt.B, " / Beide")}</span></div>` +
      `</div></div>`;
    const wg = w.windel_gesamt;
    if (wg.tage) s += `<div class="gruppe"><h3>Windeln</h3><div class="kennzahlen">` +
      `<div><b>${z.stunden ? wg.nass : komma(wg.nass / wg.tage)}</b><span>${z.stunden ? "nasse" : "Ø nasse pro Tag"}</span></div>` +
      `<div><b>${z.stunden ? wg.voll : komma(wg.voll / wg.tage)}</b><span>${z.stunden ? "volle" : "Ø volle pro Tag"}</span></div></div></div>`;
    const lg = w.letztes_gewicht, lgr = w.letzte_groesse;
    if (lg || lgr) {
      s += `<div class="gruppe"><h3>Wachstum</h3><div class="kennzahlen">`;
      if (lg) s += `<div><b>${tausender(lg.gramm)} g</b><span>am ${datum(lg.datum)}</span></div>` +
        wenn("prozent" in lg, `<div><b>${"prozent" in lg ? prozentText(lg.prozent) : ""}</b><span>zum Geburtsgewicht</span></div>`) +
        wenn(lg.perzentil, `<div><b>P${lg.perzentil}</b><span>WHO Gewicht</span></div>`);
      if (lgr) s += `<div><b>${cmText(lgr.cm)} cm</b><span>Größe am ${datum(lgr.datum)}</span></div>` + wenn(lgr.perzentil, `<div><b>P${lgr.perzentil}</b><span>WHO Größe</span></div>`);
      s += `</div></div>`;
    }
    if (wg.hell) s += `<p class="hinweis">Im Zeitraum wurde mindestens einmal ein <b>heller/weißlicher Stuhl</b> eingetragen.</p>`;
    teile.push(s + `</section>`);
  }
  // ── Nur Web-App: Fläschchen, Abpumpen, Beikost (gibt es auf dem Pi noch nicht) ──
  const er = w.ernaehrung;
  if (er && (hat("zusammenfassung") || hat("mahlzeiten"))) {
    const ek = er.k, ml = x => `${tausender(Math.round(x))} ml`;
    let s = `<section><h2>Fläschchen, Abpumpen &amp; Beikost</h2>`;
    if (ek.flaschen) s += `<div class="gruppe"><h3>Fläschchen</h3><div class="kennzahlen">` +
      `<div><b>${ek.flaschen}</b><span>Fläschchen${wenn(z.stunden, " in 24 h")}</span></div>` +
      `<div><b>${ml(ek.flascheMl)}</b><span>zusammen</span></div>` + wenn(!z.stunden, `<div><b>${ml(ek.flascheMlProTag)}</b><span>Ø pro Tag</span></div>`) +
      `<div><b>${ml(ek.flascheMl / ek.flaschen)}</b><span>Ø je Fläschchen</span></div></div></div>` +
      `<p class="leise klein">${Object.entries(ek.artenMl).filter(([, x]) => x).map(([a, x]) => `${FLASCHE_ARTEN[a] || esc(a)} ${ml(x)}`).join(" · ")}</p>`;
    if (ek.pumpen) s += `<div class="gruppe"><h3>Abgepumpt</h3><div class="kennzahlen">` +
      `<div><b>${ek.pumpen}</b><span>mal abgepumpt</span></div><div><b>${ml(ek.pumpenMl)}</b><span>zusammen</span></div>` +
      wenn(!z.stunden, `<div><b>${ml(ek.pumpenMlProTag)}</b><span>Ø pro Tag</span></div>`) + `</div></div>`;
    if (ek.beikost) {
      const was = new Map();
      for (const b of er.beikost) was.set(b.was, (was.get(b.was) || 0) + 1);
      s += `<div class="gruppe"><h3>Beikost</h3><div><p style="margin:0">${[...was].map(([x, n]) => `${esc(x)}${wenn(n > 1, ` (${n}×)`)}`).join(" · ")}</p>` +
        wenn(ek.beikostNeu.length, `<p class="leise klein">Zum ersten Mal: ${esc(ek.beikostNeu.join(", "))}</p>`) + `</div></div>`;
    }
    if (hat("mahlzeiten")) {
      const alleE = [...er.flasche.map(x => ["Fläschchen", x, `${x.ml} ml · ${FLASCHE_ARTEN[x.art] || esc(x.art)}`]),
        ...er.abpumpen.map(x => ["Abgepumpt", x, `${x.ml} ml · ${seiten[x.seite] || ""}`]),
        ...er.beikost.map(x => ["Beikost", x, `${esc(x.was)} · ${BEIKOST_MENGEN[x.menge] || esc(x.menge)}${wenn(x.neu, " · zum ersten Mal")}`])]
        .sort((a, b) => (a[1].zeit < b[1].zeit ? -1 : a[1].zeit > b[1].zeit ? 1 : 0));
      s += `<div class="tabelle" style="margin-top:10px"><table><thead><tr><th>Datum</th><th>Zeit</th><th>Was</th><th>Eintrag</th>${wenn(hat("notizen"), "<th>Notiz</th>")}</tr></thead><tbody>` +
        alle(alleE, ([art, x, text]) => `<tr><td>${datum(x.zeit.slice(0, 10))}</td><td>${x.zeit.slice(11)}</td><td>${art}</td><td>${text}</td>${wenn(hat("notizen"), `<td class="notiz">${esc(x.notiz)}</td>`)}</tr>`) +
        `</tbody></table></div>`;
    }
    teile.push(s + `<p class="leise klein">Nur zur Orientierung – Mengen wie eingetragen.</p></section>`);
  }
  if (gr.rhythmus) teile.push(`<section><h2>Tagesrhythmus</h2><p class="leise erklaerung">${z.stunden ? "Die Zeile zeigt die 24 Stunden" : "Jede Zeile ist ein Tag von 0 bis 24 Uhr"}.
      <b>Obere Spur:</b> Stillmahlzeiten, Farbe = Seite, hinterlegt = Nacht.
      <b>Untere Spur:</b> Windeln (Tropfen = nass, Punkt = voll). <b>Rechts:</b> Mahlzeiten, Stilldauer und Windeln des Tages.</p>${gr.rhythmus}</section>`);
  if (gr.dauer) teile.push(`<section><h2>Stilldauer pro Tag</h2><p class="leise erklaerung">Höhe der Säule = Stillminuten des Tages, Zahl darüber = Anzahl der Mahlzeiten.</p>${gr.dauer}</section>`);
  if (gr.trend_mahlzeiten) teile.push(`<section><h2>Trend · ${gr.trend_titel}</h2><div class="${gr.trend_breit ? "" : "zwei"}">` +
    `<div><h3>Ø Mahlzeiten pro Tag</h3>${gr.trend_mahlzeiten}</div><div><h3>Ø Stillminuten pro Tag</h3>${gr.trend_minuten}</div></div>` +
    `<p class="leise klein">${gr.trend_woche ? "Durchschnitt über die Tage mit Einträgen je Kalenderwoche." : "Werte je Tag."}${wenn(gr.trend_laeuft, " Blasse Säule (*) = läuft noch, daher unvollständig.")}</p></section>`);

  if (hat("tage")) {
    const ww = hat("windeln");
    teile.push(`<section><h2>Tagesübersicht</h2><div class="tabelle"><table><thead><tr>` +
      `<th>Datum</th><th class="zahl">Mahlz.</th><th class="zahl">Tag</th><th class="zahl">Nacht</th><th class="zahl">Dauer</th><th class="zahl">Längster Abstand</th><th class="zahl">L / R / B</th>` +
      wenn(ww, `<th class="zahl">Windeln nass</th><th class="zahl">voll</th>`) + `</tr></thead><tbody>` +
      (w.alle_tage.length ? alle(w.alle_tage, tag => {
        const t = w.tage[tag] || {}, x = w.windeln[tag] || {};
        return `<tr><td>${datum(tag)}</td><td class="zahl">${t.anzahl || 0}</td><td class="zahl">${t.tag || 0}</td><td class="zahl">${t.nacht || 0}</td>` +
          `<td class="zahl">${hm(t.minuten || 0)}</td><td class="zahl">${hm(t.laengste_pause || 0)}</td><td class="zahl">${t.L || 0} / ${t.R || 0} / ${t.B || 0}</td>` +
          wenn(ww, `<td class="zahl">${x.nass || 0}</td><td class="zahl">${x.voll || 0}</td>`) + `</tr>`;
      }) : `<tr><td colspan="9" class="leise">Keine Einträge in diesem Zeitraum.</td></tr>`) + `</tbody></table></div></section>`);
  }
  if (hat("windeln")) {
    teile.push(`<section><h2>Windeln</h2>` + (w.windel_liste.length
      ? `<div class="tabelle"><table><thead><tr><th>Datum</th><th class="zahl">nass</th><th class="zahl">voll</th><th>Stuhlfarbe</th></tr></thead><tbody>` +
        alle(Object.keys(w.windeln).sort(), tag => { const x = w.windeln[tag];
          return `<tr><td>${datum(tag)}</td><td class="zahl">${x.nass}</td><td class="zahl">${x.voll}</td><td>${esc(x.farben.join(", ")) || "–"}</td></tr>`; }) +
        `</tbody></table></div><p class="leise klein">„nass“ zählt nasse und gemischte Windeln, „voll“ volle und gemischte.</p>`
      : `<p class="leise">Keine Windeln in diesem Zeitraum eingetragen.</p>`) + `</section>`);
  }
  const m = w.medikamente;
  if (hat("medikamente") && m) {
    let s = `<section><h2>Medikamente &amp; Gaben</h2>`;
    if (m.regel.length || m.bedarf.length) {
      s += `<div class="tabelle"><table><thead><tr><th>Was</th><th>Art</th><th class="zahl">gegeben</th><th>zuletzt</th></tr></thead><tbody>` +
        alle(m.regel, r => `<tr><td>${esc(r.name)}${wenn(r.menge, ` <span class="leise">· ${esc(r.menge)}</span>`)}</td><td>regelmäßig</td>` +
          `<td class="zahl">${r.gegeben}${wenn(r.soll, ` von ${r.soll}`)}</td><td>${r.zuletzt ? `${datum(r.zuletzt.slice(0, 10))} ${r.zuletzt.slice(11)}` : "–"}</td></tr>`) +
        alle(m.bedarf, b => `<tr><td>${esc(b.name)}</td><td>bei Bedarf</td><td class="zahl">${b.anzahl}</td><td>${datum(b.zuletzt.slice(0, 10))} ${b.zuletzt.slice(11)}</td></tr>`) +
        `</tbody></table></div>`;
      if (m.verlauf.length) s += `<h3 style="margin-top:14px">Jede Gabe</h3><div class="tabelle"><table><thead><tr><th>Datum</th><th>Zeit</th><th>Was</th><th>Menge</th>${wenn(hat("notizen"), "<th>Notiz</th>")}</tr></thead><tbody>` +
        alle(m.verlauf, x => `<tr><td>${datum(x.zeit.slice(0, 10))}</td><td>${x.zeit.slice(11)}</td><td>${esc(x.name)} <span class="leise">· ${x.art}</span></td><td>${esc(x.menge) || "–"}</td>${wenn(hat("notizen"), `<td class="notiz">${esc(x.notiz)}</td>`)}</tr>`) +
        `</tbody></table></div>`;
      s += `<p class="leise klein">Notiert wie gegeben – das Babybuch berechnet keine Dosis. „x von y“ = abgehakte von geplanten Gaben im Zeitraum.</p>`;
    } else s += `<p class="leise">Keine Medikamente oder Gaben in diesem Zeitraum eingetragen.</p>`;
    teile.push(s + `</section>`);
  }
  if (hat("verlauf") && k) {
    teile.push(`<section><h2>Verlauf – jeder Eintrag</h2>` + (k.verlauf.length
      ? `<div class="tabelle"><table><thead><tr><th>Datum</th><th>Zeit</th><th>Was</th><th>Eintrag</th>${wenn(hat("notizen"), "<th>Notiz</th>")}</tr></thead><tbody>` +
        alle(k.verlauf, x => `<tr><td>${datum(x.zeit.slice(0, 10))}</td><td>${x.zeit.slice(11)}</td><td>${x.was}</td><td>${x.auffaellig ? `<b>${esc(x.wert)}</b>` : esc(x.wert)}</td>${wenn(hat("notizen"), `<td class="notiz">${esc(x.notiz)}</td>`)}</tr>`) +
        `</tbody></table></div>`
      : `<p class="leise">Keine Temperatur, Symptome oder Gaben in diesem Zeitraum.</p>`) + `</section>`);
  }
  if (hat("gewicht") || gr.gewicht) {
    let s = `<section><h2>Gewicht</h2>`;
    if (e.geburtsdatum && e.geschlecht) s += `<p class="leise" style="margin:-4px 0 6px">Perzentilen nach WHO Child Growth Standards (Gewicht nach Alter, ${e.geschlecht === "w" ? "Mädchen" : "Junge"}) – nur zur Orientierung. Bei Geburt ohne Berücksichtigung der Schwangerschaftswoche; die ärztliche Einordnung nach Schwangerschaftswoche kann abweichen.</p>`;
    const gi = w.gg_info;
    if (gi && (gi.tief || gi.erreicht)) {
      s += `<p class="hinweis">`;
      if (gi.tief) s += `Tiefster Wert: ${tausender(gi.tief.gramm)} g am ${datum(gi.tief.datum)}${wenn(gi.tief.alter !== null && gi.tief.alter !== undefined, ` (Tag ${gi.tief.alter})`)}, ${prozentText(gi.tief.prozent)} zum Geburtsgewicht.`;
      if (gi.erreicht) s += ` Geburtsgewicht wieder erreicht am ${datum(gi.erreicht.datum)}${wenn(gi.erreicht.alter !== null && gi.erreicht.alter !== undefined, ` (Tag ${gi.erreicht.alter})`)}.`;
      else if (gi.tief) s += ` Geburtsgewicht noch nicht wieder erreicht.`;
      s += `</p>`;
    }
    if (gr.gewicht) s += gr.gewicht;
    if (hat("gewicht")) {
      if (w.gewichte.length) s += `<div class="tabelle" style="margin-top:8px"><table><thead><tr><th>Datum</th>${wenn(e.geburtsdatum, '<th class="zahl">Alter</th>')}<th class="zahl">Gewicht</th><th class="zahl">Veränderung</th><th class="zahl">pro Tag</th>` +
        `${wenn(e.geburtsgewicht, '<th class="zahl">zum Geburtsgew.</th>')}<th class="zahl">WHO-Perzentile</th></tr></thead><tbody>` +
        alle(w.gewichte, x => {
          const altOk = x.alter !== null && x.alter !== undefined && x.alter >= 0;
          return `<tr><td>${datum(x.datum)}</td>` + wenn(e.geburtsdatum, `<td class="zahl">${altOk ? x.alter : "–"}${wenn(altOk, " T")}</td>`) +
            `<td class="zahl">${tausender(x.gramm)} g</td><td class="zahl">${"diff" in x ? `${mitVorzeichen(x.diff)} g` : "–"}</td>` +
            `<td class="zahl">${x.pro_tag !== undefined && x.pro_tag !== null ? `${mitVorzeichen(x.pro_tag)} g` : "–"}</td>` +
            wenn(e.geburtsgewicht, `<td class="zahl">${prozentText(x.prozent)}</td>`) + `<td class="zahl">${x.perzentil ? `P${x.perzentil}` : "–"}</td></tr>`;
        }) + `</tbody></table></div>`;
      else s += `<p class="leise">Noch kein Gewicht eingetragen.</p>`;
    }
    teile.push(s + `</section>`);
  }
  if (hat("groesse") || gr.groesse) {
    let s = `<section><h2>Größe</h2>` + (gr.groesse || "");
    if (hat("groesse")) {
      if (w.groessen.length) s += `<div class="tabelle" style="margin-top:8px"><table><thead><tr><th>Datum</th>${wenn(e.geburtsdatum, '<th class="zahl">Alter</th>')}<th class="zahl">Größe</th><th class="zahl">Veränderung</th><th class="zahl">WHO-Perzentile</th></tr></thead><tbody>` +
        alle(w.groessen, x => `<tr><td>${datum(x.datum)}</td>` + wenn(e.geburtsdatum, `<td class="zahl">${x.alter !== null && x.alter !== undefined && x.alter >= 0 ? `${x.alter} T` : "–"}</td>`) +
          `<td class="zahl">${cmText(x.cm)} cm</td><td class="zahl">${"diff" in x ? `${x.diff > 0 ? "+" : ""}${cmText(x.diff)} cm` : "–"}</td><td class="zahl">${x.perzentil ? `P${x.perzentil}` : "–"}</td></tr>`) + `</tbody></table></div>`;
      else s += `<p class="leise">Noch keine Größe eingetragen.</p>`;
    }
    teile.push(s + `</section>`);
  }
  if (hat("kopf")) teile.push(`<section><h2>Kopfumfang</h2>` + (w.kopf_liste.length
    ? `<div class="tabelle"><table><thead><tr><th>Datum</th><th class="zahl">Kopfumfang</th><th class="zahl">Veränderung</th></tr></thead><tbody>` +
      alle(w.kopf_liste, x => `<tr><td>${datum(x.datum)}</td><td class="zahl">${komma(x.cm)} cm</td><td class="zahl">${"diff" in x ? `${x.diff >= 0 ? "+" : "−"}${komma(Math.abs(x.diff))} cm` : "–"}</td></tr>`) + `</tbody></table></div>`
    : `<p class="leise">Noch kein Kopfumfang eingetragen.</p>`) + `</section>`);
  const vs = w.vorsorge;
  if (vs) {
    const ERG = { ok: "unauffällig", beob: "zur Beobachtung", mass: "weitere Maßnahmen" };
    let s = `<section><h2>Vorsorge – U-Heft, Impfungen, Maßnahmen</h2><p class="leise klein" style="margin-top:-4px">Übersicht aus dem Babybuch – maßgeblich sind das gelbe Kinderuntersuchungsheft und der Impfpass.</p>` +
      `<div class="tabelle"><table><thead><tr><th>Untersuchung</th><th>Datum</th><th>Ergebnis / Bemerkung</th></tr></thead><tbody>` +
      alle(vs.erledigt, u => `<tr><td>${esc(u.art)}</td><td>${u.am ? datum(u.am) : "erledigt"}</td><td>${esc([ERG[u.ergebnis] || "", u.bemerkung].filter(Boolean).join(" · "))}</td></tr>`) +
      alle(vs.offen, u => `<tr><td>${esc(u.art)}</td><td>${u.termin ? `Termin ${datum(u.termin.slice(0, 10))} ${u.termin.slice(11)}` : u.vom ? `fällig ${datum(u.vom)}–${datum(u.bis)}` : "offen"}</td><td class="leise">noch offen</td></tr>`) +
      `</tbody></table></div>`;
    s += vs.impfungen.length ? `<h3 style="margin-top:12px">Impfungen</h3><div class="tabelle"><table><thead><tr><th>Datum</th><th>Gegen</th><th>Impfstoff · Charge</th></tr></thead><tbody>` +
      alle(vs.impfungen, i => `<tr><td>${datum(i.am)}</td><td>${esc(i.gegen.join(", "))}</td><td>${esc(i.stoff)}${wenn(i.charge, ` · ${esc(i.charge)}`)}</td></tr>`) + `</tbody></table></div>`
      : `<p class="leise">Noch keine Impfung eingetragen.</p>`;
    if (vs.massnahmen.length) s += `<h3 style="margin-top:12px">Offene vereinbarte Maßnahmen</h3><ul style="margin:4px 0 0;padding-left:18px">` +
      alle(vs.massnahmen, x => `<li>${esc(x.text)}${wenn(x.von, ` <span class="leise">(vereinbart bei ${esc(x.von)}${wenn(x.faellig, `, bis ${x.faellig ? datum(x.faellig) : ""}`)})</span>`)}</li>`) + `</ul>`;
    if (vs.arzt.length) s += `<h3 style="margin-top:12px">Arztbesuche &amp; Termine</h3><ul style="margin:4px 0 0;padding-left:18px">` +
      alle(vs.arzt, a => `<li>${a.am ? datum(a.am) : `Termin ${datum(a.termin.slice(0, 10))} ${a.termin.slice(11)}`} · ${esc(a.grund)}${wenn(a.praxis, ` · ${esc(a.praxis)}`)}${wenn(a.ergebnis, ` – ${esc(a.ergebnis)}`)}</li>`) + `</ul>`;
    teile.push(s + `</section>`);
  }
  if (hat("mahlzeiten") && w.eintraege.length) {
    let tag = "";
    teile.push(`<h2>Alle Mahlzeiten</h2><div class="tabelle"><table><thead><tr><th>Zeit</th><th>Seite</th><th class="zahl">Min</th><th class="zahl">Abstand</th>${wenn(hat("notizen"), "<th>Notiz</th>")}</tr></thead><tbody>` +
      alle(w.eintraege, x => {
        let s = "";
        if (x.start.slice(0, 10) !== tag) { tag = x.start.slice(0, 10); s += `<tr class="tagkopf"><td colspan="5">${datum(tag)}</td></tr>`; }
        return s + `<tr><td>${x.start.slice(11)}–${x.ende}${wenn(x.nacht, ' <span class="leise">· Nacht</span>')}</td>` +
          `<td>${seiten[x.seite]}${wenn(x.zuletzt, ` <span class="leise">(zuletzt ${(seiten[x.zuletzt] || "").toLowerCase()})</span>`)}</td><td class="zahl">${x.dauer}</td>` +
          `<td class="zahl">${x.fortsetzung ? '<span class="leise">Wechsel</span>' : hm(x.pause || 0)}</td>${wenn(hat("notizen"), `<td class="notiz">${esc(x.notiz)}</td>`)}</tr>`;
      }) + `</tbody></table></div>`);
  } else if (hat("notizen")) {
    const mitNotiz = w.eintraege.filter(x => x.notiz);
    teile.push(`<h2>Notizen</h2>` + (mitNotiz.length
      ? `<div class="tabelle"><table><thead><tr><th>Datum</th><th>Zeit</th><th>Seite</th><th>Notiz</th></tr></thead><tbody>` +
        alle(mitNotiz, x => `<tr><td>${datum(x.start.slice(0, 10))}</td><td>${x.start.slice(11)}</td><td>${seiten[x.seite]}</td><td class="notiz">${esc(x.notiz)}</td></tr>`) + `</tbody></table></div>`
      : `<p class="leise">Keine Notizen in diesem Zeitraum.</p>`));
  }
  const am = erstellt ? ` am ${zwei(erstellt.getDate())}.${zwei(erstellt.getMonth() + 1)}.${erstellt.getFullYear()} um ${zwei(erstellt.getHours())}:${zwei(erstellt.getMinutes())} Uhr` : "";
  teile.push(`<p class="leise" style="margin-top:20px">Erstellt mit dem Babybuch${am} · Angaben wie von der Familie eingetragen.</p>
</main>
</body>
</html>`);
  return teile.join("\n");
}
