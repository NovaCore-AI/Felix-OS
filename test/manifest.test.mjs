// Struktur-Invarianten des Satelliten nc-felix (Muster: Onsite.ai-OS-Satellit, angepasst).
// Warum als Test: Die Plattform erzwingt weder die Kern-Dependency noch die
// "Hooks nur im Kern"-Regel — ohne diese Invarianten fällt ein Bruch erst beim Nutzer auf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'),
);

test('Manifest: Pflichtfelder und Identität', () => {
  assert.equal(manifest.name, 'nc-felix');
  assert.equal(manifest.displayName, 'NovaCore-OS — Abteilung felix');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.description?.length > 0);
  assert.equal(manifest.author?.name, 'NovaCore AI');
});

test('Manifest: Kern-Dependency und Plugin-Grenze (keine Hooks)', () => {
  assert.deepEqual(manifest.dependencies, ['nc']);
  assert.equal(manifest.hooks, undefined);
  assert.equal(existsSync(join(root, 'hooks')), false);
});

test('Struktur: Skills nur mit SKILL.md, Doku vorhanden', () => {
  const skillsDir = join(root, 'skills');
  if (existsSync(skillsDir)) {
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        assert.ok(
          existsSync(join(skillsDir, entry.name, 'SKILL.md')),
          `skills/${entry.name} ohne SKILL.md`,
        );
      }
    }
  }
  assert.ok(existsSync(join(root, 'README.md')));
  assert.ok(existsSync(join(root, 'CHANGELOG.md')));
});

test('Keine offenen Vorlagen-Platzhalter in ausgelieferten Dateien', () => {
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = join(cur, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (!/\.(md|json)$/.test(entry.name)) continue;
      assert.equal(/\{\{[A-Z_]+\}\}/.test(readFileSync(full, 'utf8')), false,
        `${full}: unersetzter Vorlagen-Platzhalter`);
    }
  }
});
