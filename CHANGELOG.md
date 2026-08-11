# Changelog — nc-felix

## 0.4.0 — 2026-08-11

Pflege-Skill und CI-/Release-Standard (Bauplan AP9). Vorlage: das Schwester-OS `nc-biggi`,
normiert in `abteilungs-plugin-bau.md` §3b.2 des OS-Repos.

### Added

- **`/nc-felix:doku-sync`** — der Pflege-Skill des Kernmoduls, Port aus dem Kern `nc` und auf
  dieses Repo zugeschnitten: keine Marketplace-Ebene (die Repo-Wurzel **ist** das Plugin),
  Versions-Gleichstand zwischen `plugin.json` und `module-registry.json` statt gegen eine
  `VERSION`-Datei, eigener Wissensbasis-Index statt des zentralen, Prüfstempel unter
  `.git/nc-felix/doku-sync.stamp`. Er macht die Abschluss-Checkliste aus `AGENTS.md`
  ausführbar. **Isolationsregel ergänzt:** Der Skill fasst nie Dateien des OS-Repos an — was
  dort nachzuziehen wäre, ist ein eigener Vorgang. Zusätzlich der Hinweis, vor der Suite einen
  gesetzten Gate-Opt-out zu leeren; sonst meldet sie grün, ohne zu prüfen. Registry-Statuszeile,
  Skill-Liste und README nachgezogen. — *Claude (Opus 5)*
- **`.github/workflows/ci.yml`** — ersetzt `quality.yml` (bisher nur ubuntu / Node 24, ein Job,
  keine Plugin-Validierung). Neu: Matrix **ubuntu + windows × Node 20/22/24** mit
  Bash-Glob-Aufruf (auch auf Windows), Actions per **Full-SHA** gepinnt, gepinnte
  Claude-Code-CLI plus harter Guard „CLI auflösbar" gegen stilles Überspringen, und die
  **Positivkontrolle des Validators**: Ein absichtlich defekter Plain-Scalar in einer
  Wegwerf-Kopie muss rot werden, die intakte Kontrollgruppe grün — sonst prüft der Validator
  keine Skills mehr und jedes Grün darunter ist wertlos.
  **Lokal belegt, nicht behauptet:** intakte Kopie „Validation passed", defekte Kopie
  „Validation failed" mit `frontmatter: YAML frontmatter failed to parse` (Defekt in
  `skills/code-tour/SKILL.md` der Wegwerf-Kopie). Beide Jobs leeren `NC_START_GATE` und
  `NC_FFG` ausdrücklich — ein geerbter Opt-out machte die Gate-Tests sonst vakuum-grün.
  — *Claude (Opus 5)*
- **`.github/workflows/release.yml`** — aus einem gepushten annotierten Tag `v<version>` wird
  das GitHub-Release mit den CHANGELOG-Notes. Vier Vorbedingungen scheitern absichtlich hart:
  annotierter Tag (Lightweight-Tags tragen keine Tagger-Info) · Tag == Version in
  `plugin.json` (die **einzige** Versionsquelle; eine `VERSION`-Datei gibt es hier nicht) ·
  grüne Suite · vorhandener CHANGELOG-Abschnitt zur Version. Der Abschnitts-Schnitt vergleicht
  **literal statt per Regex**, damit eine Version mit Metazeichen nie als Muster wirkt.
  Der Tag wird weiterhin **von Hand** gesetzt — die rote Linie bleibt unberührt.
  — *Claude (Opus 5)*

### Fixed — aus dem externen Review (Codex, 2026-08-11)

Kimi stand für die adversariale Runde nicht zur Verfügung (Kontingent erschöpft, `403`), also
hat **Codex** sie übernommen. Seine Befunde stehen vollständig im
`knowledge-base/debugging-findings/debug-log.md`; behoben wurden:

- **Stempel-Durchlass akzeptierte jedes lokale Programm namens `node`** (HIGH). `./node
  "<echter Stempelpfad>"` passierte die Prüfung, weil nur der Basisname verglichen wurde — ein
  Kanal für beliebigen Code durch Gate 2. **Fix:** Ein *nackter* Name (`node`) bleibt zulässig
  (PATH-Auflösung); ein **expliziter Pfad** muss jetzt per Realpath mit dem laufenden
  Node-Interpreter identisch sein.
