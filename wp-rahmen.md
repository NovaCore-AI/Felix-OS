# WP-Rahmen WP0–WP8 — der Pflicht-Zyklus des Felix-OS

> **Normative Metastruktur des Felix-OS** (übernommen aus dem NovaCore-OS und auf das
> Ein-Plugin-Modell angepasst: Module statt Abteilungen). Jedes **Arbeitsmodul** übersetzt
> WP1–WP7 in seinen realen Arbeitszyklus und legt diese Übersetzung in einer eigenen
> `workflow.md` neben seinen Skills ab. Bei Widerspruch gilt für die Rahmenpunkte diese
> Datei, für den Fachablauf die Modul-`workflow.md`.

## Grundsatz

Der Agent leistet die operative Arbeit, **der Mensch versteht, prüft und verantwortet.**
Überspringt der Nutzer einen Pflichtpunkt, greift der Agent ein: eine Zeile Begründung, dann
den Schritt nachholen. KI verstärkt vorhandene Disziplin oder vorhandenes Chaos — der Rahmen
liefert die Disziplin als Prozessbestandteil, nicht als Appell.

## Die neun Punkte

| WP | Punkt | Was der Punkt verlangt | Träger |
|---|---|---|---|
| WP0 | Session-Start | Kontext laden (Stand, Journal, Git-Lage, Werkzeuglage) — kein Blind-Start | Kernmodul: `/nc-felix:start` |
| WP1 | Verstehen | Auftrag erfassen, Definition-of-Ready prüfen, Arbeitsraum anlegen (Orientierung: `/nc-felix:code-tour`) | Arbeitsmodul |
| WP2 | Planen | Vorhaben in prüfbare Scheiben schneiden, bevor Artefakte entstehen | Arbeitsmodul |
| WP3 | Umsetzen | Arbeit leisten — Test-First auf kritischem Pfad, nichts dazuerfinden | Arbeitsmodul |
| WP4 | Quality-Gate | Prüfungen des Moduls vor jeder Übergabe; rot → erst grün machen | Arbeitsmodul |
| WP5 | Selbst-Review + Übergabe | Eigenen Diff prüfen, Übergabe vorbereiten | Arbeitsmodul |
| WP6 | Review | Fremdprüfung vorbereiten, durchführen, einarbeiten | Arbeitsmodul |
| WP7 | QS & Abnahme | Ergebnis in der Realität prüfen, Feedback-Schleife bis zur Abnahme | Arbeitsmodul |
| WP8 | Session-Ende | Stand sichern, Entscheidungen protokollieren, Übergabe schreiben | Kernmodul: `/nc-felix:save-session` |

Ergänzend jederzeit: **`/nc-felix:journal`** hält **einzelne** Ereignisse fest, sobald sie
anfallen, statt sie bis WP8 zu sammeln — Entscheidung, Fund, Blocker, Erledigtes, jeweils mit
Beleg.

**Warum WP0/WP8 im Kernmodul liegen:** Sie sind modulunabhängig und arbeiten auf dem
Sitzungsgedächtnis unter `.nc/erinnerung/` des Arbeits-Repos (`stand.md` konsolidiert,
`journal/<YYYY-MM-DD>.md` append-only). Das Kernmodul liegt im selben Plugin und ist damit
immer dabei — der Rahmen kann nicht fehlen.

## Globale Freigabe-Politik

Keine automatischen **Pushes, Merges, Posts, Releases oder Deployments** ohne explizite
Nutzerfreigabe — in **jedem** Skill jedes Moduls, ausdrücklich auch für Folge-Aktionen in
Feedback-Schleifen, nicht nur für die erste.

## Rote Linien (modulübergreifend)

Der Agent **bereitet vor**, der Mensch handelt. Nie automatisiert:

- **Pushes** auf geteilte Branches auslösen; `main` bleibt lauffähig, kein direkter Push darauf
- **Merges** ausführen
- **Reviews resolven oder approven**
- **Releases** schneiden oder veröffentlichen
- **Deployments** auslösen (jeder Klick in einer Deploy-Oberfläche)
- **Kundensichtbares posten** (Pull-Request-Texte, Ticket-Kommentare, Kundenkommunikation)

Jedes Arbeitsmodul benennt in seiner `workflow.md`, welcher Skill welche Linie trägt
(„Ownership") — der Skill trägt das **Verbot** und führt durch den sicheren Ablauf, statt die
Aktion selbst auszuführen. Projektspezifische Zusatzmuster für das Destruktiv-Gate des
Fact-Forcing-Gates kommen über die Env-Variable **`NC_FFG_EXTRA_DESTRUCTIVE`** (Regex).

## Verifikation statt Behauptung

Jeder Punkt endet mit einem prüfbaren Artefakt: Befehl plus erwartetes Ergebnis,
Pipeline-Status, Ticket-Status, Datei-Existenz, grüner Test. „Sollte passen" ist kein
Abschluss — Evidence statt Zusicherung.

## Für Arbeitsmodule verbindlich

1. WP1–WP7 in der eigenen `workflow.md` auf den realen Zyklus abbilden, mit mindestens einem
   auto-triggerbaren Skill je Punkt und **disjunkten** Trigger-Begriffen.
2. WP0/WP8 **nicht** nachbauen — sie kommen aus dem Kernmodul.
3. Rote-Linien-Ownership je Skill benennen.
4. Diese Datei per Namen verlinken, ihre Inhalte **nicht** duplizieren.
5. **Keine eigenen Hook-Einträge mitbringen** — die Kontroll-Schicht liegt genau einmal unter
   `hooks/` dieses Plugins, sonst feuern Gates mehrfach.
