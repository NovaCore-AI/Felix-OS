# AGENTS.md — Felix-OS (Plugin `nc-felix`, eigenständig)

> **Dieses Repo IST das Plugin.** `nc-felix` ist das eigenständige Abteilungs-OS von Felix —
> ausgeliefert über den Marketplace `novacore-os` des OS-Repos (`NovaCore-AI/NovaCoreAI-OS`),
> gepinnt per Commit-SHA. Manifest an der Wurzel: `.claude-plugin/plugin.json`. **Ein**
> Plugin, unterteilt in **Module** (Skill-Präfixe, Kernmodul ohne Präfix) — keine
> Abteilungen, kein Kern-Plugin als Dependency. Die lokale `CLAUDE.md` ist bewusst
> un-getrackt (siehe `.gitignore`); normative Repo-Anweisung ist diese Datei.

## Geltende gemeinsame Anweisung

Für alle Agenten gilt die **geteilte, synchronisierte Global-Anweisung `felix-sync.md`
dieses Plugins** (Methodik, Conventions, Safety — mit dem Plugin ausgeliefert, über
Marketplace-Updates synchron). Der Pflicht-Zyklus steht in `wp-rahmen.md` (WP0–WP8, rote
Linien). Die Safety-Schicht setzt das **FFG (Fact-Forcing-Gate)** unter `hooks/` durch —
Port aus dem NovaCore-Kern `nc`, gleiche Env-Schalter (`NC_FFG=off` nur durch den Menschen).

## Pflicht-Einstieg — vor der ersten Änderung, jedes Mal

Vier Schritte, in dieser Reihenfolge. Sie kosten zwei Minuten und ersparen die halbe
Fehlersuche:

1. **Log-Stand:** `git log --oneline -10` und `git status`; bei mehreren Bäumen zusätzlich
   `git worktree list` und in jedem fremden Baum `git status --short`. **Der Working Tree ist
   die Wahrheit**, nicht der letzte Commit und nicht die Doku.
2. **Produktstand:** `CHANGELOG.md` (autoritativ für gebaut/fehlend) und die Version in
   `.claude-plugin/plugin.json`.
3. **Eigene Wissensbasis:** `knowledge-base/SSOT-Document-Index.md` — Teil 1 (wohin gehört ein
   Dokument), Teil 2 (welche Quelle ist wann relevant). Der jüngste datierte Plan in
   `knowledge-base/grundwissen/` ist der aktuelle Planungsstand.
4. **Bekannte Fallen:** `knowledge-base/debugging-findings/agent-learnings.md` (eigene
   Fehlermuster) und, vor jeder Fehlersuche, `debug-log.md` (bekannte Symptome).

## Protokollzwang

- **Eigener Fehler** — falsche Annahme, falscher Pfad, fehlgeschlagener Befehl durch eigenes
  Verschulden, falsch umgesetztes Format → sofort ein Eintrag in
  `knowledge-base/debugging-findings/agent-learnings.md`.
- **Gefundener Bug oder Fehlbefund**, auch an fremdem Material → sofort ein Eintrag in
  `knowledge-base/debugging-findings/debug-log.md`.

Beide Protokolle sind **append-only**: nie rückdatieren, nie umschreiben. Ein widerlegter
Eintrag bekommt einen **neuen**, der auf ihn verweist. Nicht sammeln, nicht beschönigen —
sofort.

## Wissensbasis dieses Repos

`knowledge-base/` ist die **eigene, isolierte** Wissensbasis des Felix-OS: `grundwissen/`
(laufende Vorhaben mit Datumspräfix und dauerhafte eigene Referenzen) · `bauplan-archiv/`
(abgeschlossen oder verworfen, unverändert, terminal) · `debugging-findings/` (die zwei
Protokolle) · `ideen-backlog/` (je Idee ein Dokument). Nur der Index liegt direkt in
`knowledge-base/`.

- **Jede neue, verschobene oder gelöschte Wissensdatei zieht ihre Index-Zeile in derselben
  Änderung nach** — `test/wissensbasis.test.mjs` erzwingt Vollständigkeit, Linkgültigkeit,
  Wurzel-Regel und Kategorie-Routing.
- **Abgeschlossene oder verworfene Pläne wandern pflichtgemäß per `git mv` ins Archiv**, Inhalt
  unverändert — sonst verliert `grundwissen/` die Aussage „das läuft gerade".
- **Isolation:** Diese Wissensbasis ist **terminal**. Dieses Repo schreibt nie in Dokumente des
  OS-Repos; es gibt keine Warteschlange, keine Kandidatenliste und keinen reservierten Platz
  für so etwas. Umgekehrt liest kein Artefakt des OS-Repos hier mit.
- **Auslieferung:** Das Repo ist das Plugin, die Wissensbasis fährt also mit in den
  Plugin-Cache. Sie ist **Arbeitsmaterial, nie Laufzeit-Abhängigkeit eines Skills.**

## Harte Regeln dieses Repos

- **Eigenständigkeit:** keine Plugin-Dependencies — der Kern ist hier ein **Modul**, kein
  Plugin (testgesichert in `test/manifest.test.mjs`). Nicht parallel zum NovaCore-Kern `nc`
  betreiben (doppelte Gates).
