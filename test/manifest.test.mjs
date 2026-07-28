// Struktur-Invarianten des Felix-OS (Plugin nc-felix, eigenständig — Muster:
// Onsite.ai-OS-Satellit + Struktur-Tests des NovaCore-OS, angepasst).
// Warum als Test: Die Plattform erzwingt weder das Ein-Plugin-Modell noch die
// Frontmatter-Regeln — ohne diese Invarianten fällt ein Bruch erst beim Nutzer auf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'),
);

const KERNMODUL_SKILLS = [
  'start', 'save-session', 'journal', 'os-info', 'code-tour', 'skill-builder',
];

function skillDirs() {
  const skillsDir = join(root, 'skills');
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function frontmatter(file) {
  const raw = readFileSync(file, 'utf8');
  assert.equal(raw.charCodeAt(0) !== 0xfeff, true, `${file}: BOM vor der Frontmatter`);
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(m, `${file}: keine Frontmatter am Dateianfang`);
  return m[1];
}

test('Manifest: Pflichtfelder und Identität', () => {
  assert.equal(manifest.name, 'nc-felix');
  assert.equal(manifest.displayName, 'Felix-OS — Abteilung felix (eigenständig)');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.description?.length > 0);
  assert.equal(manifest.author?.name, 'NovaCore AI');
});

test('Eigenständigkeit: keine Dependencies, eigene Kontroll-Schicht unter hooks/', () => {
  // Das Felix-OS hängt bewusst NICHT am NovaCore-Kern nc — der Kern ist hier ein
  // Modul, kein Plugin. Dafür MUSS die Kontroll-Schicht (FFG) im Plugin liegen.
  assert.equal(manifest.dependencies, undefined,
    'nc-felix ist eigenständig — keine Plugin-Dependencies');
  assert.ok(existsSync(join(root, 'hooks', 'hooks.json')),
    'hooks/hooks.json fehlt — die Kontroll-Schicht muss im Plugin liegen');
  assert.ok(existsSync(join(root, 'hooks', 'nc-ffg.js')), 'FFG-Hook fehlt');
  assert.ok(existsSync(join(root, 'hooks', 'nc-session-start.js')), 'SessionStart-Hook fehlt');
});

test('Hook-Kommandos adressieren Dateien über die Plugin-Root-Variable', () => {
  const cfg = JSON.parse(readFileSync(join(root, 'hooks', 'hooks.json'), 'utf8'));
  const commands = Object.values(cfg.hooks).flat()
    .flatMap((m) => m.hooks).filter((h) => h.type === 'command').map((h) => h.command);
  assert.ok(commands.length > 0, 'keine command-Hooks gefunden');
  for (const c of commands) {
    assert.match(c, /\$\{CLAUDE_PLUGIN_ROOT\}/,
      `Hook-Kommando ohne CLAUDE_PLUGIN_ROOT: "${c}" — relative Pfade brechen im Plugin-Cache`);
  }
});

test('Kernmodul: alle sechs Skills sind gebaut, jede Skill-Dir hat eine SKILL.md', () => {
  for (const name of KERNMODUL_SKILLS) {
    assert.ok(existsSync(join(root, 'skills', name, 'SKILL.md')),
      `Kernmodul-Skill skills/${name}/SKILL.md fehlt`);
  }
  for (const dir of skillDirs()) {
    assert.ok(existsSync(join(root, 'skills', dir, 'SKILL.md')),
      `skills/${dir} ohne SKILL.md`);
  }
  assert.ok(existsSync(join(root, 'README.md')));
  assert.ok(existsSync(join(root, 'CHANGELOG.md')));
  assert.ok(existsSync(join(root, 'wp-rahmen.md')));
  assert.ok(existsSync(join(root, 'felix-sync.md')));
  assert.ok(existsSync(join(root, 'referenz', 'skill-authoring.md')));
});

