---
# ps-aj1j
title: Harden SP import wizard against phishing baseUrl
status: todo
type: task
priority: normal
created_at: 2026-04-19T03:30:45Z
updated_at: 2026-04-19T03:30:45Z
parent: ps-9uqg
---

The SP import API source accepts a user-configurable baseUrl so self-hosted / test instances work. A user tricked into entering a phishing URL would leak their SP API token to the phishing endpoint. Code-level HTTPS enforcement on baseUrl is landing on fix/ci-security-round-2; this bean tracks the UX-side hardening.

## Todos

- [ ] Default the baseUrl field to `https://api.apparyllis.com` (official SP) and mark it read-only unless the user explicitly opts into an advanced/self-hosted toggle
- [ ] Show a "You're connecting to <host> — this is not Simply Plural's official API" warning when the host is anything other than `api.apparyllis.com`
- [ ] Require the user to acknowledge the warning before submitting the import
- [ ] Add a help-text link explaining self-hosting scenarios so users don't feel blocked on legitimate setups

## Rationale

Raised while triaging CodeQL alert 18 (js/file-access-to-http in packages/import-sp/src/sources/api-source.ts). We accepted the risk at the code layer (token flows to whatever baseUrl was configured), but the UX should make it hard to get into a bad state in the first place.

## Origin

Split off from ps-9uqg (SP import wizard UI) epic on 2026-04-18.