- **Fehlgeschlagenes `git status` wurde als „Working Tree: clean" injiziert.** Der Git-Wrapper
  gab bei leerem Erfolg **und** bei Fehler/Timeout `null` zurück; der Pflicht-Einstieg behauptete
  daraufhin einen sauberen Baum, den niemand geprüft hatte. **Fix:** Erfolg-leer (`''`) und
  Fehler (`null`) sind getrennt; bei Fehler heißt es jetzt **„unbekannt"** statt „clean".
- **Deadlock in Repos ohne ersten Commit.** Bei unborn HEAD scheiterte `rev-parse HEAD`, der
  Stempel blieb `verified: false`, das Gate erkannte das Verzeichnis aber als Git-Baum und
  lehnte weiter ab — erneutes Stempeln half nicht. **Fix:** `symbolic-ref --short HEAD` liefert
  den Branch auch ohne Commit; geprüft wird dann der Branch allein, und der Stempel gilt.
- **Modul-Abschnitt fehlte in fremden Arbeits-Repos.** Die Registry wurde gegen die
  Projektwurzel gelesen statt relativ zum Hook — dort, wo der Überblick am nützlichsten ist,
  fehlte er. **Fix:** Lesen über `__dirname`.
- **Marker-Sweep war unvollständig** — mein eigener Fehler. `os-info`, `save-session` und
  `felix-sync.md` behaupteten weiter, `.nc-os` schalte den SessionStart-Hinweis, obwohl Gate 2
  seit 0.3.0 markerlos ist. Alle lebenden Stellen umgestellt; die einzige verbliebene Nennung
  sagt ausdrücklich, dass die Datei **wirkungslos** ist.
- **`doku-sync` widersprach der harten Versionsregel.** Der Skill machte den Bump von einem
  Release-Entscheid abhängig, `AGENTS.md` verlangt ihn für jede **ausgelieferte** Änderung in
  derselben Änderung. **Fix:** Bump gehört zur Änderung, ausgenommen sind nur nicht
  ausgelieferte Teile (`knowledge-base/`, `test/`, `.github/`, Repo-Doku); am
  Maintainer-Entscheid hängt allein der **Release-Schnitt**.

Suite nach den Fixes: **59/59 grün**, `validate . --strict` bestanden. — Agent: Claude (Opus 5),
Review: Codex

- **Pflicht-Einstieg bei mehreren Worktrees lief ins Start-Gate.** `AGENTS.md` verlangt bei
  mehreren Bäumen `git worktree list` und `git -C <fremder-baum> status --short`; beide wurden
  abgelehnt — die erste Form fehlte in der Allowlist, die zweite scheiterte daran, dass nach
  `git` ein `-C` statt des Subkommandos stand. `isReadOnlyGitIntrospection` überliest jetzt ein
  führendes `-C <pfad>` (es wechselt nur das Arbeitsverzeichnis, bleibt also lesend) und kennt
  `worktree list` (auch `--porcelain`). **Bewusst eng:** Erlaubt wird nicht das Subkommando,
  sondern genau die lesende Form — `worktree add|remove|move|prune` bleibt gegated, und `-C`
  ist kein Freibrief. Negativproben belegen das im Test (`worktree add`, `remove`, `prune`,
  `git -C … commit -m x`, Umleitung). — *Claude (Opus 5)*

### Noch offen (Codex-Befund, bewusst nicht einseitig entschieden)

