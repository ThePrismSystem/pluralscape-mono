/**
 * Group mapper.
 *
 * SP `groups` → Pluralscape groups. Resolves each member source ID through
 * the translation table. Members that can't be resolved are dropped with a
 * per-miss warning (the group still maps, possibly with an empty
 * `memberIds`). Empty-named groups are skipped.
 */
import { mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPGroup } from "../sources/sp-types.js";

export interface MappedGroup {
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly memberIds: readonly string[];
}

export function mapGroup(sp: SPGroup, ctx: MappingContext): MapperResult<MappedGroup> {
  if (!sp.name || sp.name.length === 0) {
    ctx.addWarning({
      entityType: "group",
      entityId: sp._id,
      message: "group has empty name; skipping",
    });
    return skipped({ kind: "empty-name", reason: "empty name" });
  }

  const resolved: string[] = [];
  for (const sourceId of sp.members) {
    const pluralscapeId = ctx.translate("member", sourceId);
    if (pluralscapeId === null) {
      ctx.addWarning({
        entityType: "group",
        entityId: sp._id,
        message: `group member ${sourceId} not in translation table; dropping`,
      });
      continue;
    }
    resolved.push(pluralscapeId);
  }

  if (sp.members.length > 0 && resolved.length === 0) {
    ctx.addWarning({
      entityType: "group",
      entityId: sp._id,
      message: "all members unresolved; mapping group with empty memberIds",
    });
  }

  const payload: MappedGroup = {
    name: sp.name,
    description: sp.desc ?? null,
    color: sp.color ?? null,
    memberIds: resolved,
  };
  return mapped(payload);
}
