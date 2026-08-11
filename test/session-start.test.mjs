// Gate 2, Teil 1 des Felix-OS — Session-Start-Injektion (nc-session-start.js).
// Testfall T-16 des Bauplans 2026-08-11 (§6) samt Negativproben.
//
// Diese Datei ersetzt die frühere Marker-Prüfung: Seit 2026-08-11 (AP7) hängt die
// Injektion NICHT mehr an einer `.nc-os`-Datei — ein Gate, das man vergessen kann, ist
// kein Gate. Genau das wird hier festgehalten, damit der Marker nicht zurückkehrt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(root, 'hooks', 'nc-session-start.js');

/** Hook als Kindprozess starten; liefert die geparste Antwort (oder null). */
function rufeHook(eingabe, extraEnv = {}) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(eingabe),
    encoding: 'utf8',
    // NC_START_GATE explizit leeren — sonst macht ein global gesetzter Opt-out die
    // ganze Datei vakuum-gruen (die Injektion bliebe aus, ohne dass ein Test es merkt).
    env: { ...process.env, NC_START_GATE: '', CLAUDE_PROJECT_DIR: '', ...extraEnv }
  });
  assert.equal(res.status, 0,
    `Session-Start endete mit Exitcode ${res.status} — fail-open verletzt`);
  const out = String(res.stdout || '').trim();
  return out ? JSON.parse(out) : null;
}

function kontext(antwort) {
  assert.ok(antwort && antwort.hookSpecificOutput, 'keine Injektion erhalten');
  assert.equal(antwort.hookSpecificOutput.hookEventName, 'SessionStart');
  return String(antwort.hookSpecificOutput.additionalContext || '');
}

test('T-16 Injektion feuert OHNE .nc-os-Marker', () => {
  // Selbst wenn der Marker im Repo liegt, darf er keine BEDINGUNG mehr sein. Der
  // entscheidende Beleg ist der naechste Fall (fremdes, markerloses Verzeichnis).
  const text = kontext(rufeHook({ cwd: root, source: 'startup', session_id: 'test-t16' }));
  assert.match(text, /Pflicht-Einstieg/, 'der Block muss den Pflicht-Einstieg nennen');
  assert.match(text, /\/nc-felix:start/, 'der Block muss den Start-Skill nennen');
  assert.doesNotMatch(text, /\.nc-os/,
    'der Marker darf im injizierten Text nicht mehr vorkommen');
});

test('T-16a Injektion feuert auch in einem fremden Verzeichnis ohne Marker', () => {
  const fremd = mkdtempSync(join(tmpdir(), 'nc-felix-fremd-'));
  try {
    assert.equal(existsSync(join(fremd, '.nc-os')), false, 'Vorbedingung: kein Marker');
    const text = kontext(rufeHook({ cwd: fremd, source: 'startup', session_id: 'test-t16a' }));
    assert.match(text, /Pflicht-Einstieg/,
      'ohne Marker muss der Regelblock trotzdem injiziert werden');
    // Repo-spezifische Abschnitte entfallen dort automatisch — die Wissensbasis ist
    // Arbeitsmaterial, nie Laufzeit-Abhaengigkeit.
    assert.doesNotMatch(text, /Laufende Vorhaben/,
      'ohne eigene Wissensbasis darf der Vorhaben-Abschnitt nicht erscheinen');
  } finally { rmSync(fremd, { recursive: true, force: true }); }
});

test('T-16b Injektion nennt die juengsten datierten Dateien aus knowledge-base/grundwissen/', () => {
  const text = kontext(rufeHook({ cwd: root, source: 'startup', session_id: 'test-t16b' }));
  assert.match(text, /Laufende Vorhaben/,
    'der Abschnitt fehlt — die eigene Wissensbasis wird nicht gelesen');
  assert.match(text, /2026-08-11-modul-definition-felix\.md/,
    'der juengste datierte Plan muss namentlich genannt sein');
  assert.match(text, /SSOT-Document-Index\.md/,
    'der Block muss auf den eigenen Master-Index verweisen');
});

test('T-16c Injektion nennt den lebenden Stand und den Stempel-Befehl', () => {
  const text = kontext(rufeHook({ cwd: root, source: 'resume', session_id: 'test-t16c' }));
  assert.match(text, /Lebender Stand/, 'Git-Lage fehlt');
  assert.match(text, /Branch:/, 'Branch fehlt im lebenden Stand');
  assert.match(text, /nc-start-stempel\.js/,
    'der exakte Stempel-Befehl muss genannt sein — sonst muss der Agent ihn raten');
  assert.match(text, /Auslöser: `resume`/,
    'ein anderer Ausloeser als startup wird ausgewiesen');
});

test('T-16d Opt-out NC_START_GATE=off unterdrueckt die Injektion vollstaendig', () => {
  const antwort = rufeHook({ cwd: root, source: 'startup', session_id: 'test-t16d' },
    { NC_START_GATE: 'off' });
  assert.equal(antwort, null,
    'mit gesetztem Opt-out darf nichts injiziert werden — ein Gate, ein Schalter');
});

test('T-16e defekte Eingabe legt die Session nicht lahm (fail-open)', () => {
  const res = spawnSync(process.execPath, [HOOK], {
    input: 'kein json',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: '' }
  });
  assert.equal(res.status, 0, 'unparsebare Eingabe darf nicht mit Exitcode != 0 enden');
});

test('T-16f der Vorhaben-Abschnitt listet nur DATIERTE Dateien', () => {
  // Dauerhafte Referenzen ohne Datumspraefix sind kein Planungsstand und wuerden die
  // Liste verwaessern. Negativprobe mit einer echten, aber undatierten Datei.
  const fremd = mkdtempSync(join(tmpdir(), 'nc-felix-datiert-'));
  try {
    const gw = join(fremd, 'knowledge-base', 'grundwissen');
    mkdirSync(gw, { recursive: true });
    writeFileSync(join(gw, 'Referenz-ohne-Datum.md'), '# x\n');
    writeFileSync(join(gw, '2026-01-02-echter-plan.md'), '# y\n');

    const text = kontext(rufeHook({ cwd: fremd, source: 'startup', session_id: 'test-t16f' }));
    assert.match(text, /2026-01-02-echter-plan\.md/, 'die datierte Datei fehlt');
    assert.doesNotMatch(text, /Referenz-ohne-Datum\.md/,
      'undatierte Referenzen gehoeren nicht in die Vorhaben-Liste');
  } finally { rmSync(fremd, { recursive: true, force: true }); }
});
