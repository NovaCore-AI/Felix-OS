# felix-sync — Globale Agenten-Anweisung (Felix-OS)

> **Was diese Datei ist:** Die **gemeinsame, höchste Instruktion** für alle Agenten, die mit
> dem Felix-OS arbeiten. Sie wird mit dem Plugin `nc-felix` ausgeliefert, bleibt über
> Marketplace-Updates synchron und gilt in **jeder** Session, in jedem Arbeits-Repo
> (die Dateinamen `CLAUDE.md` / `AGENTS.md` sind Synonyme). Source of Truth für **Methodik,
> Conventions, Safety** — nicht für fachliche Use-Case-Inhalte (die liegen im jeweiligen
> Arbeits-Repo). Übernommen aus der `nc-sync.md` des NovaCore-OS und auf das
> Ein-Plugin-Modell des Felix-OS angepasst. **Sprache aller Artefakte: Deutsch.**
> **Version:** die des Plugins `nc-felix` (siehe dessen `plugin.json`).

---

## 1. Verhaltens-Defaults (gelten immer, vor allem anderen)

Vier Prinzipien — **Defaults**, kein Dogma; bei Trivialia (Tippfehler, offensichtliche
Einzeiler) Maß halten.

1. **Erst denken, dann coden.** Annahmen aussprechen, nicht verstecken. Bei mehreren
   Interpretationen diese **vorstellen**, nicht schweigend eine wählen. Wenn ein einfacherer
   Weg existiert: sagen und dagegen halten. Unklarheit = stoppen, benennen, fragen.
2. **Einfachheit zuerst.** Minimaler Code, der das Problem löst. Nichts Spekulatives — keine
   Features jenseits des Auftrags, keine Abstraktionen für Einmal-Verwendung, keine
   unerbetene Konfigurierbarkeit. Faustregel: 200 Zeilen, die 50 sein könnten → neu
   schreiben. Maß: *„Würde ein erfahrener Engineer das als überkompliziert ansehen?"*
3. **Chirurgische Änderungen.** Nur anfassen, was der Task verlangt. Kein adjacent-Refactor,
   kein Umformatieren, kein „Verbessern" funktionierenden Codes. **Lokalen Stil matchen.**
   Bemerkter fremder Dead Code: **nennen, nicht löschen**, es sei denn, er stammt aus der
   eigenen Änderung. Test: jede veränderte Zeile muss direkt zum Auftrag zurückverfolgbar sein.
4. **Zielgetriebene Ausführung.** Aufgaben in **verifizierbare** Ziele übersetzen. Bei
   Mehrschritt-Tasks: kurzen Plan mit Verify-Schritt pro Phase angeben. Starke
   Erfolgskriterien ermöglichen autonomes Loopen; schwache erzwingen Rückfragen.

---

## 2. Methoden

### 2.1 Fakten aus der Quelle, nie aus dem Gedächtnis

Fachliche Fakten (Schwellenwerte, Datenmodelle, API-Verträge, Geschäftslogik) stammen
**ausschließlich** aus dem jeweiligen Arbeits-Repo (`CLAUDE.md`/`AGENTS.md` des Repos,
Projekt-Doku, echter Quellcode). Selbst generierte Zahlen/Regeln als **KI-Vorschlag**
kennzeichnen. Bei Widerspruch Gedächtnis vs. Quelle gewinnt **die Quelle**. Quelle nicht
auffindbar → **STOPP**, sagen, fragen — nicht raten.

### 2.2 Test-First auf kritischem Pfad

Für den **kritischen Pfad** (Geldfluss, Auth, Datenschutz/Sicherheit, externe Verträge) gilt
**TDD**: RED → GREEN → REFACTOR. Ziel ≥ 80 % Coverage für diese Pfade (**Default**; das Repo
kann eine abweichende Grenze festlegen). Trivialer UI-Code wird nicht künstlich mit Tests
erstickt. Ein Test, der nicht scheitert, wenn sich die Logik ändert, ist **schwach**.

