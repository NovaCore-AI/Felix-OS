# Platzhalter — `bauplan-archiv/`

Dieser Ordner nimmt **abgeschlossene oder verworfene Baupläne** auf, unverändert übernommen.
Er ist noch leer; die Datei hält ihn in Git und ist bewusst **nicht** indexpflichtig (sie
trägt kein Wissen, nur Struktur — testerzwungene Ausnahme).

**Lebenszyklus:** Ist ein Vorhaben abgeschlossen oder verworfen, wandert sein Plan
**pflichtgemäß** per `git mv` aus `grundwissen/` hierher; der Inhalt wird dabei nicht
angefasst. Die Zeile im `SSOT-Document-Index` wandert in derselben Änderung mit in die
Archiv-Tabelle (Status `historisch`).

**Terminal:** Das Archiv ist reine Nachvollziehbarkeit dieses Repos — **keine** Quelle
Richtung OS-Repo, keine Warteschlange, keine Vorstufe für irgendetwas. Sobald der erste Plan
hier liegt, wird diese Datei gelöscht.

*Angelegt 2026-08-11 (Standardprozess `ssot-aufbau.md` §4 des OS-Repos, Vorlage
`ssot-grundgeruest.md.vorlage`).*
