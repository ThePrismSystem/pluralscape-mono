export interface MemberFactoryOutput {
  id: string;
  systemId: string;
  encryptedData: Uint8Array;
  createdAt: number;
  updatedAt: number;
}

export type MemberFactoryInput = Partial<MemberFactoryOutput>;

export function buildMember(overrides: MemberFactoryInput = {}): MemberFactoryOutput {
  const now = Date.now();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    encryptedData: overrides.encryptedData ?? new Uint8Array([0]),
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}
