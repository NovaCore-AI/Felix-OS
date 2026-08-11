# Debug-Log Felix-OS — append-only

> Gefundene/behobene Bugs: Datum · Symptom · Ursache · Fix · Beleg. Nie umschreiben.
>
> Gegenstück zum [Fehlerprotokoll](agent-learnings.md): Dort stehen die **eigenen** Fehler des
> Agenten, hier die **gefundenen** Bugs und Fehlbefunde an Code, Konfiguration und Doku —
> unabhängig davon, wer sie verursacht hat. Vor jeder neuen Fehlersuche zuerst hier die
> Symptome abgleichen: Ein bekanntes Symptom spart die halbe Analyse. Ein widerlegter Eintrag
> wird nie umgeschrieben, sondern bekommt einen **neuen**, der auf ihn verweist.

## Einträge

### 2026-08-11 — Geerbtes `NC_START_GATE=off` machte die Gate-2-Tests vakuum-grün

- **Symptom:** Die neuen Testfälle T-13 bis T-16 schlugen alle mit „keine Injektion erhalten"
  bzw. „ohne Stempel muss Write abgelehnt werden" fehl. Direkt aufgerufen gaben beide Hooks
  **nichts** aus, bei Exitcode 0 und ohne stderr.
- **Ursache:** Kein Fehler im Port. `env | grep ^NC_` zeigte `NC_START_GATE=off` und
  `NC_FFG=off` in der Entwicklungsumgebung — die Hooks respektierten den Opt-out völlig
  korrekt. Die **Tests** waren falsch: Sie reichten `process.env` unverändert an die
  Kindprozesse weiter.
