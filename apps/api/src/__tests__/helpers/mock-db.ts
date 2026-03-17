import { vi } from "vitest";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Cast a test mock to PostgresJsDatabase. Breaks the TSAsExpression nesting pattern. */
export function asDb(mock: unknown): PostgresJsDatabase {
  return mock as PostgresJsDatabase;
}

export interface MockChain {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
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
}

/** Build a mock Drizzle DB with chainable select/insert/update/delete methods. */
export function mockDb(overrides?: Partial<MockChain>): {
  db: PostgresJsDatabase;
  chain: MockChain;
} {
  const chain: MockChain = {
    select: vi.fn(),
    from: vi.fn(),
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
    ...overrides,
  };

  // Wire up fluent chaining: each method returns the chain
  chain.select.mockReturnValue(chain);
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockResolvedValue([]);
  chain.insert.mockReturnValue(chain);
  chain.values.mockReturnValue(chain);
  chain.returning.mockResolvedValue([]);
  chain.update.mockReturnValue(chain);
  chain.set.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  // transaction passes the chain as tx and awaits the callback
  chain.transaction = vi
    .fn()
    .mockImplementation((fn: (tx: MockChain) => Promise<unknown>) => fn(chain));

  return { db: asDb(chain), chain };
}
