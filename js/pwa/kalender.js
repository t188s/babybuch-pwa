// Babybuch PWA · Kalender (.ics) – Termine und tägliche Erinnerung für regelmäßige Gaben
// Termine wie /kalender.ics der Pi-Version (app.py): Termin mit Uhrzeit (45 Min) oder ganztägig (Zeitfenster),
// Erinnerung am Vortag. Neu in der Web-App: Serientermin täglich je Uhrzeit für regelmäßige Gaben (Entscheidung 23.11.).

const ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, DATUM = /^\d{4}-\d{2}-\d{2}$/, UHR = /^([01]\d|2[0-3]):[0-5]\d$/;
const zwei = n => String(n).padStart(2, "0");
const icsText = t => String(t).replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
const einfach = (t, n) => String(t ?? "").split(/\s+/).filter(Boolean).join(" ").slice(0, n);
const utc = d => `${d.getUTCFullYear()}${zwei(d.getUTCMonth() + 1)}${zwei(d.getUTCDate())}T${zwei(d.getUTCHours())}${zwei(d.getUTCMinutes())}${zwei(d.getUTCSeconds())}Z`;
const lokal = d => `${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}T${zwei(d.getHours())}${zwei(d.getMinutes())}00`;
const tagText = d => `${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}`;
const alsDatum = t => { const [j, m, d] = t.slice(0, 10).split("-").map(Number); const [h, mi] = (t.slice(11, 16) || "00:00").split(":").map(Number); return new Date(j, m - 1, d, h, mi); };
const uid = () => `babybuch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@babybuch`;
const kopf = () => ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Babybuch//DE", "CALSCALE:GREGORIAN"];

/** Wie /kalender.ics?titel=…&start=… bzw. &tag=…&bis=… auf dem Pi. Gibt den Text oder null (Datum fehlt). */
export function terminIcs(q) {
  const titel = einfach(q.get("titel") || "Termin", 80), ort = einfach(q.get("ort") || "", 80);
  const start = q.get("start") || "", tag = q.get("tag") || "", bis = q.get("bis") || q.get("tag") || "";
  const z = [...kopf(), "BEGIN:VEVENT", `UID:${uid()}`, `DTSTAMP:${utc(new Date())}`, `SUMMARY:${icsText(titel)}`];
  if (ZEIT.test(start)) {
    const a = alsDatum(start);
    z.push(`DTSTART:${lokal(a)}`, `DTEND:${lokal(new Date(a.getTime() + 45 * 60000))}`);
  } else if (DATUM.test(tag) && DATUM.test(bis) && bis >= tag) {
    const ende = alsDatum(bis); ende.setDate(ende.getDate() + 1);
    z.push(`DTSTART;VALUE=DATE:${tag.replaceAll("-", "")}`, `DTEND;VALUE=DATE:${tagText(ende)}`);
  } else return null;
  if (ort) z.push(`LOCATION:${icsText(ort)}`);
  z.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(titel)}`, "TRIGGER:-P1D", "END:VALARM", "END:VEVENT", "END:VCALENDAR");
  return z.join("\r\n") + "\r\n";
}

/** Täglicher Serientermin je Uhrzeit (5 Min, Erinnerung zur Uhrzeit), ab „ab“ bis „bis“ (leer = dauerhaft). */
export function gabeIcs(gabe) {
  const name = einfach(gabe.name, 60), menge = einfach(gabe.menge, 60);
  const ab = DATUM.test(gabe.ab || "") ? gabe.ab : new Date().toISOString().slice(0, 10);
  const z = kopf();
  for (const uhr of (gabe.zeiten || []).filter(u => UHR.test(u))) {
    const a = alsDatum(`${ab}T${uhr}`);
    const titel = `${name}${menge ? ` · ${menge}` : ""}`;
    z.push("BEGIN:VEVENT", `UID:${uid()}`, `DTSTAMP:${utc(new Date())}`, `SUMMARY:${icsText(titel)}`,
      `DESCRIPTION:${icsText("Im Babybuch abhaken. Das Babybuch rechnet keine Dosis.")}`,
      `DTSTART:${lokal(a)}`, `DTEND:${lokal(new Date(a.getTime() + 5 * 60000))}`,
      DATUM.test(gabe.bis || "") ? `RRULE:FREQ=DAILY;UNTIL=${gabe.bis.replaceAll("-", "")}T235959` : "RRULE:FREQ=DAILY",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(titel)}`, "TRIGGER:PT0M", "END:VALARM", "END:VEVENT");
  }
  z.push("END:VCALENDAR");
  return z.join("\r\n") + "\r\n";
}

/** Übergibt die .ics-Datei an das Handy: iPhone öffnet „Zum Kalender hinzufügen“, Android lädt sie zum Öffnen mit der Kalender-App. */
export async function oeffnen(text, dateiname = "babybuch-termin.ics") {
  const datei = new File([text], dateiname, { type: "text/calendar" });
  const url = URL.createObjectURL(datei);
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (iOS) { location.href = url; }
  else {
    const a = document.createElement("a");
    a.href = url; a.download = dateiname; document.body.append(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
