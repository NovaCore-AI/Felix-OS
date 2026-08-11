#!/usr/bin/env node
// nc-start-stempel.js — Abschluss-Stempel des Session-Start-Zwangs (Gate 2, Teil 3).
// Port aus dem NovaCore-Kern `nc` (Bauplan 2026-08-11, AP7); die Kern-Fassung wurde beim
// Bau gelesen, nicht rekonstruiert. Wird von /nc-felix:start als LETZTER Ablaufschritt
// ausgefuehrt und oeffnet das Start-Gate (nc-start-gate.js) fuer schreibende Aktionen
// dieser Session.
//
// FAKTEN-STEMPEL: Der Aufrufer muss --branch und --head aus der REALEN Git-Lage mitgeben;
// das Skript verifiziert beide gegen `git rev-parse`. Wer stempeln will, muss also
// mindestens die Git-Lage wirklich angesehen haben — so nah an „Readings erzwingen", wie
// es deterministisch geht.
// Ehrliche Grenze (dokumentiert): Ein Hook/Skript kann nicht beweisen, dass der Skill
// inhaltlich lief; der Stempel ist der Proxy. Wer ihn ohne /nc-felix:start setzt, umgeht
// das Gate so bewusst wie per NC_START_GATE=off.
//
// Aufruf (den exakten Befehl nennen Session-Start-Injektion und Gate-Ablehnung):
//   node nc-start-stempel.js --session <key> --branch <branch> --head <sha>
// Ausserhalb eines Git-Baums entfallen --branch/--head (nichts zu verifizieren).
// Exit 0 = gestempelt; Exit 1 = verweigert (Fakten stimmen nicht / --session fehlt).
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sanitizeSessionKey } = require('./lib/session-key');

const GIT_TIMEOUT_MS = 2000;

// State-Ablage des Start-Gates (getrennt vom FFG-State: eigene Pruefung, eigener State).
// EIGENES Verzeichnis je OS der Familie ('nc-felix-start-gate'), damit ein parallel
// installiertes Geschwister-OS nicht denselben Stempel liest oder ueberschreibt.
//
// BEWUSST OHNE CLAUDE_PLUGIN_DATA (anders als das FFG, wo Schreiber und Leser derselbe
// Hook-Prozess sind): Den Stempel schreibt der Agent aus dem Bash-Tool, gelesen wird im
// Hook-Prozess — zwei Prozesse mit VERSCHIEDENEM Env. CLAUDE_PLUGIN_DATA zeigt im Hook
// auf das Datenverzeichnis DIESES Plugins, im Bash-Tool dagegen auf nichts oder auf das
// eines anderen installierten Plugins (im Vorbild belegt: der Stempel landete unsichtbar
// neben dem Gate, Dauer-Deadlock trotz Erfolgsmeldung).
// os.tmpdir() ist in beiden Prozessen derselbe Nutzer-Temp-Pfad, und der Stempel ist
// ephemer (30-Min-Verfall) — Persistenz braucht er nicht. NC_START_GATE_STATE_DIR
// bleibt als expliziter Override (Tests); wer ihn setzt, muss ihn beiden Prozessen geben.
function stateDir() {
  if (process.env.NC_START_GATE_STATE_DIR) return process.env.NC_START_GATE_STATE_DIR;
  return path.join(os.tmpdir(), 'nc-felix-start-gate');
}

// Dateiname IMMER ueber sanitizeSessionKey — ein manipulierter --session-Wert
// ("../…") darf nie aus dem State-Verzeichnis herausfuehren.
function stateFileFor(sessionKey) {
  const safe = sanitizeSessionKey(sessionKey);
  return safe ? path.join(stateDir(), 'start-' + safe + '.json') : null;
}

// Bezugspunkt der Verifikation ist das PROJEKT, nicht das cwd des Stempel-Prozesses.
// Sonst liesse ein `cd <irgendwohin ohne .git>` die Pruefung ins Leere laufen: Der Stempel
// wuerde ungeprueft gesetzt und oeffnete das Gate fuer das ECHTE Repo. Ein `cd` darf die
// zentrale Zusage von Gate 2 nicht aushebeln.
function projektVerzeichnis() {
  const dir = String(process.env.CLAUDE_PROJECT_DIR || '').trim();
  return dir || process.cwd();
}

