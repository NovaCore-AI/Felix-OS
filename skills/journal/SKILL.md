---
name: journal
description: >-
  Hält einzelne Ereignisse sofort im Tagesprotokoll fest, statt sie bis zum Sitzungsende zu
  sammeln — Entscheidungen, belegte Funde, Blocker und Erledigtes werden append-only an das
  Journal des Arbeits-Repos angehängt, jeweils mit Beleg. Trigger-Begriffe: „ins Journal",
  „Entscheidung festhalten", „protokollieren", „Blocker notieren", „Fund dokumentieren",
  „Journal-Eintrag", „für später merken".
---

# /nc-felix:journal — Ereignis sofort protokollieren

## Zweck

Gedächtnis **während** der Arbeit, nicht erst am Ende. Wo `/nc-felix:save-session` die Sitzung
abschließend zusammenfasst und den Stand konsolidiert (WP8 im WP-Rahmen `wp-rahmen.md` dieses
Plugins), hält dieser Skill **einzelne** Ereignisse fest, sobald sie eintreten: eine getroffene
Entscheidung, ein belegter Fund, ein Blocker, ein erledigter Punkt. Damit überlebt Kontext auch
dann, wenn eine Sitzung unerwartet endet.

## Ablauf

1. **Zielort bestimmen** (erste greifende Regel gewinnt):
   a) Nennt die repo-eigene `CLAUDE.md`/`AGENTS.md` ein Journal-Verzeichnis, oder existiert im
      Repo ein Verzeichnis `Journal/` mit eigener `README.md`, gilt dieses **Team-Journal**
      (committet, team-geteilt, Wochendatei `<JAHR>-KW<NN>.md`). Eine dort hinterlegte Vorlage
      gewinnt über die Default-Vorlage unten.
   b) Sonst das **persönliche Journal** `.nc/erinnerung/journal/<YYYY-MM-DD>.md` (lokal,
      gitignored). Verzeichnis anlegen, falls es fehlt; `.nc/` muss in der `.gitignore` stehen.
2. **Datum bestimmen:** `date +%F` für die Tagesdatei, `date +%G-KW%V` für die Wochendatei.
   Fehlt die Zieldatei, sie mit Datums- bzw. Wochenüberschrift anlegen.
3. **Typ wählen:** `Entscheidung` · `Fund` · `Blocker` · `Erledigt` · `Wartet auf Zuarbeit`.
4. **Eintrag anhängen**, eine Zeile je Ereignis:
   `- HH:MM · <Typ> · <Sachverhalt in einem Satz> · Beleg: <Datei:Zeile | Befehl | Quelle>`
5. **Bei Typ `Entscheidung`** zusätzlich die verworfene Alternative und den Grund der Wahl
   anhängen — eine Entscheidung ohne Begründung ist in drei Wochen wertlos.
6. **Zeiger setzen:** Gehört das Ereignis fachlich in die Projektdokumentation (Entscheidungslog,
   Architektur-Doku, Plan), daran erinnern, es dort nachzuziehen. Das Journal ist der Zeiger,
   nicht die Quelle.
7. **Ergebnis ausgeben:** Pfad der Datei und der geschriebene Eintrag im Wortlaut.

## Default-Vorlage (wenn das Repo keine eigene hat)

```markdown
## JJJJ-MM-TT
- HH:MM · Entscheidung · <Sachverhalt> · Beleg: <Quelle>
  - verworfen: <Alternative> · Grund: <ein Satz>
- HH:MM · Fund · <Sachverhalt> · Beleg: <Datei:Zeile>
- HH:MM · Blocker · <Sachverhalt> · Beleg: <Befehl + Ergebnis>
```

Leere Felder weglassen — kein „N/A"-Platzhalter.

## Regeln

- **Append-only.** Bestehende Zeilen werden nie geändert oder gelöscht; eine Korrektur ist ein
  neuer Eintrag, der auf den alten verweist.
- **Belegpflicht.** Jeder Eintrag nennt seine Quelle: `Datei:Zeile`, ausgeführter Befehl samt
  Ergebnis, Ticket oder Doku-Fundstelle. Ohne Beleg wird der Eintrag ausdrücklich als
  **Vermutung** gekennzeichnet.
- **Ein Ereignis, eine Zeile.** Fließtext gehört in `stand.md` oder in die Fachdokumentation.
- **Zeiger, nicht Source.** Fachliche Entscheidungen leben in der Projektdokumentation; das
  Journal verweist nur dorthin.
- **Keine Secrets, Tokens, Kundendaten oder personenbezogenen Pfade** — auch nicht im
  persönlichen Journal, das lokal bleibt. Die Disziplin gilt überall.
- **Kein Auto-Commit.** Der Eintrag wird geschrieben, nicht committet oder gepusht — keine
  automatischen Pushes, Merges, Posts, Releases oder Deployments ohne explizite Nutzerfreigabe.
  Im Team-Modus liegt die Datei im Git-Tree; der Commit bleibt Sache des Menschen.
- **Kein Ersatz für den Sitzungsabschluss.** Journaleinträge entbinden nicht von
  `/nc-felix:save-session` — der konsolidierte Stand entsteht nur dort.

## Verifikation

- `tail -5` der Zieldatei zeigt den neuen Eintrag im erwarteten Format.
- Die Datei ist um genau die geschriebenen Zeilen gewachsen (Zeilenzahl vorher/nachher nennen).
- Jeder Eintrag enthält einen Beleg oder ist ausdrücklich als Vermutung markiert.
- Der gewählte Modus ist im Ergebnis genannt (Team-Journal oder persönliches Journal) samt der
  Regel, über die er bestimmt wurde (a oder b).
- Im persönlichen Modus zeigt `git status --short` **keine** `.nc/`-Pfade (Ignore greift).
