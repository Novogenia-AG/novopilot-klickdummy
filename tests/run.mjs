// NovoPilot-Klickdummy – Testsuite ohne Abhaengigkeiten (nur Node >= 20).
// Aufruf:  node tests/run.mjs            (prueft die Quelldateien im SharePoint-Ordner)
//          NOVOPILOT_SRC=<Ordner> node tests/run.mjs
// Ergebnis: Liste je Test (OK / FEHLER / HINWEIS), Exit-Code 1 bei mindestens einem Fehler.
// Kein Netzwerk: fetch, WebSocket usw. sind in der Attrappe gesperrt.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeEnv } from './dom-stub.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SRC_DIR = process.env.NOVOPILOT_SRC || 'C:\\Users\\DanielWallerstorfer\\Novogenia GmbH\\DANIEL FILES - Dokumente\\DANIEL FILES\\AI CHAT BOT GENE-IUS\\APP DESIGN\\NOVOPILOT-REDESIGN';
const NP_FILE = path.join(SRC_DIR, 'novopilot-geneius-v1-blau.html');
const PB_FILE = path.join(SRC_DIR, 'berater.html');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'novopilot-tests-'));

const results = [];
const ok = (g, n, d = '') => results.push({ s: 'OK', g, n, d });
const bad = (g, n, d = '') => results.push({ s: 'FEHLER', g, n, d });
const warn = (g, n, d = '') => results.push({ s: 'HINWEIS', g, n, d });
const check = (g, n, cond, d = '') => (cond ? ok(g, n) : bad(g, n, d));
const short = e => String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e).slice(0, 400);

