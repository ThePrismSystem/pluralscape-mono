/**
 * Fronting session factory stub.
 *
 * Will be implemented with actual Drizzle schema resolvers when
 * the database schema epic (db-2je4) defines the fronting_sessions table.
 */

let frontingSessionSequence = 0;

export interface FrontingSessionFactoryInput {
  id?: string;
  systemId?: string;
  memberId?: string;
  startedAt?: Date;
  endedAt?: Date | null;
}

export interface FrontingSessionFactoryOutput {
  id: string;
  systemId: string;
  memberId: string;
  startedAt: Date;
  endedAt: Date | null;
}

export function buildFrontingSession(
  overrides: FrontingSessionFactoryInput = {},
): FrontingSessionFactoryOutput {
  frontingSessionSequence += 1;
  void frontingSessionSequence; // used for future sequence-based defaults
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    memberId: overrides.memberId ?? crypto.randomUUID(),
    startedAt: overrides.startedAt ?? new Date(),
    endedAt: overrides.endedAt ?? null,
  };
}

export function resetFrontingSessionSequence(): void {
  frontingSessionSequence = 0;
}
