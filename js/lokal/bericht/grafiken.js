// Babybuch PWA · Bericht · Grafiken (SVG) – 1:1 aus app.py 3.0.2 (svg_rhythmus, svg_zeitleiste, svg_balken, svg_wachstum)
// Zahlen werden wie in Python formatiert (f"{x:.1f}" → f1, str(float) → pyStr), damit das SVG gleich aussieht.

import { pyFixed, pyRound, komma, hm, istNacht, whoGramm, whoCm } from "../pi/rechnen.js";
import { N, jetzt, heute, zeitText, plus, STUNDE, TAG, wochentag } from "./naiv.js";

export const FARBEN = { L: "#a07c3b", R: "#5b6f96", B: "#b77b6c", nacht: "#e4e8f1", linie: "#e3ddd1",
  text: "#17150f", leise: "#6f685c", nass: "#4f86c6", voll: "#8a5a2b" };
const f1 = x => pyFixed(x, 1);
/** Python str(float): 127.0 → "127.0", 143.4 → "143.4" */
const pyStr = x => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&#34;").replace(/'/g, "&#39;");

const svgAnfang = (b, h, titel) => `<svg class="grafik" viewBox="0 0 ${b} ${h}" role="img" aria-label="${titel}" ` +
  `xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, Segoe UI, Arial, sans-serif">`;
const TROPFEN = "M0,-4.2 C0,-4.2 -3.2,-0.4 -3.2,1.4 A3.2,3.2 0 0 0 3.2,1.4 C3.2,-0.4 0,-4.2 0,-4.2 Z";

function windelZeichen(x, y, art) {
  const t = [];
  if (art === "nass" || art === "beides") t.push(`<path transform="translate(${f1(x + (art === "beides" ? -3 : 0))},${f1(y)})" d="${TROPFEN}" fill="${FARBEN.nass}"/>`);
  if (art === "voll" || art === "beides") t.push(`<circle cx="${f1(x + (art === "beides" ? 3.2 : 0))}" cy="${f1(y + 0.6)}" r="2.9" fill="${FARBEN.voll}"/>`);
  return t.join("");
}