- **Subagenten passieren Gate 2 vor dem Eltern-Stempel.** Das ist die **übernommene
  Entwurfsentscheidung des Kerns** („der Parent hat den Start-Zwang erfüllt"), kein Portfehler.
  Ob sie trägt, ist eine Frage an den Kern und wird dort entschieden — nicht einseitig im
  Satelliten.

### Removed

- **`.github/workflows/quality.yml`** — vollständig durch `ci.yml` ersetzt, das eine echte
  Obermenge prüft. Zwei Workflows nebeneinander hätten bedeutet, dass der schwächere grün
  meldet, während der stärkere rot ist. Der einzige verbliebene Verweis steht in einem
  historischen CHANGELOG-Alteintrag und bleibt dort unverändert. — *Claude (Opus 5)*

### Hinweis zur Version

**Minor-Bump `0.3.0 → 0.4.0`** (Neuerung: Pflege-Skill). Die CI-Dateien allein wären kein
Bump-Grund — sie werden nicht ausgeliefert —, `doku-sync` schon: Ohne Bump erreicht der neue
Skill niemanden. **Offen bis zum Merge:** Die sechs Matrix-Felder laufen erst auf GitHub; lokal
belegt sind Suite (59/59) und die Positivkontrolle.

## 0.3.0 — 2026-08-11

Gate 2 (Session-Start-Zwang) und die eigene Wissensbasis — Bauplan
`2026-08-11-prozesskorpus-nachzug-und-satelliten-ssot-bauplan.md` des OS-Repos, AP7 und AP8.
Jede Port-Datei wurde beim Bau aus der Kern-Fassung gelesen, nicht rekonstruiert.

### Added

- **Gate 2 vollständig gebaut — Session-Start-Zwang statt Marker-Begrüßung** (AP7). Bisher gab
  es nur einen Komfort-Hinweis, der zudem an einer `.nc-os`-Datei hing. Jetzt drei Teile mit
  **einem** Schalter (`NC_START_GATE=off`):
  - **`hooks/nc-session-start.js` neu gefasst, markerlos.** Die Marker-Bindung ist gestrichen —
    ein Gate, das man vergessen kann, ist kein Gate. Statt eines Hinweises injiziert der Hook
    den **lebenden Stand**: Pflicht-Einstieg, Branch, letzte Commits, Working-Tree-Änderungen,
    den `[Unreleased]`-Kopf des CHANGELOGs, die **jüngsten fünf datierten Pläne aus der eigenen
    `knowledge-base/grundwissen/`** und die Module aus `module-registry.json`. Fehlt eine
    Quelle (fremdes Arbeits-Repo), entfällt ihr Abschnitt — die Wissensbasis bleibt
    Arbeitsmaterial, nie Laufzeit-Abhängigkeit. SessionStart kann laut Doku nicht blocken;
    dieser Teil injiziert, das Blocken übernimmt das Gate (Zangen-Prinzip).
  - **`hooks/nc-start-gate.js` neu** (PreToolUse): lehnt jede schreibende Aktion ab, bis
    gestempelt ist. Lesen bleibt frei, Read-only-Git ebenfalls — es **ist** der
    Pflicht-Einstieg. Der Durchlass für den Stempel-Befehl verlangt eine einzeilige,
    verankerte Invokation genau dieses Skripts (Interpreter **und** Pfad werden aufgelöst und
    verglichen, inkl. Realpath) und verwirft angehängte Zweitaktionen.
  - **`hooks/nc-start-stempel.js` neu:** Fakten-Stempel. `--branch`/`--head` werden gegen die
    Git-Lage des **Projektverzeichnisses** (`CLAUDE_PROJECT_DIR`, sonst cwd) verifiziert — ein
    `cd` in ein Nicht-Git-Verzeichnis kann das Gate damit nicht aushebeln. Das Feld `verified`
    hält fest, ob überhaupt etwas zu prüfen war; ein unverifizierter Stempel öffnet nur dort,
    wo auch die gegatete Aktion in keinem Git-Baum läuft. State unter
    `os.tmpdir()/nc-felix-start-gate` — **eigenes** Verzeichnis je OS der Familie, damit ein
    parallel installiertes Geschwister-OS nicht denselben Stempel liest.
  - `hooks/hooks.json`: zweiter PreToolUse-Block (`Write|Edit|MultiEdit|NotebookEdit|Bash`),
    Beschreibung auf den Ist-Stand der **gesamten** Kontroll-Schicht gehoben.
  - `skills/start/SKILL.md`: Marker-Schritt entfernt, dafür Triage der eigenen Wissensbasis und
    **Schritt 8 „Start-Stempel setzen"** als letzter Ablaufschritt; Regeln und
    Verifikationsliste nachgezogen. Der Stempel ist ausdrücklich als **Proxy** gekennzeichnet:
    Ein Skript kann nicht beweisen, dass der Skill inhaltlich lief.
  — *Claude (Opus 5)*
- **Testfälle T-13 bis T-16** in `test/start-gate.test.mjs` (neu) und `test/session-start.test.mjs`
  (ersetzt die Marker-Prüfung): Write ohne Stempel wird abgelehnt und die Ablehnung nennt Skill
  und exakten Befehl, ohne den Abschalter zu bewerben · ein Stempel mit falschem `--head` wird
  verweigert und hinterlässt **keine** State-Datei · der Durchlass verwirft `;`, `&&`, `|`,
  `$(…)`, Umleitung, Zeilenumbruch, angehängten Kommentar und einen fremden Pfad mit ähnlichem
  Namen, lässt die nackte Invokation aber durch (Fehlalarm-Kontrolle) · die Injektion feuert
  **ohne** `.nc-os` auch in einem fremden Verzeichnis und nennt die jüngsten datierten Pläne;
  undatierte Referenzen bleiben draußen. Suite: **59 Tests grün**, `validate . --strict`
  bestanden. — *Claude (Opus 5)*
- **Eigene, isolierte Wissensbasis unter `knowledge-base/`** (Bauplan
  `2026-08-11-prozesskorpus-nachzug-und-satelliten-ssot-bauplan.md` des OS-Repos, AP8; Vorlage
  `ssot-grundgeruest.md.vorlage` und Standardprozess `ssot-aufbau.md` §4 ebendort). Vorher trug
  dieses Repo **0 von 6** Bausteinen. Jetzt: `SSOT-Document-Index.md` als **einzige** Datei auf
  der Wurzelebene (Kopf, Teil 1 Ordner-Routing mit Lebenszyklus, Teil 2 Quellen-Triage) ·
  `grundwissen/` · `bauplan-archiv/` · `debugging-findings/` mit **beiden**
  append-only-Protokollen · `ideen-backlog/`; die zwei noch leeren Kategorien halten
  `PLATZHALTER.md` in Git. Erster eigener Inhalt: der Bauplan **Modul-Definition Felix-OS**,
  dessen Ausgangslage gegen `module-registry.json` und `skills/` verifiziert ist — der Ordner
  ist ab Tag 1 nicht leer. Die Protokolle sind bewusst **nicht** vorbefüllt.
  **Isolation (Invariante I1):** Diese Wissensbasis ist **terminal** — dieses Repo schreibt nie
  in Dokumente des OS-Repos, deshalb existiert keine Warteschlange, keine Kandidatenliste und
  kein reservierter Platz für so etwas; umgekehrt liest kein Artefakt des OS-Repos hier mit.
  Das OS-Repo wird ausschließlich als **Quellenangabe** genannt, nie als Lesepfad: Dieses Repo
  funktioniert ohne einen Checkout des OS-Repos. — *Claude (Opus 5)*
- **Wächter `test/wissensbasis.test.mjs`** — neun Fälle T-1 bis T-9: Index existiert ·
  Wurzel-Regel · Indexpflicht je Wissensdatei (`PLATZHALTER.md` ausgenommen) · Linkgültigkeit ·
  alle vier Kategorien vorhanden **und** in Teil 1 geroutet (beidseitig, also auch kein Ordner
  ohne Routing-Zeile) · beide Protokolle mit append-only-Kopf · **T-7 Isolation** (kein Pfad und
  kein Dateiname deutet auf Queue/Kandidat/Promotion/Kuration hin) · **T-8 Isolation** (keine
  ausgelieferte Datei führt einen Maschinenpfad auf einen fremden Checkout oder einen fremden
  Repo-Pfad ohne die Kennzeichnung „OS-Repo") · **T-9 Plugin-Grenze** (keine Eltern-Pfade in
  `skills/**` und `hooks/**`; in JavaScript werden Kommentare vorher entfernt, sonst schlüge
  die Regel an ihrer eigenen Dokumentation an).
  **Negativproben belegt, nicht behauptet:** Eine testweise unter `grundwissen/` angelegte
  Datei mit „kandidaten-queue" im Namen lässt T-3 **und** T-7 rot laufen (7 pass / 2 fail),
  nach dem Entfernen wieder 9/9. — *Claude (Opus 5)*
- **`AGENTS.md`:** Pflicht-Einstieg (Log-Stand → Produktstand → eigener Index → bekannte
  Fallen), **Protokollzwang** (eigener Fehler → `agent-learnings.md`, gefundener Bug →
  `debug-log.md`, beide append-only), Abschnitt „Wissensbasis dieses Repos" samt Isolations- und
  Auslieferungsregel, und eine **Abschluss-Checkliste** vor jedem Commit-Vorschlag.
  — *Claude (Opus 5)*
- **`felix-sync.md` §3.2a:** Pflegeabsatz mit der Tabelle „Anlass → was in derselben Änderung
  fällig wird" (neue/verschobene Wissensdatei, neue Kategorie, Vorhaben abgeschlossen, Idee ohne
  Auftrag, Idee wird beauftragt, Protokolleintrag). Reine Wissensbasis-Arbeit braucht **keinen**
  Bump, den CHANGELOG-Eintrag trotzdem. — *Claude (Opus 5)*

