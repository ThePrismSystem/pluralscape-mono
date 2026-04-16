---
# api-hvep
title: Email template system
status: completed
type: task
priority: normal
created_at: 2026-03-29T02:45:47Z
updated_at: 2026-04-16T06:36:06Z
parent: api-7xw0
blocked_by:
  - api-zeh1
---

Typed string interpolation email templates in @pluralscape/email.

## Scope

- `renderTemplate(name, vars): { html, text, subject }` in `packages/email/src/templates/`
- `EmailTemplateMap` — typed variables per template (like `JobPayloadMap`)
- Base HTML layout with inline CSS, responsive design, Pluralscape branding
- Templates:
  - `recovery-key-regenerated` — timestamp, device info, "if this wasn't you" guidance
  - `new-device-login` — timestamp, device/IP info, security guidance
  - `password-changed` — timestamp, "if this wasn't you" guidance
  - `two-factor-changed` — 2FA enabled/disabled/method changed
  - `webhook-failure-digest` — webhook URL, failure count, last error, time range
- Plain-text fallback for every template
- Package export: `./templates`

## Checklist

- [ ] Define `EmailTemplateMap` with typed variables per template (cf. `JobPayloadMap`)
- [ ] Implement `renderTemplate(name, vars)` returning `{ html, text, subject }`
- [ ] Create base HTML layout with inline CSS, responsive design, Pluralscape branding
- [ ] Template: `recovery-key-regenerated` (timestamp, device info, security guidance)
- [ ] Template: `new-device-login` (timestamp, device/IP info, security guidance)
- [ ] Template: `password-changed` (timestamp, security guidance)
- [ ] Template: `two-factor-changed` (2FA enabled/disabled/method changed)
- [ ] Template: `webhook-failure-digest` (webhook URL, failure count, last error, time range)
- [ ] Plain-text fallback for every template
- [ ] Configure package export: `./templates`
- [ ] Unit tests for all templates (correct variable interpolation, HTML/text output)
- [ ] Typecheck clean

\n\n## Development Approach\n\nAll code must be written test-first using strict TDD (Red -> Green -> Refactor). Use `/tdd` workflow.

## Summary of Changes

Implemented typed email template system with `renderTemplate()` function, `EmailTemplateMap` for compile-time variable type safety, and five templates: `recovery-key-regenerated`, `new-device-login`, `password-changed`, `two-factor-changed`, `webhook-failure-digest`. Each template produces both HTML (responsive layout with Pluralscape branding) and plain-text output. HTML output uses `escapeHtml` for XSS prevention. Package export `./templates`. 31 unit tests passing including XSS prevention and variable interpolation coverage.
