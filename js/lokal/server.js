// Babybuch PWA · Lokaler Pi · Router
//
// Die Oberfläche der Pi-Version fragt „api/…“ wie bisher an. Die Weiche (weiche.js) leitet diese Anfragen hierher um,
// statt sie ins Netz zu schicken. Hier werden sie wie auf dem Pi beantwortet – nur mit dem Speicher im Handy.
// Jede Schnittstellen-Gruppe ist ein eigenes Modul in ./api/ (Etappe 3: die Oberfläche folgt diesem Schnitt).

import { ApiFehler } from "./hilfen.js";
import * as tabellen from "./tabellen.js";
import { aktivesKind } from "../kern/kinder.js";
import { kindSicherstellen } from "../pwa/kinder-backup.js";
import * as stillen from "./api/stillen.js";
import * as wachstum from "./api/wachstum.js";
import * as gesundheit from "./api/gesundheit.js";
import * as heft from "./api/heft.js";
import * as einstellungen from "./api/einstellungen.js";
import * as sonstiges from "./api/sonstiges.js";

const ROUTEN = [];
function route(methode, muster, handler) {
  const teile = muster.split("/");
  ROUTEN.push({ methode, teile, handler });
}
const r = {
  get: (m, h) => route("GET", m, h), post: (m, h) => route("POST", m, h), put: (m, h) => route("PUT", m, h),
  patch: (m, h) => route("PATCH", m, h), delete: (m, h) => route("DELETE", m, h),
};
for (const modul of [stillen, wachstum, gesundheit, heft, einstellungen, sonstiges]) modul.routen(r);

function finden(methode, pfad) {
  const teile = pfad.split("/");
  for (const ro of ROUTEN) {
    if (ro.methode !== methode || ro.teile.length !== teile.length) continue;
    const params = {};
    let passt = true;
    for (let i = 0; i < teile.length && passt; i++) {
      const m = ro.teile[i];
      if (m === ":id") { if (/^\d+$/.test(teile[i])) params.id = Number(teile[i]); else passt = false; }
      else if (m.startsWith(":")) params[m.slice(1)] = decodeURIComponent(teile[i]);
      else passt = m === teile[i];
    }
    if (passt) return { ro, params };
  }
  return null;
}

// Nacheinander abarbeiten (wie ein Server mit einer Datenbank) – verhindert, dass sich zwei Änderungen überholen
let kette = Promise.resolve();

/** Beantwortet eine Anfrage der Oberfläche. Ergebnis: echte Response wie vom Pi. */
export function anfrage(url, optionen = {}) {
  const ergebnis = kette.then(() => bearbeiten(url, optionen));
  kette = ergebnis.catch(() => {});
  return ergebnis;
}

async function bearbeiten(url, optionen) {
  const u = new URL(url, location.href);
  const pfad = u.pathname.replace(/^.*?\/api\//, "");
  const methode = (optionen.method || "GET").toUpperCase();
  let daten = {};
  if (optionen.body) { try { daten = JSON.parse(optionen.body) || {}; } catch (_) { daten = {}; } }
  try {
    const kind = (await aktivesKind()) || (await kindSicherstellen());
    tabellen.kindSetzen(kind.uid);
    const treffer = finden(methode, pfad);
    if (!treffer) throw new ApiFehler("Diese Funktion gibt es in der Web-App (noch) nicht.", 404);
    const bereich = () => {
      const von = u.searchParams.get("von") || "", bis = u.searchParams.get("bis") || "";
      if (!(/^\d{4}-\d{2}-\d{2}$/.test(von) && /^\d{4}-\d{2}-\d{2}$/.test(bis))) throw new ApiFehler("von/bis bitte als JJJJ-MM-TT angeben.");
      return [von, bis + "T99"];                         // "T99" liegt hinter jeder Uhrzeit des Tages
    };
    let antwort = await treffer.ro.handler({ ...treffer.params, params: treffer.params, daten, query: u.searchParams, bereich });
    let status = 200;
    if (Array.isArray(antwort) && antwort.length === 2 && Number.isInteger(antwort[0])) [status, antwort] = antwort;
    return json(status, antwort);
  } catch (f) {
    if (f instanceof ApiFehler) return json(f.status, { fehler: f.message });
    console.error("Lokaler Pi:", methode, pfad, f);
    return json(500, { fehler: `Interner Fehler: ${f.message}` });
  }
}

const json = (status, inhalt) => new Response(JSON.stringify(inhalt), { status, headers: { "Content-Type": "application/json" } });
