// Babybuch PWA · Tests für den Kern (Zusammenführen, Backup-Datei)
// Ausführen: npm test   (oder: node --test tests/*.test.mjs)

import { test } from "node:test";
import assert from "node:assert/strict";
import { zusammenfuehrenPlanen, rueckgaengigStand, istNeuer, abgelaufen, gleicherStand } from "../js/kern/zusammenfuehren.js";
import { backupErstellen, backupPruefen, dateiname } from "../js/kern/backupdatei.js";

const K = "kind-aaaaaaaa", K2 = "kind-bbbbbbbb";
const d = (uid, geaendert, geraet = "geraet-A", extra = {}) =>
  ({ uid, typ: "windel", kind: K, daten: { zeit: "2026-11-23T10:00", art: "nass" }, erstellt: 1, geaendert, geraet, geloescht: null, ...extra });

test("neuer Eintrag vom Partner wird übernommen", () => {
  const { zaehler, aenderungen } = zusammenfuehrenPlanen([], [d("eintrag-001", 100)]);
  assert.equal(zaehler.neu, 1);
  assert.equal(aenderungen[0].art, "neu");
});

test("gleicher Stand → nichts zu tun, zweimal importieren legt nichts doppelt an", () => {
  const a = d("eintrag-001", 100);
  const { zaehler, aenderungen } = zusammenfuehrenPlanen([a], [{ ...a }]);
  assert.equal(aenderungen.length, 0);
  assert.equal(zaehler.unveraendert, 1);
});

test("neueste Änderung gewinnt", () => {
  const meins = d("eintrag-001", 100, "geraet-A");
  const fremdNeuer = d("eintrag-001", 200, "geraet-B", { daten: { zeit: "2026-11-23T10:05", art: "voll" } });
  let p = zusammenfuehrenPlanen([meins], [fremdNeuer]);
  assert.equal(p.zaehler.aktualisiert, 1);
  assert.equal(p.aenderungen[0].vorher, meins);
  const fremdAelter = d("eintrag-001", 50, "geraet-B", { daten: { zeit: "x", art: "voll" } });
  p = zusammenfuehrenPlanen([meins], [fremdAelter]);
  assert.equal(p.aenderungen.length, 0);
  assert.equal(p.zaehler.aelter, 1);
});

test("gleich alt → beide Handys kommen zum selben Ergebnis", () => {
  const a = d("eintrag-001", 100, "geraet-A", { daten: { art: "nass" } });
  const b = d("eintrag-001", 100, "geraet-B", { daten: { art: "voll" } });
  const aufA = zusammenfuehrenPlanen([a], [b]).aenderungen.map(x => x.nachher);
  const aufB = zusammenfuehrenPlanen([b], [a]).aenderungen.map(x => x.nachher);
  const endeA = aufA[0] || a, endeB = aufB[0] || b;
  assert.deepEqual(endeA.daten, endeB.daten);
  assert.equal(gleicherStand(endeA, endeB), true);
  assert.equal(istNeuer(b, a), true);
});

test("Löschen gilt für beide Handys", () => {
  const meins = d("eintrag-001", 100);
  const geloescht = d("eintrag-001", 200, "geraet-B", { geloescht: 200 });
  const p = zusammenfuehrenPlanen([meins], [geloescht]);
  assert.equal(p.zaehler.geloescht, 1);
  assert.equal(p.aenderungen[0].art, "geloescht");
});

test("Löschmarker für unbekannten Eintrag wird gemerkt (taucht später nicht wieder auf)", () => {
  const p = zusammenfuehrenPlanen([], [d("eintrag-009", 200, "geraet-B", { geloescht: 200 })]);
  assert.equal(p.aenderungen[0].art, "geloescht");
  // später kommt eine alte Datei mit dem Eintrag noch lebend → bleibt gelöscht
  const p2 = zusammenfuehrenPlanen([p.aenderungen[0].nachher], [d("eintrag-009", 100, "geraet-C")]);
  assert.equal(p2.aenderungen.length, 0);
});

test("Wieder hergestellt auf dem anderen Handy (neuer) → kommt zurück", () => {
  const meinGeloescht = d("eintrag-001", 100, "geraet-A", { geloescht: 100 });
  const fremdLebend = d("eintrag-001", 300, "geraet-B");
  assert.equal(zusammenfuehrenPlanen([meinGeloescht], [fremdLebend]).aenderungen[0].art, "wiederhergestellt");
});

test("Rückgängig: vorheriger Stand kommt mit neuem Zeitpunkt zurück und gewinnt danach", () => {
  const meins = d("eintrag-001", 100, "geraet-A");
  const fremd = d("eintrag-001", 200, "geraet-B", { daten: { art: "voll" } });
  const a = zusammenfuehrenPlanen([meins], [fremd]).aenderungen[0];
  const zurueck = rueckgaengigStand(a, 500, "geraet-A");
  assert.deepEqual(zurueck.daten, meins.daten);
  assert.equal(zurueck.geaendert, 500);
  assert.equal(zusammenfuehrenPlanen([zurueck], [fremd]).aenderungen.length, 0);   // erneuter Import überschreibt nicht
  // war vorher nicht da → Rückgängig = löschen
  const neuA = zusammenfuehrenPlanen([], [fremd]).aenderungen[0];
  assert.equal(rueckgaengigStand(neuA, 500, "geraet-A").geloescht, 500);
});

test("doppelte uids in einer Datei: nur der neueste zählt", () => {
  const p = zusammenfuehrenPlanen([], [d("eintrag-001", 100), d("eintrag-001", 300, "geraet-B")]);
  assert.equal(p.aenderungen.length, 1);
  assert.equal(p.aenderungen[0].nachher.geaendert, 300);
});

