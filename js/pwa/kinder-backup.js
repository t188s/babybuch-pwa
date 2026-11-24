// Babybuch PWA · Web-App-eigene Teile in der Pi-Oberfläche:
//   Kind anlegen/wechseln · Backup teilen/laden mit Zusammenführen · Papierkorb · Backup-Erinnerung

import * as speicher from "../kern/speicher.js";
import * as abgleich from "../kern/abgleich.js";
import { alleKinder, aktivesKind, kindSpeichern, aktivSetzen, alterText, kindEntfernen, entfernteKinder, kindZurueckholen } from "../kern/kinder.js";
import { APP_VERSION } from "../kern/version.js";
import { $, neu, knopf, fenster, knopfReihe, nachfragen, toast, fehler, zeile, abschnitt, listenZeile, datumDe } from "../ui/bausteine.js";

const TYP_NAMEN = { kind: "Kind", stillen: "Stillen", windeln: "Windel", gewicht: "Gewicht", groesse: "Größe", kopfumfang: "Kopfumfang",
  fieber: "Temperatur", symptome: "Symptom", medikamente: "Medikament", gaben: "Gabe abgehakt", taegliche_gaben: "Regelmäßige Gabe",
  untersuchungen: "U-Untersuchung", screenings: "Abhakliste Geburt", impfungen: "Impfung", impfplan: "Impfplan", arztbesuche: "Arztbesuch",
  massnahmen: "Maßnahme", einstellung: "Einstellung" };
const typName = t => TYP_NAMEN[t] || t;
const ART_NAMEN = { neu: "neu", aktualisiert: "geändert", geloescht: "gelöscht", wiederhergestellt: "wiederhergestellt" };

/** Kurzer Name für die Kopfzeile: „Lea (Beispiel)“ → „Lea“, „Anna Maria“ → „Anna Maria“ */
const rufname = name => String(name).replace(/\s*\(.*\)\s*$/, "") || name;

/** Nach Kind-Wechsel oder Import: Pi-Oberfläche frisch laden (sie hält viel im Zwischenspeicher). */
export function neuStarten() { location.reload(); }

