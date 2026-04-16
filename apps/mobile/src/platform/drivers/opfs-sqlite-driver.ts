import { SQLITE_OK, SQLITE_ROW } from "./wa-sqlite.constants.js";

import type { SqliteDriver, SqliteStatement } from "@pluralscape/sync/adapters";

const DB_NAME = "pluralscape-sync.db";

/**
 * wa-sqlite backed by Origin Private File System (OPFS).
 * Web-only; tree-shaken from native bundles via the dynamic import in detect.ts.
 *
 * Bridges wa-sqlite (entirely async) to the synchronous SqliteStatement contract:
 *
 *   - exec() / run() (no params): store-and-check via trackExec — the Promise is
 *     cached; rejections surface on the next driver call or explicit flush().
 *   - run(...params): store-and-check via trackPrepared using the wa-sqlite
 *     prepare/bind/step API. Same surface guarantees as trackExec.
 *   - all() / get() (no params): exec row-accumulator with synchronous callback.
 *     Works because OPFSCoopSyncVFS uses FileSystemSyncAccessHandle and the
 *     non-asyncify wa-sqlite build resolves each step() synchronously, making
 *     the per-row callback effectively sync.
 *   - all(...params) / get(...params): NOT YET SUPPORTED — both throw, pointing
 *     at mobile-shr0 for the Worker bridge follow-up. The async statements()/step()
 *     API cannot satisfy the synchronous return contract without an Atomics.wait
 *     bridge over a SharedArrayBuffer in a dedicated Web Worker.
 *
 * Production deployments MUST run this driver inside a dedicated Web Worker
 * where Atomics.wait is available — required both for the existing sync-callback
 * pattern under load and for the eventual parameterized-read bridge.
 */
export interface OpfsSqliteDriverOptions {
  /** Called when a pending error is silently overwritten by a new one. */
  onDroppedError?: (dropped: Error) => void;
}

export async function createOpfsSqliteDriver(
  options: OpfsSqliteDriverOptions = {},
): Promise<SqliteDriver & { flush(): Promise<void> }> {
  // Dynamic imports keep wa-sqlite out of native bundles
  const [{ default: SQLiteESMFactory }, SQLite, { OPFSCoopSyncVFS }] = await Promise.all([
    import("@journeyapps/wa-sqlite/dist/wa-sqlite.mjs"),
    import("@journeyapps/wa-sqlite"),
    import("@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js"),
  ]);

  const waModule: WaSqliteModule = await SQLiteESMFactory();
  const sqlite3 = SQLite.Factory(waModule);

  const vfs = await OPFSCoopSyncVFS.create(DB_NAME, waModule);
  sqlite3.vfs_register(vfs, true);

  const db = await sqlite3.open_v2(DB_NAME);

  let lastExecPromise: Promise<number> = Promise.resolve(0);
  let lastError: Error | null = null;

  function setLastError(err: unknown): void {
    const next = err instanceof Error ? err : new Error(String(err));
    if (lastError !== null) {
      options.onDroppedError?.(lastError);
    }
    lastError = next;
  }

  function trackExec(
    sql: string,
    callback?: (row: (WaSqliteCompatibleType | null)[], columns: string[]) => void,
  ): void {
    checkLastError();
    const promise = callback ? sqlite3.exec(db, sql, callback) : sqlite3.exec(db, sql);
    lastExecPromise = promise;
    promise.catch((err: unknown) => {
      setLastError(err);
    });
  }

  function trackPrepared(sql: string, rawParams: unknown[]): void {
    checkLastError();

    const promise = (async () => {
      const params = toBindParams(rawParams);
      const iterator = sqlite3.statements(db, sql)[Symbol.asyncIterator]();
      try {
        let result = await iterator.next();
        while (!result.done) {
          const stmt = result.value;
          const bindRc = sqlite3.bind_collection(stmt, params);
          if (bindRc !== SQLITE_OK) {
            throw new Error(`OPFS driver: bind_collection failed (rc=${String(bindRc)})`);
          }
          while ((await sqlite3.step(stmt)) === SQLITE_ROW) {
            /* drain */
          }
          result = await iterator.next();
        }
        return 0;
      } finally {
        await iterator.return?.(undefined);
      }
    })();

    lastExecPromise = promise;
    promise.catch((err: unknown) => {
      setLastError(err);
    });
  }

  function checkLastError(): void {
    if (lastError !== null) {
      const err = lastError;
      lastError = null;
      throw err;
    }
  }

  /**
   * Cast unknown params from the SqliteStatement interface to wa-sqlite-compatible
   * types. Throws on anything outside the supported set.
   */
  function toBindParams(params: unknown[]): (WaSqliteCompatibleType | null)[] {
    return params.map((p, i) => {
      if (p === null || p === undefined) return null;
      if (typeof p === "number" || typeof p === "string" || typeof p === "bigint") return p;
      if (p instanceof Uint8Array) return p;
      // Object.prototype.toString handles cross-realm objects and null prototypes.
      const tag = Object.prototype.toString.call(p);
      const desc = typeof p === "object" ? tag.slice(8, -1) : typeof p;
      throw new Error(`OPFS driver: unsupported bind type at index ${String(i)}: ${desc}`);
    });
  }

  function makeStatement<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
    return {
      run(...params: unknown[]): void {
        if (params.length > 0) {
          trackPrepared(sql, params);
          return;
        }
        trackExec(sql);
      },

      all(...params: unknown[]): TRow[] {
        if (params.length > 0) {
          throw new Error(
            "OPFS driver: parameterized .all() not yet supported — requires Worker bridge (see mobile-shr0)",
          );
        }
        const rows: TRow[] = [];
        trackExec(sql, (row: (WaSqliteCompatibleType | null)[], columns: string[]) => {
          const obj = Object.create(null) as Record<string, unknown>;
          for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            if (col !== undefined) {
              obj[col] = row[i];
            }
          }
          rows.push(obj as TRow);
        });
        return rows;
      },

      get(...params: unknown[]): TRow | undefined {
        if (params.length > 0) {
          throw new Error(
            "OPFS driver: parameterized .get() not yet supported — requires Worker bridge (see mobile-shr0)",
          );
        }
        return this.all()[0];
      },
    };
  }

  return {
    prepare<TRow = Record<string, unknown>>(sql: string): SqliteStatement<TRow> {
      return makeStatement<TRow>(sql);
    },

    exec(sql: string): void {
      trackExec(sql);
    },

    transaction<T>(fn: () => T): T {
      trackExec("BEGIN");
      try {
        const result = fn();
        trackExec("COMMIT");
        return result;
      } catch (err: unknown) {
        trackExec("ROLLBACK");
        throw err;
      }
    },

    close(): void {
      const closePromise = lastExecPromise.then(
        () => sqlite3.close(db),
        () => sqlite3.close(db),
      );
      lastExecPromise = closePromise;
      closePromise.catch((err: unknown) => {
        setLastError(err);
      });
    },

    async flush(): Promise<void> {
      await lastExecPromise;
      checkLastError();
    },
  };
}