test("Papierkorb: nach 30 Tagen abgelaufen", () => {
  const tag = 864e5;
  assert.equal(abgelaufen(d("e-00000001", 1, "x", { geloescht: 1 }), 31 * tag), true);
  assert.equal(abgelaufen(d("e-00000001", 1, "x", { geloescht: 1 }), 29 * tag), false);
  assert.equal(abgelaufen(d("e-00000001", 1), 99 * tag), false);
});

test("Backup enthält nur ausgewählte Kinder, inkl. Löschmarker", () => {
  const daten = [
    { uid: K, typ: "kind", kind: K, daten: { name: "Mila" }, erstellt: 1, geaendert: 1, geraet: "g", geloescht: null },
    { uid: K2, typ: "kind", kind: K2, daten: { name: "Ben" }, erstellt: 1, geaendert: 1, geraet: "g", geloescht: null },
    d("eintrag-001", 5), d("eintrag-002", 6, "g", { geloescht: 6 }), { ...d("eintrag-003", 7), kind: K2 },
  ];
  const b = backupErstellen(daten, [K], { geraet: "g", appVersion: "0.1.0", jetzt: 10 });
  assert.deepEqual(b.datensaetze.map(x => x.uid).sort(), [K, "eintrag-001", "eintrag-002"].sort());
  const g = backupPruefen(JSON.stringify(b));
  assert.equal(g.ok, true);
  assert.equal(g.datensaetze.length, 3);
});

test("Backup-Prüfung lehnt fremde und kaputte Dateien ab", () => {
  assert.equal(backupPruefen("kein json").ok, false);
  assert.equal(backupPruefen(JSON.stringify({ format: "anders" })).ok, false);
  assert.equal(backupPruefen(JSON.stringify({ format: "babybuch-pwa", version: 99, datensaetze: [] })).ok, false);
  const g = backupPruefen(JSON.stringify({ format: "babybuch-pwa", version: 1, datensaetze: [d("eintrag-001", 1), { uid: "x" }, null] }));
  assert.equal(g.ok, true);
  assert.equal(g.datensaetze.length, 1);
  assert.equal(g.verworfen, 2);
});

test("Dateiname mit Kind und Zeitpunkt", () => {
  assert.match(dateiname(new Date(2026, 10, 23, 9, 5).getTime(), ["Mila Sophie"]), /^babybuch_MilaSophie_2026-11-23_0905\.babybuch$/);
  assert.match(dateiname(new Date(2026, 10, 23, 9, 5).getTime(), ["A", "B"]), /^babybuch_2026-11-23_0905\.babybuch$/);
});

// ── Feldweise mischen (Entscheidung 23.11.) ──
import { feldweiseMischen, feldZeitenNachAenderung } from "../js/kern/zusammenfuehren.js";
const st = (geaendert, geraet, daten, feldZeiten) => ({ uid: "eintrag-777", typ: "stillen", kind: K, daten, erstellt: 1, geaendert, geraet, geloescht: null, feldZeiten });

test("feldweise: Dauer von A und Notiz von B bleiben beide erhalten", () => {
  const basis = { dauer: 20, notiz: "" }, fz0 = { dauer: [10, "g"], notiz: [10, "g"] };
  const a = st(100, "A", { dauer: 25, notiz: "" }, { ...fz0, dauer: [100, "A"] });
  const b = st(200, "B", { dauer: 20, notiz: "von B" }, { ...fz0, notiz: [200, "B"] });
  const p = zusammenfuehrenPlanen([a], [b]);
  assert.deepEqual(p.aenderungen[0].nachher.daten, { dauer: 25, notiz: "von B" });
  // auf dem anderen Handy dasselbe Ergebnis
  const q = zusammenfuehrenPlanen([b], [a]);
  assert.deepEqual(q.aenderungen[0].nachher.daten, { dauer: 25, notiz: "von B" });
  assert.deepEqual(feldweiseMischen(a, b), feldweiseMischen(b, a));
  void basis;
});

test("feldweise: dasselbe Feld → neueste Änderung gewinnt", () => {
  const a = st(100, "A", { dauer: 25 }, { dauer: [100, "A"] });
  const b = st(200, "B", { dauer: 30 }, { dauer: [200, "B"] });
  assert.equal(feldweiseMischen(a, b).daten.dauer, 30);
  assert.equal(zusammenfuehrenPlanen([b], [a]).aenderungen.length, 0);       // B hat schon das Neueste
});

test("feldweise: nach dem Mischen ist beim nächsten Austausch nichts mehr zu tun", () => {
  const a = st(100, "A", { dauer: 25, notiz: "" }, { dauer: [100, "A"], notiz: [10, "g"] });
  const b = st(200, "B", { dauer: 20, notiz: "x" }, { dauer: [10, "g"], notiz: [200, "B"] });
  const m = zusammenfuehrenPlanen([a], [b]).aenderungen[0].nachher;
  assert.equal(zusammenfuehrenPlanen([m], [b]).aenderungen.length, 0);
  assert.equal(zusammenfuehrenPlanen([m], [a]).aenderungen.length, 0);
  assert.deepEqual(zusammenfuehrenPlanen([b], [m]).aenderungen[0].nachher.daten, m.daten);
});

test("feldZeiten: nur geänderte Felder bekommen den neuen Zeitpunkt", () => {
  const vorher = st(100, "A", { dauer: 20, notiz: "a" }, { dauer: [50, "A"], notiz: [100, "A"] });
  assert.deepEqual(feldZeitenNachAenderung(vorher, { dauer: 20, notiz: "b" }, 300, "B"), { dauer: [50, "A"], notiz: [300, "B"] });
  assert.deepEqual(feldZeitenNachAenderung(null, { dauer: 20 }, 300, "B"), { dauer: [300, "B"] });
});
