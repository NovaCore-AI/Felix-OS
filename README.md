# Felix-OS — `nc-felix`

**Das eigenständige Abteilungs-OS von Felix** — ausgeliefert als **ein** Claude-Code-Plugin
aus dem Marketplace `novacore-os`. **Dieses Repository IST das Plugin** (Manifest an der
Wurzel: `.claude-plugin/plugin.json`). Unterteilt wird in **Module** (Skill-Präfixe), nicht
in Abteilungen; einen Kern als eigenes Plugin gibt es bewusst nicht — der Kern ist ein
**Modul** dieses Plugins.

**Status: Kernmodul v0.2.0 ausgeliefert (6 Skills) · Arbeitsmodule folgen** — Modul- und
Skill-Planung erfolgt gemeinsam mit dem Fachbereich (Felix).

## Architektur

| Baustein | Inhalt | Aufruf |
|---|---|---|
| **Kernmodul** (kein Präfix) | Workflow WP0/WP8 + Maintenance-Basics: `start`, `save-session`, `journal`, `os-info`, `code-tour`, `skill-builder` | `/nc-felix:<name>` |
| **Arbeitsmodule** (eigene Präfixe) | geplant — werden gemeinsam mit dem Fachbereich definiert (`module-registry.json`) | `/nc-felix:<praefix>-<name>` |
| **Kontroll-Schicht** (`hooks/`) | FFG (Fact-Forcing-Gate) + SessionStart-Hinweis — Port aus dem NovaCore-Kern `nc`, testgesichert | automatisch |
| **Geteilte Anweisung** | `felix-sync.md` (Methodik/Conventions/Safety) + `wp-rahmen.md` (Pflicht-Zyklus WP0–WP8) | mit dem Plugin synchron |

Herkunft: Strukturen übernommen aus dem NovaCore-OS (FFG, Sicherheitsstrukturen,
Sync-Anweisung, WP-Rahmen) und auf das Ein-Plugin-Modell angepasst. Der Eintrag im
Marketplace `novacore-os` (OS-Repo `NovaCore-AI/NovaCoreAI-OS`) zeigt per GitHub-Source mit
Commit-SHA-Pin auf dieses private Repository.

## Kernmodul-Skills

| Skill | WP | Zweck |
|---|---|---|
| `/nc-felix:start` | WP0 | Session-Start: Stand, Journal, Git-Lage, Werkzeuglage laden — kein Blind-Start |
| `/nc-felix:save-session` | WP8 | Session-Ende: Journal schreiben, Stand konsolidieren, Übergabe |
| `/nc-felix:journal` | laufend | Einzelne Ereignisse sofort festhalten (append-only, mit Beleg) |
| `/nc-felix:os-info` | Basics | Das OS erklären, wie es wirklich installiert ist |
| `/nc-felix:code-tour` | WP1/Basics | Geführte, rein lesende Tour durch ein Arbeits-Repo |
| `/nc-felix:skill-builder` | Basics | Eigene Skills/Module nach den OS-Regeln bauen |

## Kontroll-Schicht (Hooks)

| Hook | Event | Verhalten |
|---|---|---|
| `nc-ffg` (FFG, Fact-Forcing-Gate) | PreToolUse (Write/Edit/MultiEdit/Bash) | Fakten **vor** der Aktion: Datei-Gate je Zieldatei, Destruktiv-Gate je Kommando, Routine-Bash einmal je Session; Read-only-Git nie. **Markerlos aktiv**; Opt-out nur per Env `NC_FFG=off`; Schalter: `NC_FFG_EXEMPT_GLOBS`, `NC_FFG_FULL_DENIALS`, `NC_FFG_EXTRA_DESTRUCTIVE`. Fail-open bei internen Fehlern. |
| `nc-session-start` | SessionStart | Begrüßung + `/nc-felix:start`-Hinweis + Version — **nur** in Repos mit `.nc-os`-Marker-**Datei** (Komfort, kein Gate) |

**Koexistenz:** Das Felix-OS ist nicht dafür gedacht, parallel zum NovaCore-Kern `nc`
(bzw. `nc-development`) in derselben Session zu laufen — sonst feuern Gates und Begrüßung
doppelt. Wer beides installiert hat, deaktiviert eines davon.

## Installation

```
/plugin marketplace add NovaCore-AI/NovaCoreAI-OS
/plugin install nc-felix@novacore-os
```

Hinweis für Maschinen ohne geladenen SSH-Key: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` setzen —
GitHub-Sources klonen per Default über SSH. Voraussetzungen: Claude Code ≥ 2.1.193,
Node.js ≥ 18 (Hooks).

## Updatebarkeit

Version je Release **ausschließlich** in `.claude-plugin/plugin.json` bumpen (SemVer; kein
Bump = kein Auto-Update im Team) plus CHANGELOG-Eintrag im selben Change. Nach dem Merge
setzt der Maintainer den annotierten Tag `v<version>` und zieht im OS-Repo den
Marketplace-Pin nach (`ref` zur Lesbarkeit, der 40-stellige `sha` ist der effektive Pin).
Details: `AGENTS.md` in diesem Repo.

## Entwicklung

```bash
npm test                          # node --test test/*.test.mjs (Manifest, Hooks, Frontmatter, FFG)
claude plugin validate . --strict # Manifest UND Skills — die Repo-Wurzel IST das Plugin
```

Skill-Format: `referenz/skill-authoring.md` · Neue Skills/Module: `/nc-felix:skill-builder`.

## Nächster Schritt

Arbeitsmodule (Skill-Präfixe) und Skill-Kandidaten gemeinsam mit dem Fachbereich festlegen;
je Modul entsteht eine `workflow.md` (WP1–WP7). Herkunfts-Prozesse: Standardprozess
`knowledge-base/standardprozesse/plugin-bau.md` des OS-Repos.

**Lizenz:** intern, proprietär (NovaCore AI) — kein Open-Source-Release.
