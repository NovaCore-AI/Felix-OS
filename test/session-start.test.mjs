import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// nc-session-start.js ist CommonJS (require.main-Guard) — ueber createRequire
// einbinden statt per ESM-Import, damit module.exports direkt nutzbar bleibt.
const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = path.resolve(HERE, '..', 'hooks', 'nc-session-start.js');
const PLUGIN_JSON_PATH = path.resolve(HERE, '..', '.claude-plugin', 'plugin.json');

const { buildSessionStartResponse, hasNcOsMarker, readOsVersion } = require(HOOK_PATH);

function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'felix-session-start-'));
}

function expectedVersion() {
  const manifest = JSON.parse(fs.readFileSync(PLUGIN_JSON_PATH, 'utf8'));
  return manifest.version;
}

test('Marker-DATEI .nc-os vorhanden: Kontext-String mit Version aus plugin.json', () => {
  const repo = tmpRepo();
  fs.writeFileSync(path.join(repo, '.nc-os'), '');

  const response = buildSessionStartResponse({ cwd: repo });

  assert.notEqual(response, null);
  const context = response.hookSpecificOutput.additionalContext;
  assert.match(context, /\/nc-felix:start/);
  assert.match(context, /\/nc-felix:save-session/);
  assert.ok(
    context.includes(`v${expectedVersion()}`),
    `Kontext soll Version ${expectedVersion()} enthalten, war: ${context}`
  );

  // readOsVersion() liest dieselbe plugin.json direkt.
  assert.equal(readOsVersion(), expectedVersion());
});

test('Marker als VERZEICHNIS .nc-os (Regressionstest Bug 0.1.1 des Vorbilds): liefert null', () => {
  const repo = tmpRepo();
  fs.mkdirSync(path.join(repo, '.nc-os'));

  const response = buildSessionStartResponse({ cwd: repo });

  assert.equal(response, null);
  assert.equal(hasNcOsMarker(repo), false);
});

test('kein Marker im Repo-Baum: liefert null', () => {
  const repo = tmpRepo();

  const response = buildSessionStartResponse({ cwd: repo });

  assert.equal(response, null);
  assert.equal(hasNcOsMarker(repo), false);
});