### Fixed

- **Plugin-Grenzen-Invariante verbot die eigene Wissensbasis** (Eintrag im neuen
  `knowledge-base/debugging-findings/debug-log.md`). `test/manifest.test.mjs` prüfte auf die
  bloße Zeichenkette `knowledge-base/` und verlangte in der Umgebung das Wort „OS-Repo" — eine
  Vereinfachung, die nur stimmte, solange dieses Repo **keine eigene** Wissensbasis hatte. Die
  Regel ist jetzt **verschärft statt gelockert**: Beide Wächter extrahieren den konkreten Pfad
  und prüfen mit `existsSync`, ob er hier existiert. Eigener Pfad → unbedenklich (er liegt im
  ausgelieferten Paket); fremder Pfad → muss als Quellenangabe „OS-Repo" gekennzeichnet sein.
  Damit hängt die Prüfung an der **Eigenschaft** statt an einem Namen. Negativprobe: ein
  angehängter fremder Pfad ohne Kennzeichnung lässt beide Prüfungen rot laufen (46 pass /
  2 fail), nach dem Zurücksetzen 48/48. — *Claude (Opus 5)*

- **Testumgebung konnte die Gate-Tests still entwerten** (Eintrag im `debug-log.md`). Die neuen
  Gate-2-Tests erbten `process.env` — auf einer Maschine mit global gesetztem
  `NC_START_GATE=off` (genau die Entwicklungsmaschine) lieferten die Hooks korrekt **nichts**,
  und jede Zusage der Suite wurde zum Selbstgespräch: grün, obwohl das Gate gar nicht lief.
  Beide Testdateien leeren die Variable jetzt **explizit** und setzen sie nur in den
  Opt-out-Fällen bewusst wieder. Genau dieser vakuum-grüne Zustand ist der Ausfallmodus, den
  Gate 2 hat — ein Test, der ihn nicht ausschließt, prüft nichts.