/** Tagesrhythmus: je Tag eine Zeile 0–24 Uhr (oder eine Zeile „letzte 24 h“). */
export function svgRhythmus(z, eintraege, windeln, e) {
  let reihen;
  if (z.stunden) reihen = [[`${z.von.slice(8, 10)}.${z.von.slice(5, 7)}.–${z.bis.slice(8, 10)}.${z.bis.slice(5, 7)}.`, N(z.von), N(z.bis)]];
  else {
    const h = heute(), wt = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    reihen = z.tage.filter(t => t <= h).slice(-31).map(t => [`${wt[wochentag(N(t))]} ${t.slice(8, 10)}.${t.slice(5, 7)}.`, N(t), plus(N(t), TAG)]);
  }
  if (!reihen.length) return "";
  const einzeln = reihen.length === 1;
  const B = 760, links = 66, rechts = 118, oben = 20;
  const [zh, bh] = einzeln ? [46, 18] : [30, 10];
  const wy = 5 + bh + 9, breite = B - links - rechts, H = oben + reihen.length * zh + 30;
  const teile = [svgAnfang(B, H, "Tagesrhythmus")];
  const [, r0s, r0e] = reihen[0], laenge0 = (r0e - r0s) / 1000;
  let t = new Date(r0s); t.setUTCMinutes(0);
  if (r0s.getUTCMinutes()) t = plus(t, STUNDE);
  while (t <= r0e) {
    if (t.getUTCHours() % 3 === 0) {
      const x = links + (t - r0s) / 1000 / laenge0 * breite;
      const beschr = t.getTime() === r0e.getTime() && !z.stunden ? "24" : String(t.getUTCHours());
      teile.push(t.getUTCHours() === 0 && t.getTime() === r0s.getTime()
        ? `<text x="${f1(x)}" y="12" font-size="9" fill="${FARBEN.leise}" text-anchor="middle">${beschr} Uhr</text>`
        : `<text x="${f1(x)}" y="12" font-size="9" fill="${FARBEN.leise}" text-anchor="middle">${beschr}</text>`);
      teile.push(`<line x1="${f1(x)}" x2="${f1(x)}" y1="${oben}" y2="${oben + reihen.length * zh}" stroke="${FARBEN.linie}" stroke-width=".6"/>`);
    }
    t = plus(t, STUNDE);
  }
  teile.push(`<text x="${B - rechts + 10}" y="12" font-size="9" fill="${FARBEN.leise}">Mahlz. · Dauer · Windeln</text>`);
  reihen.forEach(([beschriftung, anfang, ende], i) => {
    const y = oben + i * zh, laenge = (ende - anfang) / 1000;
    const pos = d => links + Math.max(0, Math.min(1, (d - anfang) / 1000 / laenge)) * breite;
    if (i % 2 === 0) teile.push(`<rect x="0" y="${y}" width="${B}" height="${zh}" fill="#faf8f3"/>`);
    teile.push(`<text x="2" y="${f1(y + 5 + bh / 2 + 3)}" font-size="10" fill="${FARBEN.text}">${beschriftung}</text>`);
    let stunde = new Date(anfang); stunde.setUTCMinutes(0);
    while (stunde < ende) {
      if (istNacht(zeitText(stunde), e)) {
        const x1 = pos(stunde > anfang ? stunde : anfang), x2 = pos(plus(stunde, STUNDE) < ende ? plus(stunde, STUNDE) : ende);
        teile.push(`<rect x="${f1(x1)}" y="${y + 3}" width="${f1(x2 - x1 + 0.3)}" height="${bh + 4}" fill="${FARBEN.nacht}"/>`);
      }
      stunde = plus(stunde, STUNDE);
    }
    teile.push(`<line x1="${links}" x2="${links + breite}" y1="${y + wy}" y2="${y + wy}" stroke="${FARBEN.linie}" stroke-width=".8" stroke-dasharray="2 2"/>`);
    let anzahl = 0, minuten = 0;
    for (const zz of eintraege) {
      const s = N(zz.start), en = plus(s, zz.dauer * 60000);
      if (en <= anfang || s >= ende) continue;
      if (anfang <= s && s < ende) { minuten += zz.dauer; anzahl += zz.fortsetzung ? 0 : 1; }
      const x1 = pos(s), x2 = pos(en);
      teile.push(`<rect x="${f1(x1)}" y="${y + 5}" width="${f1(Math.max(2, x2 - x1))}" height="${bh}" rx="2" fill="${FARBEN[zz.seite]}"/>`);
    }
    let nass = 0, voll = 0;
    for (const w of windeln) {
      const d = N(w.zeit);
      if (anfang <= d && d < ende) {
        teile.push(windelZeichen(pos(d), y + wy, w.art));
        nass += w.art === "nass" || w.art === "beides"; voll += w.art === "voll" || w.art === "beides";
      }
    }
    const xr = B - rechts + 10, tageszahl = anzahl || minuten ? `${anzahl}× · ${hm(minuten)} h` : "–";
    teile.push(`<text x="${xr}" y="${f1(y + 5 + bh / 2 + 3)}" font-size="10" fill="${FARBEN.text}">${tageszahl}</text>`);
    if (nass || voll || anzahl)
      teile.push(`<path transform="translate(${xr + 3},${y + wy})" d="${TROPFEN}" fill="${FARBEN.nass}"/>` +
        `<text x="${xr + 9}" y="${y + wy + 3}" font-size="9" fill="${FARBEN.leise}">${nass}</text>` +
        `<circle cx="${xr + 27}" cy="${pyStr(y + wy + 0.6)}" r="2.9" fill="${FARBEN.voll}"/>` +
        `<text x="${xr + 33}" y="${y + wy + 3}" font-size="9" fill="${FARBEN.leise}">${voll}</text>`);
  });
  const y = oben + reihen.length * zh + 20;
  let x = links, erst = true;
  for (const [text, art] of [["Links", "L"], ["Rechts", "R"], ["Beide", "B"], ["Nacht", "nacht"], ["Windel nass", "w-nass"], ["Windel voll", "w-voll"], ["nass + voll", "w-beides"]]) {
    const xs = erst ? String(x) : pyStr(x), xt = erst ? String(x + 16) : pyStr(x + 16);
    if (art.startsWith("w-")) teile.push(windelZeichen(x + 5, y - 3, art.slice(2)));
    else teile.push(`<rect x="${xs}" y="${y - 8}" width="12" height="8" rx="2" fill="${art === "nacht" ? FARBEN.nacht : FARBEN[art]}"` +
      (art === "nacht" ? ` stroke="${FARBEN.linie}"` : "") + "/>");
    teile.push(`<text x="${xt}" y="${y}" font-size="9.5" fill="${FARBEN.leise}">${text}</text>`);
    x += 16 + text.length * 5.4 + 18; erst = false;
  }
  teile.push("</svg>");
  const hinweis = z.tage.length <= 31 || z.stunden ? "" : '<p class="leise klein">Gezeigt werden die letzten 31 Tage des Zeitraums.</p>';
  return teile.join("") + hinweis;
}

