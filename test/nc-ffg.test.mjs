import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'nc-ffg.js');

const CLEAN_ENV = {
  NC_FFG: '', NC_FFG_EXTRA_DESTRUCTIVE: '', NC_FFG_STATE_DIR: '',
  NC_FFG_EXEMPT_GLOBS: '', NC_FFG_FULL_DENIALS: ''
};

function run(input, env) {
  return execFileSync(process.execPath, [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: Object.assign({}, process.env, CLEAN_ENV, env),
    encoding: 'utf8'
  });
}

// Wie run(), aber mit stderr-Zugriff (fuer den Nicht-schreibbar-Fall).
function runFull(input, env) {
  return spawnSync(process.execPath, [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: Object.assign({}, process.env, CLEAN_ENV, env),
    encoding: 'utf8'
  });
}

function freshDirs() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'ffg-proj-'));
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ffg-data-'));
  return { proj, data, env: { CLAUDE_PROJECT_DIR: proj, CLAUDE_PLUGIN_DATA: data } };
}

function inputFor(session, tool, toolInput, extra) {
  return Object.assign(
    { session_id: session, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: toolInput || {} },
    extra || {}
  );
}

function denyReason(out) {
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  return parsed.hookSpecificOutput.permissionDecisionReason;
}

test('Opt-out per NC_FFG=off: kein Eingriff', () => {
  const d = freshDirs();
  const out = run(inputFor('t-off', 'Bash', { command: 'ls' }),
    Object.assign({ NC_FFG: 'off' }, d.env));
  assert.equal(out, '');
});

test('ohne Marker aktiv: erste Routine-Bash geblockt, Wiederholung passiert', () => {
  const d = freshDirs();
  const first = denyReason(run(inputFor('t-bash', 'Bash', { command: 'npm test' }), d.env));
  assert.match(first, /\[FFG\]/);
  assert.doesNotMatch(first, /Destruktiver/);
  const second = run(inputFor('t-bash', 'Bash', { command: 'npm test' }), d.env);
  assert.equal(second, '');
});

test('Read-only-Git wird nie gegated, zaehlt aber nicht als Routine-Fakten', () => {
  const d = freshDirs();
  assert.equal(run(inputFor('t-ro', 'Bash', { command: 'git status --porcelain' }), d.env), '');
  assert.equal(run(inputFor('t-ro', 'Bash', { command: 'git log --oneline' }), d.env), '');
  // Routine-Gate ist weiterhin offen und feuert beim ersten echten Kommando.
  const reason = denyReason(run(inputFor('t-ro', 'Bash', { command: 'npm test' }), d.env));
  assert.match(reason, /ersten Bash-Befehl/);
});

test('destruktives Kommando wird je Kommando gegated — auch nach Routine-Gate', () => {
  const d = freshDirs();
  denyReason(run(inputFor('t-destr', 'Bash', { command: 'ls' }), d.env)); // Routine
  assert.equal(run(inputFor('t-destr', 'Bash', { command: 'ls' }), d.env), '');
  const r1 = denyReason(run(inputFor('t-destr', 'Bash', { command: 'git push --force origin main' }), d.env));
  assert.match(r1, /Destruktiver Befehl/);
  // Wiederholung desselben Kommandos passiert …
  assert.equal(run(inputFor('t-destr', 'Bash', { command: 'git push --force origin main' }), d.env), '');
  // … aber ein ANDERES destruktives Kommando wird erneut gegated.
  const r2 = denyReason(run(inputFor('t-destr', 'Bash', { command: 'rm -rf build' }), d.env));
  assert.match(r2, /Destruktiver Befehl/);
});

test('Destruktiv in $( ) und git commit --amend werden erkannt', () => {
  const d = freshDirs();
  const r1 = denyReason(run(inputFor('t-sub', 'Bash', { command: 'echo start $(rm -rf /tmp/x)' }), d.env));
  assert.match(r1, /Destruktiver Befehl/);
  const r2 = denyReason(run(inputFor('t-sub', 'Bash', { command: 'git commit --amend' }), d.env));
  assert.match(r2, /Destruktiver Befehl/);
});

