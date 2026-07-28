# Changelog — nc-felix

## 0.2.1 — 2026-07-28

- **fix: Repository-URL auf die reale Heimat korrigiert** — das Repo wurde vom Maintainer
  als `NovaCore-AI/Felix-OS` angelegt (nicht `NovaCoreAI-OS-<Abteilung>` wie im
  Satelliten-Namensschema angenommen); `repository` im Manifest entsprechend berichtigt.
- Team-Rollout-Hinweis verifiziert (Install-Fehler 2026-07-28, App und CLI):
  GitHub-Sources klonen per Default über SSH — ohne autorisierten SSH-Key schlägt die
  Installation mit `Permission denied (publickey)` fehl. Abhilfe:
  `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` setzen (nutzt die gh/git-Credentials).
- Doku: `AGENTS.md` und `felix-sync.md` verweisen jetzt auf den mit diesem Repo
  pilotierten Standardablauf `plugin-bau.md` §3b des OS-Repos (eigenständiges
  Kollegen-OS, inkl. Install-Fallen). — Agent: Claude (Fable 5)

## 0.2.0 — 2026-07-28

Umbau auf das **eigenständige Ein-Plugin-Modell** (Auftrag Maintainer 2026-07-28: „Module
statt Abteilungen, kein Kern als Plugin — das reicht als Modul"):

- **Kern-Dependency entfernt** (`dependencies: ["nc"]` gestrichen) — der Kern ist jetzt ein
  **Modul** dieses Plugins, kein eigenes Plugin. Koexistenz-Regel dokumentiert: nicht
  parallel zum NovaCore-Kern `nc` betreiben (doppelte Gates).
- **Kernmodul (ohne Präfix), 6 Skills:** `start`, `save-session`, `journal` (Workflow
  WP0/WP8, angepasste Ports aus dem NovaCore-Kern) sowie `os-info`, `code-tour`,
  `skill-builder` (Maintenance-Basics; `os-info`/`skill-builder` nach Onsite-Vorbild,
  `code-tour` Neubau).
- **Eigene Kontroll-Schicht:** FFG (`hooks/nc-ffg.js` + `hooks/lib/`) als verbatim-Port aus
  dem NovaCore-Kern übernommen (gleiche Env-Schalter `NC_FFG*`), SessionStart-Hinweis
  (`hooks/nc-session-start.js`) auf `/nc-felix:`-Namespace angepasst; `.nc-os`-Marker-Logik
  unverändert (isFile-Prüfung).
- **Geteilte Strukturen ins Plugin übernommen:** `felix-sync.md` (Global-Anweisung, Port der
  `nc-sync.md`), `wp-rahmen.md` (WP0–WP8, Träger: Kernmodul/Arbeitsmodule),
  `module-registry.json` (Modul-SSOT), `referenz/skill-authoring.md` (Formatregeln).
- **Tests erweitert:** FFG-Testsuite (verbatim übernommen) + SessionStart-Tests (angepasst)
  + Struktur-/Frontmatter-Invarianten (Eigenständigkeit, Hooks-Pflicht, Registry-Spiegel,
  YAML-Falle, Plugin-Grenze). — Agent: Claude (Fable 5)

## 0.1.0 — 2026-07-28

- Abteilungsplugin `nc-felix` als **erster Satellit des NovaCore-OS** angelegt (Muster:
  Onsite.ai-OS-Satellit `oai-marketing`, produktiv erprobt; Standardprozess `plugin-bau.md`
  §3a des OS-Repos). Das Repo IST das Plugin: Manifest an der Wurzel.
- Stand: angelegt, **noch keine gebauten Skills** — Modul- und Skill-Planung erfolgt separat
  mit dem Fachbereich (Felix). `dependencies: ["nc"]` zieht den Kern transitiv mit
  (Kontroll-Hook FFG, WP-Rahmen, geteilte Global-Anweisung `nc-sync.md`).
- Qualitätsbasis: Manifest-/Struktur-Tests (`node --test`), CI-Workflow `quality`
  (SHA-gepinnte Actions), `.gitignore` (u. a. `.nc/`-Memory), `.nc-os`-Marker für den
  SessionStart-Hinweis des Kerns, `AGENTS.md` mit Satelliten-Regeln. — Agent: Claude (Fable 5)
