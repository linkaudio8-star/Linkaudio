# AGENTS.md — Audio Link

## Scope
This file applies only to the **Audio Link** repository in this workspace.  
Agents must stay within this codebase and its runtime context.

## Product Context
Audio Link is a web app that encodes links/messages into ultrasound audio, decodes them, and tracks scan activity in the admin experience.

Core implementation areas:
- `public/new.js`
- `public/new/modules/history.js`
- `public/new/modules/audio.js`
- `public/new/modules/ui.js`
- `public/new/admin.html`
- `server.js`
- `storage.js`

Critical user flows:
- Encode text/url -> generate audio -> preview/play/download.
- Decode audio -> success handling -> open link CTA.
- Scan tracking -> history update -> analytics cards.

## Confidentiality Rules
- Treat all code, logs, config, and data as private.
- Do not suggest posting project artifacts to public tools/services unless explicitly requested.
- Redact secrets/tokens/IDs/real customer details in summaries by default.
- Do not include `.env` values in outputs.

## Change Policy
- Prefer small, targeted changes over broad refactors.
- Preserve existing behavior unless the task explicitly requests behavior change.
- Do not modify billing/auth flows for tasks unrelated to billing/auth.
- Keep compatibility with existing local data when changing client-side persisted state.

## Scan Tracking Rules (must-follow)
When touching scan tracking (`history.js`, analytics in `new.js`):
- Keep `Scans (24h)` semantically correct as rolling 24h.
- Keep prune/normalization logic centralized and consistent across:
  - load path
  - add history entry
  - increment scan path
- Avoid coupling scan-event limits to unrelated constants (e.g., history list size).
- Ensure legacy `localStorage` data is migration-safe (soft normalization is preferred).

## Local Workflow
1. Install deps: `npm install`
2. Run app: `npm start`
3. Run checks before handoff:
   - `npm run lint`
   - `npm run format:check`
   - `npm test`

## Manual Smoke Checklist
- Generate a new ultrasound link and verify preview/play/download.
- Decode a generated signal and verify decode success UI.
- Confirm scan increment updates:
  - history item `scanCount`
  - `lastScan`
  - analytics cards (`Total scans`, `Scans (24h)`, `Last scan`)
- Reload page and confirm persisted state remains valid.

## Review Standard
Findings-first review with priorities:
- `P0`: release-blocking correctness/security/data-loss issue
- `P1`: urgent bug/regression
- `P2`: normal bug/maintainability risk
- `P3`: low-priority improvement

If no actionable bugs are found, state it explicitly.

## Git & PR Conventions
- Branch naming default: `codex/<short-topic>`
- Commit style: concise, scoped message (e.g., `fix(scan): normalize 24h event pipeline`)
- PR should include:
  - what changed
  - user-visible behavior change
  - risks/rollback note
  - test evidence (commands + manual checks)

## Agent Output Expectations
- Be concise and factual.
- Reference exact file paths when explaining code changes.
- Do not claim tests were run unless they were actually run.
