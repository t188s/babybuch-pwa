// Babybuch PWA · Lokaler Pi · Hilfen (1:1 aus app.py der Pi-Version 3.0.2, Teil 1 und 4)

export const DAUER_MIN = 1, DAUER_MAX = 180;
export const NOTIZ_MAX = 500;
export const NAME_MAX = 40;
export const STANDARD_EINSTELLUNGEN = { nacht_von: 22, nacht_bis: 6 };
export const STANDARD_BAUSTEINE = ["gut angelegt", "unruhig", "eingeschlafen", "viel gespuckt",
  "wunde Brustwarze", "Brust hart / Milchstau", "Clusterfeeding", "zugefüttert"];
export const BAUSTEINE_MAX = 20, BAUSTEIN_LAENGE = 30;
export const ERLAUBTE_SEITEN = new Set(["L", "R", "B"]);
export const SEITEN_NAMEN = { L: "Links", R: "Rechts", B: "Beide" };
export const WINDEL_ARTEN = new Set(["nass", "voll", "beides"]);
export const STUHLFARBEN = { mekonium: "schwarz-grün (Mekonium)", uebergang: "grün/braun (Übergang)", gelb: "gelb", hell: "hell/weißlich", andere: "andere" };
export const GRAMM_MIN = 500, GRAMM_MAX = 25000;
export const CM_MIN = 30, CM_MAX = 130;
export const ZEIT_MUSTER = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const SEKUNDEN_MUSTER = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
export const DATUM_MUSTER = /^\d{4}-\d{2}-\d{2}$/;
export const UHRZEIT_MUSTER = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TEXT_MAX = 200, NAME_LAENGE = 60;

/** Fehler mit HTTP-Status – wird vom Router als {fehler} beantwortet (wie jsonify(fehler=…), 400). */
export class ApiFehler extends Error {
  constructor(text, status = 400) { super(text); this.status = status; }
}
export const nichtGefunden = () => new ApiFehler("Eintrag nicht gefunden – vielleicht schon auf dem anderen Handy gelöscht?", 404);

const zwei = n => String(n).padStart(2, "0");
export const datumText = d => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
export const zeitText = d => `${datumText(d)}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
export const heute = () => datumText(new Date());
export function alsZeit(text) {
  const [t, z = "00:00"] = text.slice(0, 16).split("T");
  const [j, m, d] = t.split("-").map(Number), [h, min] = z.split(":").map(Number);
  return new Date(j, m - 1, d, h, min);
}

/** Python: " ".join(str(x or "").split())[:laenge] */
export const einfach = (wert, laenge) => String(wert ?? "").split(/\s+/).filter(Boolean).join(" ").slice(0, laenge);
export const textFeld = (daten, name, laenge = TEXT_MAX) => einfach(daten[name], laenge);
export const hat = (daten, feld) => Object.prototype.hasOwnProperty.call(daten, feld);
export const istGanzzahl = x => Number.isInteger(x) && typeof x !== "boolean";

/** Zeitpunkt prüfen – nie in der Zukunft (1 Min Spielraum). */
export function zeitFeld(daten) {
  const zeit = daten.zeit;
  if (!(typeof zeit === "string" && ZEIT_MUSTER.test(zeit))) throw new ApiFehler("Uhrzeit fehlt oder ist ungültig.");
  if (alsZeit(zeit) > new Date(Date.now() + 60000)) throw new ApiFehler("Die Uhrzeit liegt in der Zukunft.");
  return zeit;
}

/** "3790" → 3790 g · "3,79" / "3,79 kg" → 3790 g */
export function grammAusText(wert) {
  if (typeof wert === "boolean") return null;
  let zahl;
  if (typeof wert === "number") zahl = wert;
  else {
    let text = String(wert ?? "").trim().toLowerCase().replace(/ /g, "");
    if (text.endsWith("kg")) text = text.slice(0, -2); else if (text.endsWith("g")) text = text.slice(0, -1);
    text = text.replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(text)) return null;
    zahl = Number(text);
  }
  if (zahl < 30) zahl *= 1000;
  const gramm = pyRound(zahl);
  return gramm >= GRAMM_MIN && gramm <= GRAMM_MAX ? gramm : null;
}

/** "52" / "52,5" / "52.5 cm" → 52.5 · "0,52 m" → 52 */
export function cmAusText(wert) {
  if (typeof wert === "boolean") return null;
  let zahl;
  if (typeof wert === "number") zahl = wert;
  else {
    let text = String(wert ?? "").trim().toLowerCase().replace(/ /g, "");
    const meter = text.endsWith("m") && !text.endsWith("cm");
    text = text.replace(/cm$/, "").replace(/m$/, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(text)) return null;
    zahl = Number(text) * (meter ? 100 : 1);
  }
  if (zahl < 2) zahl *= 100;
  zahl = pyRound(zahl, 1);
  return zahl >= CM_MIN && zahl <= CM_MAX ? zahl : null;
}

/** Rundung wie Python (round half to even) – damit z. B. 3,7905 kg gleich gerundet wird wie auf dem Pi. */
export function pyRound(x, stellen = 0) {
  const f = 10 ** stellen, y = x * f, r = Math.round(y);
  if (Math.abs(y % 1) === 0.5) return (r % 2 === 0 ? r : r - 1) / f;
  return r / f;
}
