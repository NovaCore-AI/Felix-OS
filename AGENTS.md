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

## Quellen

Herkunft der Strukturen: NovaCore-OS (`NovaCore-AI/NovaCoreAI-OS`) — FFG, WP-Rahmen,
Sync-Anweisung, Formatregeln; verbindliche Prozesse dort:
`knowledge-base/standardprozesse/plugin-bau.md` (§3a Satellit) im OS-Repo. Bei Format-Fragen
zu Plugin/Marketplace/Skills zuerst die offizielle Claude-Code-Doku abrufen
(code.claude.com/docs: `plugins-reference`, `plugin-marketplaces`, `skills`) — nie aus dem
Gedächtnis.
