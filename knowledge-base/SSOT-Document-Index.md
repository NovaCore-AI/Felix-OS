# SSOT-Document-Index — Master-Index der Wissensbasis des Felix-OS

> **Zweck:** Der Master-Index **dieses** Repos — die Single Source of Truth darüber, welche
> eigenen Dokumente und Ordner es gibt. Zwei Fragen, ein Dokument: **wohin** gehört ein
> Dokument (Teil 1: Ordner-Routing) und **wann** wird eine vorhandene Quelle gebraucht
> (Teil 2: Quellen-Triage). Er ist das **einzige Dokument auf der Wurzelebene** der
> Wissensbasis (testerzwungen).
>
> **Benutzung:** Vor dem Anlegen, Verschieben oder Löschen eines Dokuments Teil 1 lesen; vor
> dem Griff in eine Kategorie Teil 2 überfliegen. „Relevant wenn …" nennt die
> Abruf-**Situation**, nicht den Inhalt — triagieren statt Volltexte lesen.
>
> **Verhältnis zum OS-Repo (Quellenangabe, kein Lesepfad):** Die verbindlichen
> **Standardprozesse** (Kern- und Abteilungs-Plugin-Bau, SSOT-Aufbau, Aktualisierungs-Index)
> und die **Produktdefinitionen** der NovaCore-Familie liegen zentral im **OS-Repo**
> `NovaCore-AI/NovaCoreAI-OS` und werden hier **nicht** gespiegelt (Doppelpflege-Verbot). Sie
> werden namentlich genannt, nie als Maschinenpfad geführt — dieses Repo funktioniert ohne
> einen Checkout des OS-Repos.
>
> **Isolation (harte Invariante):** Diese Wissensbasis ist **terminal**. Felix-OS schreibt
> **nie** in Dokumente des OS-Repos, weder direkt noch über eine Vorstufe; es gibt deshalb
> keine Warteschlange, keine Kriterienliste und keinen reservierten Platz für so etwas — nicht
> als „kommt später", sondern gegenstandslos. Umgekehrt liest kein Artefakt des OS-Repos diese
> Wissensbasis; von hier kennt es nur den Marketplace-Pin und die Registry-Zeile.
>
> **Auslieferung:** Das Repo **ist** das Plugin, also fährt dieser Ordner beim Install mit in
> den Plugin-Cache. Er ist **Arbeitsmaterial des Repos, nie Laufzeit-Abhängigkeit eines
> Skills** — ein Skill, der eine Datei von hier zum Funktionieren braucht, ist falsch gebaut.
>
> **Pflege:** Jede neue, verschobene oder gelöschte Wissensdatei wird in **derselben** Änderung
> hier nachgezogen; `test/wissensbasis.test.mjs` erzwingt Vollständigkeit, Linkgültigkeit, die
> Wurzel-Regel und das Kategorie-Routing.

## Teil 1 — Ordner-Routing: wohin gehört ein Dokument

