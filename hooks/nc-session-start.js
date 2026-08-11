#!/usr/bin/env node
// nc-session-start.js — Session-Start-Zwang des Felix-OS (Gate 2, Teil 1).
// Port aus dem NovaCore-Kern `nc` (Bauplan 2026-08-11, AP7), Kern-Fassung beim Bau gelesen.
// SessionStart-Hook: injiziert Pflicht-Einstieg und LEBENDEN Projektstand als Kontext,
// statt nur auf /nc-felix:start hinzuweisen.
//
// VERIFIZIERTE MECHANIK (offizielle Hooks-Doku, im Kern abgerufen 2026-07-30):
//   - "SessionStart has no blocking mechanism": Exit 2 erzeugt nur eine Transcript-Notiz,
//     die Session laeuft weiter. Dieser Hook kann also NICHT blocken — er injiziert. Die
//     Erzwingung der ersten schreibenden Aktion ist Aufgabe des PreToolUse-Begleiters
//     nc-start-gate.js (Zangen-Prinzip).
//   - Ausgabe ueber hookSpecificOutput.additionalContext; landet als System-Reminder VOR
//     dem ersten User-Prompt.
//   - Feuert bei startup/resume/clear/compact/fork — also auch nach jeder Kompaktierung,
//     was den Stand automatisch auffrischt.
//   - Die Doku mahnt: laeuft in JEDER Session → schnell halten.
//
// SCOPING — KEIN Marker mehr (Aenderung 2026-08-11 gegenueber 0.2.2):
// Aktiv, wo das Plugin installiert ist — genau wie das FFG. Die frueher noetige
// Marker-Datei `.nc-os` als Aktivierungsbedingung ist gestrichen: Sie muesste in jedem
// Repo manuell angelegt werden, wird vergessen, und ein Gate, das man vergessen kann, ist
// kein Gate. Bewusst in Kauf genommen: Der Regelblock erscheint in JEDER Session auf dem
// Geraet. Deshalb ist er kurz; die repo-spezifischen Abschnitte entfallen automatisch, wo
// die Quellen fehlen (fremdes Repo → nur der Regelblock).
//
// Opt-out AUSSCHLIESSLICH per Env: NC_START_GATE=off (bzw. 0/false/disabled) — derselbe
// Schalter wie das Start-Gate (ein Gate, ein Schalter).
// Fail-open: ein defekter Hook darf keine Session lahmlegen.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { resolveSessionKey } = require('./lib/session-key');

const OFF_VALUES = new Set(['0', 'false', 'off', 'disabled', 'disable']);
const GIT_TIMEOUT_MS = 2000;   // lieber Abschnitt weglassen als Session verzoegern
const MAX_COMMITS = 5;
const MAX_UNRELEASED_LINES = 8;
const MAX_STATUS_FILES = 8;
const MAX_VORHABEN = 5;        // juengste datierte Dateien aus knowledge-base/grundwissen/

function isDisabled() {
  return OFF_VALUES.has(String(process.env.NC_START_GATE || '').trim().toLowerCase());
}

// --- Repo-Wurzel bestimmen ------------------------------------------------------------

