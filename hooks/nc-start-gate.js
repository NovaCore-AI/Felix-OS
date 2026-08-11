#!/usr/bin/env node
// nc-start-gate.js — Erzwingungs-Begleiter des Session-Start-Zwangs (Gate 2, Teil 2).
// Port aus dem NovaCore-Kern `nc` (Bauplan 2026-08-11, AP7), Kern-Fassung beim Bau gelesen.
// PreToolUse-Hook: lehnt jede SCHREIBENDE Aktion ab, solange /nc-felix:start diese Session
// nicht mit dem Fakten-Stempel abgeschlossen hat (nc-start-stempel.js). Lesen und Fragen
// bleiben frei — Read/Glob/Grep matchen hier gar nicht, und Read-only-Git-Introspektion
// laeuft auch ueber Bash ungehindert (sie IST der Pflicht-Einstieg; Wiederverwendung der
// gehaerteten FFG-Erkennung aus lib/bash-analyse.js).
//
// ZANGEN-PRINZIP (Plattform-Fakt: ein Hook kann keinen Skill starten, nur blocken und
// injizieren): Die SessionStart-Injektion SAGT dem Agenten, /nc-felix:start auszufuehren,
// und nennt den Stempel-Befehl; dieses Gate macht Nicht-Ausfuehren zur Sackgasse und
// wiederholt den Befehl in jeder Ablehnung. Erzwingung der Readings laeuft ueber den
// FAKTEN-Stempel: --branch/--head muessen der realen Git-Lage entsprechen.
//
// Verhaeltnis zum FFG (Pruefungs-Eigentum): gleicher Matcher, ANDERE Pruefung — das FFG
// verlangt Fakten je Ziel, dieses Gate verlangt den erledigten Session-Start. Beide
// duerfen auf denselben Aufruf feuern; keines dupliziert das andere. Beachte: NotebookEdit
// gated nur Gate 2, nicht das FFG.
// Kein "allow"-Output bei erfuelltem Start: der normale Permission-Flow bleibt unberuehrt.
// Subagenten sind ausgenommen (der Parent hat den Start-Zwang erfuellt).
// Opt-out AUSSCHLIESSLICH per Env: NC_START_GATE=off — derselbe Schalter wie die
// Injektion (ein Gate, ein Schalter). Fail-open bei internen Fehlern.
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolveSessionKey, isSubagentInvocation } = require('./lib/session-key');
const { isReadOnlyGitIntrospection } = require('./lib/bash-analyse');
const { stateFileFor } = require('./nc-start-stempel');

const OFF_VALUES = new Set(['0', 'false', 'off', 'disabled', 'disable']);
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // wie FFG: Stempel verfaellt nach 30 Min Inaktivitaet
const HEARTBEAT_MS = 60 * 1000;            // last_active hoechstens einmal je Minute auffrischen
const GIT_TIMEOUT_MS = 2000;
const STEMPEL_SKRIPT = path.join(__dirname, 'nc-start-stempel.js');

// Echte Invokation des Stempel-Skripts erkennen — NICHT per Substring:
// `echo x > /tmp/y   # nc-start-stempel.js` haette den Durchlass sonst geoeffnet, also
// jeden schreibenden Befehl mit angehaengtem Kommentar. Verlangt wird: der Befehl BEGINNT
// mit einem node-Aufruf auf GENAU DIESES Skript, und danach folgt nichts, was eine zweite
// Aktion anhaengt.
// Gruppe 1/2/3 fangen den INTERPRETER, Gruppe 4/5/6 den SKRIPTPFAD (jeweils gequotet
// doppelt/einfach/nackt). Beide werden anschliessend auf Identitaet geprueft — die Regex
// selbst entscheidet bewusst nichts ueber Namen.
const STEMPEL_INVOKATION = /^[^\S\r\n]*(?:"([^"]*)"|'([^']*)'|([^\s;&|<>#]+))[^\S\r\n]+(?:"([^"]*nc-start-stempel\.js)"|'([^']*nc-start-stempel\.js)'|([^\s;&|<>#]*nc-start-stempel\.js))(?![^\s;&|<>#])/i;

const NODE_BINARIES = new Set(['node', 'node.exe']);

