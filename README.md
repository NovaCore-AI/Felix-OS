# Felix-OS — `nc-felix`

**Das eigenständige Abteilungs-OS von Felix** — ausgeliefert als **ein** Claude-Code-Plugin
aus dem Marketplace `novacore-os`. **Dieses Repository IST das Plugin** (Manifest an der
Wurzel: `.claude-plugin/plugin.json`). Unterteilt wird in **Module** (Skill-Präfixe), nicht
in Abteilungen; einen Kern als eigenes Plugin gibt es bewusst nicht — der Kern ist ein
**Modul** dieses Plugins.

**Status: v0.4.0 — Kernmodul ausgeliefert (7 Skills), Kontroll-Schicht mit Gate 1 **und**
Gate 2, eigene isolierte Wissensbasis, CI/Release-Standard · Arbeitsmodule folgen** — Modul-
und Skill-Planung erfolgt gemeinsam mit dem Fachbereich (Felix); der laufende Plan dazu liegt
in `knowledge-base/grundwissen/`.

## Architektur

| Baustein | Inhalt | Aufruf |
|---|---|---|
| **Kernmodul** (kein Präfix) | Workflow WP0/WP8, Maintenance-Basics und Doku-Pflege: `start`, `save-session`, `journal`, `os-info`, `code-tour`, `skill-builder`, `doku-sync` | `/nc-felix:<name>` |
| **Arbeitsmodule** (eigene Präfixe) | geplant — werden gemeinsam mit dem Fachbereich definiert (`module-registry.json`) | `/nc-felix:<praefix>-<name>` |
| **Kontroll-Schicht** (`hooks/`) | **Gate 1** (FFG) + **Gate 2** (Session-Start-Zwang: Injektion, Start-Gate, Fakten-Stempel) — Port aus dem NovaCore-Kern `nc`, testgesichert | automatisch |
| **Eigene Wissensbasis** (`knowledge-base/`) | Master-Index, laufende Vorhaben, Archiv, zwei append-only-Protokolle, Ideen-Backlog — **terminal**, kein Weg zurück ins OS-Repo | Arbeitsmaterial des Repos |
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
| `/nc-felix:doku-sync` | vor Commit | Lebende Doku nachziehen, CHANGELOG und Versions-Gleichstand prüfen, Wissensbasis-Index sichern, Prüfstempel setzen |

## Kontroll-Schicht (Hooks)

| Hook | Event | Verhalten |
|---|---|---|
| `nc-ffg` (FFG, Fact-Forcing-Gate) | PreToolUse (Write/Edit/MultiEdit/Bash) | Fakten **vor** der Aktion: Datei-Gate je Zieldatei, Destruktiv-Gate je Kommando, Routine-Bash einmal je Session; Read-only-Git nie. **Markerlos aktiv**; Opt-out nur per Env `NC_FFG=off`; Schalter: `NC_FFG_EXEMPT_GLOBS`, `NC_FFG_FULL_DENIALS`, `NC_FFG_EXTRA_DESTRUCTIVE`. Fail-open bei internen Fehlern. |
| `nc-session-start` (Gate 2, Teil 1) | SessionStart | Injiziert Pflicht-Einstieg, **lebenden Stand** (Branch, Commits, Working Tree, `[Unreleased]`, jüngste datierte Pläne aus der eigenen Wissensbasis, Module) und den exakten Stempel-Befehl. **Markerlos** — ein Gate, das man vergessen kann, ist kein Gate. Kann laut Doku nicht blocken. |
| `nc-start-gate` (Gate 2, Teil 2) | PreToolUse (Write/Edit/MultiEdit/NotebookEdit/Bash) | Lehnt jede **schreibende** Aktion ab, bis `/nc-felix:start` per Fakten-Stempel abgeschlossen ist. Lesen und Read-only-Git bleiben frei. Subagenten ausgenommen. Opt-out `NC_START_GATE=off` — **ein Gate, ein Schalter** (gilt auch für Teil 1). |
| `nc-start-stempel` (Gate 2, Teil 3) | manuell, letzter Schritt von `/nc-felix:start` | Fakten-Stempel: `--branch`/`--head` werden gegen die Git-Lage des **Projektverzeichnisses** verifiziert. State unter `os.tmpdir()/nc-felix-start-gate`, Override `NC_START_GATE_STATE_DIR`; Verfall nach 30 Min Inaktivität. |

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
npm test                          # node --test test/*.test.mjs (Manifest, FFG, Gate 2, Wissensbasis)
claude plugin validate . --strict # Manifest UND Skills — die Repo-Wurzel IST das Plugin
```

Skill-Format: `referenz/skill-authoring.md` · Neue Skills/Module: `/nc-felix:skill-builder` ·
Vor dem Commit: `/nc-felix:doku-sync`.

> **Wichtig für die Gate-Tests:** Ist in deiner Shell ein Opt-out gesetzt (`NC_START_GATE`,
> `NC_FFG`), vorher leeren. Sonst antworten die Hooks korrekt mit *nichts* und die Suite meldet
> grün, ohne etwas geprüft zu haben. CI und Release-Workflow leeren beide Variablen selbst.

### CI und Release

| Workflow | Auslöser | Inhalt |
|---|---|---|
| `.github/workflows/ci.yml` | Push auf `main`, jeder PR, manuell | Testsuite auf **ubuntu + windows × Node 20/22/24** (Bash expandiert das Glob, auch auf Windows) · `claude plugin validate . --strict` mit **Positivkontrolle**: Ein absichtlich defekter Skill in einer Wegwerf-Kopie **muss** rot werden, die intakte Kontrollgruppe grün — meldet der Validator dort keinen Fehler, prüft er keine Skills mehr und jedes Grün darunter ist wertlos. Actions per Full-SHA gepinnt |
| `.github/workflows/release.yml` | Push eines annotierten Tags `v<version>` | Vier hart scheiternde Vorbedingungen: annotierter Tag · Tag == Version in `plugin.json` · grüne Suite · vorhandener CHANGELOG-Abschnitt. Danach GitHub-Release mit den CHANGELOG-Notes |

## Nächster Schritt

Arbeitsmodule (Skill-Präfixe) und Skill-Kandidaten gemeinsam mit dem Fachbereich festlegen;
je Modul entsteht eine `workflow.md` (WP1–WP7). Herkunfts-Prozesse: Standardprozess
`knowledge-base/standardprozesse/abteilungs-plugin-bau.md` des OS-Repos; die Wissensbasis
dieses Repos folgt `ssot-aufbau.md` §4 ebendort (Quellenangaben, keine Lesepfade).

**Lizenz:** intern, proprietär (NovaCore AI) — kein Open-Source-Release.
