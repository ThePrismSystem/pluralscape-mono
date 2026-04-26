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
import type { ChannelEncryptedInput } from "@pluralscape/types";
import type { CreateChannelBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedChannel = Omit<z.infer<typeof CreateChannelBodySchema>, "encryptedData"> & {
  readonly encrypted: ChannelEncryptedInput;
};

/**
 * Channel-category payload. Narrows {@link MappedChannel} so the compiler
 * enforces `type: "category"` and `parentId: undefined` — categories are
 * always top-level containers that cannot nest under another category.
 */
export type MappedChannelCategory = Omit<MappedChannel, "type" | "parentId"> & {
  readonly type: "category";
  readonly parentId: undefined;
};

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
  const encrypted: ChannelEncryptedInput = { name: sp.name };
  const payload: MappedChannelCategory = {
    encrypted,
    type: "category",
    parentId: undefined,
    sortOrder: sp.order ?? 0,
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

  let parentId: MappedChannel["parentId"] = undefined;
  // Real SP channels without a parent category omit `parentCategory`
  // entirely (undefined) rather than setting it to null. Treat both as
  // "no parent".
  if (sp.parentCategory) {
    const resolved = ctx.translate("channel-category", sp.parentCategory);
    if (resolved === null) {
      return failed({
        kind: "fk-miss",
        message: `channel ${sp._id} has unresolved parentCategory ${sp.parentCategory}`,
        missingRefs: [sp.parentCategory],
        targetField: "parentId",
      });
    }
    parentId = resolved as MappedChannel["parentId"];
  }

  const encrypted: ChannelEncryptedInput = { name: sp.name };
  const payload: MappedChannel = {
    encrypted,
    type: "channel",
    parentId,
    sortOrder: sp.order ?? 0,
  };
  return mapped(payload);
}