// ---------- Hilfen ----------
function inlineScripts(html) {
  const out = []; const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) { if (!/\bsrc\s*=/.test(m[1] || '')) out.push({ code: m[2], line: html.slice(0, m.index).split('\n').length }); }
  return out;
}
function nodeCheck(code, label) {
  const f = path.join(TMP, label.replace(/[^\w.-]/g, '_') + '.js');
  fs.writeFileSync(f, code);
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  return r.status === 0 ? null : (r.stderr || r.stdout).trim().split('\n').slice(0, 6).join(' | ');
}
// "undefined"/"NaN"/"[object Object]" im sichtbaren Text oder in Attributen (ohne data:-URIs)
function junk(html) {
  const hits = [];
  const texts = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').match(/>[^<]+</g) || [];
  for (const t of texts) { const m = t.match(/\bundefined\b|\bNaN\b|\[object Object\]/); if (m) hits.push('Text: ' + t.slice(1, -1).trim().slice(0, 80)); }
  const attrs = html.match(/\s[\w:-]+="[^"]*"/g) || [];
  for (const a of attrs) { if (/="data:/.test(a)) continue; if (/\bundefined\b|\bNaN\b|\[object Object\]/.test(a)) hits.push('Attribut:' + a.slice(0, 100)); }
  return [...new Set(hits)];
}

const npHtml = fs.readFileSync(NP_FILE, 'utf8');
const pbHtml = fs.readFileSync(PB_FILE, 'utf8');

// ---------- 1) Syntax ----------
{
  const G = '1 Syntax';
  const np = inlineScripts(npHtml);
  check(G, 'NovoPilot: zwei Inline-Script-Bloecke (QR-Bibliothek + App)', np.length === 2, `gefunden: ${np.length}`);
  np.forEach((s, i) => { const e = nodeCheck(s.code, `np-${i}`); check(G, `NovoPilot Script ${i + 1} (ab Zeile ${s.line}) node --check`, !e, e); });
  const pb = inlineScripts(pbHtml);
  check(G, 'berater.html: Inline-Scripts vorhanden', pb.length > 0, `gefunden: ${pb.length}`);
  pb.forEach((s, i) => { const e = nodeCheck(s.code, `pb-${i}`); check(G, `berater.html Script ${i + 1} (ab Zeile ${s.line}) node --check`, !e, e); });
}

// ---------- 2) NovoPilot: jede Route rendern ----------
async function loadNP(width) {
  const env = makeEnv({ width });
  // alle Inline-Scripts der Reihe nach (1. = eingebettete QR-Bibliothek, 2. = App)
  try { for (const sc of inlineScripts(npHtml)) env.run(sc.code); } catch (e) { return { env, err: e }; }
  await env.flush();
  return { env, err: null };
}
async function renderRoute(env, hash) {
  env.log.timerErrors.length = 0;
  env.location.hash = hash;
  let err = null;
  try { env.fire('window', 'hashchange'); } catch (e) { err = e; }
  await env.flush();
  const html = env.document.getElementById('main').innerHTML;
  return { err, html, timerErrors: [...env.log.timerErrors] };
}

let NP = null; // Kontext fuer Tests 3
for (const width of [1280, 375]) {
  const G = `2 Routen (${width}px)`;
  const { env, err } = await loadNP(width);
  if (err) { bad(G, 'Script laden', short(err)); continue; }
  ok(G, 'Script laden + Startseite');
  if (width === 1280) NP = env;
  const NAV = env.run('NAV');
  const ids = NAV.filter(n => Array.isArray(n) && !String(n[0]).startsWith('x:')).map(n => n[0]);
  const P = env.run('P');
  for (const id of ids) check(G, `NAV-Eintrag "${id}" hat eine Seite P.${id}`, typeof P[id] === 'function', 'faellt auf Startseite zurueck');
  const first = env.run('PARTNERS[0].id');
  const nCust = env.run('CUSTOMERS.length');
  const routes = [...ids, 'kunde-0', `kunde-${nCust - 1}`, `partner-${first}`, 'raum-DEMO'];
  // Grenzwerte: ungueltige Hashes muessen auf eine sinnvolle Seite zurueckfallen
  const edge = ['gibtsnicht', 'kunde-999', 'kunde-abc', 'kunde--1', 'partner-gibtsnicht', 'raum-gibtsnicht', 'raum-', 'partner-<img src=x onerror=alert(1)>'];
  for (const r of [...routes, ...edge]) {
    const { err: e, html, timerErrors } = await renderRoute(env, '#' + r);
    const label = (edge.includes(r) ? 'Grenzwert ' : 'Route ') + '#' + r;
    if (e) { bad(G, label, 'Ausnahme: ' + short(e)); continue; }
    if (timerErrors.length) { bad(G, label + ' (verzoegerte Logik)', timerErrors.map(short).join(' || ')); continue; }
    if (html.length < 200) { bad(G, label, `Seite fast leer (${html.length} Zeichen)`); continue; }
    if (/<img src=x onerror/i.test(html)) { bad(G, label, 'Hash-Inhalt ungefiltert im HTML (XSS)'); continue; }
    const j = junk(html);
    if (j.length) { bad(G, label, 'Platzhalter-Muell im HTML: ' + j.slice(0, 4).join(' ; ')); continue; }
    ok(G, label);
  }
  // Demo-Termin ueber den Knopf "Plattform testen" (bTest) und Tutorial
  if (width === 1280) {
    try { env.location.hash = '#beratung'; env.fire('window', 'hashchange'); await env.flush(); env.log.timerErrors.length = 0;
      env.run('bTest()'); await env.flush();
      const html = env.document.getElementById('main').innerHTML;
      if (env.log.timerErrors.length) bad(G, 'Plattform testen (bTest) -> Demo-Raum', env.log.timerErrors.map(short).join(' || '));
      else check(G, 'Plattform testen (bTest) -> Demo-Raum', env.location.hash === '#raum-DEMO' && html.length > 200 && !junk(html).length, `hash=${env.location.hash} ${junk(html).join(';')}`);
    } catch (e) { bad(G, 'Plattform testen (bTest) -> Demo-Raum', short(e)); }
    try { env.run('tourStart()'); const n = env.run('TOUR.length'); for (let i = 0; i < n; i++) env.run('tourGo(1)'); await env.flush(); ok(G, `Tutorial alle ${n} Schritte durchklicken`); }
    catch (e) { bad(G, 'Tutorial durchklicken', short(e)); }
  }
  const netTried = [...new Set(env.log.net.map(x => x.replace(/\?.*$/, '')))];
  if (netTried.length) warn(G, 'Netzwerkzugriffe beim Laden/Rendern (im Test gesperrt)', netTried.slice(0, 8).join(' ; '));
  if (env.log.console.length) warn(G, 'console.warn/error', [...new Set(env.log.console)].slice(0, 5).join(' ; ').slice(0, 400));
}

// ---------- 4) berater.html: SHOP-/Parameter-Berechnung ----------
// Fuehrt genau den Konfigurationsblock (const QS ... const INIT) mit einer erfundenen URL aus.
const pbScript = inlineScripts(pbHtml).map(s => s.code).find(c => c.includes('const QS=new URLSearchParams'));
const cfgStart = pbScript.indexOf('const QS=');
const cfgEnd = pbScript.indexOf('\n', pbScript.indexOf('const INIT='));
const CFG = pbScript.slice(cfgStart, cfgEnd);
function berater(search) {
  const ctx = vm.createContext({ URLSearchParams, location: { search } });
  vm.runInContext(CFG + '\n;globalThis.__r={DISCOUNT,CODE,SHOP,SHOPID,NAME,INIT};', ctx);
  return ctx.__r;
}
{
  const G = '4 berater.html Parameter';
  check(G, 'Konfigurationsblock gefunden', cfgStart >= 0 && cfgEnd > cfgStart);
  const S = (s, exp, n) => { const r = berater('?s=' + encodeURIComponent(s)); check(G, n || `s=${JSON.stringify(s)} -> ${exp}`, r.SHOP === exp, `SHOP=${r.SHOP}`); };
  S('NPDW2412', 'https://novodaily.com/NPDW2412');
  S('https://novodaily.com/NPDW2412', 'https://novodaily.com/NPDW2412');
  S('https://dev.novodaily.com/NPDW2412', 'https://novodaily.com/NPDW2412', 's=dev-Shop-URL -> immer offizieller Shop');
  S('javascript:alert(1)', 'https://novodaily.com');
  S('javascript://novodaily.com/%0aalert(1)', 'https://novodaily.com');
  S('https://evil.example/NPDW2412', 'https://novodaily.com');
  S('https://novodaily.com.evil.example/NPDW2412', 'https://novodaily.com');
  S('https://novodaily.com/NPDW2412/../../x', 'https://novodaily.com');
  S('//evil.example', 'https://novodaily.com');
  S('NPDW2412\n', 'https://novodaily.com', 's mit Zeilenumbruch -> Standard-Shop');
  S('ab', 'https://novodaily.com', 's zu kurz -> Standard-Shop');
  S('', 'https://novodaily.com', 's leer -> Standard-Shop');
  S('A'.repeat(21), 'https://novodaily.com', 's zu lang -> Standard-Shop');
  check(G, 'ohne Parameter: Standard-Shop, 0 %, kein Code', (r => r.SHOP === 'https://novodaily.com' && r.DISCOUNT === 0 && r.CODE === '' && r.NAME === 'Dein NovoDaily-Berater')(berater('')));
  for (const d of [0, 5, 10, 20, 30]) check(G, `d=${d} wird uebernommen`, berater(`?d=${d}&c=X-${d}`).DISCOUNT === d);
  for (const d of ['7', '100', '-5', '30abc', 'abc', '']) { const r = berater(`?d=${encodeURIComponent(d)}&c=ABC`); check(G, `d=${JSON.stringify(d)} -> 0 % und kein Code`, r.DISCOUNT === 0 && r.CODE === '', JSON.stringify(r)); }
  // Zahlschreibweisen wie 1e1, 0xA, " 10" landen per +x auf einer erlaubten Stufe – unkritisch (nur Anzeige), aber nicht streng
  { const odd = ['1e1', '0xA', ' 10', '10.0'].filter(d => berater(`?d=${encodeURIComponent(d)}`).DISCOUNT !== 0); if (odd.length) warn(G, 'd in Sonderschreibweise wird als gueltige Stufe gelesen', odd.map(JSON.stringify).join(', ') + ' -> 10 % (Number() statt strenger Pruefung)'); else ok(G, 'd nur in Normalschreibweise'); }
  { const r = berater('?d=10&c=' + encodeURIComponent('<b>"x\'-1;DROP')); check(G, 'c wird auf A-Z 0-9 - gefiltert', /^[A-Za-z0-9-]*$/.test(r.CODE), r.CODE); }
  check(G, 'c wird auf 32 Zeichen gekuerzt', berater('?d=10&c=' + 'A'.repeat(100)).CODE.length === 32);
  { const r = berater('?n=' + encodeURIComponent('<script>alert(1)</script>')); check(G, 'n mit <script>: keine spitzen Klammern', !/[<>]/.test(r.NAME) && !/[<>]/.test(r.INIT), r.NAME); }
  { const r = berater('?n=' + encodeURIComponent('"><img src=x onerror=alert(1)>')); check(G, 'n mit Attribut-Ausbruch: keine spitzen Klammern', !/[<>]/.test(r.NAME), r.NAME); }
  check(G, 'n wird auf 40 Zeichen gekuerzt', berater('?n=' + 'x'.repeat(200)).NAME.length <= 40);
  check(G, 'n = Leerzeichen -> Initiale nicht leer', berater('?n=' + encodeURIComponent('   ')).INIT.length > 0);
  // Statisch: keine fest eingebauten dev.-Shop-Links und alle Produkt-Links ueber SHOP
  check(G, 'keine festen dev.novodaily.com-Links in berater.html', !/dev\.novodaily\.com/.test(pbHtml), (pbHtml.match(/.{40}dev\.novodaily\.com.{20}/) || [''])[0]);
  const hard = (pbScript.replace(CFG, '').match(/["'`]https?:\/\/(www\.)?novodaily\.com\/[^"'`]*/g) || []);
  check(G, 'Produkt-Links nur ueber SHOP (keine fest eingebauten Shop-Pfade)', hard.length === 0, hard.slice(0, 3).join(' ; '));
}

// ---------- 3) NovoPilot pbUrl -> berater.html ----------
{
  const G = '3 pbUrl (Produktberater-Link)';
  if (!NP) bad(G, 'NovoPilot-Kontext fehlt');
  else {
    const id = NP.run('PARTNER.id'); const name = NP.run('PB.name'); const lv = NP.run('PB_LV');
    check(G, 'Rabattstufen 0/5/10/20/30', JSON.stringify(lv) === '[0,5,10,20,30]', JSON.stringify(lv));
    for (const d of lv) {
      const href = NP.run(`pbUrl(${d})`); const u = new URL(href); const q = u.searchParams;
      const errs = [];
      if (!u.pathname.endsWith('/berater.html')) errs.push('Pfad ' + u.pathname);
      if (/dev\./i.test(href)) errs.push('enthaelt dev.');
      if (u.hash) errs.push('Hash ' + u.hash);
      if (q.get('d') !== String(d)) errs.push('d=' + q.get('d'));
      if (d ? q.get('c') !== `${id}-${d}` : q.has('c')) errs.push('c=' + q.get('c'));
      if (q.get('n') !== name) errs.push('n=' + q.get('n'));
      if (q.get('s') !== id) errs.push('s=' + q.get('s'));
      const extra = [...q.keys()].filter(k => !['d', 'c', 'n', 's'].includes(k)); if (extra.length) errs.push('fremde Parameter ' + extra);
      const r = berater(u.search);
      if (r.SHOP !== 'https://novodaily.com/' + id) errs.push('berater.html macht daraus Shop ' + r.SHOP);
      if (r.DISCOUNT !== d) errs.push('berater.html liest Rabatt ' + r.DISCOUNT);
      if (d && r.CODE !== `${id}-${d}`) errs.push('berater.html liest Code ' + r.CODE);
      if (r.NAME !== name.replace(/[<>]/g, '').slice(0, 40)) errs.push('berater.html liest Name ' + r.NAME);
      check(G, `pbUrl(${d}) -> ${u.search}`, !errs.length, errs.join('; '));
    }
    // Name mit Sonderzeichen ueberlebt den Weg NovoPilot -> Link -> berater.html
    NP.run(`PB.name='Anna & Ben <Test> "Ü"'`);
    { const r = berater(new URL(NP.run('pbUrl(10)')).search); check(G, 'Name mit & < > " Ü: Link sauber kodiert, berater.html ohne < >', r.NAME === 'Anna & Ben Test "Ü"', r.NAME); }
    NP.run(`PB.name=${JSON.stringify(name)}`);
    // Haupt-Shop-Link des Partners (Shop-Seite, Startseite)
    const shop = NP.run('PARTNER.shop');
    if (/dev\./.test(shop)) warn(G, 'PARTNER.shop zeigt auf Stage-Shop', `${shop} – wird auf #shop/#home als "Dein Shop-Link", QR und "Zum Shop" angezeigt, waehrend der Produktberater auf https://novodaily.com/${id} geht`);
    else ok(G, 'PARTNER.shop ohne dev.');
  }
}

// ---------- 5) publish.py: Anonymisierung ----------
{
  const G = '5 publish.py Anonymisierung';
  // Originale aus der Ersetzungsliste (liegt seit 19.11.2026 NICHT im Repo, sondern neben der Quelldatei)
  const cfg = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'publish-ersetzungen.json'), 'utf8'));
  const originals = [...cfg.ersetzungen.map(p => p[0]), ...cfg.namen.map(p => p[0])];
  // publish.py selbst darf keinen Originalwert mehr enthalten (oeffentliches Repo)
  const pub = fs.readFileSync(path.join(REPO, 'publish.py'), 'utf8');
  check(G, 'publish.py enthaelt keine Originalwerte', !originals.some(o => pub.includes(o)), 'Originalwert in publish.py');
  // Einzelne Namen/Mails aus den Paaren zusaetzlich einzeln pruefen
  const tokens = new Set(originals);
  for (const o of originals) for (const t of o.split(/'\s*,\s*'|^'|'$/).map(x => x.trim()).filter(x => x.length > 4)) tokens.add(t.replace(/^<dd>|<\/dd>$/g, ''));
  check(G, 'Replace-Liste gelesen', originals.length >= 10, `nur ${originals.length} Eintraege`);
  const outDir = path.join(TMP, 'publish'); fs.mkdirSync(outDir);
  let py = null;
  for (const c of [process.env.PYTHON, 'python', 'py'].filter(Boolean)) { const r = spawnSync(c, ['--version'], { encoding: 'utf8' }); if (r.status === 0) { py = c; break; } }
  const leak = (txt, file) => [...tokens].filter(t => txt.includes(t)).map(t => `${file}: "${t}"`);
  if (!py) warn(G, 'publish.py ausfuehren', 'kein Python gefunden – nur die eingecheckten Dateien geprueft');
  else {
    // publish.py schreibt ins aktuelle Verzeichnis -> Temp-Ordner, das Repo bleibt unberuehrt
    const r = spawnSync(py, [path.join(REPO, 'publish.py')], { cwd: outDir, encoding: 'utf8' });
    if (r.status !== 0) bad(G, 'publish.py laeuft durch', (r.stderr || r.stdout).trim().split('\n').slice(-4).join(' | '));
    else {
      ok(G, 'publish.py laeuft durch (Asserts gruen)');
      const idx = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const ber = fs.readFileSync(path.join(outDir, 'berater.html'), 'utf8');
      const l = [...leak(idx, 'index.html'), ...leak(ber, 'berater.html')];
      check(G, `frische Ausgabe enthaelt keinen der ${tokens.size} Originalwerte`, !l.length, l.join(' ; '));
      const mails = [...new Set(idx.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) || [])].filter(e => !/@example\.com$|^np_ct_NP\w+@email\.com$/.test(e));
      check(G, 'index.html: nur @example.com bzw. Demo-Mails', !mails.length, mails.join(', '));
      const e = inlineScripts(idx).map((sc, i) => nodeCheck(sc.code, 'published-index-' + i)).filter(Boolean).join(' | '); check(G, 'veroeffentlichte index.html node --check', !e, e);
      const repoIdx = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
      if (repoIdx !== idx) warn(G, 'Repo-index.html entspricht nicht der aktuellen Quelle', 'Quelle wurde nach dem letzten publish geaendert (nur Info)');
      const repoBer = fs.readFileSync(path.join(REPO, 'berater.html'), 'utf8');
      if (repoBer !== ber) warn(G, 'Repo-berater.html entspricht nicht der aktuellen Quelle', 'nur Info');
    }
  }
  for (const f of ['index.html', 'berater.html']) {
    const p = path.join(REPO, f); if (!fs.existsSync(p)) continue;
    const l = leak(fs.readFileSync(p, 'utf8'), 'Repo/' + f);
    check(G, `eingecheckte ${f} enthaelt keine Originalwerte`, !l.length, l.join(' ; '));
  }
}

// ---------- 6) Rechts- und Datenschutz-Regeln (NOVO LEGAL, 19.11.2026) ----------
{
  const G = '6 Recht und Datenschutz';
  const pbTxt = pbHtml.replace(/data:[a-z/+0-9]+;base64,[A-Za-z0-9+/=]+/g, '');
  check(G, 'NovoPilot laedt keine Google Fonts', !/fonts\.googleapis|fonts\.gstatic/.test(npHtml));
  check(G, 'NovoPilot: noindex', /<meta name="robots" content="noindex/.test(npHtml));
  check(G, 'NovoPilot: Impressum- und Datenschutz-Link', npHtml.includes('novogenia.com/de/imprint.html') && npHtml.includes('novogenia.com/de/privacy.html'));
  check(G, 'NovoPilot: Shop des Partners ist der offizielle Shop', !/dev\.novodaily\.com/.test(npHtml));
  check(G, 'NovoPilot: Live-Backend nur lokal oder mit ?live=1', /const bLiveOk=/.test(npHtml) && /if\(!bLiveOk\(\)\)return;/.test(npHtml));
  check(G, 'NovoPilot: keine Gesundheitsdaten mehr vom Backend geladen', !npHtml.includes('/api/advisor/customer/'));
  check(G, 'NovoPilot: WhatsApp-Text nennt Partnerrolle und Provision', /const pbMsg=[^\n]*Partnerprogramm[^\n]*Provision/.test(npHtml));
  check(G, 'NovoPilot: Kundenkonto braucht eigene Freigabe (ACCX)', /ACCX\[rSel\]!=='ok'/.test(npHtml) && /if\(scope==='account'\)\{/.test(npHtml));
  check(G, 'NovoPilot: QR-Bibliothek lokal eingebettet (kein CDN-Abruf noetig)', /var qrcode=function\(\)/.test(npHtml));
  check(G, 'berater.html: noindex', /<meta name="robots" content="noindex/.test(pbHtml));
  check(G, 'berater.html: Bild mit Stoerer "Gratis" nicht mehr verwendet', !pbHtml.includes('img:NDIMG[2]'));
  // Runde 2 (Dauerfreigabe 19.11.2026): Gentest-Recht und Datenschutz
  const prodBlock = (npHtml.match(/const PRODUCTS=\[[\s\S]*?\n\];/) || [''])[0];
  check(G, 'Partnerkatalog ohne Pharmakogenetik', prodBlock.length > 100 && !/Pharmaco|Drug Response/.test(prodBlock));
  check(G, 'keine Medikamenten-Ansicht mehr im Beratungsraum', !/const MEDS=|function rMed|cMeds\(/.test(npHtml));
  check(G, 'kein Rohdaten-Download/-Upload durch Partner', !/function geneDl|function geneUpSec|function geneDown/.test(npHtml) && /function geneSelf/.test(npHtml));
  check(G, 'Partnerbestellung: Einwilligung durch Kunden + ab 18', /let wAge=false/.test(npHtml) && npHtml.includes('mindestens 18 Jahre'));
  check(G, 'keine Schweiz als Lieferland bei Partnerbestellung', !npHtml.includes('<option>Schweiz</option>'));
  check(G, 'Kunden anderer Partner: pseudonymisiert statt anonymisiert', !/siehst du nur anonymisiert|erscheinen anonymisiert/.test(npHtml));
  check(G, 'HTML-Bericht in sandbox-iframe', /<iframe id="rhf" sandbox="/.test(npHtml));
  check(G, 'PocketBase mit Integritaetspruefung (SRI)', /pocketbase@0\.26\.2[^\n]*s\.integrity='sha384-/.test(npHtml));
  check(G, 'Backend-Berichtswerte bereinigt (ID, Titel, URLs)', /const HTTPS=/.test(npHtml) && /html:HTTPS\(r\.htmlUrl\)/.test(npHtml));
  check(G, 'Online-Beratung: Hinweis keine aerztliche/genetische Beratung', npHtml.includes('keine ärztliche oder genetische Beratung'));
  {
    const src = (npHtml.match(/const HTTPS=u=>[^\n]*/) || [''])[0];
    let HTTPS = null; try { HTTPS = new Function(src + ';return HTTPS;')(); } catch (e) {}
    const cases = [['https://x.y/a-{n}.webp', true], ['/berichte/a.pdf', true], ['//evil.com/a', false], ['javascript:alert(1)', false], ['https://a/"onerror="alert(1)', false], ["https://a/'x", false], ['https://a/<b>', false]];
    check(G, 'HTTPS(): nur saubere https- oder Pfad-URLs', !!HTTPS && cases.every(([u, ok]) => (HTTPS(u) === u) === ok), cases.filter(([u, ok]) => !HTTPS || (HTTPS(u) === u) !== ok).map(c => c[0]).join(' | '));
  }
  check(G, 'Beratung: keine automatische Nachverrechnung (wie Kundenseite)', !/nachverrechnet|minutengenau/.test(npHtml) && /extra=0;/.test(npHtml) && npHtml.includes('Eine Verlängerung gibt es nur, wenn der Kunde zustimmt'));
  check(G, 'Beratung: Widerruf (consent-revoke) schliesst die Freigabe', /d\.type==='consent-revoke'\)rRevoke\(x\.scope\)/.test(npHtml) && /function rRevoke\(scope\)/.test(npHtml));
  {
    const sent = [...npHtml.matchAll(/(?:this|bApi)\.ev\('([a-z-]+)'/g)].map(m => m[1]);
    const allowed = ['hello', 'ready', 'signal', 'handover', 'chat', 'q-show', 'q-done', 'access-request', 'bye'];
    check(G, 'Beratung: nur erlaubte Event-Typen ans Backend', sent.length > 0 && sent.every(t => allowed.includes(t)), sent.filter(t => !allowed.includes(t)).join(','));
  }
  check(G, '18+-Bestaetigung gilt nur fuer den gewaehlten Kunden', /const wKey=\(\)=>/.test(npHtml) && /wAge!==wKey\(\)/.test(npHtml));
  check(G, 'NovoPilot: Netzwerkprovision nur aus Endkunden-Bestellungen', npHtml.includes('Für jede Bestellung seiner Endkunden'));
  check(G, 'berater.html: Provision offengelegt (DE und EN)', (pbTxt.match(/erhalte ich eine Provision/g) || []).length >= 2 && (pbTxt.match(/receive a commission/g) || []).length >= 2);
  check(G, 'berater.html: keine falsche Exklusivitaet', !/Persönlicher Gutschein|gib den Link nicht weiter|don't pass the link on/.test(pbTxt));
  check(G, 'berater.html: Preise mit MwSt.-, Versand- und Laufzeithinweis', pbTxt.includes('Preise inkl. MwSt.') && pbTxt.includes('Versandkosten laut Shop') && pbTxt.includes('verlängern sich danach automatisch'));
  check(G, 'berater.html: Rabattstufe streng geprueft', pbTxt.includes("/^(0|5|10|20|30)$/.test(QS.get('d')||'')"));
  check(G, 'berater.html: jedes Produktbild nur einmal eingebettet', (pbHtml.match(/data:image\/webp;base64,/g) || []).length <= 6);
}

// ---------- Ausgabe ----------
fs.rmSync(TMP, { recursive: true, force: true });
let g0 = '';
for (const r of results) {
  if (r.g !== g0) { console.log('\n== ' + r.g); g0 = r.g; }
  console.log(`  [${r.s}] ${r.n}${r.d ? '  -> ' + r.d : ''}`);
}
const nOk = results.filter(r => r.s === 'OK').length, nBad = results.filter(r => r.s === 'FEHLER').length, nW = results.filter(r => r.s === 'HINWEIS').length;
console.log(`\nErgebnis: ${nOk} OK, ${nBad} FEHLER, ${nW} HINWEIS  (${nBad ? 'ROT' : 'GRUEN'})`);
process.exit(nBad ? 1 : 0);
