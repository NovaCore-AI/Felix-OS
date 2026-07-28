---
name: start
description: >-
  Startet jede Arbeitssitzung mit geladenem Kontext statt Blind-Start (WP0) — liest den
  konsolidierten Stand und das jüngste Journal aus .nc/erinnerung/, erfasst die Git-Lage des
  Arbeits-Repos, bestimmt die nutzbaren Module des Felix-OS und legt den nächsten
  Workflow-Schritt fest. Trigger-Begriffe: „Session starten", „Sitzung beginnen",
  „Wo standen wir", „Kontext laden", „WP0", „Stand laden", „neuer Arbeitstag".
---

# /nc-felix:start — Session-Start mit geladenem Kontext (WP0)

## Zweck

Erster Pflichtschritt jeder Sitzung (WP0 im WP-Rahmen `wp-rahmen.md` dieses Plugins;
WP1–WP7 konkretisiert das jeweilige Arbeitsmodul). Der Skill stellt den Arbeitskontext her,
bevor irgendeine inhaltliche Aktion passiert: Stand, jüngstes Journal, Git-Lage, Projekt-Doku,
verfügbare Werkzeuge. Ohne diesen Schritt arbeitet der Agent aus dem Gedächtnis — genau der
Blind-Start, den das Felix-OS verhindert.

## Ablauf

1. **Arbeits-Repo erfassen:** `git status --short --branch` und `git log --oneline -10`.
   Unkommittierte Änderungen und der jüngste Commit gehen jeder Doku-Aussage vor — der
   Working Tree ist die Wahrheit.
2. **Marker prüfen:** Liegt im Repo-Root die **Datei** `.nc-os`? Sie steuert allein den
   Begrüßungs-Scope des Session-Start-Hooks, nicht diesen Skill. Fehlt sie, das einmal
   benennen („kein markiertes Felix-OS-Arbeits-Repo — die Begrüßung des Hooks bleibt aus")
   und **normal weiterarbeiten**. Ein Verzeichnis gleichen Namens ist kein Marker.
3. **Stand laden:** `.nc/erinnerung/stand.md` lesen — der konsolidierte Gesamtstand. Fehlt die
   Datei, das offen benennen statt zu improvisieren.
4. **Jüngstes Journal laden:** neueste Datei aus `.nc/erinnerung/journal/` (Dateiname
   `<YYYY-MM-DD>.md`) — offene Punkte, Blocker und Entscheidungen des letzten Arbeitstages.
5. **Werkzeuglage bestimmen:** Welche Module des Felix-OS sind nutzbar? Die
   `module-registry.json` dieses Plugins ist die Metadaten-Quelle dafür, welche Module
   (Skill-Präfixe; das Kernmodul trägt keins) welche Skills umfassen; sie **steuert nichts
   aus**, sie beschreibt nur. Nutzbar ist, was der Skill-Scan (`skills/<name>/SKILL.md`)
   wirklich findet.
6. **Projekt-Doku prüfen:** `CLAUDE.md` bzw. `AGENTS.md` des Arbeits-Repos auf Regeln, die für
   diese Sitzung gelten. Ergänzend gilt `felix-sync.md` dieses Plugins als globale
   Methodik-Anweisung; bei Widerspruch gewinnt die repo-eigene Fachanweisung für Fachfragen.
7. **Lagebericht ausgeben:** Branch und Git-Lage · Stand in drei bis fünf Zeilen · offene
   Punkte aus dem Journal · nutzbare Module und Skills · **vorgeschlagener nächster
   Workflow-Schritt** mit dem Skill, der ihn trägt.

## Regeln

- **Keine inhaltliche Arbeit vor abgeschlossenem Lagebericht** — kein Edit, kein Commit,
  keine Recherche „nebenbei".
- **Dieser Skill ist rein lesend.** Er legt nichts an, ändert nichts, committet nichts.
- **Quelle schlägt Gedächtnis:** Widerspricht der geladene Stand dem realen Repo-Zustand,
  gilt das Repo; die Abweichung wird im Lagebericht gemeldet, nicht stillschweigend geglättet.
- **Fehlender Marker ist kein Abbruchgrund** — er verändert nur den Begrüßungs-Scope. Der
  Skill weist einmal darauf hin und arbeitet weiter.
- Fehlt Stand oder Journal vollständig, wird das als **offener Erstlauf** gemeldet — der Stand
  wird **nicht** aus Commits rekonstruiert und als gesicherter Stand ausgegeben.
- **`.nc/` gehört in die `.gitignore` des Arbeits-Repos** und wird nie committet; fehlt der
  Eintrag, weist der Skill darauf hin, ändert die Datei aber nicht selbst.
- **Installation und Aktualisierung sind Marketplace-Sache** — dieser Skill richtet nichts ein
  und aktualisiert nichts.
- Rote Linien gelten ab der ersten Sekunde: keine automatischen Pushes, Merges, Posts,
  Releases oder Deployments ohne explizite Nutzerfreigabe.

## Verifikation

- Der Lagebericht nennt **jede gelesene Datei mit Pfad und Datum** (Stand, Journal,
  Projekt-Doku) oder benennt sie ausdrücklich als fehlend.
- Branch, Anzahl unkommittierter Dateien und jüngster Commit-Hash sind ausgewiesen.
- Der Marker-Zustand ist genannt (Datei vorhanden / fehlt / gleichnamiges Verzeichnis).
- Die nutzbaren Module sind mit Skills und Aufrufform (`/nc-felix:<name>`) gelistet.
- `git status --short` zeigt **keine** `.nc/`-Pfade (Ignore greift) — sonst wird der fehlende
  `.gitignore`-Eintrag im Bericht gemeldet.
- Der Bericht endet mit genau **einem** vorgeschlagenen nächsten Schritt samt zuständigem Skill.