- **Kontroll-Schicht genau einmal:** Hook-Einträge liegen **ausschließlich** unter `hooks/`
  (FFG + SessionStart). Kein Skill und kein Modul bringt weitere Hooks mit.
- **Version nur an einer Stelle:** `.claude-plugin/plugin.json`. Kein Bump = kein
  Auto-Update im Team. Jede Änderung: Bump + `CHANGELOG.md`-Eintrag + Registry-Spiegel
  (`module-registry.json.version`, testgesichert) im selben Change. **Nie** zusätzlich
  `version` in den Marketplace-Eintrag des OS-Repos schreiben.
- **Skills** nach `referenz/skill-authoring.md` dieses Plugins bauen — Layout
  `skills/<name>/SKILL.md`, Module sind Namenspräfixe (Kernmodul ohne Präfix); geführter
  Weg: `/nc-felix:skill-builder`. Neues Modul = neues Präfix + Registry-Eintrag +
  `workflow.md` (WP1–WP7).
- **Deutsch** für alle Artefakte; keine Secrets in Code, Commits oder Logs.
- **Branching:** Feature-Branch → Pull Request → Review → Merge durch den Menschen. Kein
  direkter Push auf `main`; kein Push/Merge/Tag/Release ohne explizite Maintainer-Freigabe.
- **Tests vor jedem PR:** `npm test` (Manifest-, Hook-, Frontmatter- und FFG-Invarianten)
  und `claude plugin validate . --strict` (die Repo-Wurzel IST das Plugin — strict prüft
  Manifest **und** Skills).

## Release-/Update-Ablauf (Updatebarkeit)

1. Änderung + Version-Bump in `.claude-plugin/plugin.json` (+ Registry-Spiegel) + CHANGELOG
   — im selben Change.
2. Pull Request → Review → Merge (Mensch). **Achtung: Merge ohne Squash/Rebase**, sonst
   ändert sich der Commit-SHA und der Marketplace-Pin zeigt ins Leere.
3. Maintainer pusht den annotierten Tag `v<version>`.
4. Im OS-Repo den Marketplace-Eintrag `nc-felix` umpinnen: `ref: "v<version>"` +
   `sha: "<40-stelliger Commit-SHA>"` — der `sha` ist der effektive Pin. Danach dort
   `node --test plugins/nc/tests/*.test.mjs` (prüft Pin-Format und Registry↔Pin-Konsistenz).
5. Das Team erhält das Update über die Marketplace-Mechanik (`/plugin update` bzw.
   Auto-Update).

## Abschluss-Checkliste — vor jedem Commit-Vorschlag

- [ ] **Wissensbasis:** neue oder verschobene Dateien am richtigen Ort, `SSOT-Document-Index`
      in derselben Änderung nachgezogen; abgeschlossene Pläne ins Archiv verschoben
- [ ] **Protokolle** dieser Sitzung geschrieben (eigene Fehler → `agent-learnings.md`,
      gefundene Bugs → `debug-log.md`)
- [ ] **Toter-Pfad-Sweep:** `grep` nach jedem alten Pfad oder Namen über das **ganze** Repo
- [ ] **`CHANGELOG.md`**-Eintrag **mit Namenszeichnung**
- [ ] **Version-Bump** in `.claude-plugin/plugin.json` **plus** Registry-Spiegel
      (`module-registry.json.version`) — nur wenn die Änderung ausgeliefert wird; reine
      Wissensbasis-Arbeit braucht keinen Bump, den CHANGELOG-Eintrag trotzdem
- [ ] **Tests:** `npm test` (bzw. `node --test test/*.test.mjs`) — wortgleich, Glob statt
      Verzeichnis
- [ ] **Validierung:** `claude plugin validate . --strict` (die Repo-Wurzel IST das Plugin,
      `--strict` prüft Manifest **und** Skills)
- [ ] **Behauptung nur mit gesehener Ausgabe** — „grün" und „behoben" erst nach dem Lauf

## Quellen

Herkunft der Strukturen: NovaCore-OS (`NovaCore-AI/NovaCoreAI-OS`) — FFG, WP-Rahmen,
Sync-Anweisung, Formatregeln; verbindliche Prozesse dort (Quellenangabe, **kein** Lesepfad —
dieses Repo funktioniert ohne einen Checkout des OS-Repos):
`knowledge-base/standardprozesse/abteilungs-plugin-bau.md` im OS-Repo — **§3b ist der mit
diesem Repo pilotierte Standardablauf** (eigenständiges Kollegen-OS als Satellit, inkl. der
verifizierten Install-Fallen: Repo-Name = reale Heimat, kein `type: module` bei
CommonJS-Hooks, SSH-Falle `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`, Plugin-Repo nie als
Marketplace adden); §3a beschreibt die Satelliten-Pin-Mechanik. Bei Format-Fragen
zu Plugin/Marketplace/Skills zuerst die offizielle Claude-Code-Doku abrufen
(code.claude.com/docs: `plugins-reference`, `plugin-marketplaces`, `skills`) — nie aus dem
Gedächtnis.
