// Babybuch PWA · Seite „Bericht“ (wie /bericht der Pi-Version): bericht.html?von=…&bis=…&teile=…&fuer=…&anliegen=…&ablegen=1
// oder bericht.html?ablage=<id> für einen früher erstellten Bericht. Läuft im selben Fenster wie die App
// (auf dem iPhone sieht nur die installierte App ihre eigenen Daten). Drucken = „Als PDF sichern“.

import * as speicher from "../kern/speicher.js";
import { aktivesKind } from "../kern/kinder.js";
import * as t from "../lokal/tabellen.js";
import { berichtDaten } from "../lokal/bericht/daten.js";
import { berichtHtml } from "../lokal/bericht/vorlage.js";
import { dateiAusgeben } from "./teilen.js";

export const ABLAGE_ANZAHL = 50;
const TEILEN = '<button type="button" id="pwa-teilen" style="background:transparent;color:inherit;border:1px solid #e3ddd1">Teilen</button>';

export async function ablageLesen() { return (await speicher.metaLesen("berichte", [])) || []; }

function zeigen(html, dateiname) {
  document.open(); document.write(html.replace("<head>", '<head>\n  <link rel="icon" href="icons/icon-192.png">')); document.close();
  const b = document.getElementById("pwa-teilen");
  if (b) b.onclick = () => dateiAusgeben(dateiname, html.replace(TEILEN, ""), "text/html").catch(f => alert(f.message));
}
const dateinameFuer = (titelVon, titelBis, name) =>
  `Babybuch${name ? "_" + name.replace(/\s*\(.*\)\s*$/, "").replace(/[^\p{L}\p{N}-]+/gu, "") : ""}_${titelVon}_bis_${titelBis}.html`;

async function los() {
  const q = new URLSearchParams(location.search);
  if (q.get("ablage")) {
    const b = (await ablageLesen()).find(x => x.id === q.get("ablage"));
    if (!b) { document.getElementById("warten").textContent = "Dieser Bericht ist nicht mehr abgelegt."; return; }
    return zeigen(b.html.replace('<div class="knoepfe">', '<div class="knoepfe">' + TEILEN + '<a href="./">Zurück</a>'), b.datei);
  }
  const kind = await aktivesKind();
  if (!kind) { location.replace("./"); return; }
  t.kindSetzen(kind.uid);
  const w = await berichtDaten(q);
  if (!w) { document.getElementById("warten").textContent = "Zeitraum ungültig."; return; }
  const datei = dateinameFuer(w.z.von.slice(0, 10), w.z.bis.slice(0, 10), w.e.name);
  if (q.get("ablegen")) {
    const erstellt = new Date();
    const liste = await ablageLesen();
    liste.unshift({ id: String(erstellt.getTime()), erstellt: erstellt.getTime(), kind: kind.uid, name: w.e.name || "", titel: w.z.titel,
      fuer: w.fuer, datei, html: berichtHtml(w, { gespeichert: true, erstellt }) });
    await speicher.metaSchreiben("berichte", liste.slice(0, ABLAGE_ANZAHL));
    history.replaceState(null, "", location.pathname + location.search.replace(/&?ablegen=1/, ""));   // Neuladen legt nicht doppelt ab
  }
  zeigen(berichtHtml(w, { knoepfe: TEILEN }), datei);
}
los().catch(f => { console.error(f); document.getElementById("warten").textContent = "Fehler: " + f.message; });