test('"drop table" in Anfuehrungszeichen und --force-with-lease sind KEINE Destruktiv-Treffer', () => {
  const d = freshDirs();
  const r1 = denyReason(run(inputFor('t-fp', 'Bash', { command: 'git commit -m "docs: drop table erklaert"' }), d.env));
  assert.doesNotMatch(r1, /Destruktiver/); // Routine-Gate, nicht Destruktiv-Gate
  assert.equal(run(inputFor('t-fp', 'Bash', { command: 'git commit -m "docs: drop table erklaert"' }), d.env), '');
  assert.equal(run(inputFor('t-fp', 'Bash', { command: 'git push --force-with-lease origin main' }), d.env), '');
});

test('Extra-Muster per NC_FFG_EXTRA_DESTRUCTIVE greifen; ungueltiges Regex crasht nicht', () => {
  const d = freshDirs();
  const env = Object.assign({ NC_FFG_EXTRA_DESTRUCTIVE: 'glab\\s+mr\\s+merge' }, d.env);
  const r = denyReason(run(inputFor('t-extra', 'Bash', { command: 'glab mr merge 42' }), env));
  assert.match(r, /Destruktiver Befehl/);
  // Ungueltiges Regex → wie nicht konfiguriert; Kommando faellt aufs Routine-Gate.
  const bad = Object.assign({}, d.env, { NC_FFG_EXTRA_DESTRUCTIVE: '(' });
  const r2 = denyReason(run(inputFor('t-extra-bad', 'Bash', { command: 'glab mr merge 42' }), bad));
  assert.doesNotMatch(r2, /Destruktiver/);
});

test('Edit: einmal je Datei — neue Datei blockt erneut', () => {
  const d = freshDirs();
  const a1 = denyReason(run(inputFor('t-edit', 'Edit', { file_path: path.join(d.proj, 'a.md') }), d.env));
  assert.match(a1, /\[FFG\]/);
  assert.equal(run(inputFor('t-edit', 'Edit', { file_path: path.join(d.proj, 'a.md') }), d.env), '');
  denyReason(run(inputFor('t-edit', 'Write', { file_path: path.join(d.proj, 'b.md') }), d.env));
});

test('.claude/settings.json ist vom Datei-Gate ausgenommen', () => {
  const d = freshDirs();
  const out = run(inputFor('t-settings', 'Edit', { file_path: path.join(d.proj, '.claude', 'settings.json') }), d.env);
  assert.equal(out, '');
});

test('Subagent: Datei-Gate uebersprungen, Destruktiv-Gate bleibt scharf', () => {
  const d = freshDirs();
  const sub = { agent_id: 'agent-42', agent_type: 'Explore' };
  assert.equal(run(inputFor('t-sub-agent', 'Edit', { file_path: path.join(d.proj, 'x.md') }, sub), d.env), '');
  const r = denyReason(run(inputFor('t-sub-agent', 'Bash', { command: 'git reset --hard HEAD~1' }, sub), d.env));
  assert.match(r, /Destruktiver Befehl/);
});

test('Sessions sind getrennt', () => {
  const d = freshDirs();
  denyReason(run(inputFor('t-s1', 'Bash', { command: 'ls' }), d.env));
  denyReason(run(inputFor('t-s2', 'Bash', { command: 'ls' }), d.env));
});

test('State-Timeout: nach 30 Min Inaktivitaet greift das Gate erneut', () => {
  const d = freshDirs();
  const stateDir = path.join(d.data, 'ffg');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'session-t-timeout.json'), JSON.stringify({
    checked: ['__bash_session__'],
    last_active: Date.now() - 31 * 60 * 1000
  }));
  const reason = denyReason(run(inputFor('t-timeout', 'Bash', { command: 'ls' }), d.env));
  assert.match(reason, /ersten Bash-Befehl/);
});

