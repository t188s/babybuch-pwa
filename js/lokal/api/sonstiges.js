// Babybuch PWA · Lokaler Pi · Nutzungsstatistik und Platzhalter für Pi-Funktionen, die es in der Web-App anders gibt

import * as speicher from "../../kern/speicher.js";
import { ApiFehler } from "../hilfen.js";

// Nutzungsstatistik (seit Pi 2.8): nur Bedienung, nie Einträge – bleibt auf diesem Handy, wird nicht mit geteilt
const NUTZUNG_MAX = 20000;
const nutzungLesen = async () => (await speicher.metaLesen("nutzung")) || [];

export function routen(r) {
  r.post("nutzung", async ({ daten }) => {
    const liste = daten.ereignisse;
    if (!Array.isArray(liste) || liste.length > 500) throw new ApiFehler("Ungültige Nutzungsdaten.");
    const neu = liste.filter(e => e && typeof e === "object" && JSON.stringify(e).length <= 2000)
      .map(e => ({ version: String(e.v || "").slice(0, 20) || "?", tag: String(e.tag || "").slice(0, 10), daten: e }));
    await speicher.metaSchreiben("nutzung", [...(await nutzungLesen()), ...neu].slice(-NUTZUNG_MAX));
    return [201, { ok: true, gespeichert: neu.length }];
  });
  r.get("nutzung", async () => ({ ereignisse: (await nutzungLesen()).map(z => z.daten) }));
  r.get("nutzung/versionen", async () => {
    const v = new Map();
    for (const z of await nutzungLesen()) {
      const x = v.get(z.version) || { version: z.version, anzahl: 0, von: z.tag, bis: z.tag };
      x.anzahl++; if (z.tag < x.von) x.von = z.tag; if (z.tag > x.bis) x.bis = z.tag;
      v.set(z.version, x);
    }
    return { versionen: [...v.values()] };
  });
  r.delete("nutzung", async ({ query }) => {
    const version = query.get("version") || "", alle = await nutzungLesen();
    const bleibt = version ? alle.filter(z => z.version !== version) : [];
    await speicher.metaSchreiben("nutzung", bleibt);
    return { ok: true, geloescht: alle.length - bleibt.length };
  });
  r.post("nutzung/export", async ({ daten }) => {
    if (!daten || daten.app !== "Babybuch") throw new ApiFehler("Ungültiger Export.");
    const d = new Date(), z = n => String(n).padStart(2, "0");
    const datei = `babybuch-nutzung-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.json`;
    const url = URL.createObjectURL(new File([JSON.stringify(daten, null, 1)], datei, { type: "application/json" }));
    return [201, { datei, url }];
  });

  // Erinnerung über die Home-Assistant-App gibt es in der Web-App nicht
  r.get("erinnerung/geraete", () => ({ verfuegbar: false, geraete: [] }));
  // Abgelegte Berichte und CSV-Import kommen mit Etappe 2
  r.get("berichte", () => ({ berichte: [] }));
  r.post("import/:art", () => { throw new ApiFehler("Der CSV-Import kommt mit dem nächsten Update der Web-App."); });
  // Pi-Sicherungskopien ersetzt das Backup (Einstellungen › Kinder, Backup & Abgleich)
  r.get("sicherungen", () => ({ sicherungen: [], ordner: "" }));
}
