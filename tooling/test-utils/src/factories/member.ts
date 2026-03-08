/**
 * Member factory stub.
 *
 * Will be implemented with actual Drizzle schema resolvers when
 * the database schema epic (db-2je4) defines the members table.
 */

let memberSequence = 0;

export interface MemberFactoryInput {
  id?: string;
  systemId?: string;
  name?: string;
  pronouns?: string;
  createdAt?: Date;
}

export interface MemberFactoryOutput {
  id: string;
  systemId: string;
  name: string;
  pronouns: string | null;
  createdAt: Date;
}

export function buildMember(overrides: MemberFactoryInput = {}): MemberFactoryOutput {
  memberSequence += 1;
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    name: overrides.name ?? `Test Member ${String(memberSequence)}`,
    pronouns: overrides.pronouns ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

export function resetMemberSequence(): void {
  memberSequence = 0;
}
