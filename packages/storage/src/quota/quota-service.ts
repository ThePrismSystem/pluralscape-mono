import { QuotaExceededError } from "../errors.js";

import { DEFAULT_QUOTA_BYTES } from "./quota-config.js";

import type { QuotaConfig } from "./quota-config.js";
import type { SystemId } from "@pluralscape/types";

/** Result of a quota check. */
export interface QuotaCheckResult {
  readonly allowed: boolean;
  readonly usedBytes: number;
  readonly quotaBytes: number;
}

/** Current blob usage and quota for a system. */
export interface BlobUsageResult {
  readonly usedBytes: number;
  readonly quotaBytes: number;
}

/**
 * Injectable interface for querying blob usage from the database.
 * Implemented by the API layer using Drizzle queries.
 */
export interface BlobUsageQuery {
  /** Returns total bytes used by non-archived blobs for a system. */
  getUsedBytes(systemId: SystemId): Promise<number>;
}

/**
 * Blob quota enforcement service.
 *
 * Called by the API layer before uploading to verify the system has
 * sufficient remaining quota. Not a wrapper/decorator around BlobStorageAdapter —
 * it's a separate check composed at the API level.
 */
export class BlobQuotaService {
  private readonly config: QuotaConfig;
  private readonly usageQuery: BlobUsageQuery;

  constructor(config: QuotaConfig, usageQuery: BlobUsageQuery) {
    this.config = config;
    this.usageQuery = usageQuery;
  }

  /** Returns current usage and quota for a system. */
  async getUsage(systemId: SystemId): Promise<BlobUsageResult> {
    const usedBytes = await this.usageQuery.getUsedBytes(systemId);
    const quotaBytes = this.getQuotaForSystem(systemId);
    return { usedBytes, quotaBytes };
  }

  /**
   * Checks whether an additional upload of `additionalBytes` is within quota.
   *
   * Note: this check is subject to TOCTOU races — usage may change between
   * the check and the actual upload. For strict enforcement, callers should
   * use a DB-level constraint (e.g., a serializable transaction or advisory lock)
   * around the upload path.
   */
  async checkQuota(systemId: SystemId, additionalBytes: number): Promise<QuotaCheckResult> {
    const usedBytes = await this.usageQuery.getUsedBytes(systemId);
    const quotaBytes = this.getQuotaForSystem(systemId);
    const allowed = usedBytes + additionalBytes <= quotaBytes;
    return { allowed, usedBytes, quotaBytes };
  }

  /**
   * Asserts that the upload is within quota, throwing QuotaExceededError if not.
   * Convenience method for use in upload handlers.
   *
   * Note: this check is subject to TOCTOU races — see {@link checkQuota} for details.
   */
  async assertQuota(systemId: SystemId, additionalBytes: number): Promise<void> {
    const { allowed, usedBytes, quotaBytes } = await this.checkQuota(systemId, additionalBytes);
    if (!allowed) {
      throw new QuotaExceededError(systemId, usedBytes, quotaBytes, additionalBytes);
    }
  }

  /**
   * Reserves quota for an upload by performing an advisory check.
   *
   * This method checks current usage and throws {@link QuotaExceededError} if the
   * upload would exceed the system's quota. It is functionally equivalent to
   * {@link assertQuota} today but exists as the future integration point for
   * database-level advisory locks.
   *
   * **TOCTOU limitation:** Without advisory locks (not yet available in the
   * current infrastructure), a concurrent upload could pass the check before
   * either is committed. The API layer should wrap the reserve + upload in a
   * serializable transaction when advisory locks become available.
   *
   * TODO(ps-wsiw): Acquire a pg_advisory_xact_lock on the system ID before
   * checking usage, ensuring the quota check and the subsequent blob insert
   * are atomic within the same transaction.
   */
  async reserveQuota(systemId: SystemId, additionalBytes: number): Promise<void> {
    await this.assertQuota(systemId, additionalBytes);
  }

  private getQuotaForSystem(systemId: SystemId): number {
    return this.config.perSystemOverrides?.[systemId] ?? this.config.defaultQuotaBytes;
  }
}

/** Creates a BlobQuotaService with default config. */
export function createQuotaService(
  usageQuery: BlobUsageQuery,
  config?: Partial<QuotaConfig>,
): BlobQuotaService {
  return new BlobQuotaService({ defaultQuotaBytes: DEFAULT_QUOTA_BYTES, ...config }, usageQuery);
}
