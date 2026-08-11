// Wächter der eigenen Wissensbasis des Felix-OS (knowledge-base/).
//
// Warum als Test: Ein Index, den niemand prüft, driftet innerhalb weniger Änderungen von der
// Platte weg — und eine Isolationsregel, die nur in Prosa steht, hält dem ersten „nur ganz
// kurz" nicht stand. Die Fälle T-1 bis T-9 stammen aus dem Bauplan
// „Prozesskorpus-Nachzug + Satelliten-SSOT" (2026-08-11) des OS-Repos, §6.
//
// T-7 und T-8 sind die REVIEW-FOKUS-Fälle (Invariante I1, Isolation): Diese Wissensbasis ist
// terminal. Es gibt keinen Weg zurück in Kerndokumente — also auch keine Warteschlange, keine
// Kandidatenliste und keinen reservierten Platz für so etwas; und keine ausgelieferte Datei
// benutzt einen fremden Checkout als Lesepfad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WISSEN = join(root, 'knowledge-base');
const INDEX_DATEI = join(WISSEN, 'SSOT-Document-Index.md');

/** Die vier Kategorien der Wissensbasis (Fuenferstruktur inkl. Index). */
const KATEGORIEN = ['bauplan-archiv', 'debugging-findings', 'grundwissen', 'ideen-backlog'];

/** Rekursiv alle Dateien unterhalb von dir, relativ zu WISSEN mit /-Trennern. */
function dateienUnter(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const full = join(cur, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      out.push(relative(WISSEN, full).split(sep).join('/'));
    }
  }
  return out.sort();
}

/**
 * Wissensdateien = alle .md unterhalb der Wurzel, ohne den Index selbst und ohne
 * PLATZHALTER.md (die haelt eine leere Kategorie in Git, traegt aber kein Wissen und ist
 * deshalb bewusst nicht indexpflichtig).
 */
function wissensDateien() {
  return dateienUnter(WISSEN)
    .filter((rel) => rel.endsWith('.md'))
    .filter((rel) => rel !== 'SSOT-Document-Index.md')
    .filter((rel) => !rel.endsWith('PLATZHALTER.md'));
}

function indexText() {
  return readFileSync(INDEX_DATEI, 'utf8');
}

/** Alle Markdown-Linkziele des Index, die auf die Wissensbasis selbst zeigen. */
function indexLinkziele() {
  const ziele = [];
  const re = /\]\(([^)]+)\)/g;
  const text = indexText();
  let m;
  while ((m = re.exec(text)) !== null) {
    const ziel = m[1].trim();
    if (/^[a-z]+:/i.test(ziel) || ziel.startsWith('#')) continue; // externe URL / Anker
    ziele.push(ziel.split('#')[0]);
  }
  return ziele;
}

/** Ausgelieferte Dateien: skills/**, hooks/** und die *.md der Repo-Wurzel. */
function ausgelieferteDateien() {
  const out = [];
  for (const unter of ['skills', 'hooks']) {
    const dir = join(root, unter);
    if (!existsSync(dir)) continue;
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      for (const entry of readdirSync(cur, { withFileTypes: true })) {
        const full = join(cur, entry.name);
        if (entry.isDirectory()) { stack.push(full); continue; }
        out.push(full);
      }
    }
  }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md')) out.push(join(root, entry.name));
  }
  return out;
}

// ---------------------------------------------------------------------------
// T-1 bis T-6: Struktur, Index, Protokolle
// ---------------------------------------------------------------------------

test('T-1 Wissensbasis: der Master-Index existiert', () => {
  assert.ok(existsSync(INDEX_DATEI),
    'knowledge-base/SSOT-Document-Index.md fehlt — ohne Index gibt es kein Routing und keine Triage');
});

test('T-2 Wurzel-Regel: nur der Index liegt direkt in knowledge-base/', () => {
  // Der Index ist das einzige Dokument hierarchisch ueber den Kategorien. Alles andere
  // gehoert in eine Kategorie, sonst zerfaellt die Triage.
  const obenliegend = readdirSync(WISSEN, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name)
    .filter((name) => name !== 'SSOT-Document-Index.md');
  assert.deepEqual(obenliegend, [],
    `nur der Index gehoert direkt in knowledge-base/: ${obenliegend.join(', ')}`);
});