// Wurzel = Git-Toplevel (funktioniert auch in Worktrees), sonst `.git` aufwaerts suchen,
// sonst das Startverzeichnis. Nur fuer das Auffinden der Stand-Quellen zustaendig — der
// Hook ist NICHT an ein Repo gebunden und laeuft auch ausserhalb eines Git-Baums.
function repoRoot(start) {
  const gitTop = git(start, ['rev-parse', '--show-toplevel']);
  if (gitTop) return path.resolve(gitTop.split(/\r?\n/)[0]);

  let dir = path.resolve(start);
  for (;;) {
    try {
      if (fs.existsSync(path.join(dir, '.git'))) return dir;
    } catch (_) { /* weitersuchen */ }
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

// --- Quellen (jede optional; fehlt sie, entfaellt der Abschnitt) ---------------------

function readTextFile(file, maxLen) {
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim();
    return raw ? raw.slice(0, maxLen) : null;
  } catch (_) { return null; }
}

function git(root, args) {
  try {
    // core.quotepath=false: sonst liefert git Nicht-ASCII-Pfade oktal-escaped — im
    // injizierten Kontext unlesbar und als Pfad unbrauchbar.
    const out = execFileSync('git', ['-c', 'core.quotepath=false', '-C', root, ...args], {
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });
    // WICHTIG: Erfolg-mit-leerer-Ausgabe ('') und FEHLER (null) sind verschiedene Dinge.
    // Vorher lieferte beides null — ein fehlgeschlagenes oder abgelaufenes
    // `git status --porcelain` wurde dann als "Working Tree: clean" injiziert, also eine
    // FALSCHE Tatsachenbehauptung im Pflicht-Einstieg (Review-Befund Codex 2026-08-11).
    return String(out || '').trim();
  } catch (_) { return null; } // kein Git, Timeout, kein Repo → Abschnitt entfaellt
}

// Kopf des [Unreleased]-Abschnitts: zeigt, WAS integriert aber nicht veroeffentlicht ist.
// Bewusst nur Rubriken (### Added/Changed/Fixed) und die ERSTE Zeile jedes Top-Level-
// Bullets — die Prosa-Fortsetzungszeilen sind hier Rauschen und blaehen den Block auf.
function unreleasedHead(root) {
  const raw = readTextFile(path.join(root, 'CHANGELOG.md'), 60000);
  if (!raw) return null;
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s*\[Unreleased\]/i.test(l));
  if (start === -1) return null;
  // Abschnittsgrenze: JEDE weitere Ebene-2-Ueberschrift beendet den Unreleased-Block.
  // Vorher endete er nur an einer Ueberschrift, deren Version mit einer ZIFFER beginnt
  // ("## 0.2.2 — …", "## [0.6.1] — …"). Die ebenso verbreitete Form "## v0.9.0 — …" rutschte
  // durch, und die BEREITS VEROEFFENTLICHTEN Eintraege darunter wurden als
  // "unveroeffentlicht" injiziert — eine falsche Tatsachenbehauptung im Pflicht-Einstieg
  // (Review-Befund 2026-08-12). release.yml schneidet den Abschnitt mit awk ebenfalls an
  // JEDEM `^## `; beide Stellen sagen jetzt dasselbe. Unterabschnitte sind `###`, an einer
  // Ebene-2-Ueberschrift endet der Abschnitt also immer.
  const abschnitt = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    abschnitt.push(line);
  }

  // `*` und `+` gelten als Bullet-Marker wie `-` — Markdown erlaubt alle drei.
  const erkannt = [];
  for (const line of abschnitt) {
    if (/^###\s+/.test(line)) {
      erkannt.push(line.trim());
    } else if (/^[-*+]\s+/.test(line)) {
      erkannt.push(line.trim().replace(/\s+$/, '').slice(0, 160));
    }
  }

  if (!abschnitt.some((l) => l.trim())) return '(leer — nichts Unveroeffentlichtes)';
  if (!erkannt.length) {
    // Der Abschnitt HAT Inhalt, nur nicht in einer Form, die dieser Hook zerlegt (reine
    // Prosa, Tabelle, eingerueckte Liste). "leer" waere hier genau derselbe Fehler wie das
    // frueher als "clean" injizierte fehlgeschlagene `git status`: eine Behauptung ueber
    // etwas, das nie geprueft wurde.
    return '(nicht leer, aber in einer hier nicht zerlegten Form — Abschnitt selbst lesen)';
  }

  const gezeigt = erkannt.slice(0, MAX_UNRELEASED_LINES);
  const rest = erkannt.length - gezeigt.length;
  return gezeigt.join('\n')
    + (rest > 0 ? '\n… und ' + rest + ' weitere Zeile(n) — Abschnitt selbst lesen' : '');
}

// Laufende Vorhaben: reine Dateinamen, kein Inhalt (die Triage macht der Agent).
// Quelle ist die EIGENE Wissensbasis dieses Repos (knowledge-base/grundwissen/, seit
// AP8); Dateien ohne Datumspraefix sind dauerhafte Referenzen und gehoeren nicht in die
// Liste. Fehlt der Ordner (fremdes Repo), entfaellt der Abschnitt — die Wissensbasis ist
// Arbeitsmaterial, nie Laufzeit-Abhaengigkeit.
function laufendeVorhaben(root) {
  const dir = path.join(root, 'knowledge-base', 'grundwissen');
  try {
    const files = fs.readdirSync(dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/i.test(f))
      .sort()
      .reverse()
      .slice(0, MAX_VORHABEN);
    return files.length ? files : null;
  } catch (_) { return null; }
}

