---
# api-dvgo
title: Use validated env module instead of raw process.env in webhook-config
status: completed
type: bug
priority: normal
created_at: 2026-03-26T07:43:55Z
updated_at: 2026-03-26T10:19:54Z
parent: ps-106o
---

webhook-config.service.ts checks process.env.NODE_ENV directly instead of using the validated env module. Only M5 file to access process.env directly.

## File

- webhook-config.service.ts:108

## Fix

Import env from ../env.js and check env.NODE_ENV.

## Tasks

- [ ] Replace process.env.NODE_ENV with env.NODE_ENV
- [ ] Import env module

## Summary of Changes\n\nReplaced process.env.NODE_ENV with validated env.NODE_ENV from the centralized env module.
