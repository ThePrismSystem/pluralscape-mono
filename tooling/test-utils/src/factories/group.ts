/**
 * Group factory stub.
 *
 * Will be implemented with actual Drizzle schema resolvers when
 * the database schema epic (db-2je4) defines the groups table.
 */

let groupSequence = 0;

export interface GroupFactoryInput {
  id?: string;
  systemId?: string;
  name?: string;
  createdAt?: Date;
}

export interface GroupFactoryOutput {
  id: string;
  systemId: string;
  name: string;
  createdAt: Date;
}

export function buildGroup(overrides: GroupFactoryInput = {}): GroupFactoryOutput {
  groupSequence += 1;
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    name: overrides.name ?? `Test Group ${String(groupSequence)}`,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

export function resetGroupSequence(): void {
  groupSequence = 0;
}
