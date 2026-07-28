#!/usr/bin/env node
// nc-ffg.js — Fact-Forcing-Gate (FFG) des NovaCore-OS (Design-Spec 2026-07-28 §5 (OS-Repo)).
// PreToolUse-Hook nach GateGuard-Vorbild (ECC ecc@2.0.0, gateguard-fact-force.js,
// gelesen 2026-07-26; Upstream-Stand des ECC-Repos nachgezogen 2026-07-27). Drei Gates:
//   - Edit/Write/MultiEdit: Fakten einmal je Zieldatei, mit getrennten Investigations-
//                      Texten fuer Aenderung (Importer/API) und Neuanlage (Aufrufer/
//                      Duplikat-Check); Subagenten uebersprungen (der Parent hat die
//                      Datei bereits gegated); .claude/settings*.json ausgenommen
//                      (Reparatur-Arbeiten nie aussperren); Betreiber-Ausnahmen per
//                      NC_FFG_EXEMPT_GLOBS (Komma-getrennte Globs). MultiEdit steht
//                      nicht mehr in der offiziellen Hook-Doku (code.claude.com/docs/
//                      en/hooks, abgerufen 2026-07-27) und bleibt rein defensiv fuer
//                      aeltere Claude-Code-Versionen/Fremd-Hosts gegated (Vorbild-
//                      Verhalten).
//   - Bash destruktiv: jedes destruktive Kommando einzeln (je Kommando-Hash, ganze
//                      Session) — rm -rf, git reset --hard / push --force / clean -f /
//                      checkout -- / commit --amend / switch -f, drop table, dd if=,
//                      find -exec rm, sh/bash -c-Wrapper, gequotete Kommandowoerter,
//                      Newline-Trenner (GHSA-4v57-ph3x-gf55), plus Betreiber-Muster
//                      aus NC_FFG_EXTRA_DESTRUCTIVE
//   - Bash routine:    einmal je Session; Read-only-Git-Introspektion nie gegated
// Volltext-Budget (Vorbild #2142): nur die ersten NC_FFG_FULL_DENIALS (Default 3)
// Datei-Gate-Verweigerungen je Session erhalten den vollen Faktenblock; danach ein
// kondensierter Einzeiler mit Ordinal, damit sich Verweigerungen textuell unter-
// scheiden und keine Wiederholungsschleifen im Kontext entstehen.
// Aktiv ueberall, wo das Plugin installiert ist (markerlos, Design-Spec 2026-07-28 §5
// (OS-Repo)); Opt-out AUSSCHLIESSLICH per Env: NC_FFG=off (bzw. 0/false/disabled).
// Bewusst KEIN "allow"-Output bei erfuellter Pflicht: der normale Permission-Flow
// des Nutzers wird nie umgangen (das FFG verschaerft, es lockert nie). Fail-open:
// ein defekter Hook oder nicht schreibbarer State darf kein Repo lahmlegen.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isDestructiveBash, isReadOnlyGitIntrospection } = require('./lib/bash-analyse');

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // State verfaellt nach 30 Min Inaktivitaet
const READ_HEARTBEAT_MS = 60 * 1000;       // last_active hoechstens einmal je Minute auffrischen
const MAX_CHECKED_ENTRIES = 500;           // Obergrenze gegen unbegrenztes State-Wachstum
const MAX_SESSION_KEYS = 50;               // davon maximal so viele __…__-Session-Keys
const ROUTINE_BASH_KEY = '__bash_session__';
const OFF_VALUES = new Set(['0', 'false', 'off', 'disabled', 'disable']);
const DEFAULT_FULL_DENIALS = 3; // Volltext-Verweigerungen je Session (Vorbild #2142)

function readStdin() {
  return fs.readFileSync(0, 'utf8');
}

function normalizeEnvValue(value) {
  return String(value || '').trim().toLowerCase();
}

