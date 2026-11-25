// Babybuch PWA · Datei ausgeben: Teilen-Menü (iPhone/Android: Dateien, AirDrop, Mail …), sonst Download.

export async function dateiAusgeben(name, inhalt, typ = "text/plain") {
  const datei = new File([inhalt], name, { type: typ });
  if (navigator.canShare?.({ files: [datei] })) {
    try { await navigator.share({ files: [datei], title: name }); return "geteilt"; }
    catch (f) { if (f.name === "AbortError") return "abgebrochen"; /* sonst: Download versuchen */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(datei); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  return "heruntergeladen";
}

/** Link der Pi-Oberfläche „export/stillen.csv?von=…“ → Datei vom lokalen Pi holen und ausgeben. */
export async function exportLink(href) {
  const u = new URL(href, location.href);
  const pfad = u.pathname.slice(u.pathname.indexOf("export/"));
  const r = await fetch("api/" + pfad + u.search);
  const j = await r.json();
  if (!r.ok) throw new Error(j.fehler || "Export fehlgeschlagen.");
  return dateiAusgeben(j.name, j.text, "text/csv");
}