// Module aus dem Metadaten-SSOT dieses OS. Der Hook liest sie, statt eine zweite Liste zu
// pflegen. Felix-Schema: { module: [ { name, praefix, skills } ] }.
function moduleListe() {
  // Relativ zum HOOK, nicht zur Projektwurzel: Die Registry gehoert zum installierten
  // Plugin. Gegen `root` gelesen fehlte der Modul-Abschnitt in jedem fremden Arbeits-Repo
  // (Review-Befund Codex 2026-08-11) — gerade dort ist er am nuetzlichsten.
  const raw = readTextFile(path.join(__dirname, '..', 'module-registry.json'), 200000);
  if (!raw) return null;
  try {
    const reg = JSON.parse(raw);
    if (!Array.isArray(reg.module)) return null;
    return reg.module.map((m) => ({
      name: String((m && m.name) || '?'),
      praefix: String((m && m.praefix) || ''),
      skills: Array.isArray(m && m.skills) ? m.skills.map(String) : []
    }));
  } catch (_) { return null; }
}

// Versionsquelle: die eigene plugin.json, relativ zum Hook aufgeloest — andere
// Repo-Dateien existieren im installierten Plugin-Cache nicht.
function pluginVersion() {
  const raw = readTextFile(path.join(__dirname, '..', '.claude-plugin', 'plugin.json'), 20000);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw).version;
    return v ? String(v) : null;
  } catch (_) { return null; }
}

// --- Kontextblock bauen --------------------------------------------------------------

// Stempel-Hinweis (Gate 2, Teil 3): nennt den EXAKTEN Befehl samt Session-Schluessel,
// damit der Agent ihn nach /nc-felix:start nicht raten muss.
// Bewusst aus __dirname, NICHT aus CLAUDE_PLUGIN_ROOT: Das Gate vergleicht den
// vorgeschlagenen Pfad gegen sein eigenes __dirname. Zeigt CLAUDE_PLUGIN_ROOT ueber eine
// Junction/einen Symlink auf das Plugin, wichen beide Zeichenketten ab — die Injektion
// haette einen Befehl vorgeschlagen, den das Gate ablehnt. Dieselbe Quelle auf beiden
// Seiten schliesst das aus.
function stempelHinweis(sessionKey) {
  const skript = path.join(__dirname, 'nc-start-stempel.js');
  return '**Abschluss-Stempel (Start-Gate):** Erst NACH abgeschlossenem `/nc-felix:start` '
    + 'setzen: `node "' + skript + '" --session ' + sessionKey
    + ' --branch <branch> --head <head>` — Branch und HEAD aus der realen Git-Lage '
    + '(`git rev-parse --abbrev-ref HEAD` · `git rev-parse --short HEAD`); außerhalb eines '
    + 'Git-Baums entfallen beide. Bis zum Stempel lehnt das Start-Gate jede schreibende '
    + 'Aktion ab; Lesen und Read-only-Git bleiben frei.';
}

// Zeilen des Abschnitts „Lebender Stand" aus den drei Git-Rohwerten bauen.
//
// Ausgelagert und exportiert, damit die entscheidende Unterscheidung direkt pruefbar ist:
// `status === ''` heisst „erfolgreich geprueft, nichts geaendert" (clean), `status === null`
// heisst „Fehler oder Timeout, wir wissen es NICHT" (unbekannt). Genau diese Unterscheidung
// war der Befund vom 2026-08-11 — vorher lieferte der Git-Wrapper fuer beides `null` und der
// Pflicht-Einstieg behauptete einen sauberen Baum, den niemand geprueft hatte. Eine
// Mutationsprobe am 2026-08-12 zeigte, dass kein Test sie deckte (die Suite blieb gruen,
// nachdem der Fix entfernt war), deshalb ist die Logik jetzt einzeln testbar.
function standZeilen(branch, commits, status) {
  const stand = [];
  if (branch) stand.push('- Branch: `' + branch + '`');
  if (commits) stand.push('- Letzte Commits:\n' + commits.split(/\r?\n/).map((l) => '  - ' + l).join('\n'));
  if (status === null) {
    // Nur melden, wenn wir ueberhaupt in einem Git-Baum sind — sonst gibt es nichts zu sagen.
    // NIE "clean" behaupten: Wir wissen es an dieser Stelle nicht.
    if (branch) {
      stand.push('- Working Tree: **unbekannt** — `git status` lieferte keine Antwort '
        + '(Fehler oder Timeout). Vor eigenen Änderungen selbst prüfen.');
    }
  } else if (status === '') {
    stand.push('- Working Tree: clean');
  } else {
    const zeilen = status.split(/\r?\n/).filter(Boolean);
    const gezeigt = zeilen.slice(0, MAX_STATUS_FILES).map((l) => '  - ' + l.trim());
    const rest = zeilen.length - gezeigt.length;
    stand.push('- **Working Tree hat ' + zeilen.length + ' Änderung(en)** — vor eigenen '
      + 'Änderungen prüfen, ob ein fremder Umbau läuft:\n' + gezeigt.join('\n')
      + (rest > 0 ? '\n  - … und ' + rest + ' weitere' : ''));
  }
  return stand;
}

