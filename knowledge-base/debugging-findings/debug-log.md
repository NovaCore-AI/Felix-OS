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

### 2026-08-12 — Nachtrag zu den Codex-Befunden vom 2026-08-11: fünf sind geschlossen, einer bleibt offen

Dieser Eintrag korrigiert nicht die Einträge oben (append-only), sondern **verweist** auf sie: Sie
tragen alle „**Fix:** Offen", obwohl die Fixes in 0.4.0 tatsächlich eingebaut wurden. Wer den Stand
aus diesem Protokoll liest — und genau dafür ist es da —, hält gelöste Bugs für offen.
Verifiziert am Code, nicht erinnert:

- **Unborn HEAD** → geschlossen, `nc-start-stempel.js:100-101` (`symbolic-ref --short HEAD` als
  Fallback), Zweig `echterBranch && !echterHead && imGitBaum` prüft den Branch allein.
- **Worktree-/Fremdbaum-Pflichtformen** → geschlossen, `lib/bash-analyse.js:504-521`
  (führendes `-C <pfad>` wird überlesen, `worktree list` allowgelistet); Negativproben in T-15a.
- **Lokales Programm namens `node`** → geschlossen, `nc-start-gate.js:60-73` (Realpath-Identität
  mit `process.execPath`); **seit 2026-08-12 auch per Regressionstest T-15b gedeckt** — vorher war
  der Fix ungetestet (siehe nächster Eintrag).
- **Modul-Abschnitt im fremden Repo** → geschlossen, `nc-session-start.js:141` (`__dirname`).
- **`git status` als „clean"** → geschlossen, `nc-session-start.js:90` (`''` ≠ `null`);
  **seit 2026-08-12 per T-16i/T-16j gedeckt.**
- **`doku-sync` vs. Versionsregel** → **nur halb** geschlossen: der Body war korrigiert, die
  Frontmatter-`description` nicht (eigener Eintrag unten).
- **Subagenten passieren Gate 2** → **bleibt offen**, unverändert. Bestätigt: `nc-start-gate.js`
  kehrt bei `agent_id`/`agent_type` vor der Stempel-Prüfung zurück, und der Agent-Aufruf selbst
  steht in keinem Matcher — die Ausnahme setzt einen Eltern-Stempel voraus, den sie nicht prüft.
  Entscheidung liegt laut CHANGELOG 0.4.0 beim Kern; hier bewusst nicht einseitig geändert.
- **Präventionsregel:** Wird ein protokollierter Befund behoben, gehört der **Nachtrag in
  denselben Change** wie der Fix. „Fix: Offen" ist eine Tatsachenbehauptung über den heutigen
  Stand — bleibt sie stehen, wird aus dem Protokoll eine Falschauskunft an den nächsten Agenten.

### 2026-08-12 — Vier von fünf Zusagen aus 0.4.0 waren vakuum-grün (Mutationsprobe)

- **Symptom:** Die Suite meldete 59/59 grün. Entfernt man die geprüfte Logik, meldet sie
  **weiter** grün — der Test prüft dann nichts mehr, ohne es zu sagen.
- **Vorgehen:** Mutationsprobe — Implementierung gezielt kaputt machen, Suite laufen lassen,
  Datei aus einer In-Memory-Kopie restaurieren. Fünf Mutationen, vier blieben grün:
  Realpath-Identität des Interpreters entfernt (der `./node`-Kanal durch Gate 2!) ·
  `git()`-Vertrag `''`→`null` zurückgedreht · `unreleasedHead`-Abschnittsgrenze entfernt ·
  `verified` im Stempel hart auf `true`. Nur „`deny()` stillgelegt" wurde rot.
- **Ursache:** Die Tests prüften jeweils die **Nachbarschaft** der Zusage, nicht die Zusage
  selbst. T-15 deckte Köder-**Skriptpfade** ab, aber keinen Köder-**Interpreter**; T-16c prüfte,
  *dass* ein Stand-Abschnitt erscheint, nicht *was* er bei Fehler behauptet; kein Fall setzte
  einen unverifizierten Stempel gegen einen echten Git-Baum.
