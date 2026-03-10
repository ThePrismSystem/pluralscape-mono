export interface MemberFactoryOutput {
  id: string;
  systemId: string;
  encryptedData: Uint8Array;
  createdAt: Date;
}

export type MemberFactoryInput = Partial<MemberFactoryOutput>;

export function buildMember(overrides: MemberFactoryInput = {}): MemberFactoryOutput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    encryptedData: overrides.encryptedData ?? new Uint8Array([0]),
    createdAt: overrides.createdAt ?? new Date(),
  };
}