// ════════ Kind anlegen / ändern ════════
export function kindDialog(kind = null, { pflicht = false } = {}) {
  return new Promise(ok => {
    const feld = (id, typ = "text") => { const f = neu("input", "feld-eingabe"); f.id = id; f.type = typ; f.autocomplete = "off"; return f; };
    const name = feld("pk-name"); name.maxLength = 40; name.placeholder = "z. B. Mila";
    const geburt = feld("pk-geburt", "date");
    const gg = feld("pk-gg"); gg.inputMode = "decimal"; gg.placeholder = "g oder kg";
    let geschlecht = kind?.daten.geschlecht || "";
    const wahl = neu("div", "umschalter");
    wahl.style.minWidth = "180px";
    for (const [w, text] of [["w", "Mädchen"], ["m", "Junge"]]) {
      const b = knopf(text, () => { geschlecht = geschlecht === w ? "" : w; zeichnen(); });
      b.dataset.g = w; wahl.append(b);
    }
    const zeichnen = () => { for (const b of wahl.children) b.classList.toggle("aktiv", b.dataset.g === geschlecht); };
    if (kind) { name.value = kind.daten.name; geburt.value = kind.daten.geburtsdatum || ""; gg.value = kind.daten.geburtsgewicht || ""; }
    zeichnen();
    const reihe = knopfReihe();
    const d = fenster(kind ? "Kind ändern" : pflicht ? "Willkommen im Babybuch" : "Kind hinzufügen",
      pflicht ? "Leg zuerst euer Kind an. Alles bleibt nur auf diesem Handy." : "",
      zeile("Name", name), zeile("Geburtsdatum", geburt), zeile("Geschlecht", wahl), zeile("Geburtsgewicht", gg),
      neu("p", "unter", "Geburtsdatum und Geschlecht braucht das Babybuch für die WHO-Kurven und die Vorsorge-Zeitfenster."), reihe);
    if (kind) d.append(knopf("Kind entfernen", async () => {
      const ja = await nachfragen(`„${kind.daten.name}“ mit allen Einträgen entfernen? Kind und Einträge liegen danach 30 Tage im Papierkorb und lassen sich zurückholen.`, "Entfernen");
      if (!ja) return;
      await kindEntfernen(kind.uid);
      try { sessionStorage.setItem("pwaHinweis", `„${kind.daten.name}“ entfernt – zurückholen unter „Kinder, Backup & Abgleich“.`); } catch (_) { /* egal */ }
      neuStarten();
    }, "loeschen-knopf"));
    if (pflicht) d.append(links());
    if (pflicht) d.addEventListener("cancel", e => e.preventDefault());       // ohne Kind geht es nicht weiter
    else reihe.append(knopf("Abbrechen", () => d.close()));
    reihe.append(knopf(kind ? "Speichern" : "Anlegen", async () => {
      try {
        const roh = gg.value.trim().toLowerCase().replace(/\s/g, "").replace(/kg$|g$/, "").replace(",", ".");
        let gramm = null;
        if (roh) { const z = Number(roh); gramm = Number.isFinite(z) ? Math.round(z < 30 ? z * 1000 : z) : NaN; }
        if (Number.isNaN(gramm) || (gramm !== null && (gramm < 500 || gramm > 7000))) { toast("Geburtsgewicht bitte in Gramm (3350) oder kg (3,35)."); return; }
        const neuerStand = await kindSpeichern({ name: name.value, geburtsdatum: geburt.value, geschlecht, geburtsgewicht: gramm }, kind?.uid || null);
        d.close(); ok(neuerStand);
      } catch (f) { fehler(f); }
    }, "haupt"));
    if (pflicht) {
      // Partner-Handy: statt neu anlegen das Backup vom anderen Handy laden – Kind und alle Einträge kommen mit
      d.append(abschnitt("Schon im Einsatz?", neu("p", "unter", "Nutzt dein Partner das Babybuch schon? Dann lade sein Backup – das Kind und alle Einträge kommen mit."),
        knopfReihe(knopf("Backup vom Partner laden", async () => {
          if (!(await backupLaden())) return;
          const [erstes] = await alleKinder();
          if (erstes) { await aktivSetzen(erstes.uid); d.close(); ok(erstes); }
        }))));
      d.append(abschnitt("Erst einmal ausprobieren?", neu("p", "unter", "Ein erfundenes Beispielkind (6 Wochen alt) mit Einträgen in allen Bereichen. Später einfach entfernen."),
        knopfReihe(knopf("Beispielkind ansehen", async () => {
          const b = await beispielAnlegen();
          if (b) { d.close(); ok(b); }
        }))));
    }
    d.addEventListener("close", () => ok(null));
  });
}

/** Beispielkind anlegen und anzeigen (mit kurzer Rückmeldung, dauert ein paar Sekunden). */
async function beispielAnlegen() {
  try {
    toast("Beispielkind wird angelegt …");
    const { beispielkindAnlegen } = await import("./beispiel.js");
    const kind = await beispielkindAnlegen();
    await aktivSetzen(kind.uid);
    try { sessionStorage.setItem("pwaHinweis", "Beispielkind „Lea“ angelegt – entfernen unter Kinder, Backup & Abgleich › Ändern."); } catch (_) { /* egal */ }
    return kind;
  } catch (f) { fehler(f); return null; }
}

// ════════ iPhone/iPad: erst auf den Home-Bildschirm ════════
// Auf iOS haben der Safari-Tab und die App auf dem Home-Bildschirm getrennte Speicher. Wer im Tab einträgt und
// danach installiert, findet in der App nichts wieder – und iOS kann Website-Daten nach längerer Pause löschen.
export function iosImBrowser() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installiert = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
  return ios && !installiert;
}

let installHinweisLaeuft = null;
/** Einmal pro Sitzung im iOS-Browser: Anleitung zeigen. Wartet, bis „Nur ansehen“ gewählt wurde. */
export function installHinweis({ immer = false } = {}) {
  if (!iosImBrowser()) return Promise.resolve();
  if (!immer) { try { if (sessionStorage.getItem("pwaNurAnsehen")) return Promise.resolve(); } catch (_) { /* egal */ } }
  installHinweisLaeuft ??= new Promise(ok => {
    const schritte = neu("ol", "pwa-schritte");
    for (const t of ["Unten auf Teilen tippen (Viereck mit Pfeil nach oben, beim iPad oben rechts).",
                     "„Zum Home-Bildschirm“ wählen – eventuell etwas nach unten scrollen.",
                     "Rechts oben „Hinzufügen“ tippen und das Babybuch ab jetzt nur noch über das neue Symbol öffnen."])
      schritte.append(neu("li", "", t));
    const reihe = knopfReihe();
    const d = fenster("Erst auf den Home-Bildschirm", "Auf dem iPhone speichert das Babybuch nur als App sicher.", schritte,
      neu("p", "unter", "Was du hier im Browser einträgst, sieht die App auf dem Home-Bildschirm nicht – das iPhone hält beides getrennt und kann Browser-Daten nach längerer Pause löschen."),
      reihe);
    d.addEventListener("cancel", e => e.preventDefault());
    reihe.append(knopf("Nur kurz ansehen", () => {
      try { sessionStorage.setItem("pwaNurAnsehen", "1"); } catch (_) { /* egal */ }
      d.close();
    }));
    d.addEventListener("close", () => { installHinweisLaeuft = null; ok(); });
  });
  return installHinweisLaeuft;
}

