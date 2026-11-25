// Babybuch PWA · Fläschchen, Abpumpen, Beikost im Reiter „Stillen“ (neu in 0.7.0, noch nicht in der Pi-Version)
//
// Oben im Stillen-Reiter: Umschalter Brust | Fläschchen | Abpumpen | Beikost (welche, bestimmt die Einstellung
// „Ernährung“ je Kind). „Brust“ ist die unveränderte Pi-Oberfläche; die anderen zeigen ein eigenes Feld im
// gleichen Aufbau: Status oben · Formular · Leiste „Wird gespeichert“ mit Speichern.

import { $, neu, knopf, fenster, knopfReihe, nachfragen, toast, fehler } from "../ui/bausteine.js";
import { FLASCHE_ARTEN, BEIKOST_MENGEN, ERNAEHRUNG_ARTEN, ERNAEHRUNG_NAMEN, WAS_MAX, ML_MAX, eintragText } from "../kern/ernaehrung.js";

const MODUS_SCHLUESSEL = "pwaErnModus";
const TITEL = { flasche: "Zuletzt Fläschchen", abpumpen: "Zuletzt abgepumpt", beikost: "Zuletzt Beikost" };
const MENGE_KURZ = { probiert: "probiert", wenig: "wenig", halb: "halb", ganz: "ganz" };
const ART_KURZ = { muttermilch: "Muttermilch", pre: "Pre", folge: "Folgemilch", andere: "Andere" };
const SEITEN = [["L", "Links"], ["B", "Beide"], ["R", "Rechts"]];

let arten = ["stillen"], modus = "stillen";
const formStand = {        // was im Formular gewählt ist (bleibt beim Hin- und Herschalten erhalten)
  flasche: { art: "muttermilch", ml: 90 }, abpumpen: { seite: "B", ml: 100 }, beikost: { was: "", menge: "wenig", neu: false },
};
let notiz = "", zeitGesetzt = null;   // null = „jetzt“

// ── kleine Hilfen ──
const zwei = n => String(n).padStart(2, "0");
const zeitText = d => `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}T${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
const alsDatum = t => { const [d, u = "00:00"] = t.split("T"); const [j, m, tg] = d.split("-").map(Number); const [h, mi] = u.split(":").map(Number); return new Date(j, m - 1, tg, h, mi); };
const heuteText = () => zeitText(new Date()).slice(0, 10);
function wannText(t) {
  const d = alsDatum(t), tag = t.slice(0, 10), gestern = new Date(); gestern.setDate(gestern.getDate() - 1);
  const w = tag === heuteText() ? "Heute" : tag === zeitText(gestern).slice(0, 10) ? "Gestern" : `${d.getDate()}.${d.getMonth() + 1}.`;
  return `${w} ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}