| Ordner | Gehört hierher | Gehört **nicht** hierher | Lebenszyklus |
|---|---|---|---|
| `grundwissen/` | Zweierlei: **(a) laufende Vorhaben** mit Datumspräfix `YYYY-MM-DD-` — je Vorhaben ein Dokument; **(b) dauerhafte eigene Referenzen** ohne Datumspräfix (Modul-Definitionen, Begriffsklärungen dieses OS) | Standardprozesse der Familie (→ **OS-Repo**) · Protokolle (→ `debugging-findings/`) · **abgeschlossene oder verworfene Pläne** (→ `bauplan-archiv/`) · Ideen ohne Auftrag (→ `ideen-backlog/`) | Referenzen werden lebend gepflegt. Datierte Pläne werden **nicht** rückwirkend umgeschrieben; ist ein Vorhaben abgeschlossen oder verworfen, wandert sein Plan **pflichtgemäß** per `git mv` nach `bauplan-archiv/` — sonst verliert der Ordner seine Aussage „das läuft gerade" |
| `bauplan-archiv/` | Abgeschlossene oder verworfene Pläne, **unverändert übernommen** | laufende Arbeit (→ `grundwissen/`) · Prozesswissen (→ OS-Repo) | Zugang **nur** aus `grundwissen/`. Inhalt wird nicht mehr fortgeschrieben. **Terminal:** keine Quelle Richtung OS-Repo, keine Weitergabe — reine Nachvollziehbarkeit hier. Solange leer, hält `PLATZHALTER.md` den Ordner in Git |
| `debugging-findings/` | Die **zwei** append-only-Protokolle: `agent-learnings.md` (**eigene** Fehler des Agenten) und `debug-log.md` (**gefundene** Bugs und Fehlbefunde) | Prozesswissen · Pläne · Ideen | **Append-only** — nie rückdatieren, nie umschreiben. Ein widerlegter Eintrag bekommt einen **neuen**, der auf ihn verweist |
| `ideen-backlog/` | Ideen ohne aktuellen Auftrag — **je Idee ein Dokument** mit Datumspräfix | beauftragte Vorhaben (→ Bauplan in `grundwissen/`, der auf die Idee verweist) | Lebend. Wird eine Idee beauftragt, **bleibt sie stehen** — sie ist die Herkunft, der Plan ist die Arbeit. Solange leer, hält `PLATZHALTER.md` den Ordner in Git |
| `knowledge-base/` (Wurzel) | **Ausschließlich dieser Index.** | alles andere | testerzwungen (Wurzel-Regel) |

## Teil 2 — Quellen-Triage: wann welche Quelle

### `grundwissen/` — laufende Vorhaben und eigene Referenzen

| Quelle | Status | Relevant wenn … |
|---|---|---|
| [Modul-Definition Felix-OS — 2026-08-11](grundwissen/2026-08-11-modul-definition-felix.md) | lebend | die **Arbeitsmodule** dieses OS zugeschnitten werden sollen — was heute steht (Kernmodul, Präfix-Konvention, Registry-Mechanik), welche Fragen mit Felix zu klären sind und der geführte Weg über `/nc-felix:skill-builder`. **Hier zuerst**, bevor ein neues Präfix oder ein neuer Skill entsteht |

### `bauplan-archiv/` — abgeschlossene Vorhaben

| Quelle | Status | Relevant wenn … |
|---|---|---|
| *(noch leer — der erste Eintrag entsteht, wenn der erste Plan abgeschlossen ist)* | — | — |

### `debugging-findings/` — Protokolle

| Quelle | Status | Relevant wenn … |
|---|---|---|
| [Fehlerprotokoll (agent-learnings)](debugging-findings/agent-learnings.md) | lebend, append-only | ein **eigener** Fehler passiert ist (**Pflichteintrag, sofort**) oder vor einer neuen Aufgabe bekannte eigene Fehlermuster geprüft werden |
| [Debug-Log](debugging-findings/debug-log.md) | lebend, append-only | ein **gefundener** Bug oder Fehlbefund dokumentiert wird — an eigenem Code, an Konfiguration oder an der Doku, unabhängig vom Verursacher (**Pflichteintrag, sofort**) — oder vor einer Fehlersuche bekannte Symptome abgeglichen werden |

### `ideen-backlog/` — Ideen ohne Auftrag

| Quelle | Status | Relevant wenn … |
|---|---|---|
| *(noch leer — der erste Eintrag entsteht mit der ersten dokumentierten Idee)* | — | — |

---

*Angelegt 2026-08-11 durch Claude (Opus 5, Claude Code) auf Weisung Lucas Vöhringer. Struktur
nach der Vorlage `ssot-grundgeruest.md.vorlage` und dem Standardprozess `ssot-aufbau.md` §4 des
**OS-Repos** (Quellenangabe, kein Lesepfad).*
