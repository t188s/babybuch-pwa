// Babybuch PWA · Design (Schwarz-Dusty-Blue oder Schwarz-Gold) – gilt fürs Gerät, nicht fürs Kind, wird nicht abgeglichen.
// Klassisches Skript im <head>, damit beim Start nichts aufblitzt.
(function () {
  var SCHLUESSEL = "babybuch-design", STANDARD = "blau";
  function lesen() { try { var w = localStorage.getItem(SCHLUESSEL); return w === "gold" || w === "blau" ? w : STANDARD; } catch (e) { return STANDARD; } }
  function setzen(w) {
    document.documentElement.setAttribute("data-design", w);
    try { localStorage.setItem(SCHLUESSEL, w); } catch (e) {}
  }
  document.documentElement.setAttribute("data-design", lesen());

  // „Vergleiche zu davor“ in der Auswertung: ruhig (Standard, ohne Pfeile und Farben) oder farbig wie die Pi-Version
  var V_SCHLUESSEL = "babybuch-vergleich";
  function vergleichLesen() { try { return localStorage.getItem(V_SCHLUESSEL) === "farbig" ? "farbig" : "ruhig"; } catch (e) { return "ruhig"; } }
  function vergleichSetzen(w) {
    document.documentElement.setAttribute("data-vergleich", w);
    try { localStorage.setItem(V_SCHLUESSEL, w); } catch (e) {}
  }
  document.documentElement.setAttribute("data-vergleich", vergleichLesen());
  window.PWA_DESIGN = { lesen: lesen, setzen: setzen, vergleichLesen: vergleichLesen, vergleichSetzen: vergleichSetzen };
})();
