---
name: skill-builder
description: >-
  Führt durch den Bau eines neuen Skills für das Felix-OS nach den OS-Regeln — von der Idee
  über Overlap-Prüfung, Modul-Zuordnung (Skill-Präfix) und Formatregeln (skill-authoring.md)
  bis zu Validierung, Registry-Pflege und Versions-Bump. Trigger-Begriffe: „Skill bauen",
  „neuen Skill erstellen", „eigenen Skill", „Skill anlegen", „neues Modul", „Skill einreichen".
---

# /nc-felix:skill-builder — Eigene Skills nach den OS-Regeln bauen

## Zweck

Maintenance-Skill des Kernmoduls: Jeder darf das Felix-OS um Skills erweitern — nach Vorbild
und Regeln des OS. Dieser Skill führt durch den kompletten Bau und sichert, dass das Ergebnis
den verbindlichen Formatregeln entspricht, im richtigen Modul landet und über die
Marketplace-Mechanik beim Nutzer ankommt.

## Ablauf

1. **Einordnen:** Zweck, Zielgruppe und Trigger-Begriffe in je einem Satz festhalten. Dann das
   **Modul** bestimmen: Kernmodul (kein Präfix — nur Workflow-/Maintenance-Basics) oder ein
   Arbeitsmodul (`<praefix>-<name>`). Ein neues Modul entsteht durch ein neues Präfix plus
   Eintrag in der `module-registry.json` dieses Plugins.
2. **Overlap-Prüfung:** Gegen bestehende Skills prüfen (Registry, Skill-Tabellen im README,
   `description`-Frontmatter der vorhandenen Skills) — bei Überschneidung: bestehenden Skill
   erweitern statt doppeln, oder Trigger disjunkt schärfen.
3. **Formatregeln laden:** `referenz/skill-authoring.md` dieses Plugins vollständig lesen —
   sie ist die verbindliche Quelle (Frontmatter-Constraints inklusive YAML-Fallen, Gliederung,
   Länge, Dritte-Person-Description).
4. **Gerüst erzeugen:** `skills/<name>/SKILL.md` mit Frontmatter (`name` = Verzeichnisname;
   `description` als `>-`-Block in dritter Person mit Trigger-Begriffen) und den vier
   Pflicht-Abschnitten Zweck / Ablauf / Regeln / Verifikation.
5. **Inhalt füllen — inhaltliche Pflichten:** Fakten nur mit Quelle; berührte **rote Linien
   explizit verbieten** (Pushes, Merges, Releases, Deployments, Kundensichtbares); optionale
   Werkzeuge als „wo vorhanden, sonst manuell" formulieren; keine personenbezogenen Pfade;
   keine Pfad-Verweise über die Plugin-Grenze.
6. **Prüfen:** Checkliste aus `skill-authoring.md` Punkt für Punkt abarbeiten, dann
   `npm test` (Struktur-/Frontmatter-Invarianten) und `claude plugin validate . --strict`
   (die Repo-Wurzel IST das Plugin — strict prüft hier Manifest **und** Skills).
7. **Ausliefern:** `module-registry.json` und Skill-Tabelle im README nachziehen,
   CHANGELOG-Eintrag schreiben, Version in `.claude-plugin/plugin.json` bumpen (kein Bump =
   kein Auto-Update) — dann Feature-Branch, Pull Request, Review. Merge, Tag und der
   Pin-Nachzug im OS-Repo (Marketplace `novacore-os`) bleiben Sache des Maintainers.

## Regeln

- **Rote Linien sind nicht skillbar:** Kein neuer Skill darf Pushes, Merges,
  Review-Resolves/Approvals, Releases, Deployments oder Kundensichtbares automatisieren —
  der Agent bereitet vor, der Mensch handelt.
- **Kein Skill ohne Overlap-Prüfung** (Schritt 2) und ohne vollständige Checkliste (Schritt 6).
- **Keine eigenen Hooks über Skills einschleusen** — die Kontroll-Schicht liegt genau einmal
  unter `hooks/` dieses Plugins (testgesichert).
- **Halbfertige Skills werden nicht ausgeliefert** — ein Ordner ohne fertige `SKILL.md`
  bleibt lokal; der Scanner ignoriert ihn ohnehin.
- **Version nur in `.claude-plugin/plugin.json`** — nie zusätzlich im Marketplace-Eintrag
  des OS-Repos.
- Bei unklaren Format-Fragen: offizielle Claude-Code-Doku abrufen (code.claude.com/docs:
  `skills`, `plugins-reference`) — nie aus dem Gedächtnis.

## Verifikation

- Die Checkliste aus `skill-authoring.md` ist vollständig abgehakt (jeder Punkt mit Beleg).
- `npm test` ist grün und `claude plugin validate . --strict` meldet „Validation passed".
- Die Overlap-Prüfung ist dokumentiert (geprüfte Skills + Ergebnis).
- Frontmatter-`name` entspricht exakt dem Verzeichnisnamen; die Aufrufform im Titel lautet
  `/nc-felix:<name>`.
- Registry, README-Tabelle und CHANGELOG nennen den neuen Skill; der Versions-Bump ist im
  Diff sichtbar.