### 2.3 Definition of Done (DoD)

Code gilt erst als „fertig", wenn **alle** Punkte erfüllt sind: Lint/Format sauber · Tests
grün (kritischer Pfad ≥ 80 %) · kein Secret im Diff · Pull Request beschrieben, mit
Anforderungs-Referenz · Eigen-Review des Diffs · Review bestanden · **vom Menschen** in
`main` gemergt (`main` bleibt lauffähig) · Entscheidung dokumentiert (Pull Request bzw.
`.nc/`-Journal). Wird ein Schritt übersprungen: eine Zeile Begründung, dann nachholen.

### 2.4 Review-Pflicht

**Verstehen vor Freigabe.** Jeder nicht-triviale Change geht durch Review (Self-Review des
Diffs vor dem Pull Request, Fremd-Review im Pull Request). Der Agent entwirft, der **Mensch
liest, hinterfragt, verantwortet**. Bei kritischem Pfad: adversarielles Dual-Review empfohlen.

### 2.5 Fehlerkultur

Behauptungen nur mit Beweis (grüner Test, Command-Output, beobachtetes Verhalten).
„Funktioniert" ohne Beweis = unbegründet. Bei Unsicherheit: offen sagen, nicht beschönigen.

---

## 3. Pfade & Struktur

### 3.1 Arbeits-Repo (mit `.nc-os`-Marker)

```
<repo-root>/
├── .nc-os                  # Marker-DATEI — schaltet die Begrüßung des SessionStart-Hooks frei
├── .nc/                    # lokales Memory (in .gitignore, nie committen)
│   └── erinnerung/
│       ├── stand.md        # konsolidierter Gesamtstand
│       └── journal/<YYYY-MM-DD>.md   # append-only Tagesprotokoll
├── CLAUDE.md / AGENTS.md   # repo-eigene Anweisung (fachliche Source of Truth)
└── <Projekt-Code/Doku>
```

### 3.2 Plugin-Repo (das Felix-OS selbst)

Das Repo **IST** das Plugin `nc-felix` (Manifest an der Wurzel). Ein Plugin, unterteilt in
**Module** (Skill-Präfixe, Kernmodul ohne Präfix): `skills/<name>/SKILL.md` ·
`hooks/` (Kontroll-Schicht, genau einmal) · `wp-rahmen.md` · `module-registry.json` ·
`referenz/skill-authoring.md` · diese Datei. **Version je Release genau an einer Stelle:**
`.claude-plugin/plugin.json`. Entstanden nach dem pilotierten Standardablauf
`knowledge-base/standardprozesse/plugin-bau.md` §3b im **OS-Repo** `NovaCore-AI/NovaCoreAI-OS`
(Quellenangabe — dort auch die verifizierten Install-Fallen).

### 3.3 Memory-Trennung (streng)

Kunden-/Projektkontext liegt **ausschließlich** im Arbeits-Repo unter `.nc/` (in
`.gitignore`). **Nichts** davon ins Plugin-Repo. Das Journal ist **append-only** —
bestehende Einträge nie verändern oder löschen.

### 3.4 Neue Dateien am richtigen Ort

Vor dem Anlegen jeder neuen Datei die Projekt-/Modul-Convention prüfen. Skill →
`skills/<name>/SKILL.md` (Modul über das Namenspräfix). Hook-Einträge → **ausschließlich**
`hooks/` dieses Plugins. Passt der Ort nicht → **widersprechen und korrigieren**, statt die
Datei einfach zu erzeugen. In ausgelieferten Dateien **nie** über die Plugin-Grenze hinweg
auf Pfade verweisen; auf Repo-Dokumente nur als Quellenangabe.

---

## 4. Arbeitsweise (Session-Zyklus)

Der verbindliche Rahmen steht in `wp-rahmen.md` dieses Plugins (WP0–WP8); jedes Arbeitsmodul
übersetzt WP1–WP7 in seiner eigenen `workflow.md`.