test('State nicht schreibbar: allow + Warnung statt Endlosschleife', () => {
  const d = freshDirs();
  // Eine DATEI als State-Verzeichnis vorgeben → mkdir/write schlagen fehl.
  const blocker = path.join(d.data, 'blocker');
  fs.writeFileSync(blocker, 'x');
  const res = runFull(inputFor('t-nostate', 'Bash', { command: 'ls' }),
    Object.assign({}, d.env, { NC_FFG_STATE_DIR: blocker }));
  assert.equal(res.stdout, ''); // kein Deny → Aktion passiert
  assert.match(res.stderr, /State nicht schreibbar/);
});

test('kaputtes stdin: fail-open ohne Block', () => {
  const d = freshDirs();
  assert.equal(run('kein json', d.env), '');
});

test('nicht getriggertes Tool: kein Eingriff', () => {
  const d = freshDirs();
  assert.equal(run(inputFor('t-read', 'Read', { file_path: 'x' }), d.env), '');
});

// --- Upstream-Paritaet (GateGuard-Vorbild, Marketplace-Stand gelesen 2026-07-27) ---

test('GHSA-Bypasses: quoted rm, newline, sh -c und find -exec werden erkannt', () => {
  const d = freshDirs();
  denyReason(run(inputFor('t-ghsa', 'Bash', { command: 'ls' }), d.env)); // Routine-Gate abraeumen
  const cases = [
    "'rm' -rf /tmp/x",
    'echo safe\nrm -rf /tmp/x',
    'sh -c "rm -rf /tmp/x"',
    "bash -c 'git reset --hard HEAD~1'",
    'find . -name "*.tmp" -exec rm {} \\;',
    "find . -exec 'rm' -rf {} \\;"
  ];
  for (const command of cases) {
    const r = denyReason(run(inputFor('t-ghsa', 'Bash', { command }), d.env));
    assert.match(r, /Destruktiver Befehl/, 'nicht erkannt: ' + JSON.stringify(command));
  }
});

test('quote-aware: Phrase IN Anfuehrungszeichen bleibt Fehlalarm-frei', () => {
  const d = freshDirs();
  denyReason(run(inputFor('t-qfp', 'Bash', { command: 'ls' }), d.env)); // Routine-Gate abraeumen
  assert.equal(run(inputFor('t-qfp', 'Bash', { command: 'echo "rm -rf waere gefaehrlich"' }), d.env), '');
});

test('Edit- und Write-Gate haben getrennte Investigations-Texte', () => {
  const d = freshDirs();
  const e = denyReason(run(inputFor('t-txt', 'Edit', { file_path: path.join(d.proj, 'mod.js') }), d.env));
  assert.match(e, /\[FFG\]/);
  assert.match(e, /ALLE Dateien/);          // Importer-Recherche (Edit-spezifisch)
  assert.match(e, /wörtlich zitieren/);
  const w = denyReason(run(inputFor('t-txt', 'Write', { file_path: path.join(d.proj, 'neu.js') }), d.env));
  assert.match(w, /\[FFG\]/);
  assert.match(w, /denselben Zweck/);       // Duplikat-Check (Write-spezifisch)
  assert.doesNotMatch(w, /ALLE Dateien/);
});

test('MultiEdit wird wie Edit je Datei gegated; Edit-Gate zaehlt fuer MultiEdit', () => {
  const d = freshDirs();
  const f = path.join(d.proj, 'm.md');
  const r = denyReason(run(inputFor('t-me', 'MultiEdit', { edits: [{ file_path: f, old_string: 'a', new_string: 'b' }] }), d.env));
  assert.match(r, /\[FFG\]/);
  assert.equal(run(inputFor('t-me', 'MultiEdit', { edits: [{ file_path: f }] }), d.env), '');
  // Datei, die schon per Edit gegated wurde, blockt in MultiEdit nicht erneut.
  const g = path.join(d.proj, 'n.md');
  denyReason(run(inputFor('t-me', 'Edit', { file_path: g }), d.env));
  assert.equal(run(inputFor('t-me', 'MultiEdit', { edits: [{ file_path: g }] }), d.env), '');
});

