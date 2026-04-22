---
# ps-e0tl
title: Lower ESLint max-lines cap for apps/api/src/services/** based on post-refactor LOC
status: todo
type: task
created_at: 2026-04-22T06:13:42Z
updated_at: 2026-04-22T06:13:42Z
parent: api-6l1q
---

## Context

After api-6l1q PR #535 and #536, the service layer is fully split into per-verb files. The ESLint `max-lines: 500` cap on `apps/api/src/services/**/*.ts` is now loose relative to actual file sizes.

## Scope

- After all other api-6l1q follow-ups land (api-ep2a, api-4g7w, api-cimz, api-voa8, api-5psf, api-gm02, api-3vsr), measure LOC of every file in `apps/api/src/services/**/*.ts`.
- Identify the current highest LOC (post-migration; api-ep2a should drop `member/lifecycle.ts` under 300).
- Lower the ESLint `max-lines` rule from 500 to the smallest round number safely above the observed max (e.g., if highest is 320, set to 350).
- Update the CONTRIBUTING.md note on service-file size if the hard cap changes.

## Acceptance

- ESLint `max-lines` rule on `services/**/*.ts` is tightened to a value just above the observed post-refactor max.
- `pnpm lint` passes.
- CONTRIBUTING.md reflects the new cap.
