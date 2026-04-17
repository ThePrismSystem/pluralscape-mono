/**
 * Poll `pg_stat_activity` for row-level lock waits during a concurrent
 * race. Used by the lock-contention E2E spec to prove that the second of
 * two concurrent HTTP requests actually blocks on the first's row lock at
 * the DB — distinguishing real row-level contention from Node.js event-loop
 * serialization.
 *
 * Polls every {@link PROBE_POLL_INTERVAL_MS} ms for `durationMs`
 * (default {@link DEFAULT_PROBE_DURATION_MS}) and returns every distinct
 * `(pid, wait_event_type, wait_event)` row that showed
 * `wait_event_type = 'Lock'` during the window.
 *
 * The connection string must point at the same Postgres the running API
 * under test uses. `pg_stat_activity` requires no special privilege beyond
 * being able to SELECT from it — the default role the E2E database is
 * provisioned with is sufficient.
 */
import postgres from "postgres";

/**
 * Polling interval for `pg_stat_activity` probe. Tight enough to catch
 * sub-50ms row-lock overlaps that a short transaction (SELECT-FOR-UPDATE
 * + COUNT + INSERT) typically produces.
 */
const PROBE_POLL_INTERVAL_MS = 5;

/** Default probe window when the caller does not pass `durationMs`. */
const DEFAULT_PROBE_DURATION_MS = 1_000;

/** Dedicated, short-lived connection — we only need one statement at a time. */
const PROBE_POOL_SIZE = 1;

/** A single row from `pg_stat_activity` that observed a Lock wait. */
export interface PgLockWaitRow {
  readonly pid: number;
  readonly waitEventType: string;
  readonly waitEvent: string;
  readonly query: string;
}

/** Shape of one row returned by the SELECT against `pg_stat_activity`. */
interface PgStatActivityRow {
  readonly pid: number;
  readonly wait_event_type: string | null;
  readonly wait_event: string | null;
  readonly query: string;
}

/**
 * Poll `pg_stat_activity` for Lock waits during a race. Returns the union
 * of distinct `(pid, wait_event_type, wait_event)` observations for the
 * duration of the window.
 *
 * Waits that begin and resolve between poll ticks are not observed; callers
 * must run sufficient fan-out to guarantee at least one wait spans a tick.
 */
export async function probeLockWaits(opts: {
  readonly connectionString: string;
  readonly durationMs?: number;
}): Promise<readonly PgLockWaitRow[]> {
  const duration = opts.durationMs ?? DEFAULT_PROBE_DURATION_MS;
  const sql = postgres(opts.connectionString, { max: PROBE_POOL_SIZE });
  try {
    const observed = new Map<number, PgLockWaitRow>();
    const start = Date.now();
    while (Date.now() - start < duration) {
      const rows = await sql<PgStatActivityRow[]>`
        SELECT pid, wait_event_type, wait_event, query
        FROM pg_stat_activity
        WHERE state = 'active' AND wait_event_type = 'Lock'
      `;
      for (const row of rows) {
        if (row.wait_event_type !== null && row.wait_event !== null) {
          observed.set(row.pid, {
            pid: row.pid,
            waitEventType: row.wait_event_type,
            waitEvent: row.wait_event,
            query: row.query,
          });
        }
      }
      await new Promise((r) => setTimeout(r, PROBE_POLL_INTERVAL_MS));
    }
    return Array.from(observed.values());
  } finally {
    await sql.end({ timeout: 1 });
  }
}
