import type { SqliteDriver } from "@pluralscape/sync/adapters";

/**
 * wa-sqlite backed by Origin Private File System (OPFS).
 *
 * This file is a stub during the mobile-shr0 migration. The prior
 * main-thread implementation does not satisfy the now-async SqliteStatement
 * contract; a Web Worker-backed rewrite lands in Phase 3 of mobile-shr0
 * (see docs/superpowers/plans/2026-04-16-mobile-shr0-opfs-worker-plan.md,
 * Tasks 12-16).
 *
 * While the stub is in place, `detectWeb()` catches the rejection thrown
 * here and falls through to the IndexedDB adapters, so web builds remain
 * functional on the older IndexedDB storage path.
 */
export function createOpfsSqliteDriver(): Promise<SqliteDriver> {
  return Promise.reject(
    new Error("OPFS driver not yet available — pending Web Worker bridge (mobile-shr0)"),
  );
}