function git(args) {
  try {
    const out = execFileSync('git', ['-C', projektVerzeichnis(), ...args], {
      encoding: 'utf8', timeout: GIT_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true
    });
    const trimmed = String(out || '').trim();
    return trimmed || null;
  } catch (_) { return null; }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z]+)$/.exec(argv[i]);
    if (m && i + 1 < argv.length) { args[m[1]] = String(argv[++i]); }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const file = stateFileFor(args.session);
  if (!file) {
    process.stderr.write('[Start-Gate] Stempel verweigert: --session <key> fehlt. Den exakten '
      + 'Befehl (samt Schluessel) nennt die Session-Start-Injektion bzw. die Gate-Ablehnung.\n');
    process.exitCode = 1;
    return;
  }

  // `rev-parse --abbrev-ref HEAD` scheitert bei einem UNBORN HEAD (frisch initialisiertes
  // Repo ohne ersten Commit). Vorher entstand daraus ein Deadlock: Der Stempel wurde
  // `verified: false` gesetzt, das Gate erkannte das Verzeichnis aber sehr wohl als
  // Git-Baum und lehnte deshalb weiter ab — erneutes Stempeln konnte daran nichts aendern
  // (Review-Befund Codex 2026-08-11). `symbolic-ref` liefert den Branchnamen auch ohne
  // Commit; damit ist der Zustand pruefbar statt unentscheidbar.
  const echterBranch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
    || git(['symbolic-ref', '--short', 'HEAD']);
  const echterHead = git(['rev-parse', 'HEAD']);
  const imGitBaum = git(['rev-parse', '--is-inside-work-tree']) === 'true';

  if (echterBranch && !echterHead && imGitBaum) {
    // Unborn HEAD: Es gibt noch nichts zu vergleichen ausser dem Branch — genau das wird
    // geprueft, und der Stempel gilt als verifiziert.
    if (String(args.branch || '') !== echterBranch) {
      process.stderr.write('[Start-Gate] Stempel verweigert: --branch entspricht nicht der '
        + 'realen Git-Lage. Dieses Repo hat noch keinen Commit, deshalb entfaellt --head. '
        + 'Branch erheben (git symbolic-ref --short HEAD), dann erneut stempeln.\n');
      process.exitCode = 1;
      return;
    }
  } else if (echterBranch && echterHead) {
    const branchOk = String(args.branch || '') === echterBranch;
    const headArg = String(args.head || '').toLowerCase();
    const headOk = headArg.length >= 7 && echterHead.toLowerCase().startsWith(headArg);
    if (!branchOk || !headOk) {
      // Fakten-Stempel: Die Ablehnung nennt die reale Lage NICHT vollstaendig vor — der
      // Aufrufer soll sie selbst erheben (git rev-parse), nicht aus der Meldung kopieren.
      process.stderr.write('[Start-Gate] Stempel verweigert: --branch/--head entsprechen nicht '
        + 'der realen Git-Lage dieses Verzeichnisses. Erst die Lage erheben '
        + '(git rev-parse --abbrev-ref HEAD · git rev-parse --short HEAD), dann erneut stempeln. '
        + 'HEAD-Angabe braucht mindestens 7 Zeichen.\n');
      process.exitCode = 1;
      return;
    }
  }

  const now = Date.now();
  // `verified` haelt fest, OB ueberhaupt etwas geprueft wurde. Ohne dieses Feld kann das
  // Gate einen ungeprueften Stempel nicht von einem geprueften unterscheiden. Ein
  // unverifizierter Stempel bleibt gueltig, aber nur dort, wo es wirklich nichts zu
  // verifizieren gibt; das entscheidet das Gate.
  const verified = Boolean(echterBranch && (echterHead || imGitBaum));
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    stamped_at: now,
    last_active: now,
    verified,
    branch: echterBranch || null,
    head: echterHead ? echterHead.slice(0, 12) : null
  }, null, 2), 'utf8');
  process.stdout.write('[Start-Gate] Stempel gesetzt — Session-Start-Zwang erfuellt'
    + (verified
      ? ' (Branch ' + echterBranch
        + (echterHead ? ', HEAD ' + echterHead.slice(0, 7) : ', noch kein Commit') + ')'
      : ' (kein Git-Baum unter ' + projektVerzeichnis() + ' — nichts zu verifizieren)')
    + '. Schreibende Aktionen sind frei; rote Linien gelten unveraendert.\n');
}

module.exports = { stateDir, stateFileFor };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    try { process.stderr.write('[Start-Gate] Stempel-Fehler: ' + (e && e.message) + '\n'); } catch (_) { /* egal */ }
    process.exitCode = 1;
  }
}
