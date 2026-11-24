// Babybuch PWA · Kern · Zusammenführen zweier Stände (z. B. Backup-Datei vom Partner-Handy)
//
// Reine Logik ohne Browser-Abhängigkeit – dadurch automatisch testbar (tests/zusammenfuehren.test.mjs).
//
// Jeder Datensatz (Eintrag, Kind, …) hat:
//   uid        eindeutige Kennung (bleibt für immer gleich, auch auf dem anderen Handy)
//   typ        z. B. "kind", "stillen", "windel", "gewicht"
//   kind       uid des Kindes (bei typ "kind" die eigene uid)
//   daten      die eigentlichen Werte (frei je Modul)
//   geaendert  Zeitpunkt der letzten Änderung in ms (Date.now())
//   geraet     Kennung des Handys, das zuletzt geändert hat
//   geloescht  null oder Zeitpunkt des Löschens in ms (Löschmarker, damit Löschen für beide gilt)
//
// Regeln (Entscheidungen 23.11.):
//   - Neu auf dem anderen Handy → übernehmen (auch Löschmarker, damit Gelöschtes gelöscht bleibt)
//   - Beide haben denselben Datensatz → die NEUESTE Änderung gewinnt
//   - Gleich alt → feste Reihenfolge über die Gerätekennung, damit beide Handys dasselbe Ergebnis haben
//   - Jede Übernahme wird mit dem vorherigen Stand gemeldet → einzeln rückgängig machbar

/** Gewinnt b gegen a? (true = b ist neuer) */
export function istNeuer(b, a) {
  if (b.geaendert !== a.geaendert) return b.geaendert > a.geaendert;
  return String(b.geraet || "") > String(a.geraet || "");
}

/** Sind zwei Stände inhaltlich gleich? (dann ist nichts zu tun) */
export function gleicherStand(a, b) {
  return a.geaendert === b.geaendert && a.geraet === b.geraet &&
         (a.geloescht || null) === (b.geloescht || null) &&
         gleich(a.daten, b.daten) && gleich(feldZeitenVon(a), feldZeitenVon(b));
}

// ── Feldweise mischen (Entscheidung 23.11.) ──
// Jeder Datensatz merkt sich je Feld, wann es zuletzt geändert wurde (feldZeiten: { feld: [ms, geraet] }).
// Ändert ein Elternteil die Dauer und der andere die Notiz, bleiben beide Änderungen erhalten.
// Nur wenn beide dasselbe Feld geändert haben, gewinnt dort die neueste Änderung.
// Ältere Datensätze ohne feldZeiten zählen mit ihrem Änderungszeitpunkt für alle Felder.

const gleich = (a, b) => JSON.stringify(sortiert(a)) === JSON.stringify(sortiert(b));
function sortiert(x) {
  if (Array.isArray(x)) return x.map(sortiert);
  if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().map(k => [k, sortiert(x[k])]));
  return x;
}

export function feldZeitenVon(d) {
  const z = {};
  for (const feld of Object.keys(d.daten || {})) z[feld] = d.feldZeiten?.[feld] || [d.geaendert, d.geraet || ""];
  return z;
}

const zeitNeuer = (b, a) => (b[0] !== a[0] ? b[0] > a[0] : String(b[1]) > String(a[1]));

/** Mischt zwei lebende Stände desselben Datensatzes feldweise – auf beiden Handys mit demselben Ergebnis. */
export function feldweiseMischen(a, b) {
  const za = feldZeitenVon(a), zb = feldZeitenVon(b);
  const daten = {}, feldZeiten = {};
  for (const feld of new Set([...Object.keys(za), ...Object.keys(zb)])) {
    const nimmB = !(feld in za) || (feld in zb && zeitNeuer(zb[feld], za[feld]));
    daten[feld] = nimmB ? b.daten[feld] : a.daten[feld];
    feldZeiten[feld] = nimmB ? zb[feld] : za[feld];
  }
  const neuer = istNeuer(b, a) ? b : a;
  return { ...neuer, daten, feldZeiten, erstellt: Math.min(a.erstellt ?? Infinity, b.erstellt ?? Infinity) };
}

