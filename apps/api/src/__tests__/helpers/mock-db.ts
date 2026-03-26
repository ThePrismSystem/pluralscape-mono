import { vi } from "vitest";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Cast a mock chain to PostgresJsDatabase for service function calls.
 *
 * MockChain provides the same chainable API as PostgresJsDatabase at runtime
 * but the nominal types don't overlap. This dedicated cast function keeps the
 * bridge in one place rather than scattering `as` casts across every test.
 */
export function asDb(
  mock: MockChain | Record<string, ReturnType<typeof vi.fn>>,
): PostgresJsDatabase {
  return mock as never as PostgresJsDatabase;
}

export interface MockChain {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  for: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

/** Build a mock Drizzle DB with chainable select/insert/update/delete methods. */
export function mockDb(overrides?: Partial<MockChain>): {
  db: PostgresJsDatabase;
  chain: MockChain;
} {
  const chain: MockChain = {
    select: vi.fn(),
    from: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    for: vi.fn(),
    onConflictDoNothing: vi.fn(),
    execute: vi.fn(),
    ...overrides,
  };

  // Wire up fluent chaining: each method returns the chain
  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockResolvedValue([]);
  chain.insert.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue([]);
  chain.update.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.for.mockReturnValue(chain);
  chain.onConflictDoNothing.mockReturnValue(chain);
  // execute is used by RLS context helpers (setTenantContext, setAccountId)
  chain.execute.mockResolvedValue(undefined);
  // transaction passes the chain as tx and awaits the callback.
  // Typed fn avoids no-misused-promises: the mock knows it returns a Promise.
  chain.transaction = vi.fn<(fn: (tx: MockChain) => Promise<void>) => Promise<void>>((fn) =>
    fn(chain),
  );

  return { db: asDb(chain), chain };
}

/** Capture the first argument passed to chain.where for filter comparison. */
export function captureWhereArg(chain: MockChain): unknown {
  return chain.where.mock.calls[0]?.[0];
}