- **Plugin-Grenzen-Prüfung schlug an ihrer eigenen Dokumentation an.** T-9 fand die Zeichenfolge
  für Eltern-Pfade in **Kommentaren**, die erklären, warum sie verboten ist. Für JavaScript
  werden Kommentare jetzt vorher entfernt; in Markdown bleibt die Prüfung unverändert scharf.
  — *Claude (Opus 5)*

### Hinweis zur Version

**Minor-Bump `0.2.2 → 0.3.0`** (Neuerung: Gate 2). Die Wissensbasis allein hätte keinen Bump
gebraucht — sie ändert kein ausgeliefertes Verhalten —, Gate 2 hingegen schon: Ohne Bump
erreicht der Session-Start-Zwang niemanden. Version steht in `.claude-plugin/plugin.json`,
gespiegelt in `module-registry.json` (testgesichert); **nie** im Marketplace-Eintrag des
OS-Repos. Der Marketplace-Pin wird erst nach Tag und Release umgepinnt.

## 0.2.2 — 2026-08-11

Angleich der Kontroll-Schicht an den NovaCore-Kern (Bauplan
`2026-08-11-prozesskorpus-nachzug-und-satelliten-ssot-bauplan.md` des OS-Repos, AP6). Jede
Port-Datei wurde beim Bau aus dem Kern gelesen, nicht rekonstruiert.

