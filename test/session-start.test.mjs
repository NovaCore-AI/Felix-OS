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
// Default-Import (nicht benannt): Der Hook ist CommonJS, und die Default-Form ist ueber
// Node 20/22/24 hinweg die verlaesslichere Interop-Variante.
import hookModul from '../hooks/nc-session-start.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(root, 'hooks', 'nc-session-start.js');

/** Wegwerf-Verzeichnis mit einer CHANGELOG.md daraus bauen. */
function mitChangelog(inhalt) {
  const dir = mkdtempSync(join(tmpdir(), 'nc-felix-changelog-'));
  writeFileSync(join(dir, 'CHANGELOG.md'), inhalt);
  return dir;
}

/** Nur den `[Unreleased]`-Abschnitt des injizierten Kontexts. */
function unreleasedBlock(dir) {
  const text = hookModul.buildContext(dir, 'startup', 'test-unreleased');
  const i = text.indexOf('## `[Unreleased]`');
  return i === -1 ? null : text.slice(i).split('\n\n')[0];
}

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

// ---------------------------------------------------------------------------
// T-16g bis T-16i — keine falschen Tatsachenbehauptungen im Pflicht-Einstieg
//
// Diese drei Faelle schliessen Regressionsluecken, die eine Mutationsprobe am 2026-08-12
// nachgewiesen hat: Die Suite blieb gruen, obwohl die gepruefte Logik entfernt war. Der
// injizierte Block ist der Pflicht-Einstieg — was dort steht, glaubt der Agent. Eine
// Behauptung, die niemand geprueft hat, ist deshalb ein Defekt, kein Schoenheitsfehler.
// ---------------------------------------------------------------------------

