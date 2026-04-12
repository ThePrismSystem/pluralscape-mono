/**
 * Custom front mapper.
 *
 * SP `frontStatuses` collection → Pluralscape `custom_fronts`. Direct mapping:
 * each SP front status becomes a custom front with the same name, description,
 * color, and emoji. Empty-named documents are skipped with a warning.
 */
import { requireName } from "./helpers.js";
import { mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPFrontStatus } from "../sources/sp-types.js";
import type { CustomFrontEncryptedFields } from "@pluralscape/data";
import type { HexColor } from "@pluralscape/types";

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
  const encrypted: CustomFrontEncryptedFields = {
    name: sp.name,
    description: sp.desc ?? null,
    color: (sp.color ?? null) as HexColor | null,
    emoji: null,
  };
  const payload: MappedCustomFront = { encrypted };
  return mapped(payload);
}