let sicherstellen = null;
/** Ohne Kind kann die Oberfläche nichts anzeigen – beim ersten Start einmal fragen (auch wenn viele Anfragen gleichzeitig kommen). */
export function kindSicherstellen() {
  sicherstellen ??= (async () => {
    for (;;) {
      const k = await aktivesKind();
      if (k) return k;
      await installHinweis();
      await kindDialog(null, { pflicht: true });
    }
  })().finally(() => { sicherstellen = null; });
  return sicherstellen;
}

// ════════ Hauptfenster „Kinder, Backup & Abgleich“ ════════
export async function oeffnen() {
  const inhalt = neu("div");
  const d = fenster("Kinder, Backup & Abgleich", "Alles bleibt auf diesem Handy. Mit dem Backup holt sich der Partner eure Einträge.", inhalt,
    knopfReihe(knopf("Fertig", () => d.close(), "haupt")));
  const neuZeichnen = async () => inhalt.replaceChildren(...await abschnitte(neuZeichnen));
  await neuZeichnen();
}

async function abschnitte(neuZeichnen) {
  const teile = [];
  const aktiv = await aktivesKind();
  // ── Kinder ──
  const kinder = await alleKinder();
  const ul = neu("ul", "sicherung-liste");
  for (const k of kinder) {
    const knoepfe = [];
    if (k.uid !== aktiv?.uid) knoepfe.push(knopf("Anzeigen", async () => { await aktivSetzen(k.uid); neuStarten(); }));
    knoepfe.push(knopf("Ändern", async () => { if (await kindDialog(k)) neuStarten(); }));
    ul.append(listenZeile(k.daten.name, [alterText(k.daten.geburtsdatum), k.uid === aktiv?.uid ? "wird angezeigt" : ""].filter(Boolean).join(" · ") || " ", ...knoepfe));
  }
  const entfernt = await entfernteKinder();
  const weg = neu("ul", "sicherung-liste");
  for (const k of entfernt)
    weg.append(listenZeile(k.daten.name, `entfernt ${datumDe(k.geloescht)}`, knopf("Zurückholen", async () => {
      await kindZurueckholen(k.uid); await aktivSetzen(k.uid); neuStarten();
    })));
  teile.push(abschnitt("Kinder", ul,
    knopfReihe(knopf("+ Kind hinzufügen", async () => { const k = await kindDialog(); if (k) neuStarten(); }),
               knopf("+ Beispielkind", async () => { if (await beispielAnlegen()) neuStarten(); })),
    ...(entfernt.length ? [neu("p", "label", "Entfernt (30 Tage im Papierkorb)"), weg] : [])));

  // ── Backup & Abgleich ──
  const letztes = await speicher.metaLesen("letztesBackup");
  const intervall = await speicher.metaLesen("backupIntervall", abgleich.INTERVALL_STANDARD);
  const wahl = neu("select"); wahl.id = "pk-intervall";
  for (const [w, text] of [[0, "nie"], [1, "täglich"], [3, "alle 3 Tage"], [7, "jede Woche"], [14, "alle 2 Wochen"], [30, "jeden Monat"]]) {
    const o = neu("option", "", text); o.value = w; o.selected = w === intervall; wahl.append(o);
  }
  wahl.onchange = async () => { await speicher.metaSchreiben("backupIntervall", Number(wahl.value)); hinweisZeichnen(); };
  teile.push(abschnitt("Backup & Abgleich",
    neu("p", "unter", `Letztes Backup: ${letztes ? datumDe(letztes) : "noch keins"}. Teilen über AirDrop, Messenger, „In Dateien sichern“ (iCloud Drive) oder Google Drive.`),
    zeile("Erinnern", wahl),
    knopfReihe(knopf("Backup teilen", () => backupTeilenDialog(neuZeichnen), "haupt"), knopf("Backup laden", async () => { if (await backupLaden()) neuStarten(); })),
    await letzterImportListe(neuZeichnen)));

  // ── Papierkorb ──
  if (aktiv) {
    const korb = await speicher.papierkorb(aktiv.uid);
    const liste = neu("ul", "sicherung-liste");
    if (!korb.length) liste.append(neu("li", "", "Leer."));
    for (const e of korb.filter(x => x.typ !== "einstellung").slice(0, 40))
      liste.append(listenZeile(typName(e.typ), `gelöscht ${datumDe(e.geloescht)}`,
        knopf("Zurückholen", async () => { await speicher.wiederherstellen(e.uid); toast(`${typName(e.typ)} zurückgeholt.`); neuStarten(); })));
    teile.push(abschnitt(`Papierkorb · ${aktiv.daten.name}`, neu("p", "unter", "Gelöschtes bleibt 30 Tage hier und wird dann endgültig entfernt."), liste));
  }

  // ── Über ──
  const dauerhaft = await speicher.dauerhaftAnfordern();
  teile.push(abschnitt("Über die Web-App",
    neu("p", "unter", `Babybuch Web-App ${APP_VERSION}. ` + (dauerhaft ? "Der Browser hält die Daten dauerhaft fest."
      : "Der Browser hat dauerhaftes Speichern nicht bestätigt – regelmäßige Backups sind deshalb besonders wichtig.")),
    neu("p", "unter", "Das Babybuch dokumentiert nur – es stellt keine Diagnose und ersetzt keine Hebamme und keinen Arzt."), links()));

  // ── Zurücksetzen ──
  teile.push(abschnitt("Handy zurücksetzen",
    neu("p", "unter", "Zum Beispiel vor einem Handywechsel oder wenn ihr das Babybuch nicht mehr nutzt."),
    knopf("Alle Daten auf diesem Handy löschen", () => allesLoeschenDialog().catch(fehler), "loeschen-knopf")));
  return teile;
}