- **Wirkung — der eigentliche Befund:** Wären die Tests zufällig anders geschrieben gewesen
  (etwa „Antwort ist null" als Erwartung), hätten sie auf dieser Maschine **grün gemeldet,
  während das Gate gar nicht lief**. Genau das ist der stille Ausfallmodus, gegen den Gate 2
  gebaut ist — eine Suite, die ihn nicht ausschließt, prüft nichts.
- **Fix:** `test/start-gate.test.mjs` und `test/session-start.test.mjs` setzen
  `NC_START_GATE: ''` **explizit** im Kindprozess-Env, bevor `extraEnv` gespreizt wird; die
  Opt-out-Fälle (T-13b, T-16d) setzen die Variable danach bewusst wieder. Beide Stellen tragen
  einen Kommentar mit der Begründung.
- **Beleg:** vorher 47 pass / 12 fail; nach dem Fix 59/59 grün, und die Negativproben zeigen
  reale Deny-Ausgaben (`permissionDecision: deny`, Stempel-Exit 1).
- **Präventionsregel:** Ein Test, der ein **Gate** prüft, darf dessen Opt-out-Variable niemals
  erben. Env-Schalter im Kindprozess immer explizit auf den geprüften Zustand setzen — auch
  den „aus"-Zustand —, statt sich auf die Umgebung zu verlassen. Sonst hängt die Aussagekraft
  der Suite an der Shell dessen, der sie startet.

### 2026-08-11 — Plugin-Grenzen-Test verbot die eigene Wissensbasis

- **Symptom:** Nach dem Anlegen von `knowledge-base/` schlug
  `test/manifest.test.mjs` → „Ausgelieferte Markdown-Dateien verweisen nicht über die
  Plugin-Grenze" fehl: `AGENTS.md:28: Repo-Pfad ohne "OS-Repo"-Qualifizierung`. Die Zeile
  verwies auf `knowledge-base/SSOT-Document-Index.md` — eine Datei **dieses** Repos.
- **Ursache:** Die Invariante prüfte auf die bloße Zeichenkette `knowledge-base/` und verlangte
  in der Umgebung das Wort „OS-Repo". Diese Vereinfachung war korrekt, solange Felix-OS **keine
  eigene** Wissensbasis hatte — damals konnte jede solche Nennung nur das OS-Repo meinen. Mit
  AP8 stimmt die Annahme nicht mehr: Die Repo-Wurzel **ist** das Plugin, also liegt
  `knowledge-base/` im ausgelieferten Paket und löst nach der Installation sehr wohl auf.
- **Fix:** Regel **verschärft statt gelockert**. Beide Wächter (`manifest.test.mjs` und der neue
  `wissensbasis.test.mjs`, Fall T-8) extrahieren jetzt den konkreten Pfad und prüfen mit
  `existsSync`, ob er **in diesem Repo existiert**. Existiert er → eigener Pfad, unbedenklich.
  Existiert er nicht → er meint das OS-Repo und muss als Quellenangabe gekennzeichnet sein.
  Die Regel pflegt sich damit selbst, statt an einer Namensannahme zu hängen.
- **Beleg:** `node --test test/*.test.mjs` → 48/48 grün. **Negativprobe:** eine an `AGENTS.md`
  angehängte Zeile, die einen Standardprozess des **OS-Repos** (`os-bau-methode.md`) als vollen
  `knowledge-base/`-Pfad **ohne** die Kennzeichnung nennt, lässt **beide** Prüfungen rot laufen
  (46 pass / 2 fail); nach dem Zurücksetzen wieder 48/48.
- **Präventionsregel:** Eine Invariante, die auf einen **Namen** statt auf die **Eigenschaft**
  prüft, wird falsch, sobald der Name im eigenen Repo eine zweite Bedeutung bekommt. Beim
  Einführen einer Struktur, deren Name schon in einer Prüfung vorkommt, zuerst die Prüfung
  lesen — nicht erst den roten Lauf abwarten.

### 2026-08-11 — Start-Gate ist in Git-Repos ohne ersten Commit nicht entsperrbar

- **Symptom:** In einem frisch initialisierten Git-Repo erzeugt der Stempel nur `verified: false`; die nächste Schreibaktion wird deshalb wieder abgelehnt.
- **Ursache:** `rev-parse HEAD` scheitert bei einem unborn HEAD, während das Gate dasselbe Verzeichnis korrekt als Git-Arbeitsbaum erkennt. Der Zustand kann durch erneutes Stempeln nicht wechseln.
- **Fix:** Offen — den „noch kein Commit“-Zustand als eigenen verifizierbaren Git-Zustand behandeln.
- **Beleg:** `nc-start-stempel.js:94-118` und `nc-start-gate.js:209-215` bilden den Widerspruch direkt ab.

### 2026-08-11 — Pflicht-Einstieg für mehrere Worktrees läuft ins Start-Gate

- **Symptom:** Vor dem Stempel werden `git worktree list` und `git -C <fremder-baum> status --short` abgelehnt, obwohl `AGENTS.md` beide bei mehreren Bäumen vorschreibt.
- **Ursache:** Das Start-Gate lässt für Bash nur die enge `isReadOnlyGitIntrospection`-Allowlist durch; beide erforderlichen read-only Formen fehlen dort.
- **Fix:** Offen — die sicheren Worktree- und Fremdbaum-Statusformen eng allowlisten und testen.
- **Beleg:** Direkter Funktionsaufruf ergab für beide Befehle `false`, für `git status --short --branch` dagegen `true`.

### 2026-08-11 — Stempel-Durchlass akzeptiert beliebige lokale Programme namens `node`

- **Symptom:** Ein Befehl wie `./node "<echter-stempelpfad>" ...` passiert die Vorprüfung; das lokale Programm kann statt Node beliebige Schreibaktionen ausführen.
- **Ursache:** `istNodeInterpreter` prüft nur den Basename `node`/`node.exe`, nicht die Identität mit dem tatsächlichen Node-Interpreter.
- **Fix:** Offen — explizite Interpreterpfade gegen `process.execPath`/Realpath prüfen und Pfade mit fremdem Ziel ablehnen.
- **Beleg:** `nc-start-gate.js:48-63`; der Kommentar verspricht Identitätsprüfung, die Funktion macht nur `path.basename`.

### 2026-08-11 — Subagenten umgehen Gate 2 vor dem Eltern-Stempel

- **Symptom:** Eine Write/Edit/Bash-Aktion mit `agent_id` oder `agent_type` wird auch dann durchgelassen, wenn die Eltern-Session noch keinen Stempel besitzt.
- **Ursache:** `isSubagentInvocation(input)` kehrt vor Session-Key- und Stamp-Prüfung zurück; der nicht gematchte Agent-Aufruf garantiert keinen vorherigen Eltern-Stempel.
- **Fix:** Offen — die Ausnahme an einen nachgewiesenen Eltern-Stempel binden oder Subagenten selbst stempeln lassen.
- **Beleg:** `nc-start-gate.js:203-207`.

### 2026-08-11 — SessionStart sucht die Plugin-Module im Arbeits-Repo

- **Symptom:** In einem normalen Verbraucher-Repo ohne eigene `module-registry.json` fehlt der Modul-Abschnitt der Injektion vollständig.
- **Ursache:** `buildContext` ruft `moduleListe(root)` mit der Projektwurzel auf, obwohl die Registry zum installierten Plugin neben dem Hook gehört.
- **Fix:** Offen — die Modul-Registry relativ zu `__dirname` lesen; nur projektbezogene Quellen an `root` binden.
- **Beleg:** `buildContext(process.env.TEMP, ...)` enthielt die Plugin-Version, aber keinen `## Module`-Abschnitt.

### 2026-08-11 — Fehlgeschlagenes `git status` wird als sauberer Working Tree ausgegeben

- **Symptom:** Wenn `git status --porcelain` scheitert oder nach zwei Sekunden abbricht, `rev-parse` aber gelingt, injiziert der Hook `Working Tree: clean`.
- **Ursache:** Der Git-Wrapper liefert sowohl bei leerer erfolgreicher Ausgabe als auch bei Fehlern `null`; `buildContext` deutet `null` zusammen mit einem Branch als „clean“.
- **Fix:** Offen — Erfolg-leer und Fehler als getrennte Rückgabewerte modellieren; bei Fehler den Statusabschnitt weglassen oder als unbekannt markieren.
- **Beleg:** `nc-session-start.js:63-75` und `:199-215`.

### 2026-08-11 — Doku-Sync widerspricht der verpflichtenden Versionsregel

- **Symptom:** Der neue Skill lässt einen ausgelieferten Change ohne Bump, sofern der Maintainer nicht zusätzlich einen „Release-Entscheid“ ausspricht; das Team erhält dann kein Auto-Update.
- **Ursache:** `skills/doku-sync/SKILL.md` macht den Bump von einer separaten Release-Entscheidung abhängig, während `AGENTS.md` ihn für jede ausgelieferte Änderung im selben Change verlangt.
- **Fix:** Offen — die Skill-Logik an die harte Repo-Regel angleichen; nur reine Wissensbasis-Arbeit ausnehmen.
- **Beleg:** `skills/doku-sync/SKILL.md:46-51,72-73` gegenüber `AGENTS.md:72-75,108-110`.

### 2026-08-11 — Ausgelieferte Anweisungen behaupten weiter einen `.nc-os`-Scope

- **Symptom:** `os-info`, `save-session`, `felix-sync.md` und die Marker-Datei selbst sagen weiterhin, `.nc-os` schalte den SessionStart-Hinweis; Gate 2 ist jetzt ausdrücklich markerlos.
- **Ursache:** Der Verhaltenswechsel wurde nur in SessionStart, Start-Skill und README nachgezogen; der verpflichtende Toter-Pfad-Sweep blieb unvollständig.
- **Fix:** Offen — alle lebenden Marker-Aussagen auf den markerlosen Scope und `NC_START_GATE` umstellen; historische CHANGELOG-Treffer unverändert lassen.
- **Beleg:** Treffer in `skills/os-info/SKILL.md:40`, `skills/save-session/SKILL.md:57`, `felix-sync.md:76-80,179` und `.nc-os:1`.