function vorText(t) {
  const min = Math.max(0, Math.round((Date.now() - alsDatum(t)) / 60000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60), m = min % 60;
  return h >= 48 ? `vor ${Math.floor(h / 24)} Tagen` : `vor ${h} Std${m ? ` ${m} Min` : ""}`;
}
async function api(pfad, methode = "GET", daten = null) {
  const r = await fetch("api/" + pfad, { method: methode, headers: daten ? { "Content-Type": "application/json" } : {}, body: daten ? JSON.stringify(daten) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.fehler || `Fehler ${r.status}`);
  return j;
}
function umschalter(liste, aktiv, wahl, klasse = "umschalter") {
  const u = neu("div", klasse);
  for (const [wert, text] of liste) {
    const b = knopf(text, () => { wahl(wert); for (const x of u.children) x.classList.toggle("aktiv", x.dataset.w === wert); });
    b.dataset.w = wert; b.classList.toggle("aktiv", wert === aktiv); u.append(b);
  }
  return u;
}
function feld(labelText, ...inhalt) {
  const f = neu("div", "feld");
  if (labelText) f.append(neu("p", "label", labelText));
  f.append(...inhalt);
  return f;
}
/** Mengen-Regler wie „oder nachtragen“ beim Stillen: Regler links, große Zahl rechts. */
function mengenRegler(stand, max = 300, schritt = 5, beiAenderung = () => {}) {
  const kopf = neu("div", "dauer-kopf"), links = neu("div"), r = neu("input");
  r.type = "range"; r.min = 0; r.max = max; r.step = schritt; r.value = stand.ml; r.setAttribute("aria-label", "Menge in ml");
  const wert = neu("div", "dauer-wert"), zahl = neu("span", "", String(stand.ml));
  wert.append(zahl, neu("small", "", "ml"));
  const fuellen = () => r.style.setProperty("--fuellung", `${r.value / max * 100}%`);
  r.oninput = () => { stand.ml = Number(r.value); zahl.textContent = r.value; fuellen(); beiAenderung(); };
  fuellen();
  links.style.flex = "1"; links.append(r);
  kopf.append(links, wert);
  return kopf;
}

// ════════ Einbauen ════════
export async function einbauen() {
  try { arten = (await api("ernaehrung")).arten; } catch (_) { arten = ["stillen"]; }
  let gemerkt = null;
  try { gemerkt = localStorage.getItem(MODUS_SCHLUESSEL); } catch (_) { /* egal */ }
  modus = arten.includes(gemerkt) ? gemerkt : arten[0];
  wahlZeichnen();
  beschriftungAnpassen();
  await zeigen(modus);
  einstellungZeichnen();
  setInterval(() => { if (modus !== "stillen" && !$("bereich-eintragen")?.hidden) statusZeichnen().catch(() => {}); }, 30000);
}

function wahlZeichnen() {
  const ziel = $("pwa-ern-wahl");
  if (!ziel) return;
  ziel.hidden = arten.length < 2;
  ziel.replaceChildren(umschalter(arten.map(a => [a, ERNAEHRUNG_NAMEN[a]]), modus, a => zeigen(a).catch(fehler), "umschalter pwa-ern-umschalter"));
}

/** Ohne Stillen heißt der Reiter nicht „Stillen“. */
function beschriftungAnpassen() {
  const name = arten.includes("stillen") ? "Stillen" : arten.length === 1 ? ERNAEHRUNG_NAMEN[arten[0]] : "Füttern";
  for (const b of document.querySelectorAll('.alltag-wahl button[data-a="eintragen"]')) b.textContent = name;
  try { if (typeof BEREICHE === "object") BEREICHE.eintragen = name; } catch (_) { /* Pi-Oberfläche ohne BEREICHE */ }   // eslint-disable-line no-undef
  if (!$("bereich-eintragen")?.hidden && $("kopf-titel")) $("kopf-titel").textContent = name;
}

async function zeigen(neuerModus) {
  modus = arten.includes(neuerModus) ? neuerModus : arten[0];
  try { localStorage.setItem(MODUS_SCHLUESSEL, modus); } catch (_) { /* egal */ }
  const bereich = $("bereich-eintragen");
  if (bereich) bereich.dataset.pwaModus = modus;
  for (const b of $("pwa-ern-wahl")?.querySelectorAll("button") || []) b.classList.toggle("aktiv", b.dataset.w === modus);
  const feldZiel = $("pwa-ern");
  if (!feldZiel) return;
  feldZiel.hidden = modus === "stillen";
  if (modus === "stillen") return;
  notiz = ""; zeitGesetzt = null;
  await vorbelegen(modus);
  feldZiel.replaceChildren(neu("div", "status"), formularBauen(), leisteBauen());
  feldZiel.firstChild.id = "pwa-ern-status";
  await statusZeichnen();
  zusammenfassungZeichnen();
}

/** Einmal je Art: Formular wie der letzte Eintrag (gleiche Milch, gleiche Menge, gleiche Seite). */
const vorbelegt = new Set();
async function vorbelegen(typ) {
  if (vorbelegt.has(typ) || typ === "beikost") return;
  vorbelegt.add(typ);
  try {
    const [l] = await api(`${typ}/letzte`);
    if (!l) return;
    const st = formStand[typ];
    if (Number.isInteger(l.ml)) st.ml = Math.min(300, l.ml);
    if (typ === "flasche" && l.art) st.art = l.art;
    if (typ === "abpumpen" && l.seite) st.seite = l.seite;
  } catch (_) { /* ohne Vorbelegung */ }
}

// ── Status: Zuletzt … / Heute … ──
async function statusZeichnen() {
  const s = $("pwa-ern-status");
  if (!s || modus === "stillen") return;
  const heute = heuteText();
  const [letzte, heutige] = await Promise.all([api(`${modus}/letzte`), api(`${modus}?von=${heute}&bis=${heute}`)]);
  const l = letzte[0];
  const links = neu("div", "status-knopf"); links.tabIndex = 0; links.setAttribute("role", "button");
  links.setAttribute("aria-label", "Letzte Einträge ansehen, ändern oder löschen");
  links.append(neu("p", "eyebrow", TITEL[modus]), neu("h1", "", l ? vorText(l.zeit) : "–"));
  const d = neu("p", "detail", l ? `${wannText(l.zeit)} · ${eintragText(modus, l)}` : "Noch kein Eintrag");
  if (l) d.append(neu("span", "stift", "✎"));
  links.append(d);
  links.onclick = () => letzteZeigen().catch(fehler);
  links.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); links.click(); } };
  const rechts = neu("div", "vorschlag");
  const ml = heutige.reduce((x, e) => x + (e.ml || 0), 0);
  rechts.append(neu("p", "eyebrow", "Heute"),
    neu("strong", "", modus === "beikost" ? `${heutige.length}×` : `${ml} ml`),
    neu("span", "seiten-zeit", modus === "flasche" ? `${heutige.length} Fläschchen` : modus === "abpumpen" ? `${heutige.length}× abgepumpt` : "Mahlzeiten"));
  s.replaceChildren(links, rechts);
}