test('T-3 Indexpflicht: jede Wissensdatei ist im Index genannt', () => {
  const text = indexText();
  const fehlend = wissensDateien().filter((rel) => !text.includes(rel));
  assert.deepEqual(fehlend, [],
    `ohne Index-Zeile nicht auffindbar: ${fehlend.join(', ')} — Zeile in Teil 2 nachtragen`);
});

test('T-4 Linkgueltigkeit: kein Index-Eintrag zeigt ins Leere', () => {
  const tot = indexLinkziele().filter((ziel) => {
    const abs = join(WISSEN, ziel.split('/').join(sep));
    return !existsSync(abs) || !statSync(abs).isFile();
  });
  assert.deepEqual(tot, [],
    `toter Verweis im SSOT-Document-Index.md: ${tot.join(', ')} — Pfade sind relativ zu "knowledge-base/"`);
});

test('T-5 alle vier Kategorien existieren und sind in Teil 1 geroutet', () => {
  const text = indexText();
  const fehlend = KATEGORIEN.filter((k) => !existsSync(join(WISSEN, k)));
  assert.deepEqual(fehlend, [], `Kategorie fehlt auf der Platte: ${fehlend.join(', ')}`);

  // Eine Kategorie ohne Routing-Zeile ist ein Ablageort ohne Regel — genau die Luecke,
  // durch die Dokumente am falschen Ort landen.
  const ungeroutet = KATEGORIEN.filter((k) => !text.includes('`' + k + '/`'));
  assert.deepEqual(ungeroutet, [],
    `Kategorie ohne Routing-Zeile in Teil 1: ${ungeroutet.join(', ')} — als \`<name>/\` im Index nennen`);

  // Umgekehrt: kein Ordner auf der Platte, den Teil 1 nicht kennt.
  const vorhanden = readdirSync(WISSEN, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  assert.deepEqual(vorhanden, KATEGORIEN,
    'die Kategorien auf der Platte weichen von der erwarteten Struktur ab');
});

test('T-6 beide Protokolle existieren und tragen den append-only-Kopf', () => {
  for (const name of ['agent-learnings.md', 'debug-log.md']) {
    const datei = join(WISSEN, 'debugging-findings', name);
    assert.ok(existsSync(datei), `Protokoll fehlt: debugging-findings/${name}`);
    const kopf = readFileSync(datei, 'utf8').slice(0, 600);
    assert.match(kopf, /append-only/i,
      `debugging-findings/${name}: der Kopf nennt die append-only-Regel nicht — ohne sie wird umgeschrieben statt ergaenzt`);
  }
});

// ---------------------------------------------------------------------------
// T-7 und T-8: Isolation (Invariante I1) — Review-Fokus
// ---------------------------------------------------------------------------

test('T-7 Isolation: kein Pfad und kein Dateiname deutet auf eine Warteschlange hin', () => {
  // Diese SSOT ist terminal: Felix-OS schreibt nie in Kerndokumente. Damit ist eine
  // Kandidaten-Queue nicht "spaeter", sondern gegenstandslos — und ein reservierter
  // Ablageort waere eine halbe Warteschlange, die zum Auffuellen einlaedt.
  const ordner = readdirSync(WISSEN, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name + '/');
  const verdaechtig = [...dateienUnter(WISSEN), ...ordner]
    .filter((rel) => /queue|kandidat|promotion|kuration/i.test(rel));
  assert.deepEqual(verdaechtig, [],
    `Warteschlangen-Mechanik in der Satelliten-SSOT: ${verdaechtig.join(', ')} — I1 verbietet Queue/Promotion/Kuration, auch reserviert`);
});

test('T-8 Isolation: keine ausgelieferte Datei liest ueber die Repo-Grenze', () => {
  // Zwei getrennte Verbote:
  //   (a) Maschinenpfade auf einen fremden Checkout — nach der Installation nicht
  //       aufloesbar und der staerkste dokumentierte Drift-Punkt eines Satelliten.
  //   (b) Pfade des OS-Repos als Leseanweisung. Die Nennung ist erlaubt, aber nur als
  //       Quellenangabe: "OS-Repo" muss in unmittelbarer Naehe stehen.
  //
  // Wichtig: "knowledge-base/" allein ist KEIN Befund — dieses Repo fuehrt seit 2026-08-11
  // seine eigene. Ein Pfad ist nur dann fremd, wenn er hier nicht existiert.
  const maschinenpfad = /(?:[A-Za-z]:\\|\/[a-z]\/)[^\s`"']*(?:NovaCoreAI-OS|Onsite\.ai-OS)/;
  const KB_PFAD = /knowledge-base\/[A-Za-z0-9._/-]*/g;
  const befunde = [];

  for (const datei of ausgelieferteDateien()) {
    const inhalt = readFileSync(datei, 'utf8');
    const rel = relative(root, datei).split(sep).join('/');

    if (maschinenpfad.test(inhalt)) {
      befunde.push(`${rel}: Maschinenpfad auf einen fremden Checkout`);
    }

    const zeilen = inhalt.split(/\r?\n/);
    zeilen.forEach((zeile, i) => {
      for (const roh of zeile.match(KB_PFAD) || []) {
        const pfad = roh.replace(/[.,;:)\]-]+$/, '');
        if (existsSync(join(root, ...pfad.split('/')))) continue; // eigener Pfad
        const umfeld = [zeilen[i - 1] || '', zeile, zeilen[i + 1] || ''].join(' ');
        if (!/OS-Repo/i.test(umfeld)) {
          befunde.push(`${rel}:${i + 1}: fremder Pfad "${pfad}" ohne die Kennzeichnung "OS-Repo"`);
        }
      }
    });
  }

  assert.deepEqual(befunde, [],
    `Isolationsbruch in ausgelieferten Dateien:\n  ${befunde.join('\n  ')}`);
});

// ---------------------------------------------------------------------------
// T-9: Plugin-Grenze
// ---------------------------------------------------------------------------

/**
 * Kommentare aus JavaScript entfernen, bevor auf Eltern-Pfade geprueft wird.
 * Ohne das schlaegt die Regel an ihrer eigenen Dokumentation an: Ein Hook, der in einem
 * Kommentar erklaert, warum ein Eltern-Pfad verboten ist, enthaelt die Zeichenfolge
 * zwangslaeufig. Geprueft wird der CODE, nicht die Prosa daneben.
 * Bewusst simpel (kein Parser): Fuer Kommentar-Erkennung genuegt das, und ein zu grosszuegig
 * entfernter String-Inhalt kann die Pruefung hoechstens NICHT ausloesen — dieser Fall ist
 * durch die Negativprobe abgedeckt.
 */
function ohneKommentare(quelltext) {
  return quelltext
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

test('T-9 Plugin-Grenze: keine Eltern-Pfade in skills/ und hooks/', () => {
  // Installierte Plugins werden nach ~/.claude/plugins/cache kopiert; alles oberhalb des
  // Plugin-Verzeichnisses existiert dort nicht. Hier IST die Repo-Wurzel das Plugin.
  const befunde = [];
  for (const datei of ausgelieferteDateien()) {
    const rel = relative(root, datei).split(sep).join('/');
    if (!rel.startsWith('skills/') && !rel.startsWith('hooks/')) continue;
    const roh = readFileSync(datei, 'utf8');
    const geprueft = rel.endsWith('.js') || rel.endsWith('.mjs') ? ohneKommentare(roh) : roh;
    if (/\.\.\//.test(geprueft)) befunde.push(rel);
  }
  assert.deepEqual(befunde, [],
    `Eltern-Pfad in ausgelieferten Dateien: ${befunde.join(', ')} — nach der Installation nicht aufloesbar`);
});
