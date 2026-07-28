---
name: code-tour
description: >-
  Führt eine geführte, rein lesende Tour durch das aktuelle Arbeits-Repo — kartiert Struktur,
  Einstiegspunkte, Hauptflüsse, Konventionen und Testlage und gibt eine nummerierte Tour mit
  Datei- und Zeilenverweisen aus, auf Wunsch fokussiert auf ein Thema oder Feature.
  Trigger-Begriffe: „Code-Tour", „führe mich durchs Repo", „Codebase erklären",
  „Einarbeitung", „Onboarding ins Projekt", „wie hängt das zusammen", „Architektur zeigen".
---

# /nc-felix:code-tour — Geführte Tour durch das Arbeits-Repo

## Zweck

Onboarding-Skill des Kernmoduls: verschafft Orientierung in einem (fremden oder eigenen)
Arbeits-Repo, bevor dort gearbeitet wird — als nummerierte Tour mit belegten Stationen statt
als Doku-Nacherzählung. Typischer Einsatz: Einarbeitung in ein neues Projekt (WP1 „Verstehen"
im WP-Rahmen `wp-rahmen.md` dieses Plugins) oder gezielte Vertiefung („zeig mir den
Auth-Flow").

## Ablauf

1. **Fokus klären:** Ohne Angabe gilt die Gesamt-Tour; nennt der Nutzer ein Thema/Feature,
   wird die Tour darauf fokussiert und das Weggelassene benannt.
2. **Repo-Typ bestimmen:** Manifeste an der Wurzel lesen (`package.json`, `pyproject.toml`,
   `Cargo.toml`, `go.mod`, `plugin.json`, …) — Sprache, Build-/Test-Kommandos, Entry-Points.
3. **Struktur kartieren:** Verzeichnisbaum bis Tiefe 2–3 erfassen; je Top-Level-Verzeichnis
   in einem Satz den Zweck bestimmen — aus README/Doku, sonst aus dem Inhalt, dann als
   eigene Einschätzung gekennzeichnet.
4. **Konventionen laden:** `CLAUDE.md`/`AGENTS.md`, `CONTRIBUTING`, Linter-/CI-Konfiguration —
   was gilt hier verbindlich (Branching, Tests, Formate)?
5. **Einstiegspunkte und Hauptfluss tracen:** vom Entry-Point (main, Index, Route, Hook,
   Skill) entlang der Imports/Aufrufe den wichtigsten Fluss verfolgen; je Station notieren:
   Datei, Zeile, Rolle im Fluss.
6. **Testlage erfassen:** Wo liegen Tests, wie werden sie gestartet, was decken sie erkennbar
   ab (Verzeichnis-Scan, kein Coverage-Lauf ohne Auftrag).
7. **Tour ausgeben:** nummerierte Stationen in sinnvoller Lesereihenfolge — je Station
   `Datei:Zeile`, ein Absatz Erklärung, Bezug zur Nachbar-Station; am Ende: offene Fragen,
   Risiken/Überraschungen und ein Vorschlag, wo vertieft werden sollte.

## Regeln

- **Rein lesend.** Die Tour ändert nichts — keine Edits, keine Formatierung, keine
  „Verbesserungen nebenbei", keine Installationen.
- **Jede Station trägt einen Beleg** (`Datei:Zeile` oder ausgeführter Lese-Befehl). Vermutete
  Zusammenhänge sind als Einschätzung markiert, nicht als Fakt.
- **Quelle schlägt Doku:** Widerspricht der Code der README, gilt der Code — die Abweichung
  wird als eigene Station ausgewiesen.
- **Keine Bewertungskaskade:** Die Tour orientiert; ein Review ist ein eigener Auftrag.
  Auffälligkeiten werden gesammelt am Ende genannt, nicht unterwegs verhandelt.
- **Fremder Dead Code wird benannt, nie gelöscht.**
- Bei sehr großen Repos: Tour auf die fokus-relevanten Pfade begrenzen und die Auslassung
  explizit machen — keine Vollständigkeits-Behauptung.

## Verifikation

- Jede Station der Ausgabe nennt `Datei:Zeile` (oder den Lese-Befehl) — keine Station ohne
  Beleg.
- Build-/Test-Kommandos sind aus einem Manifest oder der CI-Konfiguration zitiert, nicht
  geraten.
- Der Verlauf enthält ausschließlich Lese-Operationen (kein Edit/Write, kein
  zustandsändernder Befehl).
- Bei fokussierter Tour ist das ausgelassene Terrain explizit benannt.
- Die Tour endet mit offenen Fragen und genau einem Vertiefungs-Vorschlag.