- **Fix:** T-14b, T-15b, T-15c, T-16g–T-16j ergänzt; I7-Wächter um `nc-start-gate.js` erweitert.
  Erneute Probe mit zehn Mutationen: **10 von 10 rot.** Suite 66/66.
- **Beleg:** Probelauf vor dem Fix „!! VAKUUM-GRUEN" für vier Mutationen; danach „rot (gut)" für
  alle zehn.
- **Präventionsregel:** Ein Test für einen **Sicherheits**-Fix wird gegen die Mutation
  abgenommen, die den Fix entfernt — nicht gegen den Happy Path. „Suite grün" ist ohne
  Gegenprobe keine Aussage über Abdeckung.

### 2026-08-12 — Pflicht-Einstieg injizierte veröffentlichte CHANGELOG-Einträge als `[Unreleased]`

- **Symptom:** Bei einem CHANGELOG mit der Kopfform `## v0.9.0 — …` enthielt der injizierte
  `[Unreleased]`-Block die Einträge **dieser bereits veröffentlichten** Version.
- **Ursache:** `unreleasedHead` beendete den Abschnitt nur an `/^##\s+\[?\d/` — einer Überschrift,
  deren Version mit einer **Ziffer** beginnt. `## v0.9.0` beginnt mit `v`. Der Hook läuft
  markerlos in **jedem** Repo auf dem Gerät, fremde CHANGELOG-Dialekte sind also der Normalfall,
  nicht die Ausnahme. Bemerkenswert: `release.yml` schnitt den Abschnitt per awk schon korrekt an
  jedem `^## ` — zwei Implementierungen derselben Grenze, die sich widersprachen.
- **Fix:** Abschnitt endet an **jeder** `^## `-Überschrift (Unterabschnitte sind `###`).
- **Beleg:** Probe mit dem Fixture oben zeigte „ALTES, LAENGST VEROEFFENTLICHTES Ding" im
  Unreleased-Block; T-16g ist ohne den Fix rot.
- **Präventionsregel:** Wird dieselbe Grenze an zwei Stellen gezogen (Hook und Workflow), gehört
  sie in **einen** Test, der beide Formen prüft — sonst driftet die eine Stelle unbemerkt.

### 2026-08-12 — Gefüllter `[Unreleased]`-Abschnitt wurde als „leer" injiziert

- **Symptom:** Ein `[Unreleased]`-Abschnitt mit Prosa oder `*`-Bullets erzeugte im
  Pflicht-Einstieg „**(leer — nichts Unveroeffentlichtes)**".
- **Ursache:** Erkannt wurden nur `###`-Rubriken und `-`-Bullets. Griff kein Muster, war `body`
  leer, und der Code deutete „nichts erkannt" als „nichts vorhanden" — **dieselbe Fehlerklasse**
  wie das in 0.4.0 behobene „fehlgeschlagenes `git status` = clean": eine Behauptung über etwas,
  das nie geprüft wurde.
- **Fix:** `*`/`+` gelten als Bullets; hat der Abschnitt Inhalt, den der Hook nicht zerlegt, sagt
  er das ausdrücklich. Zusätzlich wird die Kürzung auf `MAX_UNRELEASED_LINES` jetzt ausgewiesen,
  statt eine Teilliste als vollständig zu präsentieren.
- **Beleg:** Probe B lieferte „(leer — nichts Unveroeffentlichtes)" für einen gefüllten
  Abschnitt; T-16h ist ohne den Fix rot.
- **Präventionsregel:** „Kein Treffer meines Parsers" darf nie zu „Gegenstand existiert nicht"
  verkürzt werden. Wo ein Hook Fakten injiziert, ist **Nichtwissen ein eigener Zustand** und muss
  als solcher benannt werden.

### 2026-08-12 — `doku-sync`-Frontmatter lehrte weiter die widerlegte Versionsregel

- **Symptom:** `skills/doku-sync/SKILL.md` sagte in der `description` „Bump und Tag nur bei
  Release-Entscheid" — genau die Regel, die der Eintrag vom 2026-08-11 als falsch belegt hat und
  die 0.4.0 im Body korrigierte.