test('Tool-Namen case-insensitiv: "edit" wird wie "Edit" gegated', () => {
  const d = freshDirs();
  const r = denyReason(run(inputFor('t-case', 'edit', { file_path: path.join(d.proj, 'c.md') }), d.env));
  assert.match(r, /\[FFG\]/);
});

test('NC_FFG_EXEMPT_GLOBS nimmt passende Pfade vom Datei-Gate aus', () => {
  const d = freshDirs();
  const env = Object.assign({ NC_FFG_EXEMPT_GLOBS: '**/*.test.mjs, **/scratch/**' }, d.env);
  assert.equal(run(inputFor('t-ex', 'Edit', { file_path: path.join(d.proj, 'tests', 'x.test.mjs') }), env), '');
  assert.equal(run(inputFor('t-ex', 'Write', { file_path: path.join(d.proj, 'scratch', 'tmp.md') }), env), '');
  // Nicht-passender Pfad bleibt gegated.
  denyReason(run(inputFor('t-ex', 'Edit', { file_path: path.join(d.proj, 'src', 'x.js') }), env));
});

test('Exempt-Globs sind voll verankert und case-gefoldet (Review-Härtung 2026-07-28)', () => {
  const d = freshDirs();
  const env = Object.assign({ NC_FFG_EXEMPT_GLOBS: '**/*.md, **/*.MJS' }, d.env);
  // Kein Substring-Bypass: .md.bak endet nicht auf .md → bleibt gegated.
  denyReason(run(inputFor('t-anchor', 'Edit', { file_path: path.join(d.proj, 'notes.md.bak') }), env));
  // Kein Verzeichnis-Trick: x.md/evil.js matcht *.md nicht → bleibt gegated.
  denyReason(run(inputFor('t-anchor', 'Write', { file_path: path.join(d.proj, 'x.md', 'evil.js') }), env));
  // Case-Folding: grossgeschriebenes Muster matcht kleingeschriebenen Pfad.
  assert.equal(run(inputFor('t-anchor', 'Edit', { file_path: path.join(d.proj, 'lib', 'a.mjs') }), env), '');
  // Der gemeinte Fall bleibt exempt.
  assert.equal(run(inputFor('t-anchor', 'Edit', { file_path: path.join(d.proj, 'docs', 'readme.md') }), env), '');
});

test('Denial-Budget: nach Budget kondensierter Einzeiler ohne Abschalt-Hinweis', () => {
  const d = freshDirs();
  const env = Object.assign({ NC_FFG_FULL_DENIALS: '1' }, d.env);
  const full = denyReason(run(inputFor('t-bud', 'Edit', { file_path: path.join(d.proj, 'a.js') }), env));
  assert.match(full, /ALLE Dateien/); // Volltext innerhalb des Budgets
  const cond = denyReason(run(inputFor('t-bud', 'Edit', { file_path: path.join(d.proj, 'b.js') }), env));
  assert.match(cond, /#2/);                 // Ordinal macht Verweigerungen textuell verschieden
  assert.doesNotMatch(cond, /ALLE Dateien/); // kein Volltext mehr
  assert.doesNotMatch(cond, /NC_FFG/);       // Schicht 5: kein Abschalt-Hinweis, auch kondensiert
  assert.ok(!cond.includes('\n'), 'kondensierte Meldung ist einzeilig');
  // Wiederholung nach Fakten-Vorlage passiert weiterhin.
  assert.equal(run(inputFor('t-bud', 'Edit', { file_path: path.join(d.proj, 'b.js') }), env), '');
});

test('erweiterte Read-only-Git-Introspektion: diff --cached/--stat und show <ref> --stat', () => {
  const d = freshDirs();
  assert.equal(run(inputFor('t-ro2', 'Bash', { command: 'git diff --cached --stat' }), d.env), '');
  assert.equal(run(inputFor('t-ro2', 'Bash', { command: 'git show HEAD --stat' }), d.env), '');
});