1. **Session-Start (WP0):** `/nc-felix:start` — Stand, Journal, Git-Lage, Werkzeuglage laden.
   **Kein Blind-Start.** Orientierung in fremden Repos: `/nc-felix:code-tour`.
2. **Arbeit (WP1–WP7):** über die Skills des zuständigen Arbeitsmoduls (folgen; bis dahin
   gilt der Rahmen direkt).
3. **Jederzeit:** `/nc-felix:journal` — Entscheidungen, Funde und Blocker sofort festhalten.
4. **Session-Ende (WP8):** `/nc-felix:save-session` — append-only ins Journal, Stand
   konsolidieren, Übergabe schreiben.

---

## 5. Verbindliche Regeln

- **Sprache:** Alle Artefakte (Commits, Pull Requests, Doku, Journal) auf Deutsch.
- **Safety:** Keine automatischen Pushes, Merges, Posts, Releases oder Deployments ohne
  **explizite Nutzerfreigabe**. Durchgesetzt vom **Fact-Forcing-Gate (FFG)** dieses Plugins
  mit drei Gates: **Datei-Gate** (Edit/Write/MultiEdit, einmal je Zieldatei),
  **Destruktiv-Gate** (Bash, jedes destruktive Kommando einzeln; Zusatzmuster per
  `NC_FFG_EXTRA_DESTRUCTIVE`), **Routine-Bash-Gate** (einmal je Session; Read-only-Git nie).
  Das Gate antwortet mit **deny**, nicht mit „ask". Es ist **markerlos aktiv** — überall, wo
  das Plugin installiert ist. **Opt-out ausschließlich per Env `NC_FFG=off`**, gesetzt vom
  Menschen, nie vom Agenten.
- **Branching:** Feature-Branch → Pull Request → Review → Merge. **Kein direkter Push auf
  `main`.** Der Merge ist eine rote Linie: der Mensch führt ihn aus.
- **Memory:** Kontext bleibt im Arbeits-Repo unter `.nc/` (in `.gitignore`).
- **Fehlender Kontext:** Nachfragen statt raten; im Zweifel `/nc-felix:start`.
- **Journal:** Append-only — bestehende Einträge nie verändern oder löschen.
- **Secrets:** Keine Secrets/Tokens/Passwörter in Code, Logs, Commits oder Konversation.
- **Eigene Fehler protokollieren:** append-only nach der Konvention des Arbeits-Repos —
  sofort, nicht am Ende.

---

## 6. Namespace & Koexistenz

Alle Skills laufen unter **`/nc-felix:<name>`** — der Namespace ist der Name des
Marketplace-Eintrags und nicht frei wählbar. Fremde Plugin-Familien werden **nie** verändert.

**Koexistenz-Regel:** Das Felix-OS bringt seine eigene Kontroll-Schicht mit (FFG +
SessionStart-Hinweis, Marker `.nc-os`). Es ist **nicht** dafür gedacht, parallel zum
NovaCore-Kern `nc` (bzw. `nc-development`) in derselben Session zu laufen — sonst feuern
Gates und Begrüßung doppelt. Wer beides installiert hat, deaktiviert eines davon.

---

## 7. Was diese Datei NICHT ist

- **Keine** fachlichen Use-Case-Werte — diese liegen im jeweiligen Arbeits-Repo.
- **Kein** Rollen- oder Rechte-Konzept.
- **Keine** stack-spezifischen Anweisungen (stack-agnostisch); modulspezifische Regeln
  stehen in der `workflow.md` des jeweiligen Arbeitsmoduls.
- **Keine** Anweisung, die höher steht als eine **direkte User-Anweisung** — bei Konflikt
  gewinnt der User. Diese Datei ist Referenz, keine Autorität.

---

*Globale Anweisung des Felix-OS · Methodik/Conventions/Safety · Source of Truth für fachliche
Inhalte bleibt stets das jeweilige Arbeits-Repo.*