- **Ursache:** Der Fix von 0.4.0 fasste nur den Body an. Die Frontmatter blieb stehen und
  widersprach ab da dem eigenen Schritt 6, `AGENTS.md:72-75` und dem CHANGELOG, der den Fix
  bereits als erledigt auswies.
- **Wirkung — der eigentliche Befund:** Laut offizieller Skills-Doku (code.claude.com/docs
  `skills`, abgerufen 2026-08-12) wird die `description` in den Kontext geladen, damit das Modell
  über den Einsatz des Skills entscheidet — der Body erst beim Aufruf. Die falsche Regel stand
  also genau an der Stelle, die **immer** mitliest, und die richtige an der, die nur manchmal
  geladen wird. Der Fix wirkte dort nicht, wo er wirken musste.
- **Fix:** Beschreibung an die harte Regel angeglichen.
- **Beleg:** `grep -n "Release-Entscheid"` traf `skills/doku-sync/SKILL.md:7-8` gegen
  `AGENTS.md:72-75` und `skills/doku-sync/SKILL.md:46-57`.
- **Präventionsregel:** Wird eine Regel in einem Skill korrigiert, ist die **Frontmatter Teil des
  Fixes**, nicht Beiwerk. Beim Toter-Pfad-Sweep den Altbegriff auch gegen `description`-Blöcke
  greppen — dort steht der Text, den das Modell zuerst sieht.

### 2026-08-12 — Gate 2 war durch einen abschließenden Zeilenumbruch nicht mehr entsperrbar

- **Symptom:** `node "<stempelpfad>" --session … --branch … --head …` mit angehängtem `\n` (oder
  `\r\n`) wurde vom Stempel-Durchlass abgelehnt. Da der Stempel der **einzige** Öffner von Gate 2
  ist, blieb die Session dann dauerhaft schreibunfähig.
- **Ursache:** `istStempelBefehl` wies jeden Befehl mit `\r` oder `\n` ab — richtig gegen
  angehängte Zweitaktionen (`…\necho pwned`), aber die Prüfung unterschied nicht zwischen einem
  Umbruch **mitten** im Befehl und **abschließendem** Leerraum, der in der Shell bedeutungslos
  ist.
- **Fix:** abschließenden Leerraum vor der Prüfung abschneiden; interne Umbrüche bleiben verboten.
- **Beleg:** Probelauf: „DENY | trailing newline" und „DENY | trailing CRLF" neben „ALLOW |
  BASELINE"; T-15c ist ohne den Fix rot, die Negativprobe `…\necho pwned` bleibt DENY.
- **Präventionsregel:** Bei einem Gate mit **genau einem** Öffner ist die Sperre des Öffners kein
  fail-safe, sondern ein Deadlock. Jede Verschärfung am Öffner braucht neben der Negativprobe
  auch eine **Positivprobe für die harmlose Variante**.

### 2026-08-12 — `heartbeat()` schreibt den Stempel nicht atomar (offen, gemeldet)

- **Symptom:** Bisher nicht beobachtet; aus dem Code abgeleitet.
- **Ursache:** `nc-start-gate.js` frischt `last_active` per direktem `fs.writeFileSync` auf.
  `nc-ffg.js:138-150` benutzt für denselben Zweck bewusst Temp-Datei + Rename, mit der Begründung
  „verhindert halb geschriebene Reads". Bei parallelen Tool-Aufrufen einer Session laufen mehrere
  Gate-Prozesse gleichzeitig auf **dieselbe** Stempeldatei.
- **Wirkung:** Ein zerrissener Stempel ist nicht parsebar, zählt als „nicht gestempelt" und
  erzeugt eine **überflüssige Ablehnung**, die sich durch erneutes Stempeln selbst heilt — also
  fail-safe, aber unnötig.
- **Fix:** Offen — bewusst nicht in diesem Review geändert: ein deterministischer Renn-Test fehlt,
  und ein ungetesteter Umbau an Sicherheitscode wäre das größere Risiko als der Befund.
- **Beleg:** `nc-start-gate.js:158-165` gegenüber `nc-ffg.js:138-150`.