/** Alles löschen: zuerst Backup anbieten, dann zweimal bestätigen. */
async function allesLoeschenDialog() {
  const kinder = await alleKinder();
  const namen = kinder.map(k => k.daten.name).join(", ") || "keine Kinder";
  const reihe = knopfReihe();
  const d = fenster("Alle Daten löschen?", `Auf diesem Handy: ${namen}.`,
    neu("p", "unter", "Gelöscht werden alle Kinder, Einträge, der Papierkorb und der Import-Verlauf. Das lässt sich nicht rückgängig machen. " +
      "Schon geteilte Backup-Dateien und das Handy deines Partners bleiben unverändert."), reihe);
  reihe.append(knopf("Abbrechen", () => d.close()));
  if (kinder.length) reihe.append(knopf("Erst Backup sichern", () => { d.close(); backupTeilenDialog(); }, "haupt"));
  d.append(knopf("Ohne weiteres Backup löschen", async () => {
    if (!(await nachfragen("Wirklich alle Babybuch-Daten auf diesem Handy endgültig löschen?", "Endgültig löschen"))) return;
    try {
      await speicher.allesLoeschen();
      const design = window.PWA_DESIGN?.lesen();
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) { /* egal */ }
      if (design) window.PWA_DESIGN.setzen(design);          // Design ist keine persönliche Angabe – bleibt
      try { sessionStorage.setItem("pwaHinweis", "Alle Daten auf diesem Handy wurden gelöscht."); } catch (_) { /* egal */ }
      neuStarten();
    } catch (f) { fehler(f); }
  }, "loeschen-knopf"));
}

function links() {
  const p = neu("p", "unter");
  const a1 = neu("a", "", "Installieren & Backup"); a1.href = "hilfe.html";
  const a2 = neu("a", "", "Datenschutz"); a2.href = "datenschutz.html";
  for (const a of [a1, a2]) a.style.color = "var(--gold)";
  p.append(a1, " · ", a2);
  return p;
}