test('Registry: module-registry.json spiegelt Version und gebaute Kernmodul-Skills', () => {
  const reg = JSON.parse(readFileSync(join(root, 'module-registry.json'), 'utf8'));
  assert.equal(reg.version, manifest.version, 'Registry-Version weicht vom Manifest ab');
  assert.equal(reg.plugin, manifest.name);
  const kern = reg.module.find((m) => m.name === 'kern');
  assert.ok(kern, 'Registry ohne Kernmodul');
  assert.deepEqual([...kern.skills].sort(), [...KERNMODUL_SKILLS].sort(),
    'Registry-Skills und Kernmodul-Skills driften auseinander');
});

test('Frontmatter: name entspricht dem Verzeichnis und erfüllt die Namensregeln', () => {
  for (const dir of skillDirs()) {
    const fm = frontmatter(join(root, 'skills', dir, 'SKILL.md'));
    const m = fm.match(/^name:[ \t]*(\S+)[ \t]*$/m);
    assert.ok(m, `skills/${dir}: kein einzeiliges name-Feld`);
    assert.equal(m[1], dir, `skills/${dir}: name weicht vom Verzeichnisnamen ab`);
    assert.match(m[1], /^[a-z0-9-]{1,64}$/, `skills/${dir}: name verletzt a-z0-9- / 64 Zeichen`);
  }
});

test('Frontmatter: description bricht nicht am YAML-Plain-Scalar', () => {
  // "Trigger-Begriffe: ..." enthält Doppelpunkt+Leerzeichen und beendet damit einen
  // unquotierten Plain-Scalar — der Skill lädt dann still ohne Metadaten.
  const RISKY = /:\s|(^|\s)#/;
  for (const dir of skillDirs()) {
    const file = join(root, 'skills', dir, 'SKILL.md');
    const fm = frontmatter(file);
    const zeilen = fm.split(/\r?\n/);
    const idx = zeilen.findIndex((l) => /^description:/.test(l));
    assert.ok(idx >= 0, `${file}: kein description-Feld`);
    const value = zeilen[idx].replace(/^description:[ \t]*/, '').trim();
    const isBlock = ['>-', '>', '|', '|-'].includes(value);
    const isQuoted = /^(".*"|'.*')$/.test(value);
    if (!isBlock && !isQuoted) {
      assert.equal(RISKY.test(value), false,
        `${file}: description ist ein Plain-Scalar und enthält ": " oder "#" — als >- Block schreiben`);
    }
    const full = isBlock
      ? zeilen.slice(idx + 1).filter((l) => /^\s+\S/.test(l)).map((l) => l.trim()).join(' ')
      : value.replace(/^["']|["']$/g, '');
    assert.ok(full.length > 0 && full.length <= 1024,
      `${file}: description ist leer oder länger als 1024 Zeichen (${full.length})`);
  }
});

test('Ausgelieferte Markdown-Dateien verweisen nicht über die Plugin-Grenze', () => {
  // Installierte Plugins liegen isoliert im Cache — ../-Pfade und Repo-Pfade lösen
  // dort nicht auf. Repo-Dokumente nur als Quellenangabe („OS-Repo").
  // Ausnahme: skill-authoring.md zitiert die verbotenen Muster als Regeltext.
  const AUSNAHME = join('referenz', 'skill-authoring.md');
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      if (['.git', 'node_modules', '.github', 'test', 'hooks'].includes(entry.name)) continue;
      const full = join(cur, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (!entry.name.endsWith('.md') || full.endsWith(AUSNAHME)) continue;
      const lines = readFileSync(full, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        assert.equal(/\.\.\//.test(line), false,
          `${full}:${i + 1}: ../-Pfad verlässt das Plugin-Verzeichnis`);
        if (/knowledge-base\//.test(line)) {
          const context = lines.slice(Math.max(0, i - 2), i + 2).join(' ');
          assert.match(context, /OS-Repo/,
            `${full}:${i + 1}: Repo-Pfad ohne "OS-Repo"-Qualifizierung — nach Installation nicht auflösbar`);
        }
      });
    }
  }
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
