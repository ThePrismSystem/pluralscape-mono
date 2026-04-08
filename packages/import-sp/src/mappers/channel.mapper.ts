/**
 * Channel + channel-category mapper.
 *
 * SP stores chat channels in two collections: `channelCategories` (folders)
 * and `channels` (leaves that reference a category). Pluralscape flattens
 * both into a single `channels` collection with a `type` discriminator, so
 * this file exports two mappers producing the same `MappedChannel` shape.
 *
 * Orphaned channels — whose parent category either doesn't exist upstream
 * or was skipped during the category pass — still map successfully with
 * `parentChannelId: null` and a warning, so no messages are lost downstream.
 */
import { mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPChannel, SPChannelCategory } from "../sources/sp-types.js";

export interface MappedChannel {
  readonly name: string;
  readonly description: string | null;
  readonly type: "category" | "channel";
  readonly parentChannelId: string | null;
  readonly order: number | null;
}

export function mapChannelCategory(
  sp: SPChannelCategory,
  ctx: MappingContext,
): MapperResult<MappedChannel> {
  if (!sp.name || sp.name.length === 0) {
    ctx.addWarning({
      entityType: "channel-category",
      entityId: sp._id,
      message: "channel category has empty name; skipping",
    });
    return skipped("empty name");
  }
  const payload: MappedChannel = {
    name: sp.name,
    description: sp.description ?? null,
    type: "category",
    parentChannelId: null,
    order: sp.order ?? null,
  };
  return mapped(payload);
}

export function mapChannel(sp: SPChannel, ctx: MappingContext): MapperResult<MappedChannel> {
  if (!sp.name || sp.name.length === 0) {
    ctx.addWarning({
      entityType: "channel",
      entityId: sp._id,
      message: "channel has empty name; skipping",
    });
    return skipped("empty name");
  }

  let parentChannelId: string | null = null;
  if (sp.parentCategory !== null) {
    const resolved = ctx.translate("channel-category", sp.parentCategory);
    if (resolved === null) {
      ctx.addWarning({
        entityType: "channel",
        entityId: sp._id,
        message: `parent category ${sp.parentCategory} not in translation table; orphaning channel`,
      });
    } else {
      parentChannelId = resolved;
    }
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