function isFfgDisabled() {
  return OFF_VALUES.has(normalizeEnvValue(process.env.NC_FFG));
}

// --- State: je Session eine Datei, atomare Writes, Timeout, Groessengrenzen ---

function stateDir() {
  if (process.env.NC_FFG_STATE_DIR) return process.env.NC_FFG_STATE_DIR;
  if (process.env.CLAUDE_PLUGIN_DATA) return path.join(process.env.CLAUDE_PLUGIN_DATA, 'ffg');
  return path.join(os.tmpdir(), 'nc-ffg');
}

function hashSessionKey(prefix, value) {
  return prefix + '-' + crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

function sanitizeSessionKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Nur unveraendert-saubere IDs direkt verwenden: jede Zeichen-Ersetzung koennte
  // zwei reale Sessions (a/b vs. a_b) auf denselben Key falten — dann lieber
  // hashen (Review-Haertung 2026-07-28 gegenueber dem Vorbild).
  if (sanitized === raw && sanitized.length <= 64) return sanitized;
  return hashSessionKey('sid', raw);
}

// Session-Schluessel aufloesen: session_id → Transcript-Pfad → Projekt-Fingerprint.
function resolveSessionKey(input) {
  const direct = sanitizeSessionKey((input && input.session_id) || process.env.CLAUDE_SESSION_ID);
  if (direct) return direct;

  const transcriptPath = input && input.transcript_path;
  if (transcriptPath && String(transcriptPath).trim()) {
    return hashSessionKey('tx', path.resolve(String(transcriptPath).trim()));
  }

  const projectFingerprint = process.env.CLAUDE_PROJECT_DIR || (input && input.cwd) || process.cwd();
  return hashSessionKey('proj', path.resolve(projectFingerprint));
}

let activeStateFile = null;

function initStateFile(input) {
  activeStateFile = path.join(stateDir(), 'session-' + resolveSessionKey(input) + '.json');
}

function loadState() {
  try {
    if (fs.existsSync(activeStateFile)) {
      const state = JSON.parse(fs.readFileSync(activeStateFile, 'utf8'));
      if (!Array.isArray(state.checked)) {
        // Altes/fremdes Format (z. B. FFG v1 als Objekt-Map) — frisch starten.
        return { checked: [], last_active: Date.now() };
      }
      const lastActive = state.last_active || 0;
      if (Date.now() - lastActive > SESSION_TIMEOUT_MS) {
        try { fs.unlinkSync(activeStateFile); } catch (_) { /* egal */ }
        return { checked: [], last_active: Date.now() };
      }
      return state;
    }
  } catch (_) { /* defekter State zaehlt als leer */ }
  return { checked: [], last_active: Date.now() };
}

function pruneCheckedEntries(checked) {
  if (checked.length <= MAX_CHECKED_ENTRIES) return checked;
  const preserved = checked.includes(ROUTINE_BASH_KEY) ? [ROUTINE_BASH_KEY] : [];
  const sessionKeys = checked.filter(k => k.startsWith('__') && k !== ROUTINE_BASH_KEY);
  const fileKeys = checked.filter(k => !k.startsWith('__'));
  const remainingSessionSlots = Math.max(MAX_SESSION_KEYS - preserved.length, 0);
  const cappedSession = sessionKeys.slice(-remainingSessionSlots);
  const remainingFileSlots = Math.max(MAX_CHECKED_ENTRIES - preserved.length - cappedSession.length, 0);
  const cappedFiles = fileKeys.slice(-remainingFileSlots);
  return [...preserved, ...cappedSession, ...cappedFiles];
}

