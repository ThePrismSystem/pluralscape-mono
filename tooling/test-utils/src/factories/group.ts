const UNIQUE_SUFFIX_LENGTH = 8;

export interface GroupFactoryOutput {
  id: string;
  systemId: string;
  name: string;
  createdAt: Date;
}

export type GroupFactoryInput = Partial<GroupFactoryOutput>;

export function buildGroup(overrides: GroupFactoryInput = {}): GroupFactoryOutput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    name: overrides.name ?? `Test Group ${crypto.randomUUID().slice(0, UNIQUE_SUFFIX_LENGTH)}`,
    createdAt: overrides.createdAt ?? new Date(),
  };
}
