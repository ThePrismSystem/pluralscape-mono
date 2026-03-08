# ADR 002: Frontend Framework — Expo (React Native)

## Status

Accepted

## Context

Pluralscape needs a single codebase serving web, iOS, and Android with:

- WCAG accessibility as a hard requirement (used during dissociative episodes, panic attacks)
- Offline-first with encrypted local SQLite
- Complex UI: drag-drop, rich text, color-coded timelines, and eventually node-based mind maps
- TypeScript preferred for type sharing with the API layer
- Must work on low-spec devices

Evaluated: Flutter (Dart), Expo/React Native (TypeScript), Tauri + React Native (split codebase), Kotlin Multiplatform + Compose Multiplatform.

## Decision

Expo (React Native) with TypeScript.

Key factors:

- **Accessibility**: DOM-based web rendering provides native HTML semantics and ARIA support. Flutter renders to canvas on web, causing screen reader, keyboard nav, and zoom failures — Flutter apps routinely fail WCAG audits on web.
- **TypeScript end-to-end**: Shared types with the Hono/tRPC API layer. No codegen bridge needed.
- **Offline-first ecosystem**: Best-in-class. expo-sqlite, documented local-first architecture guide, SQLCipher support, PowerSync/Automerge SDKs available.
- **Largest library ecosystem**: React Flow (node graphs on web), react-native-skia (canvas on mobile), dnd-kit (drag-drop), Lexical (rich text).

The node-based mind map visualization (phase 2 feature) will require platform-specific implementations — react-native-skia on mobile, React Flow on web. The database schema and API will be designed to support it from day one.

## Consequences

- Platform-specific code needed for canvas-heavy features (mind maps, topology views)
- JS-driven rendering is slower than Flutter's compiled pipeline for complex animations — mitigated by Hermes engine and react-native-reanimated
- Must maintain Expo SDK version alignment across the monorepo
- React Native Web is in maintenance mode; Expo team is building toward React Strict DOM as the successor — this is the migration path, not a dead end

### License

Expo: MIT. React Native: MIT. Both compatible with AGPL-3.0.
