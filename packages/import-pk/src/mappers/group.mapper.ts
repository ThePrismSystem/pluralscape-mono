/**
 * PK group mapper.
 *
 * Translates a {@link PKGroup} into a Pluralscape group payload. Unlike the
 * SP group mapper which fails the whole group on unresolvable member refs,
 * the PK mapper emits a warning and skips the individual membership — PK
 * exports may reference members that were deleted or filtered out.
 */
import { mapped, parseHexColor, skipped, type MapperResult } from "@pluralscape/import-core";

import { normalisePkColor } from "./pk-mapper-helpers.js";

import type { PKGroup } from "../validators/pk-payload.js";
import type { MappingContext } from "@pluralscape/import-core";
import type { GroupEncryptedInput } from "@pluralscape/types";
import type { CreateGroupBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type PkMappedGroup = Omit<z.infer<typeof CreateGroupBodySchema>, "encryptedData"> & {
  readonly encrypted: GroupEncryptedInput;
  readonly memberIds: readonly string[];
};

export function mapPkGroup(pk: PKGroup, ctx: MappingContext): MapperResult<PkMappedGroup> {
  if (typeof pk.name !== "string" || pk.name.trim().length === 0) {
    ctx.addWarning({
      entityType: "group",
      entityId: pk.id,
      message: `group "${pk.id}" has empty name`,
    });
    return skipped({ kind: "empty-name", reason: `group "${pk.id}" has empty name` });
  }

  const memberIds: string[] = [];
  for (const sourceId of pk.members) {
    const resolved = ctx.translate("member", sourceId);
    if (resolved === null) {
      ctx.addWarning({
        entityType: "group",
        entityId: pk.id,
        message: `group "${pk.id}" references unknown member "${sourceId}" — skipping membership`,
      });
    } else {
      memberIds.push(resolved);
    }
  }

  let color: GroupEncryptedInput["color"] = null;
  if (pk.color) {
    const normalised = normalisePkColor(pk.color);
    const parsed = parseHexColor(normalised);
    if (parsed !== null) {
      color = parsed;
    } else {
      ctx.addWarningOnce(`invalid-hex-color:group:${pk.id}`, {
        entityType: "group",
        entityId: pk.id,
        message: `Invalid color "${pk.color}" dropped (not valid hex)`,
      });
    }
  }

  const encrypted: GroupEncryptedInput = {
    name: pk.name,
    description: pk.description ?? null,
    imageSource: pk.icon ? { kind: "external" as const, url: pk.icon } : null,
    color,
    emoji: null,
  };

  return mapped({
    encrypted,
    parentGroupId: null,
    sortOrder: 0,
    memberIds,
  });
}