/** Zeitleiste (höchstens 14 Tage): Fieberkurve, darunter Symptome, Medikamente, Stillen, nasse Windeln. */
export function svgZeitleiste(z, krank, eintraege, windeln, e) {
  const ende = z.bis.includes("T") ? N(z.bis) : new Date(Math.min(jetzt(), plus(N(z.bis), TAG)));
  let anfang = z.von.includes("T") ? N(z.von) : N(z.von);
  if (anfang < plus(ende, -14 * TAG)) anfang = plus(ende, -14 * TAG);
  const dauer = (ende - anfang) / 1000;
  if (dauer <= 0) return "";
  const B = 760, links = 70, rechts = 14, fo = 16, fu = 132, breite = B - links - rechts;
  const x = d => links + Math.max(0, Math.min(1, (d - anfang) / 1000 / dauer)) * breite;
  const tmin = 35.5, tmax = 40.0, y = tt => fu - (Math.min(Math.max(tt, tmin), tmax) - tmin) / (tmax - tmin) * (fu - fo);
  const spuren = [["Symptome", "#c2786a"], ["Medikamente", "#8f7cc4"], ["Stillen", FARBEN.L], ["nasse Windeln", FARBEN.nass]];
  const H = fu + 18 + spuren.length * 18 + 24;
  const t = [svgAnfang(B, H, "Zeitleiste Fieber und Verlauf")];
  let stunde = new Date(anfang); stunde.setUTCMinutes(0, 0, 0);
  while (stunde < ende) {
    if (istNacht(zeitText(stunde), e)) {
      const x1 = x(stunde > anfang ? stunde : anfang), x2 = x(plus(stunde, STUNDE) < ende ? plus(stunde, STUNDE) : ende);
      t.push(`<rect x="${f1(x1)}" y="${fo}" width="${f1(x2 - x1 + 0.3)}" height="${H - fo - 22}" fill="${FARBEN.nacht}"/>`);
    }
    stunde = plus(stunde, STUNDE);
  }
  for (const [wert, farbe, name] of [[38.0, "#c0392b", "38,0"], [36.5, "#5b6f96", "36,5"]])
    t.push(`<line x1="${links}" x2="${B - rechts}" y1="${f1(y(wert))}" y2="${f1(y(wert))}" stroke="${farbe}" stroke-dasharray="4 3" stroke-width=".8"/>` +
      `<text x="${links - 6}" y="${f1(y(wert) + 3)}" font-size="9" fill="${farbe}" text-anchor="end">${name} °C</text>`);
  const punkte = krank.fieber.map(f => [N(f.zeit), f.temp]).filter(([d]) => anfang <= d && d <= ende);
  for (let i = 0; i + 1 < punkte.length; i++) {
    const [a, ta] = punkte[i], [b, tb] = punkte[i + 1];
    if (b - a <= 12 * STUNDE) t.push(`<line x1="${f1(x(a))}" y1="${f1(y(ta))}" x2="${f1(x(b))}" y2="${f1(y(tb))}" stroke="#c0392b" stroke-width="1.4"/>`);
  }
  for (const [d, tw] of punkte) {
    const farbe = tw >= 38.0 ? "#c0392b" : tw < 36.5 ? "#5b6f96" : FARBEN.text;
    t.push(`<circle cx="${f1(x(d))}" cy="${f1(y(tw))}" r="3" fill="${farbe}"/>` +
      `<text x="${f1(x(d))}" y="${f1(y(tw) - 6)}" font-size="8.5" fill="${farbe}" text-anchor="middle">${komma(tw, 1)}</text>`);
  }
  t.push(`<text x="4" y="${fo + 8}" font-size="9" fill="${FARBEN.leise}">Temperatur</text>`);
  const sy = fu + 18;
  spuren.forEach(([name, farbe], i) => {
    const yy = sy + i * 18;
    t.push(`<text x="4" y="${yy + 4}" font-size="9" fill="${FARBEN.leise}">${name}</text>` +
      `<line x1="${links}" x2="${B - rechts}" y1="${yy}" y2="${yy}" stroke="${FARBEN.linie}" stroke-width=".6"/>`);
    if (name === "Symptome") {
      for (const s of krank.symptome) { const d = N(s.zeit); if (anfang <= d && d <= ende)
        t.push(`<rect x="${f1(x(d) - 3)}" y="${yy - 3}" width="6" height="6" transform="rotate(45 ${f1(x(d))} ${yy})" fill="${farbe}"/>`); }
    } else if (name === "Medikamente") {
      for (const v of krank.medikamente.verlauf) { const d = N(v.zeit); if (anfang <= d && d <= ende)
        t.push(`<rect x="${f1(x(d) - 3.5)}" y="${pyStr(yy - 3.5)}" width="7" height="7" rx="1.5" fill="${v.art === "bei Bedarf" ? farbe : "#7a9a6a"}"/>`); }
    } else if (name === "Stillen") {
      for (const zz of eintraege) { const a = N(zz.start), b = plus(a, zz.dauer * 60000); if (b >= anfang && a <= ende)
        t.push(`<rect x="${f1(x(a))}" y="${yy - 3}" width="${f1(Math.max(1.5, x(b) - x(a)))}" height="6" rx="1.5" fill="${FARBEN[zz.seite] || FARBEN.L}"/>`); }
    } else {
      for (const w of windeln) { const d = N(w.zeit); if ((w.art === "nass" || w.art === "beides") && anfang <= d && d <= ende) t.push(windelZeichen(x(d), yy, "nass")); }
    }
  });
  const ay = sy + spuren.length * 18 + 10, tage = Math.floor((ende - anfang) / TAG);
  let d = new Date(anfang); d.setUTCMinutes(0, 0, 0);
  const schritt = tage < 2 ? 3 : tage < 4 ? 6 : 24;
  while (d <= ende) {
    if (d >= anfang && d.getUTCHours() % schritt === 0) {
      const text = d.getUTCHours() === 0 || schritt === 24 ? `${d.getUTCDate()}.${d.getUTCMonth() + 1}.` : `${d.getUTCHours()} Uhr`;
      if (schritt < 24 || (tage < 8 || d.getUTCDate() % 2 === 0))
        t.push(`<text x="${f1(x(d))}" y="${ay}" font-size="9" fill="${FARBEN.leise}" text-anchor="middle">${text}</text>`);
    }
    d = plus(d, STUNDE);
  }
  t.push("</svg>");
  return t.join("");
}

