---
name: doku-sync
description: >-
  Führt vor einem Commit den übergreifenden Doku-Workflow des Felix-OS aus — prüft zuerst auf
  Redundanzen, zieht die lebende Doku nach (AGENTS.md, README, felix-sync.md, Registry,
  eigener SSOT-Index), stellt den signierten CHANGELOG-Eintrag sicher und prüft den
  Versions-Gleichstand zwischen plugin.json und module-registry.json — der Bump gehört in
  dieselbe Änderung, sobald etwas Ausgeliefertes berührt ist; nur der Release-Schnitt samt Tag
  hängt am Maintainer-Entscheid. Schreibt abschließend den Prüfstempel. Trigger-Begriffe:
  „Doku nachziehen", „Doku-Sync", „CHANGELOG-Eintrag", „Version bumpen", „Release-Tag",
  „Abschluss-Checkliste", „Commit vorbereiten".
---

# /nc-felix:doku-sync — Lebende Doku nachziehen und Commit-Reife herstellen

## Zweck

Infrapflege-Skill des Kernmoduls. Er macht die **Abschluss-Checkliste aus `AGENTS.md`**
ausführbar: Nach inhaltlicher Arbeit und **vor jedem Commit** zieht er die lebende Doku nach,
sichert den CHANGELOG-Eintrag, prüft die Versionslogik und stellt die Commit-Reife her —
bezeugt durch einen Prüfstempel für einen **künftigen** Pre-Commit-Hook (noch nicht
verdrahtet); bis dahin tragen Mensch und Review die Durchsetzung.

## Ablauf

1. **Änderungsumfang erfassen:** `git status --short` und `git diff --stat` — welche Dateien,
   Pfade und Themen sind betroffen?
2. **Redundanz-Vorprüfung:** Vor jedem Schreiben per Grep prüfen, ob die Ziel-Doku die
   Information bereits enthält — Bestehendes konsolidieren statt doppeln. **Keine neuen
   Spiegelstellen für Zahlen** erfinden.
3. **Lebende Doku nachziehen** je Änderungstyp: `AGENTS.md` (normativer Einstieg, Repo-Regeln,
   Abschluss-Checkliste) · `README.md` (Skill- und Modul-Tabelle, Kontroll-Schicht) ·
   `felix-sync.md` (geteilte Anweisung, wird **ausgeliefert**) · `module-registry.json`
   (Modul-Segment und Statuszeile) · `hooks/hooks.json` (die `description` trägt den
   Prosa-Zustand der **gesamten** Kontroll-Schicht). Danach per Grep nach Altpfaden und
   Altbegriffen über das **ganze** Repo verifizieren, dass keine lebenden Verweise
   zurückbleiben — historische Dokumente und append-only-Protokolle ausgenommen.
4. **Eigene Wissensbasis:** Ist eine Datei unter `knowledge-base/` entstanden, gewandert oder
   verschwunden, wird `knowledge-base/SSOT-Document-Index.md` in **derselben** Änderung
   nachgezogen — Teil 1 bei neuer Kategorie oder Verschiebung, Teil 2 bei jeder Wissensdatei.
   Vollständigkeit, Linkgültigkeit, Wurzel-Regel und Kategorie-Routing sind testerzwungen
   (`test/wissensbasis.test.mjs`). Abgeschlossene oder verworfene Pläne wandern per `git mv`
   nach `bauplan-archiv/`, Inhalt unverändert.
5. **`CHANGELOG.md`:** Eintrag sicherstellen — Pflicht für **jede** integrierte Änderung, **mit
   Namenszeichnung des Agenten**. Reine Wissensbasis-Arbeit braucht keinen Bump, den Eintrag
   trotzdem.
6. **Versionslogik (eine Version, ein Spiegel):** Die Version steht **ausschließlich** in
   `.claude-plugin/plugin.json` und wird in `module-registry.json` gespiegelt (testgesichert).
   Der Marketplace-Eintrag im OS-Repo trägt **nie** ein `version`-Feld.
   **Der Bump gehört in dieselbe Änderung**, sobald etwas **Ausgeliefertes** berührt ist —
   Skills, Hooks, `felix-sync.md`, `wp-rahmen.md`, `referenz/`, Manifest. Ohne Bump erreicht
   die Änderung niemanden (`AGENTS.md`, harte Repo-Regel). Schema: Fix = Patch, Neuerung =
   Minor, Strukturbruch = Major.
   **Ausgenommen:** reine Arbeit an `knowledge-base/`, an `test/`, an `.github/` und an
   Repo-Doku, die nicht ausgeliefert wird (`AGENTS.md`, `README.md`, `CHANGELOG.md`) — sie
   ändert kein ausgeliefertes Verhalten; der CHANGELOG-Eintrag bleibt trotzdem Pflicht.
   **Nur** der Release-Schnitt hängt am ausdrücklichen Maintainer-Entscheid: Abschnitt
   `## <version> — <datum>` schneiden und den annotierten Tag `v<version>` vorbereiten.