// ── Formular ──
function formularBauen() {
  const f = neu("div", "formular"), st = formStand[modus];
  const neuZeichnen = () => zusammenfassungZeichnen();
  if (modus === "flasche") {
    f.append(feld("Was", umschalter(Object.entries(ART_KURZ), st.art,
      w => { st.art = w; neuZeichnen(); }, "umschalter pwa-klein")));
    f.append(feld("Menge", mengenRegler(st, 300, 5, neuZeichnen)));
  } else if (modus === "abpumpen") {
    f.append(feld("Seite", umschalter(SEITEN, st.seite, w => { st.seite = w; neuZeichnen(); }, "umschalter gross")));
    f.append(feld("Menge", mengenRegler(st, 300, 5, neuZeichnen)));
  } else if (modus === "beikost") {
    const eingabe = neu("input", "feld-eingabe"); eingabe.id = "pwa-bk-was";
    eingabe.maxLength = WAS_MAX; eingabe.placeholder = "z. B. Karotte"; eingabe.autocomplete = "off"; eingabe.value = st.was;
    eingabe.oninput = () => { st.was = eingabe.value; neuZeichnen(); };
    const chips = neu("div", "schnell-notiz pwa-bk-chips");
    zuletztGegessen().then(liste => chips.replaceChildren(...liste.map(w => knopf(w, () => { eingabe.value = st.was = w; neuZeichnen(); }, "notiz-chip")))).catch(() => {});
    f.append(feld("Was", eingabe, chips));
    const neuSchalter = neu("button", "schalter"); neuSchalter.type = "button"; neuSchalter.setAttribute("role", "switch");
    neuSchalter.setAttribute("aria-checked", String(st.neu)); neuSchalter.setAttribute("aria-label", "Zum ersten Mal");
    neuSchalter.onclick = () => { st.neu = !st.neu; neuSchalter.setAttribute("aria-checked", String(st.neu)); neuZeichnen(); };
    const neuZeile = neu("div", "pwa-bk-neu"); neuZeile.append(neu("span", "", "Zum ersten Mal"), neuSchalter);
    f.append(feld("Wie viel", umschalter(Object.keys(BEIKOST_MENGEN).map(w => [w, MENGE_KURZ[w]]), st.menge, w => { st.menge = w; neuZeichnen(); }, "umschalter pwa-klein"), neuZeile));
  }
  const n = knopf("", () => notizBearbeiten(), "notiz-chip"); n.id = "pwa-ern-notiz";
  const reihe = neu("div", "notiz-reihe"); reihe.append(neu("span", "label notiz-label", "Notiz"), n);
  f.append(feld("", reihe));
  return f;
}

async function zuletztGegessen() {
  const liste = await api("beikost/letzte"), gesehen = [];
  for (const e of liste) if (e.was && !gesehen.includes(e.was)) gesehen.push(e.was);
  return gesehen.slice(0, 6);
}

function notizBearbeiten() {
  const t = neu("textarea", "feld-eingabe"); t.rows = 3; t.maxLength = 500; t.value = notiz; t.style.width = "100%";
  const reihe = knopfReihe();
  const d = fenster("Notiz", "", t, reihe);
  reihe.append(knopf("Abbrechen", () => d.close()), knopf("Übernehmen", () => { notiz = t.value.trim(); d.close(); zusammenfassungZeichnen(); }, "haupt"));
}

