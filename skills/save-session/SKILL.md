---
name: save-session
description: >-
  Sichert am Sitzungsende den Arbeitsstand (WP8) — schreibt den append-only Journal-Eintrag
  des Tages nach .nc/erinnerung/journal/, konsolidiert .nc/erinnerung/stand.md neu und
  übergibt offene Punkte samt empfohlenem Einstieg an die nächste Sitzung. Trigger-Begriffe:
  „Session beenden", „Feierabend", „Stand sichern", „WP8", „Sitzung abschließen", „Übergabe",
  „für heute fertig".
---

# /nc-felix:save-session — Stand sichern und übergeben (WP8)

## Zweck

Letzter Pflichtschritt jeder Sitzung (WP8 im WP-Rahmen `wp-rahmen.md` dieses Plugins).
Der Skill überführt das, was in dieser Sitzung passiert ist, in das Sitzungsgedächtnis unter
`.nc/erinnerung/`, damit die nächste Sitzung mit `/nc-felix:start` nahtlos daran anknüpfen
kann. Er sichert **Wissen** — er stellt keine Commit-Reife her und ersetzt kein Review.

## Ablauf

1. **Sitzung erfassen:** `git status --short` und `git log --oneline` seit Sitzungsbeginn; dazu
   die eigenen Arbeitsschritte — was wurde entschieden, gefunden, gebaut, verworfen.
2. **Ablage sicherstellen:** `.nc/erinnerung/journal/` anlegen, falls es fehlt. Prüfen, dass
   `.nc/` in der `.gitignore` des Arbeits-Repos steht; fehlt der Eintrag, ihn ergänzen und
   ausdrücklich darauf hinweisen.
3. **Journal fortschreiben:** Eintrag an `.nc/erinnerung/journal/<YYYY-MM-DD>.md` **anhängen**
   (Datei mit Datumsüberschrift anlegen, falls sie fehlt). Inhalt: Uhrzeit, bearbeitete
   Aufgaben, getroffene Entscheidungen mit Begründung, offene Punkte, nächste Schritte.
   Bestehende Zeilen werden nie geändert.
4. **Stand konsolidieren:** `.nc/erinnerung/stand.md` **neu schreiben** — nicht anhängen.
   Erledigtes ersetzt Offenes, überholte Punkte fliegen raus. Struktur: aktueller Arbeitsstand ·
   offene Punkte · zuletzt getroffene Entscheidungen · aktive Branches und offene Pull Requests ·
   bekannte Risiken · nächster Schritt.
5. **Fehlerprotokoll prüfen:** Sind alle eigenen Fehler dieser Sitzung nach der Konvention des
   Arbeits-Repos festgehalten (append-only)? Fehlt ein Eintrag: nachholen.
6. **Übergabe ausgeben:** geschriebene Dateien mit Pfad, Kern des Stands, offene Punkte und der
   empfohlene Einstieg der nächsten Sitzung — plus der Hinweis, dass ein anstehender Commit
   Freigabe des Menschen braucht.

## Regeln

- **Journal ist append-only.** Vergangene Einträge werden nie umgeschrieben oder gelöscht —
  auch nicht, wenn sie sich als falsch erwiesen haben; Korrekturen kommen als neuer Eintrag,
  der auf den alten verweist.
- **`stand.md` ist konsolidiert, nicht kumulativ** — Zielgröße unter 60 Zeilen. Historie gehört
  ins Journal, nicht in den Stand.
- **Nur Belegtes festhalten.** Vermutungen werden als Vermutung markiert, nicht als Stand
  geschrieben. „Läuft" ohne Beweis ist kein Stand.
- **Keine Secrets, Tokens, Kundendaten oder personenbezogenen Pfade** ins Gedächtnis —
  Dateipfade und Ticket-Bezüge des Arbeits-Repos ja, Zugangsdaten nie.
- **Kunden-/Projektkontext bleibt im Arbeits-Repo** unter `.nc/` und wandert nie in das
  Plugin-Repo des Felix-OS.
- **Der Agent committet und pusht nie selbst.** Keine automatischen Pushes, Merges, Posts,
  Releases oder Deployments ohne explizite Nutzerfreigabe — auch nicht „nur schnell den
  Journal-Eintrag".
- **Fehlender `.nc-os`-Marker ist kein Abbruchgrund** — er steuert nur den Begrüßungs-Scope des
  Session-Start-Hooks. Der Skill sichert den Stand trotzdem.

## Verifikation

- Der Journal-Eintrag ist per `tail -20 .nc/erinnerung/journal/<YYYY-MM-DD>.md` sichtbar und die
  Datei ist **länger** als vorher — Zeilenzahl vorher/nachher im Ergebnis ausweisen.
- `.nc/erinnerung/stand.md` existiert, ist unter 60 Zeilen und nennt einen konkreten nächsten
  Schritt.
- Kein bestehender Journal-Block wurde verändert (per Diff oder Zeilenzahl-Vergleich belegen).
- `git status --short` zeigt **keine** `.nc/`-Pfade (Ignore greift).
- Die Übergabe listet jede geschriebene Datei mit vollem Pfad.