function gleicherPfad(a, b) {
  const foldCase = process.platform === 'win32' || process.platform === 'darwin';
  return foldCase ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// Ist das ausfuehrende Programm wirklich node? Ein Namensmuster genuegt nicht: Ein
// gequoteter Pfad, der "node" nur ENTHAELT, traefe sonst zu — in jedem Repo mit
// node_modules erfuellt damit JEDE Datei in node_modules/.bin das Kriterium
// (`"…/node_modules/.bin/rimraf" "<stempelpfad>"` haette vor erledigtem Session-Start das
// Stempel-Skript geloescht). Geprueft wird deshalb der Basisname.
function istNodeInterpreter(pfad) {
  const roh = String(pfad || '').trim();
  if (!roh) return false;
  if (!NODE_BINARIES.has(path.basename(roh).toLowerCase())) return false;
  // Nackter Name ("node", "node.exe"): PATH-Aufloesung, wie bisher zugelassen.
  if (!/[\\/]/.test(roh)) return true;
  // EXPLIZITER Pfad: Der Basisname allein genuegt hier NICHT. Eine Datei namens `node` im
  // Arbeitsverzeichnis liesse sonst `./node "<echter Stempelpfad>"` durch — ein Kanal fuer
  // beliebigen Code durch Gate 2 (Review-Befund Codex 2026-08-11). Verlangt wird Identitaet
  // mit dem laufenden Node-Interpreter.
  try {
    return gleicherPfad(fs.realpathSync(path.resolve(roh)), fs.realpathSync(process.execPath));
  } catch (_) { return false; }
}

// Zeigt der Pfad auf DIESE Datei? Der blosse Namenssuffix genuegt nicht:
// `node "<irgendwo>/my-nc-start-stempel.js"` waere sonst ein Kanal fuer beliebigen
// Node-Code durch Gate 2. Verglichen wird der aufgeloeste Pfad; Case-Folding nur auf
// case-insensitiven Plattformen (wie im FFG-Datei-Gate). Zusaetzlich ein Realpath-Vergleich,
// damit ein ueber Symlink/Junction adressiertes Plugin-Root nicht den eigenen Oeffner
// aussperrt.
function istDiesesSkript(pfad) {
  if (!pfad) return false;
  try {
    const kandidat = path.resolve(pfad);
    const echt = path.resolve(STEMPEL_SKRIPT);
    if (gleicherPfad(kandidat, echt)) return true;
    try {
      return gleicherPfad(fs.realpathSync(kandidat), fs.realpathSync(echt));
    } catch (_) { return false; } // Datei existiert nicht → kein Treffer
  } catch (_) { return false; }
}

function istStempelBefehl(command) {
  const raw = String(command || '');
  // Zeilenumbruch und Wagenruecklauf sind vollwertige Kommandotrenner (Bash wie
  // PowerShell). Ein mehrzeiliger Befehl ist NIE "nur der Stempel".
  if (/[\r\n]/.test(raw)) return false;
  const treffer = STEMPEL_INVOKATION.exec(raw);
  if (!treffer) return false;
  if (!istNodeInterpreter(treffer[1] || treffer[2] || treffer[3])) return false;
  if (!istDiesesSkript(treffer[4] || treffer[5] || treffer[6])) return false;
  // Nach dem Skriptpfad duerfen nur noch Argumente stehen — kein Verketten, kein Kommentar,
  // keine Umleitung, keine Kommando-Substitution.
  const rest = raw.slice(treffer[0].length);
  return !/[;&|<>#`]|\$\(/.test(rest);
}

function isDisabled() {
  return OFF_VALUES.has(String(process.env.NC_START_GATE || '').trim().toLowerCase());
}

// Stempel laden; abgelaufene Stempel verfallen (lange Pause → neuer Kontext noetig,
// die Injektion feuert bei resume/compact ohnehin frisch).
function loadStamp(file) {
  try {
    if (!file || !fs.existsSync(file)) return null;
    const stamp = JSON.parse(fs.readFileSync(file, 'utf8'));
    const lastActive = Number(stamp && stamp.last_active) || 0;
    if (Date.now() - lastActive > SESSION_TIMEOUT_MS) {
      try { fs.unlinkSync(file); } catch (_) { /* egal */ }
      return null;
    }
    return stamp;
  } catch (_) { return null; } // defekter Stempel zaehlt als nicht gestempelt
}

// Ist `dir` ein Git-Arbeitsbaum? Rein lesend, kurz getimeoutet. Wird nur gebraucht, um zu
// entscheiden, ob ein UNVERIFIZIERTER Stempel hier gelten darf.
function istGitBaum(dir) {
  try {
    const out = execFileSync('git', ['-C', dir, 'rev-parse', '--is-inside-work-tree'], {
      encoding: 'utf8', timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true
    });
    return String(out || '').trim() === 'true';
  } catch (error) {
    // Kein Git / kein Repo → es gibt wirklich nichts zu verifizieren, stiller Durchlass.
    // Ein TIMEOUT ist etwas anderes: dann wissen wir es nicht und lassen fail-open durch
    // (repo-weite Doktrin) — das aber nicht stumm, sonst schwaecht Last unbemerkt Gate 2.
    if (error && (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM')) {
      try {
        process.stderr.write('[nc-start-gate] git rev-parse in ' + dir + ' lief in den '
          + 'Timeout — ein unverifizierter Stempel wird hier durchgelassen (fail-open).\n');
      } catch (_) { /* egal */ }
    }
    return false;
  }
}

// Ein Stempel gilt als verifiziert, wenn er es ausweist. Aeltere Stempel ohne das Feld
// werden aus branch/head abgeleitet, damit ein Versionswechsel mitten in einer Session
// niemanden aussperrt.
function istVerifiziert(stamp) {
  if (typeof stamp.verified === 'boolean') return stamp.verified;
  return Boolean(stamp.branch && stamp.head);
}

function heartbeat(file, stamp) {
  try {
    if (Date.now() - (Number(stamp.last_active) || 0) > HEARTBEAT_MS) {
      stamp.last_active = Date.now();
      fs.writeFileSync(file, JSON.stringify(stamp, null, 2), 'utf8');
    }
  } catch (_) { /* Heartbeat-Fehler ist kein Gate-Fehler */ }
}

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  }));
}