function zeitWaehlen() {
  const e = neu("input", "feld-eingabe"); e.type = "datetime-local"; e.value = zeitGesetzt || zeitText(new Date()); e.max = zeitText(new Date());
  const reihe = knopfReihe();
  const d = fenster("Wann?", "", e, reihe);
  reihe.append(knopf("Jetzt", () => { zeitGesetzt = null; d.close(); zusammenfassungZeichnen(); }),
    knopf("Übernehmen", () => { if (e.value) zeitGesetzt = e.value.slice(0, 16); d.close(); zusammenfassungZeichnen(); }, "haupt"));
}

// ── Leiste „Wird gespeichert“ ──
function leisteBauen() {
  const l = neu("div", "speichern-leiste"), z = neu("div", "zusammenfassung");
  const kopf = neu("p", "eyebrow"); kopf.id = "pwa-ern-zf-kopf";
  const zk = knopf("", zeitWaehlen, "zeit-knopf"); zk.id = "pwa-ern-zf-zeit"; zk.setAttribute("aria-label", "Uhrzeit ändern");
  const det = neu("div", "details"); det.id = "pwa-ern-zf-details";
  const nz = neu("div", "notiz-zeile"), nv = neu("span", "notiz-vorschau"); nv.id = "pwa-ern-zf-notiz"; nz.append(nv);
  z.append(kopf, zk, det, nz);
  const s = knopf("Speichern", () => speichern().catch(fehler), "speichern-knopf"); s.id = "pwa-ern-speichern";
  l.append(z, s);
  return l;
}

function zusammenfassungZeichnen() {
  if (modus === "stillen" || !$("pwa-ern-zf-zeit")) return;
  const st = formStand[modus];
  $("pwa-ern-zf-kopf").textContent = `Wird gespeichert · ${zeitGesetzt ? "nachgetragen" : "jetzt"}`;
  $("pwa-ern-zf-zeit").replaceChildren(neu("span", "zeitspanne", wannText(zeitGesetzt || zeitText(new Date()))), neu("span", "stift", "✎"));
  $("pwa-ern-zf-details").textContent = eintragText(modus, modus === "beikost" ? { ...st, was: st.was.trim() || "noch offen" } : st);
  $("pwa-ern-zf-notiz").hidden = !notiz; $("pwa-ern-zf-notiz").textContent = notiz;
  $("pwa-ern-notiz").textContent = notiz ? "✎ geändert" : "✎ Text";
  $("pwa-ern-speichern").disabled = modus === "beikost" && !st.was.trim();
}

async function speichern() {
  const st = formStand[modus], typ = modus;
  const daten = { ...st, zeit: zeitGesetzt || zeitText(new Date()), notiz };
  if (typ === "beikost") daten.was = st.was.trim();
  const { id } = await api(typ, "POST", daten);
  const text = `${ERNAEHRUNG_NAMEN[typ]} gespeichert · ${eintragText(typ, daten)}`;
  toast(text, [{ text: "Rückgängig", aktion: async () => { await api(`${typ}/${id}`, "DELETE"); toast("Rückgängig gemacht."); statusZeichnen(); } }]);
  notiz = ""; zeitGesetzt = null;
  if (typ === "beikost") { st.neu = false; }
  await zeigen(typ);
}

// ── Letzte Einträge: ansehen, ändern, löschen ──
async function letzteZeigen() {
  const typ = modus, liste = await api(`${typ}/letzte`);
  const ul = neu("ul", "sicherung-liste");
  const d = fenster(`${ERNAEHRUNG_NAMEN[typ]} · letzte Einträge`, liste.length ? "" : "Noch keine Einträge.", ul,
    knopfReihe(knopf("Schließen", () => d.close())));
  for (const e of liste) {
    const li = neu("li"), info = neu("span", "info");
    info.append(wannText(e.zeit), neu("span", "", eintragText(typ, e) + (e.notiz ? ` · „${e.notiz}“` : "")));
    const k = neu("span", "knoepfe");
    k.append(knopf("Ändern", async () => { if (await aendernDialog(typ, e)) { d.close(); zeigen(typ); } }),
      knopf("Löschen", async () => {
        if (!(await nachfragen(`${ERNAEHRUNG_NAMEN[typ]} von ${wannText(e.zeit)} löschen? Er liegt danach 30 Tage im Papierkorb.`))) return;
        await api(`${typ}/${e.id}`, "DELETE"); li.remove(); statusZeichnen(); toast("Gelöscht.");
      }, "loeschen-knopf"));
    li.append(info, k); ul.append(li);
  }
}

