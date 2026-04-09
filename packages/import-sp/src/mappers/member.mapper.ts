/**
 * Member mapper.
 *
 * Translates an {@link SPMember} into three coupled outputs the engine
 * persists atomically:
 *
 * 1. A {@link MappedMemberCore} (the member row itself).
 * 2. An array of {@link ExtractedFieldValue} rows sourced from SP's `info`
 *    map — SP stores custom-field values inline on the member document, but
 *    Pluralscape persists them separately.
 * 3. An array of bucket source IDs. Modern SP populates `buckets` directly;
 *    legacy SP encodes privacy with the `private` / `preventTrusted` boolean
 *    pair, which we translate to synthetic bucket IDs (see
 *    {@link deriveBucketSourceIds}). When neither modern nor legacy privacy
 *    info is available, we fail closed to `synthetic:private`.
 *
 * SP fields without a Pluralscape equivalent (`frame`, `supportDescMarkdown`,
 * `preventsFrontNotifs`, `receiveMessageBoardNotifs`) are dropped with a
 * warning so users can audit what was lost during import.
 */
import { extractFieldValues, type ExtractedFieldValue } from "./field-value.mapper.js";
import { mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPMember } from "../sources/sp-types.js";

export interface MappedMemberCore {
  readonly name: string;
  readonly description: string | null;
  readonly pronouns: string | null;
  readonly colors: readonly string[];
  readonly avatarUrl: string | null;
  readonly archived: boolean;
}

export interface MappedMemberOutput {
  readonly member: MappedMemberCore;
  readonly fieldValues: readonly ExtractedFieldValue[];
  readonly bucketSourceIds: readonly string[];
}

/**
 * Canonical name for the persister payload. The member mapper produces
 * {@link MappedMemberOutput}; this alias aligns the entity-level name with the
 * rest of the `Mapped<Entity>` family consumed by {@link PersistableEntity}.
 */
export type MappedMember = MappedMemberOutput;

/**
 * Resolve a member's privacy bucket source IDs.
 *
 * Precedence:
 * 1. Modern SP `buckets` array (non-empty) — use as-is.
 * 2. Legacy `private: true` → `["synthetic:private"]` (the narrowest).
 * 3. Legacy `preventTrusted: true` (while not private) → public-only.
 * 4. Any other explicit legacy flag → public + trusted.
 * 5. No privacy info at all → fail closed to synthetic:private.
 */
function deriveBucketSourceIds(sp: SPMember): readonly string[] {
  if (sp.buckets && sp.buckets.length > 0) return sp.buckets;
  if (sp.private === true) return ["synthetic:private"];
  if (sp.preventTrusted === true) return ["synthetic:public"];
  if (sp.private === false || sp.preventTrusted === false) {
    return ["synthetic:public", "synthetic:trusted"];
  }
  return ["synthetic:private"];
}

export function mapMember(sp: SPMember, ctx: MappingContext): MapperResult<MappedMemberOutput> {
  if (!sp.name || sp.name.length === 0) {
    ctx.addWarning({
      entityType: "member",
      entityId: sp._id,
      message: "member has empty name; skipping",
    });
    return skipped("empty name");
  }

  if (sp.frame !== undefined && sp.frame !== null) {
    ctx.addWarning({
      entityType: "member",
      entityId: sp._id,
      message: "SP `frame` field dropped (no Pluralscape equivalent)",
    });
  }
  if (sp.supportDescMarkdown !== undefined) {
    ctx.addWarning({
      entityType: "member",
      entityId: sp._id,
      message: "SP `supportDescMarkdown` dropped (no Pluralscape equivalent)",
    });
  }
  if (sp.preventsFrontNotifs !== undefined || sp.receiveMessageBoardNotifs !== undefined) {
    ctx.addWarning({
      entityType: "member",
      entityId: sp._id,
      message: "SP per-member notification toggles dropped (no Pluralscape equivalent)",
    });
  }

  const member: MappedMemberCore = {
    name: sp.name,
    description: sp.desc ?? null,
    pronouns: sp.pronouns ?? null,
    colors: sp.color ? [sp.color] : [],
    avatarUrl: sp.avatarUrl ?? null,
    archived: sp.archived ?? false,
  };

  const fieldValues = extractFieldValues({ memberSourceId: sp._id, info: sp.info }, ctx);
  const bucketSourceIds = deriveBucketSourceIds(sp);

  const payload: MappedMemberOutput = { member, fieldValues, bucketSourceIds };
  return mapped(payload);
}