// ════════ Backup teilen: Kinder per Häkchen ════════
async function backupTeilenDialog(nachher = () => {}) {
  const kinder = await alleKinder();
  if (!kinder.length) { toast("Noch kein Kind angelegt."); return; }
  const liste = neu("div", "haken-liste");
  const haken = kinder.map(k => {
    const l = neu("label"), h = neu("input"); h.type = "checkbox"; h.checked = true; h.value = k.uid;
    l.append(h, " " + k.daten.name); liste.append(l); return h;
  });
  const reihe = knopfReihe();
  const d = fenster("Backup teilen", "Die Datei enthält alle Einträge der gewählten Kinder – auch, was gelöscht wurde, damit das Löschen beim Partner ankommt.",
    liste, reihe);
  reihe.append(knopf("Abbrechen", () => d.close()), knopf("Teilen", async () => {
    try {
      const { ergebnis, anzahl } = await abgleich.backupSenden(haken.filter(h => h.checked).map(h => h.value));
      d.close();
      if (ergebnis !== "abgebrochen") toast(ergebnis === "heruntergeladen" ? `Backup gespeichert (${anzahl} Einträge).` : `Backup geteilt (${anzahl} Einträge).`);
      hinweisZeichnen(); nachher();
    } catch (f) { fehler(f); }
  }, "haupt"));
}

// ════════ Backup laden: Vorschau → übernehmen. Ergebnis: true = übernommen ════════
export async function backupLaden() {
  let text;
  try { text = await abgleich.wegHolen("datei").holen(); } catch (f) { fehler(f); return false; }
  if (!text) return false;
  const v = await abgleich.vorschauAusText(text);
  if (!v.ok) { toast(v.fehler); return false; }
  const z = v.plan.zaehler;
  const box = neu("div", "import-ergebnis"), zahlen = neu("p", "zahlen");
  zahlen.style.margin = "0";
  zahlen.append(neu("b", "", String(z.neu)), " neu · ", neu("b", "", String(z.aktualisiert)), " geändert · ",
                neu("b", "", String(z.geloescht)), " gelöscht · ", neu("b", "", String(z.unveraendert + z.aelter)), " schon aktuell");
  box.append(zahlen);
  const nichts = !v.plan.aenderungen.length;
  const reihe = knopfReihe();
  const d = fenster("Backup laden", `Datei vom ${datumDe(v.datei.erstellt)}` + (v.verworfen ? ` · ${v.verworfen} unlesbare Einträge werden übersprungen` : ""),
    box, neu("p", "unter", nichts ? "Hier ist schon alles auf dem neuesten Stand." :
      "Bei Einträgen, die auf beiden Handys geändert wurden, gewinnt die neueste Änderung. Jede Übernahme lässt sich danach einzeln rückgängig machen."), reihe);
  let uebernommen = false;
  const fertig = new Promise(ok => d.addEventListener("close", () => ok(uebernommen)));
  reihe.append(knopf(nichts ? "Schließen" : "Abbrechen", () => d.close()));
  if (!nichts) reihe.append(knopf("Übernehmen", async () => {
    try {
      const p = await abgleich.uebernehmen(v.plan);
      try { sessionStorage.setItem("pwaHinweis", `${p.aenderungen.length} Änderungen übernommen – rückgängig unter „Kinder, Backup & Abgleich“.`); } catch (_) { /* egal */ }
      uebernommen = true; d.close();
    } catch (f) { fehler(f); }
  }, "haupt"));
  return fertig;
}

async function letzterImportListe(neuZeichnen) {
  const p = await speicher.metaLesen("letzterImport");
  const box = neu("div");
  if (!p?.aenderungen.length) return box;
  box.append(neu("p", "label", `Zuletzt übernommen · ${datumDe(p.zeit)}`));
  const ul = neu("ul", "sicherung-liste");
  for (const a of p.aenderungen.filter(x => x.typ !== "einstellung").slice(0, 40)) {
    const name = a.typ === "kind" ? `Kind ${a.nachher.daten?.name || ""}` : typName(a.typ);
    const bleibt = abgleich.bleibtErhalten(a);
    const knoepfe = !a.zurueck && !bleibt ? [knopf("Rückgängig", async () => { await abgleich.einzelnZurueck(a.uid); toast("Rückgängig gemacht."); neuZeichnen(); })] : [];
    ul.append(listenZeile(name, a.zurueck ? "rückgängig gemacht" : ART_NAMEN[a.art] + (bleibt ? " · bleibt erhalten" : ""), ...knoepfe));
  }
  box.append(ul);
  if (p.aenderungen.some(a => !a.zurueck && !abgleich.bleibtErhalten(a))) {
    const weg = knopf("Ganzen Import rückgängig machen", async () => {
      if (!(await nachfragen("Den ganzen letzten Import rückgängig machen?", "Rückgängig"))) return;
      const n = await abgleich.allesZurueck();
      try { sessionStorage.setItem("pwaHinweis", `${n} Übernahmen rückgängig gemacht.`); } catch (_) { /* egal */ }
      neuStarten();
    }, "loeschen-knopf");
    box.append(weg);
  }
  return box;
}

