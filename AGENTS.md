# AGENTS.md — NovaCoreAI-OS-Felix (Satellit `nc-felix`)

> **Dieses Repo IST das Plugin.** `nc-felix` ist das Abteilungsplugin der Abteilung felix im
> NovaCore-OS — ausgeliefert über den Marketplace `novacore-os` des OS-Repos
> (`NovaCore-AI/NovaCoreAI-OS`), gepinnt per Commit-SHA. Manifest an der Wurzel:
> `.claude-plugin/plugin.json`. Die lokale `CLAUDE.md` ist bewusst un-getrackt (siehe
> `.gitignore`); normative Repo-Anweisung ist diese Datei.

## Geltende gemeinsame Anweisung

Für alle Agenten in diesem Repo gilt die **geteilte, synchronisierte Global-Anweisung
`nc-sync.md` des Kern-Plugins `nc`** (Methodik, Conventions, Safety — mit der Plugin-Familie
ausgeliefert, über Marketplace-Updates synchron). Die Safety-Schicht setzt das
**FFG (Fact-Forcing-Gate)** des Kerns durch; dieses Repo bringt **bewusst keine eigenen
Hooks** mit, sonst feuern die Gates doppelt.

## Harte Regeln dieses Repos

- `dependencies: ["nc"]` **nie entfernen** — ohne sie fehlt die transitive Kern-Aktivierung
  (FFG, WP-Rahmen, `nc-sync.md`) und die ständige Abteilung ist nicht mehr erzwungen.
- **Kein `hooks/`-Verzeichnis** — die Kontroll-Schicht liegt ausschließlich im Kern
  (testgesichert in `test/manifest.test.mjs`).
- **Version nur an einer Stelle:** `.claude-plugin/plugin.json`. Kein Bump = kein
  Auto-Update im Team. Jede Änderung: Bump + `CHANGELOG.md`-Eintrag im selben Change.
  **Nie** zusätzlich `version` in den Marketplace-Eintrag des OS-Repos schreiben.
- **Skills** nach `referenz/skill-authoring.md` des Kern-Plugins `nc` bauen — Layout
  `skills/<modul>-<name>/SKILL.md` (flach, Module sind Namenspräfixe; YAML-Falle:
  `description` mit „Trigger-Begriffe: …" immer als `>-`-Block).
- **Deutsch** für alle Artefakte; keine Secrets in Code, Commits oder Logs.
- **Branching:** Feature-Branch → Pull Request → Review → Merge durch den Menschen. Kein
  direkter Push auf `main`; kein Push/Merge/Tag/Release ohne explizite Maintainer-Freigabe.
- **Tests vor jedem PR:** `npm test` (Manifest-/Struktur-Invarianten) und
  `claude plugin validate . --strict`.

## Release-/Update-Ablauf (Updatebarkeit)

1. Änderung + Version-Bump in `.claude-plugin/plugin.json` + CHANGELOG — im selben Change.
2. Pull Request → Review → Merge (Mensch). **Achtung: Merge ohne Squash/Rebase**, sonst
   ändert sich der Commit-SHA und der Marketplace-Pin zeigt ins Leere.
3. Maintainer pusht den annotierten Tag `v<version>`.
4. Im OS-Repo den Marketplace-Eintrag `nc-felix` umpinnen: `ref: "v<version>"` +
   `sha: "<40-stelliger Commit-SHA>"` — der `sha` ist der effektive Pin. Danach dort
   `node --test plugins/nc/tests/*.test.mjs` (prüft Pin-Format und Registry↔Pin-Konsistenz).
5. Das Team erhält das Update über die Marketplace-Mechanik (`/plugin update` bzw.
   Auto-Update).

## Quellen

Verbindliche Prozesse liegen im OS-Repo: `knowledge-base/standardprozesse/plugin-bau.md`
(§3a Satellit) und `os-bau-methode.md`. Bei Format-Fragen zu Plugin/Marketplace/Skills
zuerst die offizielle Claude-Code-Doku abrufen (code.claude.com/docs: `plugins-reference`,
`plugin-marketplaces`, `skills`) — nie aus dem Gedächtnis.
