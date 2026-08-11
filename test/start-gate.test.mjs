// Gate 2 des Felix-OS — Erzwingungs-Begleiter (nc-start-gate.js) und Fakten-Stempel
// (nc-start-stempel.js). Testfaelle T-13 bis T-15 des Bauplans 2026-08-11 (§6).
//
// Warum als Test: Gate 2 hat einen STILLEN Ausfallmodus. Ein Gate, das nicht mehr blockt,
// meldet sich nicht — es faellt erst auf, wenn ein Blind-Start Schaden angerichtet hat.
// Jede Zusage bekommt deshalb eine Negativprobe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATE = join(root, 'hooks', 'nc-start-gate.js');
const STEMPEL = join(root, 'hooks', 'nc-start-stempel.js');

/** Frisches, isoliertes State-Verzeichnis je Testfall. */
function frischerState() {
  return mkdtempSync(join(tmpdir(), 'nc-felix-gate-test-'));
}

/**
 * Gate mit einer Werkzeug-Eingabe aufrufen; liefert die geparste Antwort (oder null).
 *
 * NC_START_GATE wird HIER explizit geleert (nicht nur nicht gesetzt): Auf einer Maschine,
 * die den Opt-out global gesetzt hat, wuerde die geerbte Variable jede Zusage dieses Tests
 * still zu einem Selbstgespraech machen — die Suite waere gruen, obwohl das Gate gar nicht
 * laeuft. Genau dieser vakuum-gruene Zustand ist der Ausfallmodus, den Gate 2 hat.
 * Die Opt-out-Faelle setzen die Variable ueber `extraEnv` bewusst wieder.
 */
function rufeGate(eingabe, stateDir, extraEnv = {}) {
  const res = spawnSync(process.execPath, [GATE], {
    input: JSON.stringify(eingabe),
    encoding: 'utf8',
    env: {
      ...process.env,
      NC_START_GATE: '',
      NC_START_GATE_STATE_DIR: stateDir,
      ...extraEnv
    }
  });
  assert.equal(res.status, 0, `Gate endete mit Exitcode ${res.status} — fail-open verletzt`);
  const out = String(res.stdout || '').trim();
  return out ? JSON.parse(out) : null;
}

function istDeny(antwort) {
  return Boolean(antwort
    && antwort.hookSpecificOutput
    && antwort.hookSpecificOutput.permissionDecision === 'deny');
}

const SCHREIB_EINGABE = {
  tool_name: 'Write',
  session_id: 'test-session-t13',
  cwd: root,
  tool_input: { file_path: join(root, 'egal.md'), content: 'x' }
};

// ---------------------------------------------------------------------------
// T-13 — ohne Stempel kein Schreiben
// ---------------------------------------------------------------------------

