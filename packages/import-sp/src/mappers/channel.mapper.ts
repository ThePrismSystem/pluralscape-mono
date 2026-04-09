/**
 * Channel + channel-category mapper.
 *
 * SP stores chat channels in two collections: `channelCategories` (folders)
 * and `channels` (leaves that reference a category). Pluralscape flattens
 * both into a single `channels` collection with a `type` discriminator, so
 * this file exports two mappers producing the same `MappedChannel` shape.
 *
 * Fail-closed on FK miss: a channel whose `parentCategory` cannot be resolved
 * returns `MapperResult.failed` with `kind: "fk-miss"` so the engine can
 * record the failure and continue.
 */
import { requireName } from "./helpers.js";
import { failed, mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPChannel, SPChannelCategory } from "../sources/sp-types.js";

export interface MappedChannel {
  readonly name: string;
  readonly description: string | null;
  readonly type: "category" | "channel";
  readonly parentChannelId: string | null;
  readonly order: number | null;
}

/**
 * Channel-category payload. Structurally identical to {@link MappedChannel}
 * today (both are persisted into the flattened `channels` collection with a
 * `type` discriminant), but kept as a distinct named type so the
 * {@link PersistableEntity} discriminated union can carry separate
 * `"channel-category"` and `"channel"` variants.
 */
export interface MappedChannelCategory {
  readonly name: string;
  readonly description: string | null;
  readonly type: "category";
  readonly parentChannelId: null;
  readonly order: number | null;
}

export function mapChannelCategory(
  sp: SPChannelCategory,
  ctx: MappingContext,
): MapperResult<MappedChannelCategory> {
  const nameError = requireName(sp.name, "channel-category", sp._id);
  if (nameError !== null) {
    ctx.addWarning({
      entityType: "channel-category",
      entityId: sp._id,
      message: nameError.message,
    });
    return skipped({ kind: nameError.kind, reason: nameError.message });
  }
  const payload: MappedChannelCategory = {
    name: sp.name,
    description: sp.description ?? null,
    type: "category",
    parentChannelId: null,
    order: sp.order ?? null,
  };
  return mapped(payload);
}

export function mapChannel(sp: SPChannel, ctx: MappingContext): MapperResult<MappedChannel> {
  const nameError = requireName(sp.name, "channel", sp._id);
  if (nameError !== null) {
    ctx.addWarning({
      entityType: "channel",
      entityId: sp._id,
      message: nameError.message,
    });
    return skipped({ kind: nameError.kind, reason: nameError.message });
  }

  let parentChannelId: string | null = null;
  if (sp.parentCategory !== null) {
    const resolved = ctx.translate("channel-category", sp.parentCategory);
    if (resolved === null) {
      return failed({
        kind: "fk-miss",
        message: `Channel "${sp.name}" has unresolved parentCategory "${sp.parentCategory}"`,
        missingRefs: [sp.parentCategory],
        targetField: "parentCategory",
      });
    }
    parentChannelId = resolved;
  }

  const payload: MappedChannel = {
    name: sp.name,
    description: sp.description ?? null,
    type: "channel",
    parentChannelId,
    order: sp.order ?? null,
  };
  return mapped(payload);
}
