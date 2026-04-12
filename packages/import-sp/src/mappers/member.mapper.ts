/**
 * Member mapper.
 *
 * Translates an {@link SPMember} into three coupled outputs the engine
 * persists atomically:
 *
 * 1. An `encrypted` blob matching {@link MemberEncryptedFields}.
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
import { parseHexColor, requireName, warnDropped } from "./helpers.js";
import { failed, mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPMember } from "../sources/sp-types.js";
import type { MemberEncryptedFields } from "@pluralscape/data";

export interface MappedMember {
  readonly encrypted: MemberEncryptedFields;
  readonly archived: boolean;
  readonly fieldValues: readonly ExtractedFieldValue[];
  /**
   * Pluralscape privacy-bucket IDs resolved from the source document's
   * bucket references. Every ID here is already translated through
   * {@link MappingContext.translate} — consumers never need to re-resolve.
   */
  readonly bucketIds: readonly string[];
}

/**
 * Resolve a member's privacy bucket source IDs.
 *
 * Precedence:
 * 1. Modern SP member with `buckets` field present (any length) — respect
 *    the explicit assignment. An empty array means "assigned to no
 *    buckets", which SP semantically treats as "visible to no friends"
 *    (equivalent to restrictive). We import that as an empty `bucketIds`
 *    list so downstream privacy stays fail-closed. We do NOT fall through
 *    to legacy-flag synthesis in this case, even when `private` or
 *    `preventTrusted` are set — the modern account has already chosen the
 *    bucket model and mixing the two would double-count privacy.
 * 2. Legacy SP (no `buckets` field at all) — derive from the
 *    `private` / `preventTrusted` boolean pair:
 *    2a. `private: true` → `["synthetic:private"]` (the narrowest).
 *    2b. `preventTrusted: true` (while not private) → public-only.
 *    2c. Any other explicit legacy flag → public + trusted.
 *    2d. No privacy info at all → fail closed to synthetic:private.
 */
function deriveBucketSourceIds(sp: SPMember): readonly string[] {
  if (sp.buckets !== undefined) return sp.buckets;
  if (sp.private === true) return ["synthetic:private"];
  if (sp.preventTrusted === true) return ["synthetic:public"];
  if (sp.private === false || sp.preventTrusted === false) {
    return ["synthetic:public", "synthetic:trusted"];
  }
  return ["synthetic:private"];
}

export function mapMember(sp: SPMember, ctx: MappingContext): MapperResult<MappedMember> {
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
    warnDropped(ctx, "member", sp._id, "frame", "no Pluralscape equivalent");
  }
  if (sp.supportDescMarkdown !== undefined) {
    warnDropped(ctx, "member", sp._id, "supportDescMarkdown", "no Pluralscape equivalent");
  }
  if (sp.preventsFrontNotifs !== undefined || sp.receiveMessageBoardNotifs !== undefined) {
    warnDropped(
      ctx,
      "member",
      sp._id,
      "notifs",
      "per-member notification toggles have no Pluralscape equivalent",
    );
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
      message: `member ${sp._id} has ${String(missingRefs.length)} unresolved privacy bucket reference(s)`,
      missingRefs,
      targetField: "buckets",
    });
  }

  const parsedColor = parseHexColor(sp.color);
  if (sp.color && parsedColor === null) {
    ctx.addWarningOnce("invalid-hex-color:member", {
      entityType: "member",
      entityId: sp._id,
      message: `Invalid color "${sp.color}" dropped (not valid hex)`,
    });
  }

  const encrypted: MemberEncryptedFields = {
    name: sp.name,
    description: sp.desc ?? null,
    pronouns: sp.pronouns ? [sp.pronouns] : [],
    avatarSource: sp.avatarUrl ? { kind: "external" as const, url: sp.avatarUrl } : null,
    colors: parsedColor ? [parsedColor] : [],
    saturationLevel: { kind: "known" as const, level: "highly-elaborated" as const },
    tags: [],
    suppressFriendFrontNotification: false,
    boardMessageNotificationOnFront: false,
  };

  const fieldValues = extractFieldValues({ memberSourceId: sp._id, info: sp.info }, ctx);

  const payload: MappedMember = {
    encrypted,
    archived: sp.archived ?? false,
    fieldValues,
    bucketIds,
  };
  return mapped(payload);
}
