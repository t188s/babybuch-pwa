// Babybuch PWA · Auswertung für Fläschchen, Abpumpen, Beikost (neu in 0.7.0)
//
// Die Pi-Auswertung ruft zwei Stellen auf (eingefügt von werkzeuge/pi_uebernehmen.py):
//   window.PWA_ERN_AW.ueberblick(z)  – nach dem Überblick: Kacheln „Fläschchen“, „Abgepumpt“, „Beikost“ anhängen
//   window.PWA_ERN_AW.teil(z)        – Unterreiter „Fläschchen“: Kennzahlen, Tagesbalken bzw. Liste
// z ist der Zeitraum der Pi-Oberfläche: {von, bis} (Tage) oder {stunden: true, vonZ, bisZ} (24 h).

import { $, neu } from "../ui/bausteine.js";
import { jeTag, kennzahlen, eintragText } from "../kern/ernaehrung.js";

const zwei = n => String(n).padStart(2, "0");
const komma = x => (Math.round(x * 10) / 10).toLocaleString("de-DE");
const imZeitraum = (t, z) => (z.stunden ? t >= z.vonZ && t <= z.bisZ : t >= z.von && t <= z.bis + "T99");
const tagArtig = z => Boolean(z.stunden) || z.von === z.bis;
function tageZwischen(von, bis) {
  const liste = [], d = new Date(von + "T12:00"), ende = new Date(bis + "T12:00");
  while (d <= ende && liste.length < 400) { liste.push(`${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`); d.setDate(d.getDate() + 1); }
  return liste;
}
async function api(pfad) {
  const r = await fetch("api/" + pfad);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.fehler || `Fehler ${r.status}`);
  return j;
}
async function laden(z) {
  const q = `von=${z.von}&bis=${z.bis}`;
  const [flaschen, pumpen, beikost, auswahl] = await Promise.all([api(`flasche?${q}`), api(`abpumpen?${q}`), api(`beikost?${q}`), api("ernaehrung")]);
  const f = l => l.filter(e => imZeitraum(e.zeit, z));
  return { flaschen: f(flaschen), pumpen: f(pumpen), beikost: f(beikost), arten: auswahl.arten,
           tage: z.stunden ? 1 : tageZwischen(z.von, z.bis).length };
}
const zeigtWas = d => d.arten.some(a => a !== "stillen") || d.flaschen.length || d.pumpen.length || d.beikost.length;

function unterreiterKnopf(sichtbar) {
  const b = $("pwa-aw-ern-knopf");
  if (b) b.hidden = !sichtbar;
}

// ════════ Überblick: Kacheln ════════
let lauf = 0;
async function ueberblick(z) {
  const meinLauf = ++lauf;
  const d = await laden(z);
  if (meinLauf !== lauf) return;                       // inzwischen neu gezeichnet
  unterreiterKnopf(zeigtWas(d));
  const ziel = $("kacheln");
  if (!ziel) return;
  ziel.querySelectorAll(".pwa-kachel").forEach(k => k.remove());
  const k = kennzahlen(d), tag = tagArtig(z), liste = [];
  if (d.flaschen.length || d.arten.includes("flasche"))
    liste.push({ titel: tag ? "Fläschchen" : "Fläschchen Ø/Tag", wert: d.flaschen.length ? `${Math.round(tag ? k.flascheMl : k.flascheMlProTag)} ml` : "–",
                 unter: d.flaschen.length ? `${tag ? `${k.flaschen}×` : `${komma(k.flaschen / d.tage)}×/Tag`} · Ø ${Math.round(k.flascheMlSchnitt)} ml` : "keine Einträge" });
  if (d.pumpen.length || d.arten.includes("abpumpen"))
    liste.push({ titel: tag ? "Abgepumpt" : "Abgepumpt Ø/Tag", wert: d.pumpen.length ? `${Math.round(tag ? k.pumpenMl : k.pumpenMlProTag)} ml` : "–",
                 unter: d.pumpen.length ? (tag ? `${k.pumpen}×` : `${komma(k.pumpen / d.tage)}×/Tag`) : "keine Einträge" });
  if (d.beikost.length || d.arten.includes("beikost"))
    liste.push({ titel: "Beikost", wert: d.beikost.length ? `${k.beikost}×` : "–",
                 unter: k.beikostNeu.length ? `neu: ${k.beikostNeu.slice(0, 2).join(", ")}` : d.beikost.length ? "nichts Neues" : "keine Einträge" });
  for (const x of liste) {
    const b = neu("button", "kachel pwa-kachel"); b.type = "button";
    const t = neu("span", "titel", x.titel); t.dataset.ico = "stillen";
    b.append(t, neu("b", "", x.wert), neu("span", "unter", x.unter), neu("span", "pfeil", "Details ›"));
    b.onclick = () => window.teilWechseln?.("ernaehrung");
    ziel.append(b);
  }
}

