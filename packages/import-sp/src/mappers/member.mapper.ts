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
 * 3. An array of *resolved* Pluralscape bucket IDs (`bucketIds`). Modern SP
 *    populates `buckets` directly; legacy SP encodes privacy with the
 *    `private` / `preventTrusted` boolean pair, which we translate to
 *    synthetic bucket source IDs (see {@link deriveBucketSourceIds}). Each
 *    source ID is then resolved against the `IdTranslationTable` via
 *    `ctx.translate("privacy-bucket", ...)` so the persister receives
 *    already-resolved foreign keys and never has to re-resolve. Any
 *    unresolved reference is a fail-closed `fk-miss` failure — unlike
 *    `skipped`, which would silently drop the member.
 *
 * SP fields without a Pluralscape equivalent (`frame`, `supportDescMarkdown`,
 * `preventsFrontNotifs`, `receiveMessageBoardNotifs`) are dropped with a
 * warning so users can audit what was lost during import.
 */
import { extractFieldValues, type ExtractedFieldValue } from "./field-value.mapper.js";
import { requireName } from "./helpers.js";
import { failed, mapped, skipped, type MapperResult } from "./mapper-result.js";

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
  /**
   * Pluralscape privacy-bucket IDs resolved from the source document's
   * bucket references. Every ID here is already translated through
   * {@link MappingContext.translate} — consumers never need to re-resolve.
   */
  readonly bucketIds: readonly string[];
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
  const nameError = requireName(sp.name, "member", sp._id);
  if (nameError !== null) {
    ctx.addWarning({
      entityType: "member",
      entityId: sp._id,
      message: nameError.message,
    });
    return skipped({ kind: nameError.kind, reason: nameError.message });
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

  // Resolve every bucket source ID through the translation table BEFORE
  // constructing the payload. Any unresolved reference is a fail-closed
  // `fk-miss` failure — the engine records a non-fatal error and moves on.
  const bucketSourceIds = deriveBucketSourceIds(sp);
  const bucketIds: string[] = [];
  const missingRefs: string[] = [];
  for (const sourceId of bucketSourceIds) {
    const resolved = ctx.translate("privacy-bucket", sourceId);
    if (resolved === null) {
      missingRefs.push(sourceId);
    } else {
      bucketIds.push(resolved);
    }
  }

  if (missingRefs.length > 0) {
    return failed({
      kind: "fk-miss",
      message: `Member "${sp.name}" has ${String(missingRefs.length)} unresolved privacy bucket reference(s)`,
      missingRefs,
      targetField: "buckets",
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

  const payload: MappedMemberOutput = { member, fieldValues, bucketIds };
  return mapped(payload);
}
