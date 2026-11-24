// Babybuch PWA · Oberflächen-Bausteine für die Web-App-eigenen Fenster (Kinder, Backup)
// Nutzt die Klassen der Pi-Oberfläche (dialog, .dialog-knoepfe, .b-zeile, .sicherung-liste …), damit alles gleich aussieht.

export const $ = id => document.getElementById(id);

export function neu(tag, klasse = "", text = "") {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text) e.textContent = text;
  return e;
}

export function knopf(text, aktion, klasse = "") {
  const b = neu("button", klasse, text);
  b.type = "button";
  b.onclick = aktion;
  return b;
}

/** Hinweis-Leiste der Pi-Oberfläche (mit „Rückgängig“-Knöpfen). */
export function toast(text, knoepfe = [], dauer = null) {
  if (typeof window.zeigeToast === "function") return window.zeigeToast(text, knoepfe, dauer ? { dauer } : {});
  console.log(text);
}
export function fehler(f) { console.error(f); toast(f?.message || String(f)); }

/** Fenster bauen; schließt sich selbst und räumt auf. Fokus aufs Fenster, nicht aufs erste Feld (sonst springt die Tastatur auf). */
export function fenster(titel, unter, ...inhalt) {
  const d = neu("dialog");
  d.tabIndex = -1;
  d.append(neu("h3", "", titel));
  if (unter) d.append(neu("p", "unter", unter));
  d.append(...inhalt);
  d.addEventListener("close", () => d.remove());
  document.body.append(d);
  d.showModal();
  if (document.activeElement && document.activeElement !== d) document.activeElement.blur();
  d.focus({ preventScroll: true });
  return d;
}

export function knopfReihe(...k) {
  const r = neu("div", "dialog-knoepfe");
  if (k.length === 1) r.style.gridTemplateColumns = "1fr";
  r.append(...k);
  return r;
}

/** Rückfrage (z. B. vor dem Löschen). */
export function nachfragen(text, jaText = "Löschen") {
  return new Promise(ok => {
    let antwort = false;
    const reihe = knopfReihe();
    const d = fenster(text, "", reihe);
    reihe.append(knopf("Abbrechen", () => d.close()), knopf(jaText, () => { antwort = true; d.close(); }, "haupt"));
    d.addEventListener("close", () => ok(antwort));
  });
}

export function zeile(labelText, feld) {
  const z = neu("div", "b-zeile"), l = neu("label", "", labelText);
  if (feld.id) l.htmlFor = feld.id;
  z.append(l, feld);
  return z;
}

export function abschnitt(titel, ...inhalt) {
  const a = neu("div", "abschnitt");
  a.append(neu("h3", "", titel), ...inhalt);
  return a;
}

/** Listenzeile wie „Daten & Sicherungen“ der Pi-Version: Text links, Knöpfe rechts. */
export function listenZeile(titel, unter, ...knoepfe) {
  const li = neu("li"), info = neu("span", "info");
  info.append(titel, neu("span", "", unter));
  const k = neu("span", "knoepfe");
  k.append(...knoepfe);
  li.append(info, k);
  return li;
}

export function datumDe(ms) {
  const d = new Date(ms), z = n => String(n).padStart(2, "0");
  return `${z(d.getDate())}.${z(d.getMonth() + 1)}.${d.getFullYear()}, ${z(d.getHours())}:${z(d.getMinutes())}`;
}