// ════════ Unterreiter „Fläschchen“ ════════
async function teil(z) {
  const ziel = $("pwa-aw-ern");
  if (!ziel) return;
  const d = await laden(z);
  unterreiterKnopf(true);
  const k = kennzahlen(d), tag = tagArtig(z), teile = [];

  // Kennzahlen
  const tabelle = neu("table"), kopf = neu("tr");
  kopf.append(neu("th"), neu("th", "", "Fläschchen"), neu("th", "", "Abgepumpt"));
  tabelle.append(kopf);
  const zeilen = [
    ["Anzahl", String(k.flaschen), String(k.pumpen)],
    ["Menge", `${k.flascheMl} ml`, `${k.pumpenMl} ml`],
    ...(tag ? [] : [["Ø pro Tag", `${Math.round(k.flascheMlProTag)} ml`, `${Math.round(k.pumpenMlProTag)} ml`]]),
    ["Ø je Mal", k.flaschen ? `${Math.round(k.flascheMl / k.flaschen)} ml` : "–", k.pumpen ? `${Math.round(k.pumpenMl / k.pumpen)} ml` : "–"],
  ];
  for (const [i, [name, a, b]] of zeilen.entries()) {
    const tr = neu("tr");
    tr.append(neu("td", "", name), neu("td", i === 1 ? "gesamt" : "", a), neu("td", i === 1 ? "gesamt" : "", b));
    tabelle.append(tr);
  }
  const arten = Object.entries(k.artenMl).filter(([, ml]) => ml).map(([a, ml]) => `${({ muttermilch: "Muttermilch", pre: "Pre", folge: "Folgemilch", andere: "Andere" })[a] || a} ${ml} ml`);
  let mahlzeiten = "";
  try {      // Stillmahlzeiten mit der Rechnung der Pi-Oberfläche (Seitenwechsel = eine Mahlzeit)
    const st = (await api(`stillen?von=${z.von}&bis=${z.bis}`)).filter(e => imZeitraum(e.start, z));
    /* global mahlzeitenBilden, mahlzeitenMarkieren */
    const n = typeof mahlzeitenBilden === "function" ? mahlzeitenBilden(mahlzeitenMarkieren(st)).length : st.length;
    if (n || k.flaschen) mahlzeiten = `Zusammen: ${n} ${n === 1 ? "Stillmahlzeit" : "Stillmahlzeiten"} und ${k.flaschen} Fläschchen.`;
  } catch (_) { /* ohne Stillen */ }
  tabelle.append(neu("caption", "", [arten.length ? `Fläschchen: ${arten.join(" · ")}.` : "", mahlzeiten, "Nur zur Orientierung."].filter(Boolean).join(" ")));
  const karte = neu("div", "karte kennzahlen"); karte.append(tabelle); teile.push(karte);

  // Verlauf: Balken je Tag (Zeitraum) – im 24-h- und Tagesblick die Liste
  if (!tag) teile.push(balken(jeTag(tageZwischen(z.von, z.bis), d.flaschen, d.pumpen, d.beikost)));

  // Beikost
  if (d.beikost.length || d.arten.includes("beikost")) {
    const b = neu("div", "karte");
    b.append(neu("p", "label", "Beikost"));
    if (!d.beikost.length) b.append(neu("p", "unter", "Keine Einträge in diesem Zeitraum."));
    else {
      const was = new Map();
      for (const e of d.beikost) was.set(e.was, (was.get(e.was) || 0) + 1);
      b.append(neu("p", "unter", [...was].map(([w, n]) => `${w}${n > 1 ? ` (${n}×)` : ""}`).join(" · ")));
      if (k.beikostNeu.length) b.append(neu("p", "unter", `Zum ersten Mal: ${k.beikostNeu.join(", ")}`));
    }
    teile.push(b);
  }

  // Liste (Tag / 24 h)
  if (tag) {
    const alle = [...d.flaschen.map(e => ["flasche", e]), ...d.pumpen.map(e => ["abpumpen", e]), ...d.beikost.map(e => ["beikost", e])]
      .sort((a, b) => (a[1].zeit < b[1].zeit ? 1 : -1));
    const ul = neu("ul", "sicherung-liste");
    if (!alle.length) ul.append(neu("li", "", z.stunden ? "In diesen 24 Stunden ist nichts eingetragen." : "An diesem Tag ist nichts eingetragen."));
    for (const [typ, e] of alle) {
      const li = neu("li"), info = neu("span", "info");
      info.append(`${e.zeit.slice(11, 16)} · ${({ flasche: "Fläschchen", abpumpen: "Abgepumpt", beikost: "Beikost" })[typ]}`,
        neu("span", "", eintragText(typ, e) + (e.notiz ? ` · „${e.notiz}“` : "")));
      li.append(info); ul.append(li);
    }
    const l = neu("div", "karte"); l.append(neu("p", "label", "Einträge"), ul); teile.push(l);
  }
  ziel.replaceChildren(...teile);
}

