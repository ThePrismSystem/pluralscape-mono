/**
 * Privacy bucket factory stub.
 *
 * Will be implemented with actual Drizzle schema resolvers when
 * the database schema epic (db-2je4) defines the buckets table.
 */

let bucketSequence = 0;

export interface BucketFactoryInput {
  id?: string;
  systemId?: string;
  name?: string;
  tags?: string[];
  createdAt?: Date;
}

export interface BucketFactoryOutput {
  id: string;
  systemId: string;
  name: string;
  tags: string[];
  createdAt: Date;
}

export function buildBucket(overrides: BucketFactoryInput = {}): BucketFactoryOutput {
  bucketSequence += 1;
  return {
    id: overrides.id ?? crypto.randomUUID(),
    systemId: overrides.systemId ?? crypto.randomUUID(),
    name: overrides.name ?? `Test Bucket ${String(bucketSequence)}`,
    tags: overrides.tags ?? [],
    createdAt: overrides.createdAt ?? new Date(),
  };
}

export function resetBucketSequence(): void {
  bucketSequence = 0;
}
