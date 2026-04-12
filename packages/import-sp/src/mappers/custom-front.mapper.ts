/**
 * Custom front mapper.
 *
 * SP `frontStatuses` collection → Pluralscape `custom_fronts`. Direct mapping:
 * each SP front status becomes a custom front with the same name, description,
 * color, and emoji. Empty-named documents are skipped with a warning.
 */
import { parseHexColor, requireName } from "./helpers.js";
import { mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPFrontStatus } from "../sources/sp-types.js";
import type { CustomFrontEncryptedFields } from "@pluralscape/data";

export interface MappedCustomFront {
  readonly encrypted: CustomFrontEncryptedFields;
}

export function mapCustomFront(
  sp: SPFrontStatus,
  ctx: MappingContext,
): MapperResult<MappedCustomFront> {
  const nameError = requireName(sp.name, "custom-front", sp._id);
  if (nameError !== null) {
    ctx.addWarning({
      entityType: "custom-front",
      entityId: sp._id,
      message: nameError.message,
    });
    return skipped({ kind: nameError.kind, reason: nameError.message });
  }
  const color = parseHexColor(sp.color);
  if (sp.color && color === null) {
    ctx.addWarningOnce("invalid-hex-color:custom-front", {
      entityType: "custom-front",
      entityId: sp._id,
      message: `Invalid color "${sp.color}" dropped (not valid hex)`,
    });
  }

  const encrypted: CustomFrontEncryptedFields = {
    name: sp.name,
    description: sp.desc ?? null,
    color,
    emoji: null,
  };
  const payload: MappedCustomFront = { encrypted };
  return mapped(payload);
}
