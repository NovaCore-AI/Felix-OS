# Fehlerprotokoll Felix-OS — append-only

> Jeder eigene Fehler sofort als Eintrag: Datum · was falsch war · Ursache ·
> Lernerkenntnis/Präventionsregel. Nie rückdatieren, nie umschreiben.
>
> **Pflicht, nicht Ermessen.** Jeder Fehler, den ein Agent bei der Arbeit an **diesem** Repo
> selbst macht, wird hier festgehalten — ohne Ausnahme. Vor neuen Aufgaben zuerst hier auf
> bekannte eigene Fehlermuster prüfen. Gefundene Bugs gehören nicht hierher, sondern ins
> [Debug-Log](debug-log.md).

## Einträge

*(noch keiner — der erste Eintrag entsteht beim ersten echten Fehler. Dieser Abschnitt wird
bewusst nicht mit Beispielen vorbefüllt: Ein erfundener Eintrag entwertet das Protokoll.)*

### 2026-08-11 — Referenzpfad der Superpowers-Skill-Anweisung falsch angenommen

- **Fehler:** Ich habe `references/codex-tools.md` unterhalb von `skills/` aufgerufen; der Pfad existiert dort nicht.
- **Ursache:** Ich habe den relativen Pfad aus `using-superpowers/SKILL.md` ohne Prüfung auf das Skill-Verzeichnis bezogen.
- **Prävention:** Relative Referenzpfade zuerst gegen die Verzeichnisstruktur des Plugins auflösen, bevor ich sie aufrufe.

### 2026-08-11 — Temporären Testpfad vor rekursivem Löschen nicht verifiziert

- **Fehler:** Mein Reproduktionsbefehl wollte ein berechnetes Temp-Verzeichnis rekursiv entfernen, ohne den aufgelösten Zielpfad vorher gegen das Temp-Verzeichnis zu prüfen; die Sicherheitsrichtlinie blockierte den Befehl.
- **Ursache:** Ich habe die Aufräumlogik direkt in denselben PowerShell-Befehl geschrieben und die vorgeschriebene Pfadprüfung ausgelassen.
- **Prävention:** Vor jedem rekursiven Löschen den absoluten Zielpfad separat auflösen und belegen, dass er unter dem ausdrücklich gewählten Temp-Wurzelpfad liegt.

### 2026-08-11 — Rekursives Temp-Aufräumen erneut in einem berechneten Befehl versucht

- **Fehler:** Auch der zweite Reproduktionsbefehl mit eingebauter Pfadprüfung wurde blockiert, weil ich weiterhin ein rekursives `Remove-Item` gegen einen im selben Befehl berechneten Pfad verwendet habe.
- **Ursache:** Ich habe die Sicherheitsregel semantisch geprüft, aber nicht die robustere Ausführung gewählt, ganz ohne rekursives Aufräumen auszukommen.
- **Prävention:** Für kleine Reproduktionen einen eindeutigen Temp-Pfad verwenden und im Prüfkommando gar nicht rekursiv löschen; Aufräumen nur separat mit einem bereits sichtbaren absoluten Pfad.

### 2026-08-11 — PowerShell-Backtick in einem `node -e`-Prüfbefehl nicht escaped

- **Fehler:** Ein `node -e`-Befehl brach mit SyntaxError ab, weil der Markdown-Backtick im JavaScript-String von PowerShell als Escape-Zeichen interpretiert wurde.
- **Ursache:** Ich habe JavaScript mit einem Backtick-haltigen Vergleich direkt in eine doppelt gequotete PowerShell-Zeichenkette eingebettet.
- **Prävention:** In PowerShell-Prüfbefehlen Backticks vermeiden oder den JavaScript-Quelltext über einen literal here-string an `node` übergeben.

### 2026-08-12 — Mutationsprobe mit `git checkout --` riss die eigenen uncommitteten Fixes mit

- **Fehler:** Meine Mutationsprobe machte die Implementierung kaputt und stellte sie mit
  `git checkout -- <datei>` wieder her. Beim zweiten Durchlauf lagen meine **eigenen, noch nicht
  committeten** Fixes in genau diesen Dateien — `git checkout` setzte auf HEAD zurück und löschte
  sie restlos. Nur weil `git status` danach ausgegeben wurde, ist es aufgefallen; die Suite wäre
  weiter grün gewesen, hätte aber die alte Logik geprüft.
- **Ursache:** Ich habe „Wiederherstellen" mit „auf HEAD zurücksetzen" gleichgesetzt. Das stimmt
  nur, solange der Working Tree clean ist — beim ersten Probelauf war er das, beim zweiten nicht.
  Die Anweisung nannte `git checkout` als Rücksetzweg; ich habe sie übernommen, ohne die
  Vorbedingung „clean" zu prüfen, die sie stillschweigend voraussetzt.
- **Prävention:** Eine Mutationsprobe restauriert **aus einer In-Memory-Kopie** der Datei
  (`const orig = readFileSync(...)` → `finally { writeFileSync(..., orig) }`), nie über Git.
  Wenn doch über Git: vorher committen oder stashen und den cleanen Zustand belegen. Und nach
  jeder Probe `git status --short` ausgeben — ein Rücksetzschaden ist sonst unsichtbar.

### 2026-08-12 — `/tmp` in Git Bash ist nicht `/tmp` für Node auf Windows

- **Fehler:** Ein Prüfskript schrieb Fixtures per Git-Bash-Heredoc nach `/tmp/felix-probe` und
  ließ Node dasselbe Verzeichnis lesen. Node löste `/tmp/...` als `C:\tmp\...` auf, fand nichts,
  und die Probe lieferte **leere Ausgabe** — was aussah wie „Befund nicht reproduzierbar".
- **Ursache:** Git Bash mappt `/tmp` auf das Windows-Temp des Nutzers, Node interpretiert einen
  führenden `/` als Wurzel des aktuellen Laufwerks. Ich habe zwei Pfad-Welten in einem Befehl
  gemischt.
- **Prävention:** In gemischten Bash/Node-Befehlen auf Windows **ausschließlich** absolute
  Windows-Pfade verwenden (oder den Pfad in Node selbst per `os.tmpdir()`/`mkdtempSync`
  bestimmen). Und eine leere Probe-Ausgabe nie als „kein Befund" lesen, sondern erst beweisen,
  dass die Probe überhaupt gegriffen hat.

### 2026-08-12 — Test-Assertion auf ein Wort geprüft, das die korrekte Meldung enthalten darf

- **Fehler:** Für „der Hook darf einen gefüllten Abschnitt nicht als leer melden" habe ich
  `assert.doesNotMatch(block, /leer/i)` geschrieben. Die richtige Meldung lautet „**nicht leer**,
  aber in einer hier nicht zerlegten Form" — der Test schlug also am korrekten Verhalten fehl.
- **Ursache:** Ich habe auf ein **Teilwort** geprüft statt auf die konkrete falsche Behauptung.
- **Prävention:** Negativ-Assertions gegen die vollständige Falschaussage richten (hier:
  `/nichts Unveroeffentlichtes/`), nie gegen ein Wort, das in der gewünschten Ausgabe ebenfalls
  vorkommen kann. Sonst erzwingt der Test eine Formulierung statt eines Verhaltens.
