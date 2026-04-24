/**
 * Group mapper.
 *
 * SP `groups` → Pluralscape groups. Resolves each member source ID through
 * the translation table. Fail-closed: any unresolvable member ref returns
 * `MapperResult.failed` with `kind: "fk-miss"` and the full list of missing
 * refs. Empty-named groups are skipped.
 */
import { parseHexColor, requireName, summarizeMissingRefs } from "./helpers.js";
import { failed, mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPGroup } from "../sources/sp-types.js";
import type { GroupEncryptedInput } from "@pluralscape/data";
import type { CreateGroupBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type MappedGroup = Omit<z.infer<typeof CreateGroupBodySchema>, "encryptedData"> & {
  readonly encrypted: GroupEncryptedInput;
  readonly memberIds: readonly string[];
};

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
      message: `group ${sp._id} has unresolved member reference(s): ${summarizeMissingRefs(missingMemberRefs)}`,
      missingRefs: missingMemberRefs,
      targetField: "members",
    });
  }

  const color = parseHexColor(sp.color);
  if (sp.color && color === null) {
    ctx.addWarningOnce("invalid-hex-color:group", {
      entityType: "group",
      entityId: sp._id,
      message: `Invalid color "${sp.color}" dropped (not valid hex)`,
    });
  }

  const encrypted: GroupEncryptedInput = {
    name: sp.name,
    description: sp.desc ?? null,
    imageSource: null,
    color,
    emoji: null,
  };

  const payload: MappedGroup = {
    encrypted,
    parentGroupId: null,
    sortOrder: 0,
    memberIds,
  };
  return mapped(payload);
}