// ════════ In der Pi-Oberfläche: Kind-Knopf oben, Backup-Hinweis ════════
export async function einbauen() {
  // Hinweis nach Neustart (z. B. „12 Änderungen übernommen“)
  try { const h = sessionStorage.getItem("pwaHinweis"); if (h) { sessionStorage.removeItem("pwaHinweis"); setTimeout(() => toast(h), 600); } } catch (_) { /* egal */ }
  const kinder = await alleKinder(), aktiv = await aktivesKind();
  // Kind-Knopf oben: immer sichtbar, zeigt das angezeigte Kind, antippen = Kind wechseln (Verwalten in den Einstellungen)
  const k = $("pwa-kind");
  if (k && aktiv) {
    k.replaceChildren(neu("span", "name", rufname(aktiv.daten.name)), neu("span", "pfeil", "▾"));
    k.title = aktiv.daten.name;
    k.hidden = false;
    k.onclick = async () => {
      const liste = neu("div", "menue-knoepfe");
      const d = fenster("Welches Kind?", "", liste,
        neu("p", "unter", "Kinder hinzufügen, ändern oder entfernen: Einstellungen › Kinder, Backup & Abgleich."),
        knopfReihe(knopf("Schließen", () => d.close())));
      for (const kind of await alleKinder()) {
        const b = knopf("", async () => { if (kind.uid !== aktiv.uid) { await aktivSetzen(kind.uid); neuStarten(); } else d.close(); },
                        kind.uid === aktiv.uid ? "aktiv" : "");
        b.append(neu("span", "", kind.daten.name), neu("span", "pfeil", kind.uid === aktiv.uid ? "✓ angezeigt" : alterText(kind.daten.geburtsdatum)));
        liste.append(b);
      }
    };
  }
  void kinder;
  // Einstellungen › Baby: nur Zusammenfassung, bearbeitet wird im Kind-Dialog (eine Stelle für die Kinddaten)
  const baby = $("pwa-baby");
  if (baby && aktiv) {
    const g = { w: "Mädchen", m: "Junge" }[aktiv.daten.geschlecht];
    const teile = [g, aktiv.daten.geburtsdatum ? "geboren " + aktiv.daten.geburtsdatum.split("-").reverse().join(".") : "Geburtsdatum fehlt",
                   aktiv.daten.geburtsgewicht ? `${aktiv.daten.geburtsgewicht} g` : ""].filter(Boolean);
    const ul = neu("ul", "sicherung-liste");
    ul.append(listenZeile(aktiv.daten.name, teile.join(" · "), knopf("Ändern", async () => { if (await kindDialog(aktiv)) neuStarten(); })));
    baby.replaceChildren(ul);
  }
  installHinweis().catch(() => {});
  // Design-Umschalter in den Einstellungen
  const dz = $("pwa-design");
  if (dz && window.PWA_DESIGN) {
    const markieren = () => dz.querySelectorAll("button").forEach(b => b.classList.toggle("aktiv", b.dataset.design === window.PWA_DESIGN.lesen()));
    dz.querySelectorAll("button").forEach(b => b.onclick = () => { window.PWA_DESIGN.setzen(b.dataset.design); markieren(); });
    markieren();
  }
  for (const id of ["pwa-daten", "pwa-daten-2"]) if ($(id)) $(id).onclick = () => oeffnen().catch(fehler);
  hinweisZeichnen();
}

async function hinweisZeichnen() {
  const f = await abgleich.backupFaellig(), ziel = $("pwa-hinweis");
  if (!ziel) return;
  if (iosImBrowser()) {      // wichtiger als die Backup-Erinnerung
    ziel.hidden = false;
    ziel.replaceChildren(neu("span", "", "Im Browser geöffnet – Einträge hier sind getrennt von der App."),
      knopf("So geht’s", () => installHinweis({ immer: true })));
    return;
  }
  ziel.hidden = !f;
  if (!f) return;
  ziel.replaceChildren(neu("span", "", f.seit === null ? "Noch kein Backup – jetzt sichern?" : `Letztes Backup vor ${f.seit} Tagen – jetzt sichern?`),
    knopf("Sichern", () => backupTeilenDialog()));
}
