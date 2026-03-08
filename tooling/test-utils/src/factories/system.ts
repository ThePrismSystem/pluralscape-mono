/**
 * System factory stub.
 *
 * Will be implemented with actual Drizzle schema resolvers when
 * the database schema epic (db-2je4) defines the systems table.
 */

let systemSequence = 0;

export interface SystemFactoryInput {
  id?: string;
  name?: string;
  createdAt?: Date;
}

export interface SystemFactoryOutput {
  id: string;
  name: string;
  createdAt: Date;
}

export function buildSystem(overrides: SystemFactoryInput = {}): SystemFactoryOutput {
  systemSequence += 1;
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? `Test System ${String(systemSequence)}`,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

export function resetSystemSequence(): void {
  systemSequence = 0;
}