function saveState(state) {
  let tmpFile = null;
  try {
    fs.mkdirSync(stateDir(), { recursive: true });

    let mergedChecked = Array.isArray(state.checked) ? state.checked : [];
    let mergedLastActive = typeof state.last_active === 'number' ? state.last_active : 0;
    let mergedDenials = getDenialCount(state);

    try {
      if (fs.existsSync(activeStateFile)) {
        const diskState = JSON.parse(fs.readFileSync(activeStateFile, 'utf8'));
        if (Array.isArray(diskState.checked)) {
          mergedChecked = Array.from(new Set([...diskState.checked, ...mergedChecked]));
        }
        if (typeof diskState.last_active === 'number') {
          mergedLastActive = Math.max(mergedLastActive, diskState.last_active);
        }
        mergedDenials = Math.max(mergedDenials, getDenialCount(diskState));
      }
    } catch (_) { /* defekter Disk-State wird ueberschrieben */ }

    const finalState = {
      checked: pruneCheckedEntries(mergedChecked),
      last_active: Math.max(mergedLastActive, Date.now()),
      fact_force_denials: mergedDenials
    };

    // Atomarer Write: Temp-Datei + Rename verhindert halb geschriebene Reads.
    tmpFile = activeStateFile + '.tmp.' + process.pid + '.' + crypto.randomBytes(4).toString('hex');
    fs.writeFileSync(tmpFile, JSON.stringify(finalState, null, 2), 'utf8');
    try {
      fs.renameSync(tmpFile, activeStateFile);
    } catch (error) {
      if (error && (error.code === 'EEXIST' || error.code === 'EPERM')) {
        try { fs.unlinkSync(activeStateFile); } catch (_) { /* egal */ }
        fs.renameSync(tmpFile, activeStateFile);
      } else {
        throw error;
      }
    }
    tmpFile = null;
    return true;
  } catch (_) {
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch (_) { /* egal */ }
    }
    return false;
  }
}

function markChecked(key) {
  const state = loadState();
  if (!state.checked.includes(key)) {
    state.checked.push(key);
    return saveState(state);
  }
  return true;
}

// --- Volltext-Budget fuer Datei-Gate-Verweigerungen (Vorbild #2142) ---
// In langen Sessions sammeln sich fast identische Faktenblock-Denies im Kontext
// und beguenstigen degenerierte Wiederholungsschleifen. Nur die ersten N Denies
// je Session bekommen den Volltext; danach ein kondensierter Einzeiler mit
// Ordinal. Echte Wiederholungen bereits gegateter Ziele bleiben unberuehrt;
// Destruktiv- und Routine-Bash-Gates sind unveraendert.

function getFullDenialBudget() {
  const raw = Number.parseInt(process.env.NC_FFG_FULL_DENIALS || '', 10);
  if (Number.isInteger(raw) && raw >= 0) return raw;
  return DEFAULT_FULL_DENIALS;
}

function getDenialCount(state) {
  const n = Number(state && state.fact_force_denials);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// Erst-Kontakt-Ziel vermerken UND die Verweigerung im selben State-Write zaehlen.
// Liefert das neue Ordinal (1-basiert) plus den Persistenz-Status.
function markCheckedAndCountDenial(key) {
  const state = loadState();
  if (!state.checked.includes(key)) {
    state.checked.push(key);
  }
  const denials = getDenialCount(state) + 1;
  state.fact_force_denials = denials;
  return { ok: saveState(state), denials };
}

function isChecked(key) {
  const state = loadState();
  const found = state.checked.includes(key);
  if (found && Date.now() - (state.last_active || 0) > READ_HEARTBEAT_MS) {
    saveState(state);
  }
  return found;
}

// Verwaiste Session-Dateien aufraeumen (aelter als 2x Timeout).
function pruneStaleFiles() {
  try {
    const dir = stateDir();
    const files = fs.readdirSync(dir);
    const now = Date.now();
    for (const f of files) {
      const isStateFile = f.startsWith('session-') && (f.endsWith('.json') || f.includes('.json.tmp.'));
      if (!isStateFile) continue;
      const fp = path.join(dir, f);
      try {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > SESSION_TIMEOUT_MS * 2) {
          fs.unlinkSync(fp);
        }
      } catch (_) { /* Datei kann zwischen readdir/stat/unlink verschwinden */ }
    }
  } catch (_) { /* kein State-Verzeichnis = nichts zu tun */ }
}

