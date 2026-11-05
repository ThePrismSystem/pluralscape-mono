---
# infra-jbxj
title: Send coverage, test results, and bundle sizes to Codecov
status: completed
type: task
priority: normal
created_at: 2026-11-05T23:51:41Z
updated_at: 2026-11-05T23:56:53Z
---

Use Codecov for coverage, test results, and bundle analysis. Replace the gist coverage badge, and add Python to CodeQL.

## Summary of Changes

- Uploads coverage from the Tests job, with `codecov/patch` targeting 90% and the project status off. Vitest's 89% thresholds stay.
- Uploads JUnit test results from the Tests job and from all five E2E suites, including when tests fail.
- Runs `@codecov/bundle-analyzer` over Expo's output for web, iOS, and Android. Codecov has no Metro plugin, and the analyzer reads a build folder directly. Size changes warn at 5% and never fail the check.
- Replaces the gist coverage badge with Codecov's. `GIST_TOKEN` stays for the E2E badge.
- Adds Python to CodeQL and to the local analysis script. Kotlin and Swift stay out: one file each, and each needs a native build.
