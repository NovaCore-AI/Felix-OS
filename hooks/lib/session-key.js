// lib/session-key.js — gemeinsame Session-Schluessel-Aufloesung der Kontroll-Hooks.
// Extrahiert 2026-08-11 aus nc-ffg.js (Bauplan „Prozesskorpus-Nachzug + Satelliten-SSOT",
// AP6; Vorlage ist die Kern-Fassung des NovaCore-OS), damit FFG, Start-Gate, Stempel-Skript
// und Session-Start-Injektion denselben Schluessel ableiten — eine zweite Kopie dieser
// Logik waere ein Drift-Risiko in Sicherheitscode.
'use strict';
const crypto = require('crypto');
const path = require('path');

function hashSessionKey(prefix, value) {
  return prefix + '-' + crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

function sanitizeSessionKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Nur unveraendert-saubere IDs direkt verwenden: jede Zeichen-Ersetzung koennte
  // zwei reale Sessions (a/b vs. a_b) auf denselben Key falten — dann lieber
  // hashen (Review-Haertung 2026-07-28; bewusst strenger als das Onsite-Vorbild,
  // das nur bei Ueberlaenge hasht).
  if (sanitized === raw && sanitized.length <= 64) return sanitized;
  return hashSessionKey('sid', raw);
}

// Session-Schluessel aufloesen: session_id → Transcript-Pfad → Projekt-Fingerprint.
function resolveSessionKey(input) {
  const direct = sanitizeSessionKey((input && input.session_id) || process.env.CLAUDE_SESSION_ID);
  if (direct) return direct;

  const transcriptPath = input && input.transcript_path;
  if (transcriptPath && String(transcriptPath).trim()) {
    return hashSessionKey('tx', path.resolve(String(transcriptPath).trim()));
  }

  const projectFingerprint = process.env.CLAUDE_PROJECT_DIR || (input && input.cwd) || process.cwd();
  return hashSessionKey('proj', path.resolve(projectFingerprint));
}

// Subagenten-Kennung laut offizieller Hook-Doku (agent_id/agent_type, verifiziert
// code.claude.com/docs/en/hooks, abgerufen 2026-07-26). Datei-Gates entfallen dort —
// der Parent hat die Datei bereits gegated; Bash-Gates gelten weiterhin.
function isSubagentInvocation(input) {
  if (!input || typeof input !== 'object') return false;
  return [input.agent_id, input.agent_type]
    .some(v => typeof v === 'string' && v.trim());
}

module.exports = { hashSessionKey, sanitizeSessionKey, resolveSessionKey, isSubagentInvocation };