// --- Ausnahmen ---

function normalizeForMatch(value) {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

// Edit/Write auf .claude/settings*.json nie gaten — Reparaturen an den eigenen
// Einstellungen duerfen nicht in eine Gate-Schleife laufen (Vorbild-Verhalten).
function isClaudeSettingsPath(filePath) {
  return /(^|\/)\.claude\/settings(?:\.[^/]+)?\.json$/.test(normalizeForMatch(filePath));
}

// Betreiber-Ausnahmen fuers Datei-Gate: Komma-getrennte Globs aus
// NC_FFG_EXEMPT_GLOBS, gematcht gegen den normalisierten (Forward-Slash,
// lowercase) Pfad. Gedacht fuer Baeume ohne Investigations-Signal (Tests,
// Generate, Scratch). `*` matcht innerhalb eines Segments, `**` ueber
// Segmente, `?` ein Zeichen. Fehlerhafte Muster fallen stumm weg (fail-open,
// Konfig-Fehler duerfen nie die Tool-Ausfuehrung crashen).
function getExemptMatchers() {
  const raw = process.env.NC_FFG_EXEMPT_GLOBS || '';
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(glob => {
      const source = glob
        .toLowerCase()                         // Pfade werden lowercase gematcht — Muster auch
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Regex-Metazeichen escapen, * und ? behalten
        .split('**')                           // `**`-Grenzen (segmentuebergreifend)
        .map(part => part.replace(/\*/g, '[^/]*').replace(/\?/g, '.'))
        .join('.*');                           // `**` → ueber Segmente hinweg
      try {
        // Voll verankert: ein Glob exemptet nur den GANZEN Pfad, nie per Substring.
        // (Review-Haertung 2026-07-28 gegenueber dem Vorbild: unverankert haette
        // `*.md` auch `foo.md.bak` oder `x.md/evil.js` freigestellt.)
        return new RegExp('^' + source + '$');
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function isExemptPath(filePath) {
  const norm = normalizeForMatch(filePath);
  return getExemptMatchers().some(re => re.test(norm));
}

// Pfad fuer die Gate-Meldung entschaerfen: Steuerzeichen (inkl. NUL), Bidi-
// Overrides und Newlines raus, Laenge gedeckelt (Vorbild-Verhalten).
function sanitizePath(filePath) {
  let sanitized = '';
  for (const char of String(filePath || '')) {
    const code = char.codePointAt(0);
    const isAsciiControl = code <= 0x1f || code === 0x7f;
    const isBidiOverride = (code >= 0x200e && code <= 0x200f)
      || (code >= 0x202a && code <= 0x202e)
      || (code >= 0x2066 && code <= 0x2069);
    sanitized += isAsciiControl || isBidiOverride ? ' ' : char;
  }
  return sanitized.trim().slice(0, 500);
}

// Subagenten-Kennung laut offizieller Hook-Doku (agent_id/agent_type, verifiziert
// code.claude.com/docs/en/hooks, abgerufen 2026-07-26). Datei-Gates entfallen dort —
// der Parent hat die Datei bereits gegated; Bash-Gates gelten weiterhin.
function isSubagentInvocation(input) {
  if (!input || typeof input !== 'object') return false;
  return [input.agent_id, input.agent_type]
    .some(v => typeof v === 'string' && v.trim());
}

// --- Gate-Texte (deutsch; bewusst OHNE Abschalt-Hinweis — Schicht 5 raeumt der
// KI kein Mitspracherecht ein, der Env-Schalter ist fuer Menschen dokumentiert) ---

// Edit-Gate: erzwingt Investigation der BESTEHENDEN Datei (Vorbild-Checkliste,
// werkzeug-agnostisch formuliert — Glob/Grep oder find/grep via Bash).
function editMsg(filePath) {
  const safe = sanitizePath(filePath);
  return '[FFG] Fakten vorlegen vor der ersten Änderung an ' + safe + ': '
    + '(1) ALLE Dateien auflisten, die diese Datei importieren/referenzieren (Suche im Baum: Glob/Grep oder find/grep via Bash). '
    + '(2) Die von der Änderung betroffenen öffentlichen Funktionen/Abschnitte nennen. '
    + '(3) Falls die Datei Datendateien liest/schreibt: Feldnamen, Struktur und Datumsformat zeigen (redigierte oder synthetische Werte, keine echten Daten). '
    + '(4) Die aktuelle Anweisung des Nutzers wörtlich zitieren. '
    + 'Fakten im Antworttext nennen, dann DENSELBEN Aufruf wiederholen.';
}

// Write-Gate: erzwingt Einordnung der NEUEN Datei (Aufrufer + Duplikat-Check).
function writeMsg(filePath) {
  const safe = sanitizePath(filePath);
  return '[FFG] Fakten vorlegen vor dem Anlegen von ' + safe + ': '
    + '(1) Datei(en) und Stelle(n) nennen, die die neue Datei aufrufen/einbinden werden. '
    + '(2) Bestätigen, dass keine bestehende Datei denselben Zweck erfüllt (Suche im Baum: Glob/Grep oder find/grep via Bash). '
    + '(3) Falls die Datei Datendateien liest/schreibt: Feldnamen, Struktur und Datumsformat zeigen (redigierte oder synthetische Werte, keine echten Daten). '
    + '(4) Die aktuelle Anweisung des Nutzers wörtlich zitieren. '
    + 'Fakten im Antworttext nennen, dann DENSELBEN Aufruf wiederholen.';
}

// Kondensierter Einzeiler nach verbrauchtem Volltext-Budget (Vorbild #2142).
// Das Ordinal macht aufeinanderfolgende Verweigerungen textuell verschieden.
// Bewusst OHNE Abschalt-Hinweis (Schicht 5, wie alle Gate-Texte hier).
function condensedMsg(aktion, filePath, ordinal) {
  const safe = sanitizePath(filePath);
  return '[FFG] (Verweigerung #' + ordinal + ' dieser Session) Erste ' + aktion + ' von ' + safe + ': '
    + 'kurz Importer/Aufrufer, betroffene API, ggf. Datenschema und die wörtliche '
    + 'Nutzer-Anweisung nennen, dann DENSELBEN Aufruf wiederholen.';
}

function routineMsg() {
  return '[FFG] Fakten vorlegen vor dem ersten Bash-Befehl dieser Session: '
    + '(1) Auftrag des Nutzers in einem Satz. '
    + '(2) Was dieser Aufruf konkret bewirkt oder verifiziert. '
    + '(3) Beleg für die zentrale Annahme (Datei:Zeile, Befehl-Output oder Quelle). '
    + 'Fakten im Antworttext nennen, dann DENSELBEN Aufruf wiederholen.';
}

function destruktivMsg() {
  return '[FFG] Destruktiver Befehl erkannt. Vor der Ausführung vorlegen: '
    + '(1) Alle Dateien/Daten, die dieser Befehl ändert oder löscht. '
    + '(2) Rollback-Weg in einem Satz. '
    + '(3) Die Anweisung des Nutzers, die genau das verlangt, wörtlich zitieren. '
    + 'Fakten im Antworttext nennen, dann DENSELBEN Aufruf wiederholen.';
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

// State nicht schreibbar → durchlassen statt Endlos-Deny-Schleife (Warnung auf stderr).
function allowMitStateWarnung() {
  try {
    process.stderr.write('[nc-ffg] State nicht schreibbar — Aktion wird ohne Gate '
      + 'durchgelassen, um keine Dauerschleife zu erzeugen. NC_FFG_STATE_DIR/'
      + 'CLAUDE_PLUGIN_DATA und Dateirechte pruefen.\n');
  } catch (_) { /* egal */ }
}

// Datei-Gate fuer EIN Ziel. Rueckgabe: 'pass' (durchlassen), 'state-fehler'
// (State nicht schreibbar) oder der Deny-Text. `istEdit` steuert Text-Variante.
function fileGateDecision(f, istEdit) {
  if (!f || isClaudeSettingsPath(f) || isExemptPath(f)) return 'pass';
  // Case-Folding nur auf case-insensitiven Plattformen (win32/darwin-Default) —
  // auf Linux sind Foo.md und foo.md verschiedene Dateien und brauchen getrennte
  // Gates (Review-Haertung 2026-07-28 gegenueber dem Vorbild).
  const resolved = path.resolve(String(f));
  const foldCase = process.platform === 'win32' || process.platform === 'darwin';
  const key = 'file:' + (foldCase ? resolved.toLowerCase() : resolved);
  if (isChecked(key)) return 'pass'; // Fakten wurden vorgelegt → normaler Flow
  const { ok, denials } = markCheckedAndCountDenial(key);
  if (!ok) return 'state-fehler';
  if (denials > getFullDenialBudget()) {
    return condensedMsg(istEdit ? 'Änderung' : 'Anlage', f, denials);
  }
  return istEdit ? editMsg(f) : writeMsg(f);
}

function main() {
  const input = JSON.parse(readStdin());
  if (isFfgDisabled()) return;

  // Tool-Namen case-insensitiv normalisieren (Vorbild-Verhalten; Fremd-Hosts
  // senden teils Kleinschreibung).
  const TOOL_MAP = { edit: 'Edit', write: 'Write', multiedit: 'MultiEdit', bash: 'Bash' };
  const rawTool = String(input.tool_name || '');
  const tool = TOOL_MAP[rawTool.toLowerCase()] || rawTool;
  if (tool !== 'Bash' && tool !== 'Edit' && tool !== 'Write' && tool !== 'MultiEdit') return;

  initStateFile(input);
  pruneStaleFiles();

  if (tool === 'Edit' || tool === 'Write') {
    if (isSubagentInvocation(input)) return;
    const f = input.tool_input && input.tool_input.file_path;
    const decision = fileGateDecision(f, tool === 'Edit');
    if (decision === 'pass') return;
    if (decision === 'state-fehler') return allowMitStateWarnung();
    return deny(decision);
  }

  if (tool === 'MultiEdit') {
    if (isSubagentInvocation(input)) return;
    const edits = (input.tool_input && input.tool_input.edits) || [];
    for (const edit of edits) {
      const decision = fileGateDecision(edit && edit.file_path, true);
      if (decision === 'pass') continue;
      if (decision === 'state-fehler') return allowMitStateWarnung();
      return deny(decision); // erste ungegatete Datei blockt; Rest beim Retry
    }
    return;
  }

  // Bash
  const command = (input.tool_input && input.tool_input.command) || '';
  if (isReadOnlyGitIntrospection(command)) return;

  if (isDestructiveBash(command)) {
    const key = '__destruktiv__' + crypto.createHash('sha256').update(String(command)).digest('hex').slice(0, 16);
    if (isChecked(key)) return; // Wiederholung nach Fakten-Vorlage
    if (!markChecked(key)) return allowMitStateWarnung();
    return deny(destruktivMsg());
  }

  if (isChecked(ROUTINE_BASH_KEY)) return;
  if (!markChecked(ROUTINE_BASH_KEY)) return allowMitStateWarnung();
  return deny(routineMsg());
}

try {
  main();
} catch (e) {
  try { process.stderr.write('nc-ffg fail-open: ' + (e && e.message)); } catch (_) { /* egal */ }
}
process.exit(0);