/** Säulendiagramm: werte = [[Beschriftung, Zahl, Zusatz]] */
export function svgBalken(werte, titel, einheit, wertText, B = 760, blass = new Set()) {
  if (!werte.length) return "";
  const H = B > 500 ? 190 : 170, links = 34, unten = 26, oben = 20, breite = B - links - 6, hoehe = H - unten - oben;
  const hoechst = Math.max(1, Math.max(...werte.map(w => w[1])));
  const schritt = 10 ** Math.max(0, String(Math.trunc(hoechst)).length - 1);
  const obenWert = Math.ceil(hoechst / schritt) * schritt;
  const teile = [svgAnfang(B, H, titel)];
  for (const anteil of [0, 0.5, 1]) {
    const y = oben + hoehe - anteil * hoehe;
    teile.push(`<line x1="${links}" x2="${B - 6}" y1="${f1(y)}" y2="${f1(y)}" stroke="${FARBEN.linie}" stroke-width=".7"/>`);
    teile.push(`<text x="${links - 5}" y="${f1(y + 3)}" font-size="9" fill="${FARBEN.leise}" text-anchor="end">${wertText(obenWert * anteil)}</text>`);
  }
  const spalte = breite / werte.length, jede = Math.max(1, Math.ceil(werte.length / 16));
  werte.forEach(([beschriftung, wert, zusatz], i) => {
    const h = wert / obenWert * hoehe, x = links + i * spalte + spalte * 0.18;
    teile.push(`<rect x="${f1(x)}" y="${f1(oben + hoehe - h)}" width="${f1(spalte * 0.64)}" height="${f1(h)}" rx="2" fill="${FARBEN.L}"` + (blass.has(i) ? ' fill-opacity=".35"' : "") + "/>");
    if (zusatz && werte.length <= 31)
      teile.push(`<text x="${f1(x + spalte * 0.32)}" y="${f1(oben + hoehe - h - 4)}" font-size="9" fill="${FARBEN.text}" text-anchor="middle">${zusatz}</text>`);
    if (i % jede === 0)
      teile.push(`<text x="${f1(x + spalte * 0.32)}" y="${H - 10}" font-size="9" fill="${FARBEN.leise}" text-anchor="middle">${beschriftung}</text>`);
  });
  teile.push(`<text x="${links}" y="10" font-size="9" fill="${FARBEN.leise}">${einheit}</text>`);
  teile.push("</svg>");
  return teile.join("");
}

