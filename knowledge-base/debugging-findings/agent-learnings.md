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