/** Neue feldZeiten nach einer Änderung auf diesem Handy: geänderte Felder bekommen „jetzt“. */
export function feldZeitenNachAenderung(vorher, daten, jetzt, geraet) {
  const alt = vorher ? feldZeitenVon(vorher) : {}, z = {};
  for (const feld of Object.keys(daten))
    z[feld] = vorher && feld in alt && gleich(vorher.daten[feld], daten[feld]) ? alt[feld] : [jetzt, geraet];
  return z;
}

/**
 * Plant das Zusammenführen, ohne etwas zu verändern.
 * @param {Map<string, object>|object[]} lokal   eigener Bestand
 * @param {object[]} fremd                        Datensätze aus der Datei
 * @returns {{ aenderungen: {art: string, uid: string, typ: string, vorher: object|null, nachher: object}[],
 *            zaehler: {neu: number, aktualisiert: number, geloescht: number, unveraendert: number, aelter: number} }}
 *   art: "neu" | "aktualisiert" | "geloescht" | "wiederhergestellt"
 */
export function zusammenfuehrenPlanen(lokal, fremd) {
  const bestand = lokal instanceof Map ? lokal : new Map(lokal.map(d => [d.uid, d]));
  const zaehler = { neu: 0, aktualisiert: 0, geloescht: 0, unveraendert: 0, aelter: 0 };
  const aenderungen = [];
  const gesehen = new Map();                        // doppelte uids innerhalb der Datei: nur der neueste zählt
  for (const d of fremd) {
    const bisher = gesehen.get(d.uid);
    if (!bisher || istNeuer(d, bisher)) gesehen.set(d.uid, d);
  }
  for (const d of gesehen.values()) {
    const meins = bestand.get(d.uid);
    if (!meins) {
      aenderungen.push({ art: d.geloescht ? "geloescht" : "neu", uid: d.uid, typ: d.typ, vorher: null, nachher: d });
      zaehler[d.geloescht ? "geloescht" : "neu"]++;
      continue;
    }
    if (gleicherStand(meins, d)) { zaehler.unveraendert++; continue; }
    // Beide lebend → feldweise mischen; Löschen/Wiederherstellen entscheidet weiter der ganze Datensatz
    if (!d.geloescht && !meins.geloescht) {
      const gemischt = feldweiseMischen(meins, d);
      if (gleicherStand(meins, gemischt)) { zaehler.aelter++; continue; }
      aenderungen.push({ art: "aktualisiert", uid: d.uid, typ: d.typ, vorher: meins, nachher: gemischt });
      zaehler.aktualisiert++;
      continue;
    }
    if (!istNeuer(d, meins)) { zaehler.aelter++; continue; }
    let art = "aktualisiert";
    if (d.geloescht && !meins.geloescht) art = "geloescht";
    else if (!d.geloescht && meins.geloescht) art = "wiederhergestellt";
    aenderungen.push({ art, uid: d.uid, typ: d.typ, vorher: meins, nachher: d });
    zaehler[art === "wiederhergestellt" ? "aktualisiert" : art]++;
  }
  return { aenderungen, zaehler };
}

/**
 * Rückgängig für eine einzelne Übernahme: der vorherige Stand kommt zurück –
 * mit neuem Zeitpunkt, damit er beim nächsten Austausch gegen den alten fremden Stand gewinnt.
 * War der Datensatz vorher gar nicht da, wird er als gelöscht markiert (Löschmarker).
 */
export function rueckgaengigStand(aenderung, jetzt, geraet) {
  if (aenderung.vorher) {
    const v = aenderung.vorher;
    const feldZeiten = Object.fromEntries(Object.keys(v.daten || {}).map(f => [f, [jetzt, geraet]]));
    return { ...v, geaendert: jetzt, geraet, feldZeiten };
  }
  return { ...aenderung.nachher, geloescht: jetzt, geaendert: jetzt, geraet };
}

/** Löschmarker älter als die Frist werden endgültig entfernt (Papierkorb 30 Tage). */
export const PAPIERKORB_TAGE = 30;
export function abgelaufen(d, jetzt, tage = PAPIERKORB_TAGE) {
  return Boolean(d.geloescht) && jetzt - d.geloescht > tage * 864e5;
}
