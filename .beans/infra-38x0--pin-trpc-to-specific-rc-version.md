---
# infra-38x0
title: Pin tRPC to specific RC version
status: in-progress
type: task
priority: low
created_at: 2026-03-09T12:13:47Z
updated_at: 2026-03-16T05:02:22Z
parent: ps-vtws
---

tRPC is at ^11.0.0-rc.730 (release candidate). Pin to a specific RC version in pnpm-lock.yaml until v11 GA to avoid surprise breaking changes on pnpm install. Monitor tRPC v11 release timeline.

Source: Architecture Audit 004, Metric 7
