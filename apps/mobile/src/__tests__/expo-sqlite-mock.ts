// apps/mobile/src/__tests__/expo-sqlite-mock.ts
//
// In-memory mock of expo-sqlite for vitest.
// The driver uses the synchronous JSI API (openDatabaseSync, prepareSync, etc.).
// Statements are not parsed — the mock exposes hooks so tests can drive specific
// rows / errors / transaction outcomes per call. The wrapper-side branches we
// care about are init guards, error wrapping, and key namespacing — none of
// which need real SQL execution.

import { vi } from "vitest";

type RowsByQuery = Map<string, unknown[]>;

interface MockStatement<TRow = Record<string, unknown>> {
  executeSync: (params?: SQLiteBindParams) => MockIterableResult<TRow>;
  finalizeSync: ReturnType<typeof vi.fn>;
}

interface MockIterableResult<TRow = Record<string, unknown>> {
  getAllSync: () => TRow[];
  getFirstSync: () => TRow | null;
}

interface MockDatabase {
  prepareSync: <TRow = Record<string, unknown>>(sql: string) => MockStatement<TRow>;
  execSync: ReturnType<typeof vi.fn>;
  withTransactionSync: (fn: () => void) => void;
  closeSync: ReturnType<typeof vi.fn>;
}

let openedDatabases: Map<string, MockDatabase> = new Map();
let openShouldThrow: Error | null = null;
let queryRows: RowsByQuery = new Map();

function newResult<TRow>(rows: unknown[]): MockIterableResult<TRow> {
  return {
    getAllSync: () => rows as TRow[],
    getFirstSync: () => (rows.length > 0 ? (rows[0] as TRow) : null),
  };
}

function newDb(): MockDatabase {
  return {
    prepareSync: <TRow = Record<string, unknown>>(sql: string): MockStatement<TRow> => ({
      executeSync: vi.fn((params?: SQLiteBindParams) => {
        void params;
        return newResult<TRow>(queryRows.get(sql) ?? []);
      }) as MockStatement<TRow>["executeSync"],
      finalizeSync: vi.fn(),
    }),
    execSync: vi.fn(),
    withTransactionSync: (fn: () => void) => {
      fn();
    },
    closeSync: vi.fn(),
  };
}

export function openDatabaseSync(name: string): MockDatabase {
  if (openShouldThrow) {
    const err = openShouldThrow;
    openShouldThrow = null;
    throw err;
  }
  const existing = openedDatabases.get(name);
  if (existing) return existing;
  const db = newDb();
  openedDatabases.set(name, db);
  return db;
}

export type SQLiteDatabase = MockDatabase;
export type SQLiteBindParams = unknown[];

// Test helpers — not part of the real expo-sqlite API.
export function __reset(): void {
  openedDatabases = new Map();
  openShouldThrow = null;
  queryRows = new Map();
}

export function __failNextOpen(error: Error): void {
  openShouldThrow = error;
}

export function __setQueryRows(sql: string, rows: unknown[]): void {
  queryRows.set(sql, rows);
}

export function __getOpenedDatabase(name: string): MockDatabase | undefined {
  return openedDatabases.get(name);
}

export function deleteDatabaseSync(name: string): void {
  openedDatabases.delete(name);
}

export default {
  openDatabaseSync,
  deleteDatabaseSync,
};