7. **Validieren:** `claude plugin validate . --strict` — die Repo-Wurzel **ist** das Plugin,
   `--strict` prüft Manifest **und** Skills. Ein stilles „Validation passed" ist das
   Erfolgssignal. Skill-Änderungen zusätzlich gegen `referenz/skill-authoring.md` prüfen.
   Danach die Testsuite: `node --test test/*.test.mjs` — wortgleich, Glob statt Verzeichnis.
   Ist in der Umgebung ein Gate-Opt-out gesetzt (`NC_START_GATE`, `NC_FFG`), vorher leeren:
   sonst melden die Gate-Tests grün, ohne etwas zu prüfen.
8. **Protokoll-Check:** Sind alle eigenen Fehler dieser Sitzung in
   `knowledge-base/debugging-findings/agent-learnings.md` und alle gefundenen Bugs in
   `debug-log.md` eingetragen? Falls nein: nachholen — sofort, nicht sammeln.
9. **Prüfstempel schreiben** (nur nach vollständigem Durchlauf): gewünschten Stand stagen, dann
   den `git write-tree`-Hash mit ISO-Datum nach `.git/nc-felix/doku-sync.stamp` schreiben. Ein
   künftiger Pre-Commit-Hook wird den Stempel-Hash mit dem tatsächlich committeten Stand
   vergleichen.
10. **Ergebnis an den Nutzer:** nachgezogene Dokumente, CHANGELOG-Eintrag, Versions- und
    Tag-Status, Testergebnis, Stempel-Bestätigung — als Grundlage für die Commit-Freigabe.

## Regeln

- **Der Agent committet, pusht und taggt nie selbst ohne explizite Freigabe des Maintainers** —
  dieser Skill stellt Commit-Reife her, mehr nicht.
- **Bump = Teil der Änderung, nicht des Releases.** Wird etwas Ausgeliefertes berührt, wird in
  derselben Änderung gebumpt — kein Bump heißt: die Änderung erreicht niemanden. **Tag und
  Release** dagegen nur bei ausdrücklichem Maintainer-Entscheid.
- **Historisch bleibt historisch:** CHANGELOG-Alteinträge, archivierte Pläne und die beiden
  append-only-Protokolle werden **nie** rückwirkend umgeschrieben; nachgezogen wird
  ausschließlich lebende Doku.
- **Isolation:** Dieser Skill fasst **nie** Dateien des OS-Repos an. Die Wissensbasis dieses
  Repos ist terminal; was dort nachzuziehen wäre, ist ein eigener Vorgang im OS-Repo.
- Der Prüfstempel wird **nie „auf Vorrat"** geschrieben — nur nach vollständigem Durchlauf; er
  liegt unter `.git/` und wird nie versioniert.
- Bei Widerspruch zwischen Doku und Platte gewinnt die Platte: realen Zustand verifizieren
  (Glob, Grep, `git status`), Doku korrigieren, Abweichung im Ergebnis melden — **nachfragen
  statt raten**, wenn die Intention unklar ist.

## Verifikation

- Grep nach den geänderten Altpfaden und Altbegriffen liefert **null** Treffer in lebender
  Doku; verbleibende Treffer sind namentlich als historisch benannt.
- Der `CHANGELOG.md`-Diff zeigt den Eintrag inklusive Namenszeichnung.
- `.claude-plugin/plugin.json` und `module-registry.json` tragen dieselbe Version (beide Werte
  im Ergebnis nebeneinander ausgewiesen).
- `claude plugin validate . --strict` meldet „Validation passed", und
  `node --test test/*.test.mjs` ist grün — beide Ausgaben zitiert, nicht behauptet.
- Bei Änderungen unter `knowledge-base/`: `test/wissensbasis.test.mjs` ist grün, und der Index
  nennt jede neue Datei.
- `.git/nc-felix/doku-sync.stamp` existiert und enthält den aktuellen `git write-tree`-Hash
  plus Datum.
