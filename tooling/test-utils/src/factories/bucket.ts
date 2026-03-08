const UNIQUE_SUFFIX_LENGTH = 8;

export interface BucketFactoryOutput {
  id: string;
  systemId: string;
  name: string;
  tags: string[];
  createdAt: Date;
}

export type BucketFactoryInput = Partial<BucketFactoryOutput>;

export function buildBucket(overrides: BucketFactoryInput = {}): BucketFactoryOutput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    name: overrides.name ?? `Test Bucket ${crypto.randomUUID().slice(0, UNIQUE_SUFFIX_LENGTH)}`,
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? new Date(),
  };
}
