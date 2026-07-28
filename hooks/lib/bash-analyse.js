'use strict';
// bash-analyse.js — Bash-Befehlsanalyse fuer das FFG (Design-Spec 2026-07-28 §5 (OS-Repo)).
// Port der GateGuard-Erkennung aus dem ECC-Plugin (gateguard-fact-force.js, ecc@2.0.0,
// gelesen 2026-07-26; Upstream-Stand des ECC-Repos nachgezogen 2026-07-27):
// Quote-Stripping, Subshell-/Brace-Zerlegung, Segment-Splitting, rm-/git-Flag-Analyse,
// SQL-/dd-Muster, die Read-only-Git-Allowlist sowie die quote-aware Zweitpruefung und
// find-exec-Erkennung aus dem Upstream-Fix zu GHSA-4v57-ph3x-gf55 (gequotete
// Kommandowoerter, Newline-Trenner, sh/bash-c-Wrapper, find -exec rm).
// NovaCore-Zuschnitt: Zusatzmuster kommen als Regex-Quelltext ueber die Env-Variable
// NC_FFG_EXTRA_DESTRUCTIVE — der Einstiegspunkt fuer die roten Linien der Firma
// (glab mr merge, exec-*-Deploys, …); die konkreten Muster legt der Maintainer fest
// (Design-Spec 2026-07-28 §5 (OS-Repo), Punkt 5 bewusst offen).
const {
  extractCommandSubstitutions,
  extractSubshellGroups,
  extractBraceGroups
} = require('./shell-substitution');

// SQL-Schluesselwoerter + dd bleiben ein einzelnes Regex — stabile Phrasen ohne
// Flag-Reihenfolge-Probleme. Quoted Strings werden vorher entfernt, damit eine
// Commit-Message mit "drop table" kein Fehlalarm ist.
const DESTRUCTIVE_SQL_DD = /\b(drop\s+table|delete\s+from|truncate|dd\s+if=)\b/i;

// Vom Betreiber gepflegte Zusatzmuster (Regex-Quelltext aus der Env). Ungueltiges
// Regex zaehlt als "nicht konfiguriert" (eingebaute Muster gelten weiter) und wird
// einmal je Prozess auf stderr gemeldet — ein Hook darf wegen Konfig-Fehlern nie
// die Tool-Ausfuehrung crashen.
let extraWarnLogged = false;
function getExtraDestructiveRegex() {
  const raw = process.env.NC_FFG_EXTRA_DESTRUCTIVE || '';
  if (!raw) return null;
  try {
    return new RegExp(raw, 'i');
  } catch (err) {
    if (!extraWarnLogged) {
      try {
        process.stderr.write(
          '[nc-ffg] ignoriere ungueltiges NC_FFG_EXTRA_DESTRUCTIVE-Regex: ' + err.message + '\n'
        );
      } catch (_) { /* stderr-Fehler sind nicht fatal */ }
      extraWarnLogged = true;
    }
    return null;
  }
}

