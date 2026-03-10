export interface SystemFactoryOutput {
  id: string;
  accountId: string;
  createdAt: Date;
}

export type SystemFactoryInput = Partial<SystemFactoryOutput>;

export function buildSystem(overrides: SystemFactoryInput = {}): SystemFactoryOutput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    accountId: overrides.accountId ?? crypto.randomUUID(),
    createdAt: overrides.createdAt ?? new Date(),
  };
}
