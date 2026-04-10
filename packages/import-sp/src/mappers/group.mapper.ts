/**
 * Group mapper.
 *
 * SP `groups` → Pluralscape groups. Resolves each member source ID through
 * the translation table. Fail-closed: any unresolvable member ref returns
 * `MapperResult.failed` with `kind: "fk-miss"` and the full list of missing
 * refs. Empty-named groups are skipped.
 */
import { requireName } from "./helpers.js";
import { failed, mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPGroup } from "../sources/sp-types.js";

export interface MappedGroup {
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly memberIds: readonly string[];
}

export function mapGroup(sp: SPGroup, ctx: MappingContext): MapperResult<MappedGroup> {
  const nameError = requireName(sp.name, "group", sp._id);
  if (nameError !== null) {
    ctx.addWarning({
      entityType: "group",
      entityId: sp._id,
      message: nameError.message,
    });
    return skipped({ kind: nameError.kind, reason: nameError.message });
  }

  const memberIds: string[] = [];
  const missingMemberRefs: string[] = [];
  for (const sourceId of sp.members) {
    const resolved = ctx.translate("member", sourceId);
    if (resolved === null) {
      missingMemberRefs.push(sourceId);
    } else {
      memberIds.push(resolved);
    }
  }

  if (missingMemberRefs.length > 0) {
    return failed({
      kind: "fk-miss",
      message: `Group "${sp.name}" has unresolved member reference(s): ${missingMemberRefs.join(", ")}`,
      missingRefs: missingMemberRefs,
      targetField: "members",
    });
  }

  const payload: MappedGroup = {
    name: sp.name,
    description: sp.desc ?? null,
    color: sp.color ?? null,
    memberIds,
  };
  return mapped(payload);
}