// Inhalte von single-/double-quoted Strings entfernen, damit Phrasen in
// Commit-Messages o. Ae. den Destruktiv-Detektor nicht triggern. Command
// Substitutions werden separat VOR diesem Schritt eingesammelt, weil sie
// auch innerhalb doppelter Anfuehrungszeichen ausgefuehrt werden.
function stripQuotedStrings(input) {
  return input
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

// Subshell-Begrenzer zu Top-Level-Trennern machen, damit der Destruktiv-Check
// auch in `$(...)` und Backticks greift — sonst rutscht `echo y | $(rm -rf x)`
// am Segment-Splitter vorbei. Iterativ fuer eine Verschachtelungsebene.
function explodeSubshells(input) {
  let out = input;
  for (let i = 0; i < 4; i += 1) {
    const before = out;
    out = out.replace(/\$\(([^()`]*)\)/g, ';$1;');
    out = out.replace(/`([^`]*)`/g, ';$1;');
    if (out === before) break;
  }
  return out;
}

// Kommandozeile an unquoted Shell-Trennern (`;`, `|`, `&`, `&&`, `||`) und
// ueber Subshells hinweg in Top-Level-Segmente zerlegen; Kommentare je
// Segment entfernen.
function splitCommandSegments(input) {
  const stripped = explodeSubshells(stripQuotedStrings(input));
  return stripped
    .split(/[;|&]+/)
    .map(segment => segment.replace(/(^|\s)#.*/, '$1').trim())
    .filter(Boolean);
}

// Einzelnes Segment an Whitespace tokenisieren (Quotes sind bereits zu ''/""
// kollabiert, naives Splitting reicht).
function tokenize(segment) {
  return segment.split(/\s+/).filter(Boolean);
}

// Tokenizer fuer allowgelistete Kurzkommandos, der quoted Argumente erhaelt.
// Bewusst kleiner als ein voller Shell-Parser: der Aufrufer weist
// Shell-Steuerzeichen vorher ab.
function tokenizeAllowlistedShellWords(input) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (const char of String(input || '')) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaped) current += '\\';
  if (quote) return null;
  if (current) tokens.push(current);
  return tokens;
}

// Fuehrenden Pfad und `.exe` abstreifen: `/usr/bin/git`, `git.exe`, `GIT` → `git`.
function commandBasename(token) {
  if (!token) return '';
  return token.replace(/^.*[\\/]/, '').replace(/\.exe$/i, '').toLowerCase();
}

const SHELL_SEGMENT_SEPARATORS = new Set([';', '|', '&', '\n', '\r']);

// Quote-aware Zerlegung einer Kommandozeile in Segmente, mit ENTFERNTEN Quotes in
// den Ergebnis-Woertern. Getrennt wird nur an UNQUOTED `;`, `|`, `&` und Newlines:
//  - ein gequotetes Kommandowort (`'rm'`, `"rm"`) normalisiert zu `rm` (die Shell
//    behandelt Quotes um Kommandonamen transparent), und
//  - Newline wirkt als Kommando-Trenner (die Shell fuehrt jede Zeile aus).
// Beides kann `stripQuotedStrings` + naives Splitting nicht — beides waren
// Destruktiv-Klassifizierer-Bypasses (GHSA-4v57-ph3x-gf55).
function quoteAwareSegments(input) {
  const segments = [];
  let words = [];
  let current = '';
  let hasWord = false;
  let quote = null;
  let escaped = false;

  const flushWord = () => {
    if (hasWord) words.push(current);
    current = '';
    hasWord = false;
  };
  const flushSegment = () => {
    flushWord();
    if (words.length) segments.push(words);
    words = [];
  };

  for (const ch of String(input || '')) {
    if (escaped) {
      current += ch;
      hasWord = true;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      hasWord = true;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      hasWord = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      hasWord = true; // Quote-Beginn startet ein Wort, auch bei leerem Inhalt
      continue;
    }
    if (SHELL_SEGMENT_SEPARATORS.has(ch)) {
      flushSegment();
      continue;
    }
    if (/\s/.test(ch)) {
      flushWord();
      continue;
    }
    current += ch;
    hasWord = true;
  }
  flushSegment();
  return segments;
}

const SHELL_WRAPPERS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);

// Quote-aware Destruktiv-Check: faengt gequotete Kommandowoerter, Newline-Trenner,
// gequotetes `find -exec` und `sh -c`/`bash -c`-Wrapper, die am Quote-Stripping-Pfad
// vorbeirutschen (GHSA-4v57-ph3x-gf55). `depth` begrenzt die Wrapper-Rekursion.
function isDestructiveQuoteAware(raw, depth = 0) {
  if (depth > 4) return false;
  for (const tokens of quoteAwareSegments(raw)) {
    if (tokens.length === 0) continue;
    if (isDestructiveRm(tokens)) return true;
    if (isDestructiveGit(tokens)) return true;
    if (isDestructiveFindExec(tokens.join(' '))) return true;
    const base = commandBasename(tokens[0]);
    if (SHELL_WRAPPERS.has(base)) {
      const ci = tokens.indexOf('-c');
      if (ci !== -1 && tokens[ci + 1] && isDestructiveQuoteAware(tokens[ci + 1], depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

// Destruktive Kommandos in `find ... -exec`-Aufrufen: `-exec rm {} \;` (mit oder
// ohne Flags), `-exec rmdir/unlink {} \;`, `-exec git reset --hard {} \;`.
function isDestructiveFindExec(command) {
  const trimmed = String(command || '').trim();
  if (!trimmed) return false;

  const tokens = tokenize(trimmed);
  if (tokens.length === 0 || commandBasename(tokens[0]) !== 'find') return false;

  const execIndex = tokens.indexOf('-exec');
  if (execIndex === -1) return false;

  // Tokens nach `-exec` bis zum Terminator (`;`, `\;` oder `+`) einsammeln.
  const execTokens = [];
  for (let i = execIndex + 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === ';' || token === '\\;' || token === '+') break;
    execTokens.push(token);
  }
  if (execTokens.length === 0) return false;

  const baseCmd = commandBasename(execTokens[0]);
  if (baseCmd === 'rmdir' || baseCmd === 'unlink') return true;
  // `rm` in -exec ist mit UND ohne Flags destruktiv (find liefert die Ziele).
  if (baseCmd === 'rm') return true;
  if (baseCmd === 'git') {
    const sub = findGitSubcommand(execTokens);
    if (sub && sub.command === 'reset' && sub.rest.includes('--hard')) return true;
  }
  return false;
}

// `rm`-Aufrufe erkennen, die rekursiv UND erzwungen loeschen — kombinierte
// (`-rf`, `-fr`, `-Rf`) und getrennte (`-r -f`) Flag-Formen.
function isDestructiveRm(tokens) {
  if (tokens.length === 0 || commandBasename(tokens[0]) !== 'rm') return false;
  let hasR = false;
  let hasF = false;
  for (const t of tokens.slice(1)) {
    if (t === '--recursive') {
      hasR = true;
      continue;
    }
    if (t === '--force') {
      hasF = true;
      continue;
    }
    if (!t.startsWith('-') || t.startsWith('--')) continue;
    const body = t.slice(1);
    if (/[rR]/.test(body)) hasR = true;
    if (/f/.test(body)) hasF = true;
  }
  return hasR && hasF;
}

// git-Subkommando finden und dabei globale Optionen ueberspringen
// (`-c key=value`, `-C <pfad>`, `--git-dir=…`, `--work-tree=…`, …).
function findGitSubcommand(tokens) {
  if (tokens.length === 0 || commandBasename(tokens[0]) !== 'git') return null;
  const valueConsumingShort = new Set(['-c', '-C']);
  const valueConsumingLong = new Set(['--git-dir', '--work-tree', '--namespace', '--super-prefix']);
  let i = 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (valueConsumingShort.has(t) || valueConsumingLong.has(t)) {
      i += 2;
      continue;
    }
    if (t.startsWith('--git-dir=') || t.startsWith('--work-tree=') || t.startsWith('--namespace=') || t.startsWith('--super-prefix=')) {
      i += 1;
      continue;
    }
    if (t.startsWith('-')) {
      // Unbekannte globale Option — ueberspringen, ohne einen Wert zu schlucken.
      i += 1;
      continue;
    }
    return { command: t.toLowerCase(), rest: tokens.slice(i + 1) };
  }
  return null;
}

// Destruktive git-Aufrufe: reset --hard, checkout --/-f/., clean -f…,
// push --force (nicht --force-with-lease), commit --amend, rm -r, switch
// --discard-changes/-f/-C.
function isDestructiveGit(tokens) {
  const sub = findGitSubcommand(tokens);
  if (!sub) return false;
  const { command, rest } = sub;

  if (command === 'reset') {
    return rest.includes('--hard');
  }

  if (command === 'checkout') {
    // `git checkout -- <pfad>`, `git checkout .` und die Force-Formen
    // (`--force` / `-f`) verwerfen uncommittete Working-Tree-Aenderungen.
    return rest.some(t => {
      if (t === '--' || t === '.' || t === '--force') return true;
      if (!t.startsWith('-') || t.startsWith('--')) return false;
      return t.slice(1).includes('f');
    });
  }

  if (command === 'clean') {
    // `git clean -f`, `-fd`, `-fdx`, `-df`, `--force`
    return rest.some(t => {
      if (t === '--force') return true;
      if (!t.startsWith('-') || t.startsWith('--')) return false;
      return t.slice(1).includes('f');
    });
  }

  if (command === 'push') {
    // Nur `--force-with-lease` zaehlt als abgesicherter Force.
    // `--force-if-includes` ist OHNE `--force-with-lease` wirkungslos
    // (git-scm.com/docs/git-push); kombiniert mit nacktem `--force` bleibt
    // der nackte Force wirksam → destruktiv. Ein `+`-Refspec-Praefix
    // (`git push origin +main`) erzwingt ebenfalls ein Non-Fast-Forward.
    let withLease = false;
    let bareForce = false;
    let plusRefspecForce = false;
    for (const t of rest) {
      if (t === '--force-with-lease' || t.startsWith('--force-with-lease=')) {
        withLease = true;
        continue;
      }
      if (t === '--force' || t.startsWith('--force=')) {
        bareForce = true;
        continue;
      }
      if (t.startsWith('-') && !t.startsWith('--') && t.slice(1).includes('f')) {
        bareForce = true;
        continue;
      }
      if (t.startsWith('+') && t.length > 1 && /^\+(?:[a-zA-Z_/.:]|HEAD)/.test(t)) {
        plusRefspecForce = true;
      }
    }
    return bareForce || (plusRefspecForce && !withLease);
  }

  if (command === 'commit') {
    return rest.includes('--amend');
  }

  if (command === 'rm') {
    // `git rm -r` / `-rf` / `-r -f` — auch im Index destruktiv.
    let hasR = false;
    for (const t of rest) {
      if (!t.startsWith('-') || t.startsWith('--')) continue;
      if (/[rR]/.test(t.slice(1))) hasR = true;
    }
    return hasR;
  }

  if (command === 'switch') {
    // `git switch` verwirft lokale Aenderungen via --discard-changes,
    // --force/-f oder -C (Force-Create ueberschreibt bestehenden Branch).
    return rest.some(t => {
      if (t === '--discard-changes' || t === '--force') return true;
      if (!t.startsWith('-') || t.startsWith('--')) return false;
      return /[fC]/.test(t.slice(1));
    });
  }

  return false;
}

// Alle ausfuehrbaren Bodies einer Kommandozeile einsammeln (BFS ueber die drei
// Extraktoren), damit auch syntaxuebergreifende Verschachtelungen — `(...)` in
// `$(...)`, `{ ...; }` in `(...)` — geprueft werden. `seen` begrenzt die Kosten
// auf O(eindeutige Bodies).
function collectExecutableBodies(raw) {
  const bodies = [raw];
  const queue = [raw];
  const seen = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);

    for (const body of extractCommandSubstitutions(current)) {
      if (seen.has(body)) continue;
      bodies.push(body);
      queue.push(body);
    }
    for (const body of extractSubshellGroups(current)) {
      if (seen.has(body)) continue;
      bodies.push(body);
      queue.push(body);
    }
    for (const body of extractBraceGroups(current)) {
      if (seen.has(body)) continue;
      bodies.push(body);
      queue.push(body);
    }
  }

  return bodies;
}

// Entscheidet, ob eine Bash-Kommandozeile eine destruktive Aktion enthaelt:
// SQL-/dd-Regex (auf quote-bereinigtem, subshell-aufgeloestem Input) plus
// per-Segment-Tokenisierung fuer rm/git — jeweils inklusive der
// Betreiber-Zusatzmuster aus NC_FFG_EXTRA_DESTRUCTIVE.
function isDestructiveBash(command) {
  const raw = String(command || '');
  const flattened = explodeSubshells(stripQuotedStrings(raw));
  if (DESTRUCTIVE_SQL_DD.test(flattened)) return true;

  const extra = getExtraDestructiveRegex();
  if (extra && extra.test(flattened)) return true;

  // find -exec auf ROHEN Body-Segmenten pruefen (vor dem Quote-Stripping):
  // splitCommandSegments entfernt Quotes vor dem Split, aus `find . -exec 'rm' {} \;`
  // wuerde `find . -exec  {} \;` — der Binaername verschwindet und der Check liefe
  // ins Leere. Der Roh-Split faengt zusaetzlich `&&`-/`;`-/`|`-Verbundformen.
  const bodies = collectExecutableBodies(raw);
  for (const body of bodies) {
    for (const rawSeg of body.split(/[;|&]+/).map(s => s.trim()).filter(Boolean)) {
      if (isDestructiveFindExec(rawSeg)) return true;
    }
  }

  const segments = bodies.flatMap(splitCommandSegments);
  for (const segment of segments) {
    const stripped = stripQuotedStrings(segment);
    if (DESTRUCTIVE_SQL_DD.test(stripped)) return true;
    if (extra && extra.test(stripped)) return true;
    const tokens = tokenize(segment);
    if (isDestructiveRm(tokens)) return true;
    if (isDestructiveGit(tokens)) return true;
  }

  // Quote-aware Schlusspass: schliesst die Bypasses gequotetes Kommandowort,
  // Newline-Trenner, gequotetes find -exec und sh/bash -c (GHSA-4v57-ph3x-gf55).
  if (isDestructiveQuoteAware(raw)) return true;

  return false;
}

// Read-only-Allowlist: reine Git-Introspektion (status/log/diff/show/branch/
// rev-parse in engen Formen) wird nie gegated — weder destruktiv noch routine.
function isReadOnlyGitIntrospection(command) {
  const trimmed = String(command || '').trim();
  if (!trimmed || /[\r\n;&|><`$()]/.test(trimmed)) {
    return false;
  }

  const segments = splitCommandSegments(trimmed);
  if (segments.length !== 1) {
    return false;
  }

  const tokens = tokenizeAllowlistedShellWords(trimmed);
  if (!tokens) {
    return false;
  }
  if (commandBasename(tokens[0]) !== 'git' || tokens.length < 2) {
    return false;
  }

  const subcommand = tokens[1].toLowerCase();
  const args = tokens.slice(2);

  if (subcommand === 'status') {
    return args.every(arg => ['--porcelain', '--short', '--branch'].includes(arg));
  }

  if (subcommand === 'diff') {
    // `git diff` ohne Argumente ist reine Introspektion; erlaubte Flags nach
    // Upstream-Stand: --name-only, --name-status, --cached, --staged, --stat.
    const allowedDiffArgs = new Set(['--name-only', '--name-status', '--cached', '--staged', '--stat']);
    if (args.length === 0) return true;
    return args.length <= 2 && args.every(arg => allowedDiffArgs.has(arg));
  }

  if (subcommand === 'log') {
    return args.every(arg => arg === '--oneline' || /^--max-count=\d+$/.test(arg));
  }

  if (subcommand === 'show') {
    // Erlaubt: `git show <ref>`, `git show --stat|--name-only`,
    // `git show <ref> --stat|--name-only` (Upstream-Stand).
    if (args.length === 0) return false;
    const isRef = (arg) => !arg.startsWith('--') && /^[a-zA-Z0-9._:/ -]+$/.test(arg);
    if (args.length === 1) {
      return args[0] === '--stat' || args[0] === '--name-only' || isRef(args[0]);
    }
    if (args.length === 2) {
      return isRef(args[0]) && (args[1] === '--stat' || args[1] === '--name-only');
    }
    return false;
  }

  if (subcommand === 'branch') {
    return args.length === 1 && args[0] === '--show-current';
  }

  if (subcommand === 'rev-parse') {
    return args.length === 2 && args[0] === '--abbrev-ref' && /^head$/i.test(args[1]);
  }

  return false;
}

module.exports = { isDestructiveBash, isReadOnlyGitIntrospection };
