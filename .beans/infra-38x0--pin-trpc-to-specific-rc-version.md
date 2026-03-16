---
# infra-38x0
title: Pin tRPC to specific RC version
status: completed
type: task
priority: low
created_at: 2026-03-09T12:13:47Z
updated_at: 2026-03-16T05:08:31Z
parent: ps-vtws
---

tRPC is at ^11.0.0-rc.730 (release candidate). Pin to a specific RC version in pnpm-lock.yaml until v11 GA to avoid surprise breaking changes on pnpm install. Monitor tRPC v11 release timeline.

Source: Architecture Audit 004, Metric 7

## Summary of Changes

Pinned all tRPC packages (@trpc/server, @trpc/client, @trpc/react-query) to exact version 11.13.4 by removing caret ranges. Added pnpm override for @trpc/server to resolve lockfile version mismatch where api-client was resolving to 11.12.0 while api had 11.13.4.
