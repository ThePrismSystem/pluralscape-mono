---
# ps-4rjt
title: App shell & navigation
status: in-progress
type: epic
priority: normal
created_at: 2026-03-31T23:12:26Z
updated_at: 2026-04-01T05:57:11Z
parent: ps-7j8n
---

Expo Router layout hierarchy, tab bar, stack navigators, deep link config

## Summary of Changes

Navigation skeleton implemented in feat/m8-app-foundation (PR #352):

- Full provider tree in root layout (Platform → I18n → QueryClient → Auth → Connection → Sync)
- Auth gate with redirects (unauthenticated → login, locked → spinner, unlocked → tabs)
- Route groups: (auth)/login, (auth)/register, (app)/(tabs)/index
- Deep link config with URL scheme and notification route mapping