- **fix (sicherheitsrelevant): Abschluss über `process.exitCode` statt `process.exit(0)`** in
  `nc-ffg.js` und `nc-session-start.js`. `process.exit()` kann auf POSIX den gepufferten
  stdout-Write einer Pipe abschneiden — eine abgeschnittene Deny-JSON bedeutet: **das Gate
  blockt still nicht**, und beim Session-Start bliebe der injizierte Kontext leer. Kern und
  `nc-biggi` trugen den Fix seit 2026-08-10, dieses Plugin nicht.
- **refactor: `hooks/lib/session-key.js`** neu — `hashSessionKey`, `sanitizeSessionKey`,
  `resolveSessionKey` und `isSubagentInvocation` liegen jetzt in der geteilten Lib (Inhalt =
  Kern-Fassung inklusive der NovaCore-Härtung „hashen bei **jeder** Zeichen-Ersetzung"), die
  lokalen Kopien in `nc-ffg.js` sind entfallen. Voraussetzung dafür, dass die kommenden Teile
  von Gate 2 (Start-Gate, Fakten-Stempel) denselben Session-Schlüssel ableiten wie das FFG —
  eine zweite Kopie wäre Drift-Risiko in Sicherheitscode.
- **fix: Pflicht-Einstieg läuft nicht mehr ins Routine-Bash-Gate** —
  `isReadOnlyGitIntrospection` erkennt jetzt auch `git log --oneline -N` (Kurzform) sowie
  `git rev-parse --short HEAD` und blankes `git rev-parse HEAD`. Das sind der in `AGENTS.md`
  dokumentierte Einstiegsbefehl und die Stempel-Formen aus Gate 2, alle rein lesend.
- **test:** drei neue Fälle — Pflicht-Einstieg als read-only (mit Negativprobe, dass
  `git log … > out.txt` weiter gegated wird), die beiden `rev-parse`-Formen, und eine
  Invariante über **alle** Hook-Dateien: kein `process.exit(`-Aufruf, `process.exitCode`
  gesetzt. Suite: 39 Tests grün.
- `hooks/hooks.json`-Beschreibung auf den neuen Ist-Stand der gesamten Kontroll-Schicht
  gehoben (inkl. des offenen Punkts: Gate 2 ist in diesem Plugin noch nicht gebaut).
- **Externer Review (Kimi K3, read-only, 2026-08-11): Verdikt `approve`**, keine HIGH/MEDIUM;
  Parität zur Kern-Fassung und die Sicherheit der erweiterten Read-only-Liste unabhängig
  bestätigt (verkettete/umgeleitete Formen fallen schon am Metazeichen-Wächter der
  Bash-Analyse aus, `--output=file` matcht keine der drei akzeptierten `log`-Argumentformen).
  Drei LOW-Befunde eingearbeitet: **F1** `main()` in `nc-session-start.js` lief ohne
  Fail-open-Wrapper (jetzt try/catch mit `exitCode = 0`, wie im Kern) · **F2** ungenutzter
  Import `hashSessionKey` entfernt · **F3** der I7-Wächter entfernt jetzt auch
  Blockkommentare, bevor er nach `process.exit(` sucht.
  — Agent: Claude (Opus 5), Review: Kimi K3

## 0.2.1 — 2026-07-28

- **fix: Repository-URL auf die reale Heimat korrigiert** — das Repo wurde vom Maintainer
  als `NovaCore-AI/Felix-OS` angelegt (nicht `NovaCoreAI-OS-<Abteilung>` wie im
  Satelliten-Namensschema angenommen); `repository` im Manifest entsprechend berichtigt.
- Team-Rollout-Hinweis verifiziert (Install-Fehler 2026-07-28, App und CLI):
  GitHub-Sources klonen per Default über SSH — ohne autorisierten SSH-Key schlägt die
  Installation mit `Permission denied (publickey)` fehl. Abhilfe:
  `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` setzen (nutzt die gh/git-Credentials).
- Doku: `AGENTS.md` und `felix-sync.md` verweisen jetzt auf den mit diesem Repo
  pilotierten Standardablauf `plugin-bau.md` §3b des OS-Repos (eigenständiges
  Kollegen-OS, inkl. Install-Fallen). — Agent: Claude (Fable 5)

## 0.2.0 — 2026-07-28

Umbau auf das **eigenständige Ein-Plugin-Modell** (Auftrag Maintainer 2026-07-28: „Module
statt Abteilungen, kein Kern als Plugin — das reicht als Modul"):

- **Kern-Dependency entfernt** (`dependencies: ["nc"]` gestrichen) — der Kern ist jetzt ein
  **Modul** dieses Plugins, kein eigenes Plugin. Koexistenz-Regel dokumentiert: nicht
  parallel zum NovaCore-Kern `nc` betreiben (doppelte Gates).
- **Kernmodul (ohne Präfix), 6 Skills:** `start`, `save-session`, `journal` (Workflow
  WP0/WP8, angepasste Ports aus dem NovaCore-Kern) sowie `os-info`, `code-tour`,
  `skill-builder` (Maintenance-Basics; `os-info`/`skill-builder` nach Onsite-Vorbild,
  `code-tour` Neubau).
- **Eigene Kontroll-Schicht:** FFG (`hooks/nc-ffg.js` + `hooks/lib/`) als verbatim-Port aus
  dem NovaCore-Kern übernommen (gleiche Env-Schalter `NC_FFG*`), SessionStart-Hinweis
  (`hooks/nc-session-start.js`) auf `/nc-felix:`-Namespace angepasst; `.nc-os`-Marker-Logik
  unverändert (isFile-Prüfung).
- **Geteilte Strukturen ins Plugin übernommen:** `felix-sync.md` (Global-Anweisung, Port der
  `nc-sync.md`), `wp-rahmen.md` (WP0–WP8, Träger: Kernmodul/Arbeitsmodule),
  `module-registry.json` (Modul-SSOT), `referenz/skill-authoring.md` (Formatregeln).
- **Tests erweitert:** FFG-Testsuite (verbatim übernommen) + SessionStart-Tests (angepasst)
  + Struktur-/Frontmatter-Invarianten (Eigenständigkeit, Hooks-Pflicht, Registry-Spiegel,
  YAML-Falle, Plugin-Grenze). — Agent: Claude (Fable 5)

## 0.1.0 — 2026-07-28

- Abteilungsplugin `nc-felix` als **erster Satellit des NovaCore-OS** angelegt (Muster:
  Onsite.ai-OS-Satellit `oai-marketing`, produktiv erprobt; Standardprozess `plugin-bau.md`
  §3a des OS-Repos). Das Repo IST das Plugin: Manifest an der Wurzel.
- Stand: angelegt, **noch keine gebauten Skills** — Modul- und Skill-Planung erfolgt separat
  mit dem Fachbereich (Felix). `dependencies: ["nc"]` zieht den Kern transitiv mit
  (Kontroll-Hook FFG, WP-Rahmen, geteilte Global-Anweisung `nc-sync.md`).
- Qualitätsbasis: Manifest-/Struktur-Tests (`node --test`), CI-Workflow `quality`
  (SHA-gepinnte Actions), `.gitignore` (u. a. `.nc/`-Memory), `.nc-os`-Marker für den
  SessionStart-Hinweis des Kerns, `AGENTS.md` mit Satelliten-Regeln. — Agent: Claude (Fable 5)
