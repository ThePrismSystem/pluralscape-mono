/**
 * Custom front mapper.
 *
 * SP `frontStatuses` collection → Pluralscape `custom_fronts`. Direct mapping:
 * each SP front status becomes a custom front with the same name, description,
 * color, and avatar URL. Empty-named documents are skipped with a warning.
 */
import { requireName } from "./helpers.js";
import { mapped, skipped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPFrontStatus } from "../sources/sp-types.js";

export interface MappedCustomFront {
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly avatarUrl: string | null;
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
  const payload: MappedCustomFront = {
    name: sp.name,
    description: sp.desc ?? null,
    color: sp.color ?? null,
    avatarUrl: sp.avatarUrl ?? null,
  };
  return mapped(payload);
}
