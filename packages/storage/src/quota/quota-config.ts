import type { SystemId } from "@pluralscape/types";

/** Configuration for blob quota enforcement. */
export interface QuotaConfig {
  /** Default quota in bytes for each system. */
  readonly defaultQuotaBytes: number;
  /** Per-system quota overrides, keyed by system ID. */
  readonly perSystemOverrides?: Readonly<Record<SystemId, number>>;
}

/** 1 GiB default quota. */
const GIB = 1_073_741_824;
export const DEFAULT_QUOTA_BYTES = GIB;