/** Einfache Balken: Fläschchen-ml je Tag, Abgepumpt als schmaler Balken daneben. */
function balken(tage) {
  const karte = neu("div", "karte");
  karte.append(neu("p", "label", "Menge pro Tag"));
  const max = Math.max(50, ...tage.map(t => Math.max(t.flascheMl, t.pumpenMl)));
  const B = 320, H = 130, unten = 18, n = tage.length, w = B / n;
  const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${B} ${H}`); svg.setAttribute("class", "pwa-balken"); svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Fläschchen und Abgepumpt in ml pro Tag");
  const rechteck = (x, h, breite, klasse) => {
    const r = document.createElementNS(ns, "rect");
    r.setAttribute("x", x); r.setAttribute("y", H - unten - h); r.setAttribute("width", Math.max(1, breite)); r.setAttribute("height", Math.max(0, h));
    r.setAttribute("rx", Math.min(3, breite / 3)); r.setAttribute("class", klasse); svg.append(r);
  };
  const schritt = Math.ceil(n / 8);
  tage.forEach((t, i) => {
    const x = i * w, hoehe = v => (v / max) * (H - unten - 6);
    rechteck(x + w * 0.12, hoehe(t.flascheMl), w * 0.5, "f");
    rechteck(x + w * 0.66, hoehe(t.pumpenMl), w * 0.22, "p");
    if (i % schritt === 0) {
      const tx = document.createElementNS(ns, "text");
      tx.setAttribute("x", x + w / 2); tx.setAttribute("y", H - 4); tx.setAttribute("text-anchor", "middle");
      tx.textContent = `${Number(t.tag.slice(8))}.${Number(t.tag.slice(5, 7))}.`; svg.append(tx);
    }
  });
  const leg = neu("p", "unter pwa-legende");
  leg.innerHTML = `<i class="pwa-farbe f"></i> Fläschchen <i class="pwa-farbe p"></i> Abgepumpt · höchster Wert ${max} ml`;
  karte.append(svg, leg);
  return karte;
}

window.PWA_ERN_AW = { ueberblick: z => ueberblick(z).catch(e => console.error(e)), teil: z => teil(z).catch(e => console.error(e)) };
