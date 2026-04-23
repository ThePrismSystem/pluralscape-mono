/**
 * PK member mapper.
 *
 * Translates a {@link PKMember} into a Pluralscape member payload. PK colors
 * may omit the `#` prefix, so we normalise before parsing.
 */
import {
  mapped,
  parseHexColor,
  skipped,
  failed,
  type MapperResult,
} from "@pluralscape/import-core";

import { normalisePkColor } from "./pk-mapper-helpers.js";

import type { PKMember } from "../validators/pk-payload.js";
import type { MemberEncryptedInput } from "@pluralscape/data";
import type { MappingContext } from "@pluralscape/import-core";
import type { CreateMemberBodySchema } from "@pluralscape/validation";
import type { z } from "zod/v4";

export type PkMappedMember = Omit<z.infer<typeof CreateMemberBodySchema>, "encryptedData"> & {
  readonly encrypted: MemberEncryptedInput;
  readonly archived: false;
  readonly fieldValues: readonly [];
  readonly bucketIds: readonly string[];
};

export function mapPkMember(pk: PKMember, ctx: MappingContext): MapperResult<PkMappedMember> {
  if (typeof pk.name !== "string" || pk.name.trim().length === 0) {
    ctx.addWarning({
      entityType: "member",
      entityId: pk.id,
      message: `member "${pk.id}" has empty name`,
    });
    return skipped({ kind: "empty-name", reason: `member "${pk.id}" has empty name` });
  }

  let colors: MemberEncryptedInput["colors"] = [];
  if (pk.color) {
    const normalised = normalisePkColor(pk.color);
    const parsed = parseHexColor(normalised);
    if (parsed !== null) {
      colors = [parsed];
    } else {
      ctx.addWarningOnce(`invalid-hex-color:member:${pk.id}`, {
        entityType: "member",
        entityId: pk.id,
        message: `Invalid color "${pk.color}" dropped (not valid hex)`,
      });
    }
  }

  const encrypted: MemberEncryptedInput = {
    name: pk.name,
    description: pk.description ?? null,
    pronouns: pk.pronouns ? [pk.pronouns] : [],
    avatarSource: pk.avatar_url ? { kind: "external" as const, url: pk.avatar_url } : null,
    colors,
    saturationLevel: { kind: "known" as const, level: "highly-elaborated" as const },
    tags: [],
    suppressFriendFrontNotification: false,
    boardMessageNotificationOnFront: false,
  };

  // Resolve privacy bucket assignment from synthesis pass metadata
  const bucketIds: string[] = [];
  const privateMemberIds = ctx.getMetadata(
    "privacy-bucket",
    "synthetic:pk-private",
    "memberIds",
  ) as readonly string[] | undefined;

  if (privateMemberIds?.includes(pk.id)) {
    const bucketId = ctx.translate("privacy-bucket", "synthetic:pk-private");
    if (bucketId === null) {
      return failed({
        kind: "fk-miss",
        message: `Privacy bucket "synthetic:pk-private" not found — cannot assign bucket to member "${pk.id}"`,
      });
    }
    bucketIds.push(bucketId);
  }

  return mapped({
    encrypted,
    archived: false as const,
    fieldValues: [] as const,
    bucketIds,
  });
}
