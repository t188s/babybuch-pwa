// Babybuch PWA · Weiche (klassisches Skript, wird VOR der Pi-Oberfläche geladen)
//
// Die Oberfläche ist 1:1 die der Pi-Version. Sie spricht über fetch("api/…") mit dem Pi.
// Diese Weiche leitet genau diese Anfragen an den „lokalen Pi“ im Handy um (js/lokal/server.js).
// Alles andere (Dateien der App) geht ganz normal ins Netz bzw. in den Offline-Speicher.
(function () {
  "use strict";
  const original = window.fetch.bind(window);
  let server = null;
  const laden = () => (server ??= import("./server.js"));

  window.fetch = function (eingabe, optionen) {
    const url = typeof eingabe === "string" ? eingabe : eingabe?.url || "";
    const pfad = new URL(url, location.href);
    if (pfad.origin === location.origin && /\/api\//.test(pfad.pathname)) {
      return laden().then(m => m.anfrage(pfad.href, optionen || {}));
    }
    return original(eingabe, optionen);
  };

  // Bericht, CSV-Tabellen und Kalender erzeugt auf dem Pi der Server – in der Web-App kommen sie mit dem nächsten Update.
  const BALD = "Kommt mit dem nächsten Update der Web-App (Bericht und CSV-Tabellen).";
  window.PWA_BALD = () => (typeof window.zeigeToast === "function" ? window.zeigeToast(BALD) : alert(BALD));
  // Kalender: Termin aus Vorsorge (wie Pi) und – neu – täglicher Serientermin nach dem Anlegen einer regelmäßigen Gabe
  window.PWA_KALENDER = q => import("../pwa/kalender.js").then(k => {
    const text = k.terminIcs(new URLSearchParams(q));
    if (!text) return window.zeigeToast?.("Bitte zuerst einen Termin eintragen.");
    return k.oeffnen(text);
  });
  window.PWA_GABE_KALENDER = gabe => Promise.all([import("../pwa/kalender.js"), import("../ui/bausteine.js")]).then(async ([k, ui]) => {
    if (!gabe || gabe.pausiert || !gabe.zeiten?.length) return;
    const ja = await ui.nachfragen(`„${gabe.name}“ täglich um ${gabe.zeiten.join(", ")} Uhr in den Kalender eintragen? Das Handy erinnert dann zur Uhrzeit.`, "In Kalender");
    if (ja) await k.oeffnen(k.gabeIcs(gabe), "babybuch-gabe.ics");
  });
  document.addEventListener("click", ev => {
    const a = ev.target.closest("a[data-export], a#bericht-link, a[href^='bericht'], a[href^='export/']");
    if (!a) return;
    ev.preventDefault();
    ev.stopPropagation();
    window.PWA_BALD();
  }, true);

  document.addEventListener("DOMContentLoaded", () => {
    import("../pwa/kinder-backup.js").then(m => m.einbauen()).catch(e => console.error(e));
    import("../pwa/ernaehrung.js").then(m => m.einbauen()).catch(e => console.error(e));
    import("../pwa/ernaehrung-auswertung.js").catch(e => console.error(e));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(e => console.warn("Offline-Speicher:", e));
    import("../kern/speicher.js").then(s => { s.dauerhaftAnfordern(); s.aufraeumen(); }).catch(() => {});
  });
})();
