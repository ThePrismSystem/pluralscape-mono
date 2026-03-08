const UNIQUE_SUFFIX_LENGTH = 8;

export interface MemberFactoryOutput {
  id: string;
  systemId: string;
  name: string;
  pronouns: string | null;
  createdAt: Date;
}

export type MemberFactoryInput = Partial<MemberFactoryOutput>;

export function buildMember(overrides: MemberFactoryInput = {}): MemberFactoryOutput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    name: overrides.name ?? `Test Member ${crypto.randomUUID().slice(0, UNIQUE_SUFFIX_LENGTH)}`,
    pronouns: overrides.pronouns ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}
