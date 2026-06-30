# Visual Evidence Layer — makxas-front

SoT: ADR-0076 / makxas-ai-native docs/25-visual-evidence-layer.md

## Rollout status

- rollout_status: `done`
- kind: `ui_e2e_sensitive`
- ui_e2e: `true`
- sensitive: `true`
- blocked_sensitive_required: `true`
- upload_raw_artifacts: `false`

## Policy

This repo uses `blocked_sensitive` as the default safety boundary. Screenshots, Playwright trace, video, and HTML reports must not be uploaded when the run may include PII, secrets, accounting data, recordings, customer contact data, OAuth, 2FA, CAPTCHA, password, or identity-verification screens. The workflow keeps only `visual-evidence-manifest.json` as the alternative evidence.

## Alternative verification

Customer lead/PII UI uses blocked_sensitive manifest only. Raw screenshots, trace, video, and Playwright HTML report are not uploaded.

## Verification fields

- UI: Playwright E2E plus manifest; sensitive runs use blocked_sensitive manifest only.
- Function: `node scripts/visual-evidence-manifest.mjs --input <manifest>`
- DB: DB影響なし
