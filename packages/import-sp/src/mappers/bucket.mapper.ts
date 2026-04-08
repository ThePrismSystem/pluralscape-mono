/**
 * Privacy bucket mapper.
 *
 * Two modes:
 *
 * 1. **Modern SP** — the `privacyBuckets` collection is populated. Each SP
 *    bucket is mapped directly to a Pluralscape bucket via {@link mapBucket}.
 *
 * 2. **Legacy SP** — the `privacyBuckets` collection is empty and members
 *    carry only `private`/`preventTrusted` flags. Before the privacy pass
 *    starts, the engine calls {@link synthesizeLegacyBuckets} to create three
 *    Pluralscape buckets ("Public", "Trusted", "Private"), recorded in
 *    `import_entity_refs` under synthetic source IDs (`synthetic:public`,
 *    `synthetic:trusted`, `synthetic:private`) so re-imports update them
 *    instead of duplicating.
 *
 *    If the user already has Pluralscape buckets named "Public" / "Trusted" /
 *    "Private" (case-insensitive), the synthesizer reuses them by name via
 *    `reusedPluralscapeId` — the engine then registers the source → target
 *    mapping directly without creating a new bucket.
 */
import { mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPPrivacyBucket } from "../sources/sp-types.js";

/** The Pluralscape-shaped bucket payload the persister consumes. */
export interface MappedBucket {
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly icon: string | null;
}

export function mapBucket(sp: SPPrivacyBucket, ctx: MappingContext): MapperResult<MappedBucket> {
  if (!sp.name || sp.name.length === 0) {
    ctx.addWarning({
      entityType: "privacy-bucket",
      entityId: sp._id,
      message: "bucket has empty name; skipping",
    });
    return skipped("empty name");
  }
  const payload: MappedBucket = {
    name: sp.name,
    description: sp.desc ?? null,
    color: sp.color ?? null,
    icon: sp.icon ?? null,
  };
  return mapped(payload);
}

/** Canonical names for the three legacy synthesized buckets. */
export type LegacyBucketName = "Public" | "Trusted" | "Private";

/** Synthetic source IDs recorded in `import_entity_refs` for re-import idempotency. */
export type LegacyBucketSourceId = "synthetic:public" | "synthetic:trusted" | "synthetic:private";

/** Result entry for legacy bucket synthesis. */
export interface SynthesizedBucket {
  readonly name: LegacyBucketName;
  readonly syntheticSourceId: LegacyBucketSourceId;
  readonly description: string;
  /** If a Pluralscape bucket with this name (case-insensitive) already exists, its ID. */
  readonly reusedPluralscapeId?: string;
}

const SYNTH_DESCRIPTIONS: Record<LegacyBucketName, string> = {
  Public: "Visible to everyone (synthesized from legacy SP privacy)",
  Trusted: "Visible to trusted friends (synthesized from legacy SP privacy)",
  Private: "Private to the system (synthesized from legacy SP privacy)",
};

const SYNTH_SOURCE_IDS: Record<LegacyBucketName, LegacyBucketSourceId> = {
  Public: "synthetic:public",
  Trusted: "synthetic:trusted",
  Private: "synthetic:private",
};

const LEGACY_BUCKET_NAMES: readonly LegacyBucketName[] = ["Public", "Trusted", "Private"];

export function synthesizeLegacyBuckets(opts: {
  readonly existingBucketNames: readonly { name: string; pluralscapeId: string }[];
}): readonly SynthesizedBucket[] {
  const lookup = new Map(
    opts.existingBucketNames.map((b) => [b.name.toLowerCase(), b.pluralscapeId] as const),
  );
  return LEGACY_BUCKET_NAMES.map((name) => {
    const reused = lookup.get(name.toLowerCase());
    const base = {
      name,
      syntheticSourceId: SYNTH_SOURCE_IDS[name],
      description: SYNTH_DESCRIPTIONS[name],
    } as const;
    return reused === undefined ? base : { ...base, reusedPluralscapeId: reused };
  });
}
