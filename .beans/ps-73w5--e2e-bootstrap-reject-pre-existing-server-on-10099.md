---
# ps-73w5
title: "E2E bootstrap: reject pre-existing server on :10099 and surface non-JSON stderr"
status: todo
type: bug
priority: normal
created_at: 2026-04-19T19:12:07Z
updated_at: 2026-04-19T19:12:07Z
parent: ps-0enb
---

Discovered while debugging ps-0enb batch PR 2026-04-19. Two latent bugs in apps/api-e2e/src/global-setup.ts: (1) pollHealth() accepts any process answering /health, including a zombie from a prior crashed run. Should refuse to proceed when port 10099 is already bound before spawn, or fingerprint the server. (2) stderr filter at lines 298-304 forwards only pino level:50/60 JSON. Raw stderr like Bun EADDRINUSE is swallowed. Either forward all stderr or add explicit post-spawn check for early exit / port conflict. These bugs let a zombie bun from an earlier crashed run cause 491/509 E2E test failures.
