# Changelog — nc-felix

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
