// Babybuch PWA · Kern · Backup & Abgleich zwischen den Eltern
//
// Austauschbarer Baustein: Die App kennt nur „Stand senden“ und „Stand holen“.
// Stufe 1 (jetzt): Weg „datei“ – Teilen-Menü / Datei auswählen.
// Später: Weg „google-drive“ und „icloud“ registrieren sich hier mit derselben Schnittstelle.

import * as speicher from "./speicher.js";
import { backupErstellen, backupPruefen, dateiname } from "./backupdatei.js";
import { zusammenfuehrenPlanen, rueckgaengigStand } from "./zusammenfuehren.js";
import { APP_VERSION } from "./version.js";

const wege = new Map();
/** Weg registrieren: { name, titel, senden(datei, inhalt) → Promise, holen() → Promise<string|null> } */
export function wegRegistrieren(weg) { wege.set(weg.name, weg); }
export function wegHolen(name = "datei") { return wege.get(name); }

// ── Weg 1: Datei (Teilen-Menü auf iPhone/Android, sonst Download) ──
wegRegistrieren({
  name: "datei",
  titel: "Datei (Teilen-Menü)",
  async senden(name, inhalt) {
    const datei = new File([inhalt], name, { type: "application/json" });
    if (navigator.canShare?.({ files: [datei] })) {
      try { await navigator.share({ files: [datei], title: "Babybuch-Backup" }); return "geteilt"; }
      catch (f) { if (f.name === "AbortError") return "abgebrochen"; /* sonst: Download versuchen */ }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(datei); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return "heruntergeladen";
  },
  holen() {
    return new Promise(ok => {
      const feld = document.createElement("input");
      feld.type = "file";
      feld.accept = ".babybuch,application/json,.json,text/plain";
      feld.onchange = async () => ok(feld.files[0] ? await feld.files[0].text() : null);
      feld.click();
    });
  },
});

// ── Stand senden ──
export async function backupSenden(kinderUids, wegName = "datei") {
  if (!kinderUids.length) throw new Error("Bitte mindestens ein Kind auswählen.");
  const jetzt = Date.now();
  const alleDaten = await speicher.alle();
  const inhalt = backupErstellen(alleDaten, kinderUids, { geraet: await speicher.geraet(), appVersion: APP_VERSION, jetzt });
  const namen = alleDaten.filter(d => d.typ === "kind" && kinderUids.includes(d.uid)).map(d => d.daten.name || "Kind");
  const ergebnis = await wegHolen(wegName).senden(dateiname(jetzt, namen), JSON.stringify(inhalt));
  if (ergebnis !== "abgebrochen") await speicher.metaSchreiben("letztesBackup", jetzt);
  return { ergebnis, anzahl: inhalt.datensaetze.length };
}

// ── Stand holen: erst Vorschau, dann übernehmen ──
export async function vorschauAusText(text) {
  const geprueft = backupPruefen(text);
  if (!geprueft.ok) return geprueft;
  const plan = zusammenfuehrenPlanen(await speicher.alle(), geprueft.datensaetze);
  return { ok: true, plan, verworfen: geprueft.verworfen, datei: geprueft.datei };
}

/** Übernimmt einen geprüften Plan und merkt sich jede Änderung für „Rückgängig“. */
export async function uebernehmen(plan) {
  await speicher.standSchreiben(plan.aenderungen.map(a => a.nachher));
  const protokoll = { zeit: Date.now(), aenderungen: plan.aenderungen.map(a => ({ ...a, zurueck: false })) };
  await speicher.metaSchreiben("letzterImport", protokoll);
  return protokoll;
}

/** Ein Kind, das erst mit dem Import gekommen ist, bleibt beim Rückgängigmachen erhalten (Entscheidung 23.11.) –
 *  sonst stünde das Partner-Handy plötzlich ohne Kind da. Nur seine Einträge werden zurückgenommen. */
export function bleibtErhalten(a) { return a.typ === "kind" && !a.vorher; }

/** Eine einzelne Übernahme des letzten Imports rückgängig machen. */
export async function einzelnZurueck(uid) {
  const protokoll = await speicher.metaLesen("letzterImport");
  const a = protokoll?.aenderungen.find(x => x.uid === uid && !x.zurueck && !bleibtErhalten(x));
  if (!a) return false;
  await speicher.standSchreiben([rueckgaengigStand(a, Date.now(), await speicher.geraet())]);
  a.zurueck = true;
  await speicher.metaSchreiben("letzterImport", protokoll);
  return true;
}

/** Den ganzen letzten Import rückgängig machen. */
export async function allesZurueck() {
  const protokoll = await speicher.metaLesen("letzterImport");
  if (!protokoll) return 0;
  const jetzt = Date.now(), ich = await speicher.geraet();
  const offen = protokoll.aenderungen.filter(a => !a.zurueck && !bleibtErhalten(a));
  await speicher.standSchreiben(offen.map(a => rueckgaengigStand(a, jetzt, ich)));
  for (const a of offen) a.zurueck = true;
  await speicher.metaSchreiben("letzterImport", protokoll);
  return offen.length;
}

// ── Erinnerung ans Backup (Intervall stellt jeder selbst ein) ──
export const INTERVALL_STANDARD = 7;            // Tage; 0 = keine Erinnerung
export async function backupFaellig() {
  const tage = await speicher.metaLesen("backupIntervall", INTERVALL_STANDARD);
  if (!tage) return null;
  const letztes = await speicher.metaLesen("letztesBackup");
  const seit = letztes ? Math.floor((Date.now() - letztes) / 864e5) : null;
  return seit === null || seit >= tage ? { seit, tage } : null;
}
