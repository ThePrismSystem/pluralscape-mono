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
 */
import { requireName } from "./helpers.js";
import { mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPPrivacyBucket } from "../sources/sp-types.js";
import type { PrivacyBucketEncryptedInput } from "@pluralscape/types";
import type { CreateBucketBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

/** The Pluralscape-shaped bucket payload the persister consumes. */
export type MappedPrivacyBucket = Omit<z.infer<typeof CreateBucketBodySchema>, "encryptedData"> & {
  readonly encrypted: PrivacyBucketEncryptedInput;
};

export function mapBucket(
  sp: SPPrivacyBucket,
  ctx: MappingContext,
): MapperResult<MappedPrivacyBucket> {
  const nameError = requireName(sp.name, "privacy-bucket", sp._id);
  if (nameError !== null) {
    ctx.addWarning({
      entityType: "privacy-bucket",
      entityId: sp._id,
      message: nameError.message,
    });
    return skipped({ kind: nameError.kind, reason: nameError.message });
  }
  const encrypted: PrivacyBucketEncryptedInput = {
    name: sp.name,
    description: sp.desc ?? null,
  };
  const payload: MappedPrivacyBucket = { encrypted };
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

export function synthesizeLegacyBuckets(): readonly SynthesizedBucket[] {
  return LEGACY_BUCKET_NAMES.map((name) => ({
    name,
    syntheticSourceId: SYNTH_SOURCE_IDS[name],
    description: SYNTH_DESCRIPTIONS[name],
  }));
}
