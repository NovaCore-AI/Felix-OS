# Modul-Definition Felix-OS — Vorhaben, angelegt 2026-08-11

> **Status: laufend.** Erster eigener Bauplan dieses Repos. Er beschreibt, wie aus dem heutigen
> Ein-Modul-Zustand (nur Kernmodul) die **Arbeitsmodule** von Felix entstehen. Solange dieses
> Dokument lebt, liegt es in `grundwissen/`; ist der Modulzuschnitt entschieden und gebaut,
> wandert es pflichtgemäß nach `bauplan-archiv/`.
>
> **Vor jedem neuen Präfix oder Skill zuerst hier lesen.**

## 1. Ausgangslage (verifiziert am 2026-08-11 gegen `module-registry.json` und `skills/`)

| | Stand |
|---|---|
| Module | genau **eines**: `kern`, Präfix leer (das Kernmodul trägt kein Präfix) |
| Skills im Kernmodul | `start`, `save-session`, `journal`, `os-info`, `code-tour`, `skill-builder` |
| Arbeitsmodule | **keine** — die Registry führt sie unter `geplant`: „werden gemeinsam mit dem Fachbereich definiert" |
| Kontroll-Schicht | eigene Kopie unter `hooks/` (FFG); Gate 2 kommt mit dem laufenden Nachzug |
| Wissensbasis | dieses Verzeichnis, angelegt am 2026-08-11 |

Das Repo **ist** das Plugin; es hängt bewusst nicht am NovaCore-Kern `nc` und wird nicht
parallel zu ihm betrieben (sonst feuern die Gates doppelt).

## 2. Was ein Modul in diesem OS ist

Ein Modul ist **kein** eigenes Plugin, sondern eine **Skill-Präfix-Gruppe** innerhalb dieses
einen Plugins:

- Skills liegen flach unter `skills/<name>/SKILL.md`; das Präfix ist Teil des Skill-Namens.
- Das **Kernmodul trägt kein Präfix** — seine Skills heißen `/nc-felix:start` und so weiter.
- Ein Arbeitsmodul trägt ein kurzes Präfix, das im Skill-Namen steht.
- **Ein Modul darf mehrere Präfixe führen**, wenn der Fachbereich das verlangt (belegter Fall
  im Schwester-OS `nc-biggi`: ein Modul `dokumentation-daily-work` mit `doc` und `day`).
- `module-registry.json` ist **Metadaten-SSOT und steuert nichts aus**: Nutzbar ist, was der
  Skill-Scan wirklich findet. Ein Ordner ohne `SKILL.md` wird nie ausgeliefert — deshalb
  reservieren `PLATZHALTER.md`-Ordner gefahrlos einen Namen.

Daraus folgt die Reihenfolge: **erst Zuschnitt, dann Präfix, dann Skill.** Ein Präfix, das
später umbenannt wird, ist teamsichtbar — der alte Slash-Befehl verschwindet.

## 3. Offene Fragen an Felix (vor dem ersten Arbeitsmodul zu klären)

1. **Welche wiederkehrenden Arbeiten** macht Felix so oft, dass ein Skill sie lohnt? Kriterium:
   mindestens wöchentlich **oder** fehleranfällig genug, dass eine feste Reihenfolge hilft.
2. **Wie schneiden sich diese Arbeiten in Module?** Ein Modul ist eine Arbeitsdomäne, kein
   einzelner Handgriff. Faustregel: weniger, dafür tragende Module.
3. **Präfixe:** kurz, kollisionsfrei, sprechend. Je Modul eins — ein zweites nur, wenn zwei
   Aufrufgewohnheiten wirklich nebeneinander existieren.
4. **Fachablauf:** Bildet ein Modul einen Zyklus ab, der auf WP1–WP7 passt? Dann entsteht
   daneben eine `workflow.md`; der Rahmen WP0–WP8 bleibt unverändert in `wp-rahmen.md`.
5. **Fremdsysteme:** Braucht ein Modul einen Konnektor (Zugang, CLI, MCP)? Dann gehören
   Host-Anforderungen in die `README.md`, Zugangsdaten ausschließlich in Env — **nie** in eine
   Datei dieses Repos.

Diese Fragen werden **mit Felix** beantwortet, nicht stellvertretend geraten.

## 4. Geführter Weg

Der Bau läuft über `/nc-felix:skill-builder` — der Skill führt durch Modulzuschnitt,
Präfixwahl, Registry-Eintrag und Skill-Gerüst nach `referenz/skill-authoring.md`.

Je neuem Modul fällt an: Registry-Eintrag (Modul, Präfix, Status, Skills) · Skill(s) nach den
Formatregeln · `README.md`-Tabelle · `CHANGELOG.md`-Eintrag mit Namenszeichnung ·
Version-Bump in `.claude-plugin/plugin.json` **plus** Registry-Spiegel · Suite und
`claude plugin validate . --strict`.

## 5. Abnahme dieses Vorhabens

Abgeschlossen ist es, wenn **mindestens ein Arbeitsmodul** mit Felix definiert, in der Registry
geführt und mit wenigstens einem funktionierenden Skill ausgeliefert ist — und wenn die offenen
Fragen aus §3 hier beantwortet nachgetragen sind. Danach: `git mv` nach `bauplan-archiv/`,
Index-Zeile in derselben Änderung mitziehen.

## 6. Nachträge

> Regel: Abweichungen werden **erst hier dokumentiert, dann gebaut**. Der jüngste Nachtrag
> gewinnt; der Text oberhalb wird nicht rückwirkend umgeschrieben.

*(noch keine)*

---

*Angelegt 2026-08-11 durch Claude (Opus 5, Claude Code) auf Weisung Lucas Vöhringer, als erster
Inhalt der neuen Wissensbasis dieses Repos (Standardprozess `ssot-aufbau.md` §4 des OS-Repos).
Ausgangslage gegen `module-registry.json` und `skills/` verifiziert, nicht erinnert.*
