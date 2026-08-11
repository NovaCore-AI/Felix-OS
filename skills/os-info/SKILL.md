---
name: os-info
description: >-
  Erklärt das Felix-OS und seine Bestandteile auf Basis dessen, was wirklich installiert ist —
  ermittelt Version und Quelle des Plugins nc-felix, liest dessen module-registry.json, zählt
  je Modul die real vorhandenen Skills samt Aufrufform, prüft die Kontroll-Hooks (FFG) im
  aktuellen Repo und erklärt Installation und Update über den Marketplace novacore-os.
  Trigger-Begriffe: „Was ist das Felix-OS", „was kann das OS", „welche Skills gibt es",
  „welche Module", „OS erklären", „Orientierung im OS", „Hilfe zum OS".
---

# /nc-felix:os-info — Das OS erklären, wie es wirklich installiert ist

## Zweck

Orientierungs-Skill des Kernmoduls: erklärt Aufbau und Bestandteile des Felix-OS **auf Basis
des realen Installationszustands** — nie aus Doku-Erinnerung. Das Felix-OS ist **ein**
eigenständiges Plugin (`nc-felix`) aus dem Marketplace `novacore-os`, unterteilt in **Module**
(Skill-Präfixe) statt Abteilungen; das Kernmodul trägt kein Präfix. Der Skill unterscheidet
strikt zwischen „installiert und nutzbar" und „geplant, aber nicht gebaut".

## Ablauf

1. **Installation ermitteln:** `claude plugin list` ausführen und das Plugin `nc-felix`
   erfassen — Version, Quelle, gemeldete Fehler. Schlägt der Befehl fehl: im Plugin-Cache
   suchen (`~/.claude/plugins/cache`) und die `plugin.json` der Installation lesen. **Alle
   weiteren Dateien aus genau dieser Installation lesen** — nicht aus einem zufällig
   ausgecheckten Plugin-Repo.
2. **Struktur laden:** `module-registry.json` des Plugins lesen — Hierarchie Modul
   (Skill-Präfix) → Skills. Die Registry beschreibt das **Produkt**, nicht die Installation:
   Geplante Module ohne gebaute Skills klar als „geplant, nicht nutzbar" kennzeichnen.
3. **Skills real zählen:** das Verzeichnis `skills/` der Installation scannen — Ordner **mit**
   `SKILL.md` = nutzbar. Aufrufform: `/nc-felix:<name>` (der Namespace ist der Name des
   Marketplace-Eintrags, nicht wählbar). Weicht die Registry vom Scan ab, die Abweichung
   offen benennen.
4. **Kontroll-Hooks:** `hooks/hooks.json` der Installation lesen; dann prüfen, ob die
   Env-Variable `NC_FFG` auf einem Aus-Wert steht (`off`/`0`/`false`/`disabled`). Das FFG
   liegt in diesem Plugin und ist überall scharf, wo es installiert ist — außer bei gesetztem
   Opt-out. Klar sagen, ob die Gates HIER gerade scharf sind. Zusätzlich den Marker-Status
   des aktuellen Repos nennen. **Kein Marker mehr:** Gate 1 (FFG) und Gate 2
   (Session-Start-Zwang) sind markerlos überall aktiv, wo das Plugin installiert ist; den
   Scope steuern ausschließlich die Env-Schalter `NC_FFG` und `NC_START_GATE`. Ob ein
   `.nc-os` im Repo liegt, ist ohne Wirkung und wird nicht mehr berichtet.
5. **Geteilte Anweisung:** auf `felix-sync.md` und `wp-rahmen.md` dieses Plugins als
   Methodik-/Workflow-Grundlage hinweisen (WP0–WP8, rote Linien).
6. **Übersicht ausgeben** — kompakt und mit Quelle je Angabe: Plugin (Version, Quelle, aktiv
   ja/nein) · Modul-Tabelle (je Modul: Präfix, nutzbare Skills mit Aufrufform, Status) ·
   Gate-Status im aktuellen Repo · Update-Weg (`/plugin update` bzw. Auto-Update nach
   Versions-Bump; Installation: `/plugin marketplace add NovaCore-AI/NovaCoreAI-OS` +
   `/plugin install nc-felix@novacore-os`).
7. Liegt zusätzlich ein lokal ausgechecktes Plugin-Repo vor, dessen Stand von der
   Installation abweicht: den Unterschied explizit benennen — **nutzbar ist der
   Installationsstand.**

## Regeln

- **Nur belegen, nie erinnern:** Jede Aussage stammt aus einer in diesem Lauf gelesenen Datei
  oder einem ausgeführten Befehl — Nicht-Auffindbares wird als „nicht ermittelbar"
  ausgewiesen, nie ergänzt.
- **Installationsstand schlägt Repo-Stand** — erklärt wird, was der Nutzer wirklich hat.
- **Geplante Module nie als verfügbar darstellen** — geplant heißt geplant.
- **Namespace nie raten:** Skills laufen unter `/nc-felix:<name>`.
- **Nur lesen.** Dieser Skill ändert nichts: keine Dateien, keine Einstellungen, keine
  Installationen, nichts Kundensichtbares (rote Linien unberührt).
- **Koexistenz benennen:** Das Felix-OS bringt eine eigene Kontroll-Schicht mit. Ist parallel
  der NovaCore-Kern `nc` installiert, feuern Gates und Begrüßung doppelt — dann eines der
  beiden deaktivieren; nicht beide parallel betreiben.
- Bei mehreren Versionen im Cache: die von `claude plugin list` gemeldete bzw. die jüngste
  installierte Version verwenden und das im Ergebnis benennen.

## Verifikation

- Die Ausgabe nennt das Plugin `nc-felix` mit Version und Quelle, mit Beleg (Befehl oder
  Dateipfad).
- Die Skill-Zählung stammt nachvollziehbar aus dem realen Verzeichnis-Scan (Anzahl je Modul,
  Aufrufform ausgewiesen).
- Module aus der Registry ohne gebaute Skills sind als „geplant" markiert.
- Der Gate-Status ist mit dem `NC_FFG`-Prüfergebnis belegt (Opt-out gesetzt: ja/nein) und der
  Marker-Status des aktuellen Repos ist genannt.
- Der Verlauf enthält ausschließlich Lese-Operationen.