function buildContext(root, source, sessionKey) {
  const teile = [];
  const version = pluginVersion();

  teile.push('# Felix-OS — Pflicht-Einstieg (Session-Start-Zwang, Gate 2)'
    + (version ? '\nPlugin `nc-felix` ' + version : '')
    + (source && source !== 'startup' ? '\nAuslöser: `' + source + '`.' : ''));

  teile.push('**Vor der ersten inhaltlichen Aktion:** `/nc-felix:start` ausführen — oder, wenn '
    + 'du ohne den Skill arbeitest, dessen Schritte selbst erledigen: Log-Stand und '
    + '`git status` lesen (der Working Tree ist die Wahrheit, nicht der letzte Commit), '
    + '`CHANGELOG.md` für den Produktstand, dann die Projekt-Doku (`AGENTS.md` als normativer '
    + 'Einstieg) und die für die Aufgabe passende Wissensquelle. Der WP-Rahmen WP0–WP8 steht '
    + 'normativ in `wp-rahmen.md` dieses Plugins.');

  if (sessionKey) teile.push(stempelHinweis(sessionKey));

  teile.push('**Rote Linien (nie automatisiert, gelten auch hier):** Merges · Deploy-Klicks · '
    + 'Review-Resolves/Approvals · alles Kundensichtbare (PR-Texte, Ticket-Kommentare posten). '
    + '**Kein Commit/Push ohne explizite Freigabe des Maintainers.**');

  const commits = git(root, ['log', '--oneline', '-' + MAX_COMMITS]);
  const status = git(root, ['status', '--porcelain']);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);

  const stand = standZeilen(branch, commits, status);
  if (stand.length) teile.push('## Lebender Stand\n' + stand.join('\n'));

  const unreleased = unreleasedHead(root);
  if (unreleased) teile.push('## `[Unreleased]` im CHANGELOG\n' + unreleased);

  const vorhaben = laufendeVorhaben(root);
  if (vorhaben) {
    teile.push('## Laufende Vorhaben (`knowledge-base/grundwissen/`, jüngste zuerst)\n'
      + vorhaben.map((f) => '- ' + f).join('\n')
      + '\nDie jüngste Datei ist der aktuellste Planungsstand; Routing und Quellen-Triage '
      + 'stehen in `knowledge-base/SSOT-Document-Index.md`.');
  }

  const mod = moduleListe();
  if (mod) {
    teile.push('## Module (aus `module-registry.json`)\n'
      + mod.map((m) => '- **' + m.name + '**'
        + (m.praefix ? ' (`' + m.praefix + '`)' : ' (Kernmodul, ohne Präfix)')
        + (m.skills.length ? ' — Skills: ' + m.skills.join(', ') : '')).join('\n'));
  }

  return teile.join('\n\n');
}

function buildSessionStartResponse(input) {
  if (isDisabled()) return null;
  const start = process.env.CLAUDE_PROJECT_DIR || (input && input.cwd) || process.cwd();
  const root = repoRoot(start);
  const context = buildContext(
    root,
    (input && typeof input.source === 'string') ? input.source : '',
    resolveSessionKey(input || {})
  );
  if (!context) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context
    }
  };
}

function main() {
  let input = {};
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8')) || {};
  } catch (_) { input = {}; } // leere/defekte Eingabe: mit cwd weiterarbeiten
  if (typeof input !== 'object' || input === null) input = {};

  const response = buildSessionStartResponse(input);
  if (response) process.stdout.write(JSON.stringify(response));
}

// `git`, `standZeilen` und `unreleasedHead` sind fuer die Tests mit-exportiert: Ihre
// Vertraege (Erfolg-leer vs. Fehler, keine erfundenen Tatsachen) sind der Kern von Gate 2,
// Teil 1 und waren bis 2026-08-12 nur indirekt und damit gar nicht gedeckt.
module.exports = {
  buildSessionStartResponse, buildContext, laufendeVorhaben, repoRoot,
  git, standZeilen, unreleasedHead
};

if (require.main === module) {
  try {
    main();
  } catch (e) {
    try { process.stderr.write('nc-session-start fail-open: ' + (e && e.message)); } catch (_) { /* egal */ }
  }
  // Kein process.exit(): das kann auf POSIX den gepufferten stdout-Write (Pipe) abschneiden —
  // die Injektion ginge still verloren. exitCode 0 genuegt fuer fail-open, nichts laeuft async.
  process.exitCode = 0;
}
