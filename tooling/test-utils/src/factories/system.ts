const UNIQUE_SUFFIX_LENGTH = 8;

export interface SystemFactoryOutput {
  id: string;
  name: string;
  createdAt: Date;
}

export type SystemFactoryInput = Partial<SystemFactoryOutput>;

export function buildSystem(overrides: SystemFactoryInput = {}): SystemFactoryOutput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? `Test System ${crypto.randomUUID().slice(0, UNIQUE_SUFFIX_LENGTH)}`,
    createdAt: overrides.createdAt ?? new Date(),
  };
}