function aendernDialog(typ, e) {
  return new Promise(ok => {
    const felder = neu("div"), werte = { ...e };
    const zeile = (text, el) => { const z = neu("div", "b-zeile"), l = neu("label", "", text); z.append(l, el); felder.append(z); };
    const zeit = neu("input", "feld-eingabe"); zeit.type = "datetime-local"; zeit.value = e.zeit;
    zeile("Wann", zeit);
    const auswahl = (opts, wert, f) => { const s = neu("select"); for (const [w, t] of opts) { const o = neu("option", "", t); o.value = w; o.selected = w === wert; s.append(o); } s.onchange = () => { werte[f] = s.value; }; return s; };
    if (typ !== "beikost") {
      const ml = neu("input", "feld-eingabe"); ml.type = "number"; ml.inputMode = "numeric"; ml.min = 0; ml.max = ML_MAX; ml.value = e.ml;
      ml.oninput = () => { werte.ml = Math.round(Number(ml.value)); };
      zeile("Menge (ml)", ml);
    }
    if (typ === "flasche") zeile("Was", auswahl(Object.entries(FLASCHE_ARTEN), e.art, "art"));
    if (typ === "abpumpen") zeile("Seite", auswahl(SEITEN, e.seite, "seite"));
    if (typ === "beikost") {
      const was = neu("input", "feld-eingabe"); was.maxLength = WAS_MAX; was.value = e.was; was.oninput = () => { werte.was = was.value; };
      zeile("Was", was);
      zeile("Wie viel", auswahl(Object.entries(BEIKOST_MENGEN), e.menge, "menge"));
      const neuH = neu("input"); neuH.type = "checkbox"; neuH.checked = Boolean(e.neu); neuH.onchange = () => { werte.neu = neuH.checked ? 1 : 0; };
      zeile("Zum ersten Mal", neuH);
    }
    const n = neu("input", "feld-eingabe"); n.maxLength = 500; n.value = e.notiz || ""; n.oninput = () => { werte.notiz = n.value; };
    zeile("Notiz", n);
    const reihe = knopfReihe();
    const d = fenster(`${ERNAEHRUNG_NAMEN[typ]} ändern`, "", felder, reihe);
    let fertig = false;
    reihe.append(knopf("Abbrechen", () => d.close()), knopf("Speichern", async () => {
      try {
        const { id, ...rest } = werte;
        await api(`${typ}/${id}`, "PATCH", { ...rest, zeit: zeit.value.slice(0, 16) });
        fertig = true; d.close(); toast("Geändert.");
      } catch (f) { fehler(f); }
    }, "haupt"));
    d.addEventListener("close", () => ok(fertig));
  });
}

// ════════ Einstellungen › Baby › „Ernährung“ ════════
function einstellungZeichnen() {
  const ziel = $("pwa-ern-einst");
  if (!ziel) return;
  const liste = neu("div", "haken-liste");
  const haken = ERNAEHRUNG_ARTEN.map(a => {
    const l = neu("label"), h = neu("input"); h.type = "checkbox"; h.value = a; h.checked = arten.includes(a);
    l.append(h, " " + ({ stillen: "Stillen (Brust)", flasche: "Fläschchen", abpumpen: "Abpumpen", beikost: "Beikost" })[a]);
    liste.append(l); return h;
  });
  for (const h of haken) h.onchange = async () => {
    const gewaehlt = haken.filter(x => x.checked).map(x => x.value);
    if (!gewaehlt.length) { h.checked = true; toast("Mindestens eins bleibt angehakt."); return; }
    try {
      arten = (await api("ernaehrung", "PUT", { arten: gewaehlt })).arten;
      wahlZeichnen(); beschriftungAnpassen(); await zeigen(arten.includes(modus) ? modus : arten[0]);
    } catch (f) { fehler(f); }
  };
  const box = neu("div", "pwa-ern-einst");
  box.append(neu("p", "label", "Ernährung"), neu("p", "unter", "Was im Reiter „Stillen“ zur Auswahl steht – gilt für dieses Kind."), liste);
  ziel.replaceChildren(box);
}