// Gate-Text: enthaelt den EXAKTEN Stempel-Befehl samt Session-Schluessel — der Agent
// soll ihn nicht raten muessen. Bewusst OHNE Abschalt-Hinweis.
function startMsg(sessionKey) {
  return '[Start-Gate] Kein Blind-Start (Gate 2): Diese Session hat /nc-felix:start noch nicht '
    + 'abgeschlossen. Ablauf: (1) /nc-felix:start ausführen — Stand, jüngstes Journal, Git-Lage, '
    + 'Projekt-Doku (WP0). (2) Als Abschluss den Fakten-Stempel setzen: '
    + 'node "' + STEMPEL_SKRIPT + '" --session ' + sessionKey
    + ' --branch <branch> --head <head> — Branch und HEAD aus der realen Git-Lage '
    + '(git rev-parse --abbrev-ref HEAD · git rev-parse --short HEAD); außerhalb eines '
    + 'Git-Baums entfallen beide. Lesen und Fragen bleiben frei. '
    + 'Danach DENSELBEN Aufruf wiederholen.';
}

// Ablehnung, wenn ein ungeprueft gesetzter Stempel in einem echten Git-Baum vorgelegt wird.
function ungeprueftMsg(sessionKey) {
  return '[Start-Gate] Der Stempel dieser Session wurde OHNE Git-Verifikation gesetzt '
    + '(er entstand außerhalb eines Git-Baums), dieses Verzeichnis ist aber eines. Damit ist '
    + 'die Git-Lage nie geprüft worden. Erneut stempeln — aus dem Projektverzeichnis heraus '
    + 'bzw. mit gesetztem CLAUDE_PROJECT_DIR: '
    + 'node "' + STEMPEL_SKRIPT + '" --session ' + sessionKey
    + ' --branch <branch> --head <head> (git rev-parse --abbrev-ref HEAD · '
    + 'git rev-parse --short HEAD). Lesen und Read-only-Git bleiben frei.';
}

function main() {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  if (isDisabled()) return;

  const TOOL_MAP = {
    edit: 'Edit', write: 'Write', multiedit: 'MultiEdit',
    notebookedit: 'NotebookEdit', bash: 'Bash'
  };
  const rawTool = String(input.tool_name || '');
  const tool = TOOL_MAP[rawTool.toLowerCase()];
  if (!tool) return; // Read/Glob/Grep/Fragen: Lesen bleibt frei

  if (isSubagentInvocation(input)) return;

  const sessionKey = resolveSessionKey(input);
  const file = stateFileFor(sessionKey);
  const stamp = loadStamp(file);
  if (stamp) {
    // Ein verifizierter Stempel oeffnet ueberall. Ein UNVERIFIZIERTER gilt nur dort, wo es
    // wirklich nichts zu verifizieren gab — sonst waere er per `cd` in ein Nicht-Git-
    // Verzeichnis erschlichen.
    if (istVerifiziert(stamp)) return heartbeat(file, stamp);
    const arbeitsDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    if (!istGitBaum(arbeitsDir)) return heartbeat(file, stamp);
    return deny(ungeprueftMsg(sessionKey));
  }

  if (tool === 'Bash') {
    const command = (input.tool_input && input.tool_input.command) || '';
    // Der Stempel-Befehl selbst muss durch — sonst kann das Gate nie oeffnen. Erkannt wird
    // eine ECHTE Invokation (verankert, ohne angehaengte Zweitaktion), nicht ein blosses
    // Vorkommen der Zeichenkette. Ein Missbrauch des Durchlasses (Stempeln ohne
    // /nc-felix:start) bleibt die dokumentierte Proxy-Grenze; der Fakten-Stempel verifiziert
    // Branch/HEAD dabei trotzdem gegen das Projektverzeichnis.
    if (istStempelBefehl(command)) return;
    if (isReadOnlyGitIntrospection(command)) return; // Pflicht-Einstieg selbst nie blocken
  }

  return deny(startMsg(sessionKey));
}

try {
  main();
} catch (e) {
  try { process.stderr.write('nc-start-gate fail-open: ' + (e && e.message)); } catch (_) { /* egal */ }
}
// Kein process.exit(): abgeschnittene Deny-JSON hiesse, das Gate blockt still nicht
// (POSIX-Pipe-Falle). exitCode 0 genuegt, nichts laeuft async.
process.exitCode = 0;
