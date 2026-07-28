# Skill-Authoring — verbindliche Formatregeln (Felix-OS)

> Gilt für **jede** `SKILL.md` des Felix-OS. Quelle: offizielle Claude-Code-Doku
> (code.claude.com/docs: `skills`, `plugins-reference`, `plugin-marketplaces`) — Plugin-Layout,
> Skill-Discovery und Validierung zuletzt verifiziert am **2026-07-28**; übernommen aus dem
> NovaCore-OS und auf das Ein-Plugin-Modell angepasst. Bei künftigen Format-Änderungen:
> zuerst die Live-Doku erneut abrufen, dann diese Datei aktualisieren — nie aus dem
> Gedächtnis ändern.
>
> **Ablageort:** Diese Datei liegt unter `referenz/` im Plugin und wird mit ausgeliefert —
> wer Skills baut, braucht sie zur Laufzeit und nicht nur im Repo-Checkout.

## Frontmatter (harte Constraints)

```yaml
---
name: code-tour
description: >-
  <Was der Skill tut + wann er zu nutzen ist, dritte Person, mit Trigger-Begriffen>
---
```

- `name`: max. 64 Zeichen, nur Kleinbuchstaben/Ziffern/Bindestriche, keine reservierten Wörter
  (`anthropic`, `claude`). Muss dem **Verzeichnisnamen** entsprechen.
- `description`: Pflicht (steuert die automatische Skill-Auswahl), max. 1024 Zeichen,
  **dritte Person** („Bereitet … vor", nie „Ich helfe dir …"), enthält konkrete
  Trigger-Begriffe.
- **YAML-Falle — Pflichtregel:** Enthält ein Wert einen **Doppelpunkt gefolgt von einem
  Leerzeichen** (typisch: „Trigger-Begriffe: …"), ein `#` oder beginnt er mit einem
  YAML-Indikator (`>`, `|`, `*`, `&`, `{`, `[`, `-`, `?`, `!`, `%`, `@`), dann ist ein
  unquotierter Plain-Scalar **ungültig**. Immer den Folded-Block-Scalar `>-` verwenden und
  den Text eingerückt darunter setzen. **Warum das hart geregelt ist:** Eine nicht parsende
  Frontmatter bricht nicht sichtbar ab — der Skill lädt ohne Metadaten und wird nie
  automatisch getriggert (im Vorbild-System traf das unbemerkt 19 von 22 Skills).
- Optional nur, wo begründet: `disable-model-invocation: true` — Skill ausschließlich manuell
  aufrufbar. Angebracht bei Skills, die **durch eine rote Linie führen**.
- Frontmatter beginnt in **Zeile 1** mit `---`, Einrückung mit Leerzeichen, keine Tabs,
  **kein BOM** vor der ersten Zeile.

## Aufbau des Bodys (Haus-Stil)

```markdown
# /nc-felix:<name> — <Titel>

## Zweck
<1 Absatz: was, für wen, an welchem Workflow-Punkt (WP-Verweis)>

## Ablauf
1. <nummerierte, imperative Schritte>

## Regeln
- <harte Verhaltensregeln, Verbote fett, rote Linien explizit>

## Verifikation
- <konkret prüfbares Artefakt: Befehl + erwartetes Ergebnis — nie „sollte korrekt sein">
```

- **Aufrufform im Titel:** immer `/nc-felix:<name>` — der Namespace ist der Name des
  Marketplace-Eintrags, nicht frei wählbar.
- **WP-Verweis:** WP0/WP8 und die Rahmenregeln stehen in `wp-rahmen.md` dieses Plugins,
  WP1–WP7 in der `workflow.md` des jeweiligen Arbeitsmoduls. Auf die zuständige Datei
  verweisen, nicht beides duplizieren.
- **Länge:** Ziel 60–120 Zeilen, hartes Doku-Limit < 500 Zeilen Body. Detailwissen in eine
  Referenzdatei neben der `SKILL.md` auslagern (max. **eine** Verweis-Ebene tief).
- **Sprache:** Deutsch, direktiv-imperativisch, keine Floskeln.
- **Eine Datei pro Skill**, flaches Layout: `skills/<name>/SKILL.md`. Keine
  Use-Case-Unterordner; Ordner ohne `SKILL.md` ignoriert der Scanner.
- **Module sind Namenspräfixe**, keine Verzeichnisse — das Kernmodul trägt kein Präfix,
  Arbeitsmodule ein eigenes (`<praefix>-<name>`). Ein neues Modul entsteht durch ein neues
  Präfix plus Eintrag in `module-registry.json` dieses Plugins.
- **Keine Pfad-Verweise über die Plugin-Grenze:** Ein installiertes Plugin liegt allein im
  Plugin-Cache. Auf Inhalte anderer Plugins per **Name** verweisen, auf Repo-Dokumente nur
  als **Quellenangabe** („siehe OS-Repo"), nie als Leseanweisung.

## Inhaltliche Pflichten

1. **Fakten nur mit Quelle.** Fachliche Fakten stammen **ausschließlich** aus dem jeweiligen
   Arbeits-Repo; die methodischen Defaults stehen in `felix-sync.md` dieses Plugins. Selbst
   generierte Zahlen oder Regeln als **KI-Vorschlag** kennzeichnen. Quelle nicht auffindbar
   → STOPP, benennen, fragen — nicht raten.
2. **Rote Linien verankern.** Pushes auf geteilte Branches, Merges, Review-Resolves/Approvals,
   Releases, Deployments und alles Kundensichtbare führt der Agent **nie selbst** aus. Jeder
   Skill, der eine rote Linie berührt, verbietet sie explizit in `## Regeln`.
3. **Verifikation vor Vertrauen.** Jeder Skill endet mit prüfbaren Abschluss-Nachweisen.
4. **Werkzeug-Verfügbarkeit korrekt behandeln.** Nur voraussetzen, was das Setup garantiert;
   optionale Werkzeuge als „wo vorhanden, sonst manuell" formulieren. Schreibende Aktionen
   über externe Dienste bleiben manuelle Schritte des Menschen.
5. **Keine personenbezogenen Pfade/Annahmen.**
6. **Nachfragen statt raten** bei widersprüchlichen oder fehlenden Quellen.

## Checkliste vor dem Merge eines Skills

- [ ] `name` = Verzeichnisname, ≤ 64 Zeichen, nur `a-z0-9-`
- [ ] `description` ≤ 1024 Zeichen, dritte Person, Trigger-Begriffe enthalten
- [ ] `description` als `>-`-Block, wenn sie `: `, `#` oder einen führenden YAML-Indikator
      enthält
- [ ] Gliederung Zweck/Ablauf/Regeln/Verifikation vollständig
- [ ] Aufrufform im Titel: `/nc-felix:<name>`
- [ ] Verifikation nennt konkret prüfbare Artefakte
- [ ] Berührte rote Linien explizit verboten
- [ ] Kein Pfad-Verweis über die Plugin-Grenze
- [ ] Deutsch, 60–120 Zeilen, keine Personenpfade
- [ ] Kein Trigger-Overlap mit bestehenden Skills (Registry + descriptions prüfen)
- [ ] `npm test` grün **und** `claude plugin validate . --strict` fehlerfrei — die
      Repo-Wurzel IST hier das Plugin, strict prüft Manifest und Skills