test('T-13 Start-Gate lehnt Write ohne Stempel ab', () => {
  const state = frischerState();
  try {
    const antwort = rufeGate(SCHREIB_EINGABE, state);
    assert.ok(istDeny(antwort), 'ohne Stempel muss Write abgelehnt werden');
    const grund = antwort.hookSpecificOutput.permissionDecisionReason;
    assert.match(grund, /\/nc-felix:start/,
      'die Ablehnung muss den auszufuehrenden Skill nennen');
    assert.match(grund, /nc-start-stempel\.js/,
      'die Ablehnung muss den exakten Stempel-Befehl nennen — der Agent soll ihn nicht raten');
    assert.doesNotMatch(grund, /NC_START_GATE\s*=\s*off/i,
      'die Ablehnung darf den Abschalter NICHT bewerben');
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('T-13a Lesen bleibt frei — Read matcht das Gate nicht', () => {
  const state = frischerState();
  try {
    const antwort = rufeGate({ tool_name: 'Read', session_id: 's', cwd: root, tool_input: {} }, state);
    assert.equal(antwort, null, 'Read darf nie abgelehnt werden');
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('T-13b Opt-out NC_START_GATE=off oeffnet das Gate', () => {
  const state = frischerState();
  try {
    const antwort = rufeGate(SCHREIB_EINGABE, state, { NC_START_GATE: 'off' });
    assert.equal(antwort, null, 'mit gesetztem Opt-out darf nicht abgelehnt werden');
  } finally { rmSync(state, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// T-14 — ein Stempel mit falschem --head oeffnet nicht
// ---------------------------------------------------------------------------

test('T-14 Stempel mit falschem --head wird verweigert und oeffnet nicht', () => {
  const state = frischerState();
  try {
    const gestempelt = spawnSync(process.execPath, [
      STEMPEL, '--session', 'test-session-t14',
      '--branch', 'kein-solcher-branch', '--head', '0000000'
    ], {
      encoding: 'utf8',
      env: {
        ...process.env, NC_START_GATE: '',
        NC_START_GATE_STATE_DIR: state, CLAUDE_PROJECT_DIR: root
      }
    });

    assert.equal(gestempelt.status, 1,
      'ein Stempel mit falschen Fakten muss mit Exitcode 1 scheitern');
    assert.match(String(gestempelt.stderr || ''), /verweigert/i);
    assert.deepEqual(readdirSync(state), [],
      'ein verweigerter Stempel darf KEINE State-Datei hinterlassen');

    const antwort = rufeGate(
      { ...SCHREIB_EINGABE, session_id: 'test-session-t14' }, state);
    assert.ok(istDeny(antwort),
      'nach verweigertem Stempel muss das Gate weiter blocken');
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('T-14a Stempel mit korrekten Fakten oeffnet das Gate', () => {
  const state = frischerState();
  try {
    const branch = spawnSync('git', ['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD'],
      { encoding: 'utf8' }).stdout.trim();
    const head = spawnSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'],
      { encoding: 'utf8' }).stdout.trim();
    assert.ok(branch && head, 'Vorbedingung: dieses Repo ist ein Git-Baum');

    const gestempelt = spawnSync(process.execPath, [
      STEMPEL, '--session', 'test-session-t14a', '--branch', branch, '--head', head
    ], {
      encoding: 'utf8',
      env: {
        ...process.env, NC_START_GATE: '',
        NC_START_GATE_STATE_DIR: state, CLAUDE_PROJECT_DIR: root
      }
    });
    assert.equal(gestempelt.status, 0, String(gestempelt.stderr || ''));

    const antwort = rufeGate(
      { ...SCHREIB_EINGABE, session_id: 'test-session-t14a' }, state);
    assert.equal(antwort, null, 'mit gueltigem Stempel darf nicht mehr abgelehnt werden');
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('T-14b ein UNVERIFIZIERTER Stempel oeffnet nicht in einem echten Git-Baum', () => {
  // Die zentrale Zusage von Gate 2 gegen den `cd`-Trick: Ein Stempel, der ausserhalb eines
  // Git-Baums entstand (nichts zu verifizieren), darf das Gate NICHT fuer das echte Repo
  // oeffnen. Bis 2026-08-12 war das von keinem Test gedeckt — die Mutation
  // `const verified = true` liess die Suite gruen (Mutationsprobe, debug-log.md).
  const state = frischerState();
  const ohneGit = mkdtempSync(join(tmpdir(), 'nc-felix-ohne-git-'));
  try {
    const gestempelt = spawnSync(process.execPath, [STEMPEL, '--session', 'test-session-t14b'], {
      encoding: 'utf8',
      env: {
        ...process.env, NC_START_GATE: '',
        NC_START_GATE_STATE_DIR: state, CLAUDE_PROJECT_DIR: ohneGit
      }
    });
    assert.equal(gestempelt.status, 0, String(gestempelt.stderr || ''));
    assert.match(String(gestempelt.stdout || ''), /nichts zu verifizieren/i,
      'Vorbedingung: der Stempel entstand ausserhalb eines Git-Baums');

    // Dort, wo es wirklich nichts zu verifizieren gibt, gilt er weiterhin …
    const frei = rufeGate({
      ...SCHREIB_EINGABE, session_id: 'test-session-t14b', cwd: ohneGit,
      tool_input: { file_path: join(ohneGit, 'egal.md'), content: 'x' }
    }, state, { CLAUDE_PROJECT_DIR: '' });
    assert.equal(frei, null,
      'ausserhalb eines Git-Baums muss der unverifizierte Stempel gelten');

    // … aber im echten Repo nicht.
    const geblockt = rufeGate(
      { ...SCHREIB_EINGABE, session_id: 'test-session-t14b', cwd: root },
      state, { CLAUDE_PROJECT_DIR: '' });
    assert.ok(istDeny(geblockt),
      'ein ungeprueft gesetzter Stempel darf das echte Repo NICHT oeffnen');
    assert.match(geblockt.hookSpecificOutput.permissionDecisionReason, /OHNE Git-Verifikation/i,
      'die Ablehnung muss den Grund benennen, damit erneut gestempelt werden kann');
  } finally {
    rmSync(state, { recursive: true, force: true });
    rmSync(ohneGit, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// T-15 — der Stempel-Durchlass verwirft angehaengte Zweitaktionen
// ---------------------------------------------------------------------------

test('T-15 Stempel-Durchlass verwirft angehaengte Zweitaktionen', () => {
  const state = frischerState();
  const basis = `node "${STEMPEL}" --session s --branch main --head abcdefg`;
  const angehaengt = [
    `${basis}; echo pwned > /tmp/x`,
    `${basis} && echo pwned > /tmp/x`,
    `${basis} | tee /tmp/x`,
    `${basis} $(echo pwned)`,
    `${basis}\necho pwned > /tmp/x`,
    `${basis} > /tmp/x`,
    `echo pwned > /tmp/x   # ${STEMPEL}`,
    `node "/anderswo/my-nc-start-stempel.js" --session s`
  ];
  try {
    for (const command of angehaengt) {
      const antwort = rufeGate({
        tool_name: 'Bash', session_id: 'test-session-t15', cwd: root,
        tool_input: { command }
      }, state);
      assert.ok(istDeny(antwort),
        `der Durchlass haette geoeffnet fuer: ${JSON.stringify(command)}`);
    }

    // Gegenprobe (Fehlalarm-Kontrolle): die nackte, einzeilige Invokation MUSS durch —
    // sonst koennte das Gate nie geoeffnet werden.
    const durchlass = rufeGate({
      tool_name: 'Bash', session_id: 'test-session-t15', cwd: root,
      tool_input: { command: basis }
    }, state);
    assert.equal(durchlass, null,
      'die reine Stempel-Invokation muss durchgelassen werden, sonst oeffnet das Gate nie');
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('T-15b Durchlass verwirft ein LOKALES Programm namens node (Interpreter-Identitaet)', () => {
  // Der Codex-Befund vom 2026-08-11: `./node "<echter Stempelpfad>"` war ein Kanal fuer
  // beliebigen Code durch Gate 2, weil nur der Basisname verglichen wurde. Der Fix prueft
  // Realpath-Identitaet mit dem laufenden Interpreter — bis 2026-08-12 ohne Regressionstest
  // (die Mutation „nur Basename" liess T-15 gruen, Mutationsprobe in debug-log.md).
  const state = frischerState();
  const koeder = mkdtempSync(join(tmpdir(), 'nc-felix-koeder-'));
  try {
    for (const name of ['node', 'node.exe']) {
      writeFileSync(join(koeder, name), '#!/bin/sh\necho pwned\n');
    }
    for (const name of ['node', 'node.exe']) {
      const command = `"${join(koeder, name)}" "${STEMPEL}" --session s --branch main --head abcdefg`;
      const antwort = rufeGate({
        tool_name: 'Bash', session_id: 'test-session-t15b', cwd: root,
        tool_input: { command }
      }, state);
      assert.ok(istDeny(antwort),
        `ein lokales Programm namens ${name} darf den Durchlass nicht oeffnen`);
    }

    // Gegenprobe: der ECHTE Interpreter mit explizitem Pfad MUSS durch — sonst waere der
    // Fix eine Sperre statt einer Identitaetspruefung.
    const echt = rufeGate({
      tool_name: 'Bash', session_id: 'test-session-t15b', cwd: root,
      tool_input: { command: `"${process.execPath}" "${STEMPEL}" --session s --branch main --head abcdefg` }
    }, state);
    assert.equal(echt, null, 'der echte Node-Interpreter muss mit explizitem Pfad durchkommen');
  } finally {
    rmSync(state, { recursive: true, force: true });
    rmSync(koeder, { recursive: true, force: true });
  }
});

test('T-15c abschliessender Zeilenumbruch sperrt den Durchlass nicht aus', () => {
  // Ein Gate, dessen EINZIGER Oeffner an einem angehaengten `\n` scheitert, ist nicht
  // fail-safe, sondern nicht mehr entsperrbar. Abschliessender Leerraum ist in der Shell
  // bedeutungslos; ein Zeilenumbruch MITTEN im Befehl bleibt eine zweite Aktion (T-15).
  const state = frischerState();
  const basis = `node "${STEMPEL}" --session s --branch main --head abcdefg`;
  try {
    for (const command of [basis + '\n', basis + '\r\n', basis + '  \n']) {
      const antwort = rufeGate({
        tool_name: 'Bash', session_id: 'test-session-t15c', cwd: root,
        tool_input: { command }
      }, state);
      assert.equal(antwort, null,
        `abschliessender Leerraum darf den Durchlass nicht sperren: ${JSON.stringify(command)}`);
    }
    // Negativprobe: ein Zeilenumbruch mit Inhalt danach bleibt eine Zweitaktion.
    const zweitaktion = rufeGate({
      tool_name: 'Bash', session_id: 'test-session-t15c', cwd: root,
      tool_input: { command: basis + '\necho pwned' }
    }, state);
    assert.ok(istDeny(zweitaktion), 'ein zweites Kommando nach dem Umbruch muss blocken');
  } finally { rmSync(state, { recursive: true, force: true }); }
});

test('T-15a Read-only-Git bleibt auch ohne Stempel frei', () => {
  const state = frischerState();
  try {
    const pflichtEinstieg = [
      'git status', 'git log --oneline -10', 'git rev-parse --short HEAD',
      // Bei mehreren Baeumen verlangt AGENTS.md zusaetzlich diese beiden Formen; vorher
      // liefen genau sie ins Gate (Review-Befund Codex 2026-08-11).
      'git worktree list', 'git worktree list --porcelain',
      'git -C /anderer/baum status --short', 'git -C /anderer/baum log --oneline -10'
    ];
    for (const command of pflichtEinstieg) {
      const antwort = rufeGate({
        tool_name: 'Bash', session_id: 'test-session-t15a', cwd: root,
        tool_input: { command }
      }, state);
      assert.equal(antwort, null,
        `Pflicht-Einstieg darf nie gegated werden: ${command}`);
    }
    // Negativproben: schreibende bzw. umgeleitete Formen duerfen NICHT durchrutschen —
    // sonst waere die Erweiterung eine Luecke statt einer Praezisierung.
    const muessenBlocken = [
      'git log --oneline -10 > out.txt',   // Umleitung schreibt
      'git worktree add ../neuer-baum',    // veraendert den Zustand
      'git worktree remove ../alter-baum',
      'git worktree prune',
      'git -C /anderer/baum commit -m x'   // -C darf kein Freibrief sein
    ];
    for (const command of muessenBlocken) {
      const antwort = rufeGate({
        tool_name: 'Bash', session_id: 'test-session-t15a', cwd: root,
        tool_input: { command }
      }, state);
      assert.ok(istDeny(antwort), `haette blocken muessen: ${command}`);
    }
  } finally { rmSync(state, { recursive: true, force: true }); }
});
