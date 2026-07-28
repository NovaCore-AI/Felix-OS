# `nc-felix` — Abteilung felix (Platzhalter)

> **Status: Plugin angelegt, keine gebauten Skills.** Das Plugin ist installierbar, damit die
> Abteilungsgrenze existiert und der Kern als Dependency mitkommt — die Modul- und
> Skill-Planung erfolgt separat mit dem Fachbereich (Felix). Diesen Absatz ersetzen, sobald
> die Abteilung Skills ausliefert.

**Heimat:** Dieses Repository (`NovaCore-AI/NovaCoreAI-OS-Felix`, privat) ist die einzige
Quelle des Plugins — **das Repo IST das Plugin** (Manifest an der Wurzel:
`.claude-plugin/plugin.json`). Es ist der erste Satellit des NovaCore-OS (Muster aus dem
Onsite.ai-OS, dort produktiv erprobt; Ablauf: Standardprozess
`knowledge-base/standardprozesse/plugin-bau.md` §3a des OS-Repos). Der Eintrag im
Marketplace `novacore-os` des OS-Repos zeigt per GitHub-Source mit Commit-SHA-Pin hierher.

**Abhängigkeit:** `dependencies: ["nc"]` — Installation zieht den Kern `nc` automatisch mit:

- **FFG (Fact-Forcing-Gate):** Kontroll-Hook mit Datei-Gate, Destruktiv-Gate und
  Routine-Bash-Gate — markerlos aktiv, deny statt ask, Opt-out nur per Env `NC_FFG=off`.
- **Sicherheitsstrukturen:** rote Linien des WP-Rahmens WP0–WP8 (keine Pushes, Merges,
  Releases ohne explizite Freigabe), Session-Zyklus `/nc:start` … `/nc:save-session`.
- **`nc-sync.md`:** die geteilte, synchronisierte Global-Anweisung aller Abteilungen
  (Methodik, Conventions, Safety) — kommt mit dem Kern-Plugin und bleibt über
  Marketplace-Updates synchron.

Eigene Hooks bringt dieses Plugin bewusst **nicht** mit; die Kontroll-Schicht liegt
ausschließlich im Kern. Der Namespace `/nc-felix:<skill>` ist reserviert.

**Lizenz:** intern, proprietär (NovaCore AI) — kein Open-Source-Release.

## Installation

```
/plugin marketplace add NovaCore-AI/NovaCoreAI-OS
/plugin install nc-felix@novacore-os
```

Der Kern `nc` kommt automatisch als Dependency mit. Hinweis für Maschinen ohne geladenen
SSH-Key: `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` setzen — GitHub-Sources klonen per Default
über SSH.

## Updatebarkeit

Version je Release **ausschließlich** in `.claude-plugin/plugin.json` bumpen (SemVer; kein
Bump = kein Auto-Update im Team) plus CHANGELOG-Eintrag im selben Change. Nach dem Merge
setzt der Maintainer den annotierten Tag `v<version>` und zieht im OS-Repo den
Marketplace-Pin nach (`ref` zur Lesbarkeit, der 40-stellige `sha` ist der effektive Pin).
Details: `AGENTS.md` in diesem Repo.

## Module und Skills

Noch keine. Sobald der Modul-Zuschnitt (Skill-Präfixe) steht, hier die Übersichtstabelle
nach dem Vorbild von `plugins/nc-development/README.md` im OS-Repo ergänzen:

| Modul | WP | Skills |
|---|---|---|
| — | — | — |

## Nächster Schritt

Modul-Zuschnitt und Skill-Kandidaten mit dem Fachbereich festlegen, dann nach
`referenz/skill-authoring.md` des Kern-Plugins bauen. Sobald WP1–WP7 auf den realen Zyklus
dieser Abteilung abgebildet sind, entsteht daneben eine `workflow.md` (Vorbild:
`plugins/nc-development/workflow.md` im OS-Repo). Ablauf im Standardprozess
`knowledge-base/standardprozesse/plugin-bau.md` des OS-Repos.
