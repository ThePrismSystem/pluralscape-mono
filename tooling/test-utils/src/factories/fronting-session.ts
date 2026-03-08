export interface FrontingSessionFactoryOutput {
  id: string;
  systemId: string;
  memberId: string;
  startedAt: Date;
  endedAt: Date | null;
}

export type FrontingSessionFactoryInput = Partial<FrontingSessionFactoryOutput>;

export function buildFrontingSession(
  overrides: FrontingSessionFactoryInput = {},
): FrontingSessionFactoryOutput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    memberId: overrides.memberId ?? crypto.randomUUID(),
    startedAt: overrides.startedAt ?? new Date(),
    endedAt: overrides.endedAt ?? null,
  };
}