const tausender = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** Python f"{v:g}" für ganze bzw. einfache Zahlen */
const pyG = v => String(Number(v.toPrecision(6)));

export function svgGewicht(gewichte, e) {
  const gg = e.geburtsdatum ? e.geburtsgewicht : null;
  return svgWachstum(gewichte.map(w => [w.alter, w.gramm, w.datum]), e, "Gewichtskurve", whoGramm, [250, 500, 1000], 250, tausender, gg, "Geburtsgewicht");
}
export function svgGroesse(groessen, e) {
  return svgWachstum(groessen.map(g => [g.alter, g.cm, g.datum]), e, "Größenkurve", whoCm, [1, 2, 5], 2, v => `${pyG(v)} cm`);
}

function svgWachstum(werte, e, titel, whoWert, raster, rand, einheit, startWert = null, startName = "") {
  let punkte = werte.filter(([a]) => a !== null && a !== undefined && a >= 0);
  const who = Boolean(e.geschlecht && punkte.length);
  if (startWert && !punkte.some(p => p[0] === 0) && punkte.length) punkte.unshift([0, startWert, e.geburtsdatum]);
  if (!punkte.length) {
    if (!werte.length) return "";
    const erster = N(werte[0][2]);
    punkte = werte.map(([, v, d]) => [Math.round((N(d) - erster) / TAG), v, d]);
  }
  const B = 760, H = 230, links = 48, unten = 26, oben = 12, breite = B - links - 10, hoehe = H - unten - oben;
  let xMax = Math.max(42, Math.max(...punkte.map(p => p[0])) + 7);
  if (who) xMax = Math.min(xMax, 730);
  const yWerte = punkte.map(p => p[1]);
  if (who) yWerte.push(whoWert(xMax, e.geschlecht, 1.881), whoWert(0, e.geschlecht, -1.881));
  const spanneRoh = Math.max(...yWerte) - Math.min(...yWerte);
  const schritt = raster.find(r => spanneRoh / r <= 8) ?? raster[raster.length - 1];
  const yMin = Math.floor(Math.min(...yWerte) / schritt) * schritt - rand, yMax = Math.ceil(Math.max(...yWerte) / schritt) * schritt + rand;
  const px = a => links + a / xMax * breite, py = v => oben + hoehe - (v - yMin) / (yMax - yMin) * hoehe;
  const teile = [svgAnfang(B, H, titel)];
  for (let v = Math.ceil(yMin / schritt) * schritt; v <= yMax; v += schritt) {
    teile.push(`<line x1="${links}" x2="${B - 10}" y1="${f1(py(v))}" y2="${f1(py(v))}" stroke="${FARBEN.linie}" stroke-width=".6"/>`);
    teile.push(`<text x="${links - 5}" y="${f1(py(v) + 3)}" font-size="9" fill="${FARBEN.leise}" text-anchor="end">${einheit(v)}</text>`);
  }
  if (who) {
    const tage = [];
    for (let a = 0; a <= Math.trunc(xMax); a += Math.max(1, Math.floor(Math.trunc(xMax) / 60))) tage.push(a);
    const flaeche = (zu, zo, farbe) => {
      const o = tage.map(a => `${f1(px(a))},${f1(py(whoWert(a, e.geschlecht, zo)))}`).join(" ");
      const u = [...tage].reverse().map(a => `${f1(px(a))},${f1(py(whoWert(a, e.geschlecht, zu)))}`).join(" ");
      return `<polygon points="${o} ${u}" fill="${farbe}"/>`;
    };
    teile.push(flaeche(-1.881, 1.881, "#f3eee3"), flaeche(-1.036, 1.036, "#e9e0cc"));
    teile.push(`<polyline points="${tage.map(a => `${f1(px(a))},${f1(py(whoWert(a, e.geschlecht, 0)))}`).join(" ")}" fill="none" stroke="#c9b48a" stroke-width="1" stroke-dasharray="3 3"/>`);
  }
  const woche = xMax <= 120 ? 7 : 28;
  for (let a = 0; a <= Math.trunc(xMax); a += woche)
    teile.push(`<text x="${f1(px(a))}" y="${H - 10}" font-size="9" fill="${FARBEN.leise}" text-anchor="middle">` +
      `${who || e.geburtsdatum ? `${Math.floor(a / 7)} Wo` : `+${a} T`}</text>`);
  if (startWert) teile.push(`<line x1="${links}" x2="${B - 10}" y1="${f1(py(startWert))}" y2="${f1(py(startWert))}" stroke="${FARBEN.leise}" stroke-width=".7" stroke-dasharray="1 3"/>`);
  teile.push(`<polyline points="${punkte.map(([a, v]) => `${f1(px(a))},${f1(py(v))}`).join(" ")}" fill="none" stroke="${FARBEN.text}" stroke-width="1.6"/>`);
  for (const [a, v] of punkte) teile.push(`<circle cx="${f1(px(a))}" cy="${f1(py(v))}" r="3" fill="${FARBEN.L}" stroke="#fff" stroke-width="1"/>`);
  teile.push("</svg>");
  const legende = who ? '<p class="leise klein">Hellgold: WHO P3–P97 · Gold: P15–P85 · gestrichelt: Median (P50)' + (startWert ? ` · gepunktet: ${startName}` : "") + "</p>" : "";
  return teile.join("") + legende;
}

export { esc, pyRound };
