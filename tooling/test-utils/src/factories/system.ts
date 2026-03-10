export interface SystemFactoryOutput {
  id: string;
  accountId: string;
  createdAt: number;
  updatedAt: number;
}

export type SystemFactoryInput = Partial<SystemFactoryOutput>;

export function buildSystem(overrides: SystemFactoryInput = {}): SystemFactoryOutput {
  const now = Date.now();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    accountId: overrides.accountId ?? crypto.randomUUID(),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}