test('T-16g `[Unreleased]` endet an JEDER Ebene-2-Ueberschrift, nicht nur an einer mit Ziffer', () => {
  // `## v0.9.0` ist eine verbreitete CHANGELOG-Kopfform. Endete der Abschnitt dort nicht,
  // wurden BEREITS VEROEFFENTLICHTE Eintraege als unveroeffentlicht injiziert.
  const dir = mitChangelog([
    '# Changelog', '',
    '## [Unreleased]', '',
    '### Added', '- brandneue Sache A', '',
    '## v0.9.0 — 2026-01-01', '',
    '### Added', '- LAENGST VEROEFFENTLICHTES Ding', ''
  ].join('\n'));
  try {
    const block = unreleasedBlock(dir);
    assert.ok(block, 'der `[Unreleased]`-Abschnitt fehlt ganz');
    assert.match(block, /brandneue Sache A/, 'der echte Unreleased-Eintrag fehlt');
    assert.doesNotMatch(block, /VEROEFFENTLICHTES Ding/,
      'ein bereits veroeffentlichter Eintrag wurde als unveroeffentlicht injiziert');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('T-16h nicht zerlegbarer `[Unreleased]`-Inhalt wird NIE als "leer" behauptet', () => {
  // Prosa und `*`-Bullets sind gueltiges Markdown. Wer sie nicht zerlegen kann, darf nicht
  // "nichts Unveroeffentlichtes" behaupten — das ist dieselbe falsche Tatsachenbehauptung
  // wie das frueher als "clean" injizierte fehlgeschlagene `git status`.
  const dir = mitChangelog([
    '# Changelog', '',
    '## [Unreleased]', '',
    'Grosser Umbau der Auth-Schicht laeuft; Details im PR.', '',
    '## 0.9.0 — 2026-01-01', '- alt', ''
  ].join('\n'));
  try {
    const block = unreleasedBlock(dir);
    assert.ok(block, 'der `[Unreleased]`-Abschnitt fehlt ganz');
    // Geprueft wird die konkrete FALSCHE BEHAUPTUNG, nicht das Wort "leer": Eine ehrliche
    // Meldung darf „nicht leer" sagen duerfen, ohne den Test zu brechen.
    assert.doesNotMatch(block, /nichts Unveroeffentlichtes/i,
      'ein Abschnitt MIT Inhalt wurde als „nichts Unveroeffentlichtes" gemeldet');
  } finally { rmSync(dir, { recursive: true, force: true }); }

  // Gegenprobe: ein wirklich leerer Abschnitt DARF die Leer-Meldung tragen — sonst waere die
  // Verschaerfung nur eine Umformulierung.
  const leer = mitChangelog(['# Changelog', '', '## [Unreleased]', '', '## 0.9.0 — 2026-01-01', '- alt', ''].join('\n'));
  try {
    assert.match(unreleasedBlock(leer), /nichts Unveroeffentlichtes/i,
      'ein wirklich leerer Abschnitt soll als leer ausgewiesen werden');
  } finally { rmSync(leer, { recursive: true, force: true }); }

  // `*` und `+` sind gueltige Markdown-Bullet-Marker. Ihr Inhalt muss ANKOMMEN — sonst
  // faellt der Abschnitt auf die Ersatzmeldung zurueck, obwohl er zerlegbar ist.
  const marker = mitChangelog([
    '# Changelog', '',
    '## [Unreleased]', '',
    '* Sternchen-Eintrag X', '+ Plus-Eintrag Y', '',
    '## 0.9.0 — 2026-01-01', '- alt', ''
  ].join('\n'));
  try {
    const block = unreleasedBlock(marker);
    assert.match(block, /Sternchen-Eintrag X/, '`*`-Bullets muessen im Block erscheinen');
    assert.match(block, /Plus-Eintrag Y/, '`+`-Bullets muessen im Block erscheinen');
  } finally { rmSync(marker, { recursive: true, force: true }); }
});

test('T-16i Working Tree: Fehler/Timeout heisst "unbekannt", nur Erfolg-leer heisst "clean"', () => {
  // Der Kern des Befundes vom 2026-08-11: Der Git-Wrapper unterscheidet Erfolg-mit-leerer-
  // Ausgabe ('') von Fehler/Timeout (null). Bis 2026-08-12 deckte KEIN Test diese
  // Unterscheidung — die Mutation `return … || null` liess die Suite gruen.
  const { standZeilen } = hookModul;
  assert.equal(typeof standZeilen, 'function',
    'standZeilen wird nicht exportiert — die Unterscheidung bleibt sonst unpruefbar');

  const fehler = standZeilen('main', null, null).join('\n');
  assert.match(fehler, /unbekannt/i, 'Fehler/Timeout muss als unbekannt ausgewiesen werden');
  assert.doesNotMatch(fehler, /clean/i, 'Fehler/Timeout darf NIE als clean gelten');

  const sauber = standZeilen('main', null, '').join('\n');
  assert.match(sauber, /clean/i, 'Erfolg mit leerer Ausgabe ist ein sauberer Baum');
  assert.doesNotMatch(sauber, /unbekannt/i, 'ein geprueft sauberer Baum ist nicht unbekannt');

  const geaendert = standZeilen('main', null, ' M a.js').join('\n');
  assert.match(geaendert, /1 Änderung/, 'Aenderungen muessen gezaehlt werden');

  // Ohne Branch sind wir nicht nachweislich in einem Git-Baum: dann schweigen, statt zu raten.
  assert.deepEqual(standZeilen(null, null, null), [],
    'ohne Git-Lage darf gar nichts behauptet werden');
});

test('T-16j git(): Erfolg-mit-leerer-Ausgabe ist NICHT dasselbe wie Fehler', () => {
  // T-16i prueft die AUSWERTUNG der drei Rohwerte. Dieser Fall prueft den WRAPPER selbst —
  // ohne ihn bliebe die eigentliche Fehlerquelle offen: Eine Mutationsprobe am 2026-08-12
  // zeigte, dass `return … || null` (der alte, fehlerhafte Zustand) die Suite gruen liess,
  // weil kein Test den Rueckgabewert von git() direkt festnagelte.
  const { git } = hookModul;
  assert.equal(typeof git, 'function',
    'git wird nicht exportiert — der Vertrag bleibt sonst unpruefbar');

  // (a) FEHLER (kein Git-Baum) → null
  const ohneGit = mkdtempSync(join(tmpdir(), 'nc-felix-kein-repo-'));
  try {
    assert.equal(git(ohneGit, ['status', '--porcelain']), null,
      'ausserhalb eines Git-Baums muss der Wrapper null liefern (Fehler, nicht "leer")');
  } finally { rmSync(ohneGit, { recursive: true, force: true }); }

  // (b) ERFOLG mit leerer Ausgabe (frisches, leeres Repo) → '' und niemals null
  const leeresRepo = mkdtempSync(join(tmpdir(), 'nc-felix-leeres-repo-'));
  try {
    const init = spawnSync('git', ['init', leeresRepo], { encoding: 'utf8' });
    assert.equal(init.status, 0, 'Vorbedingung: git init gelingt');
    assert.equal(git(leeresRepo, ['status', '--porcelain']), '',
      'ein geprueft sauberer Baum liefert Erfolg mit LEERER Ausgabe — wird daraus null, '
      + 'entsteht daraus wieder das falsche "Working Tree: clean"');
  } finally { rmSync(leeresRepo, { recursive: true, force: true }); }
});
