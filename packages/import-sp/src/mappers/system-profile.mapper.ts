/**
 * System profile mapper.
 *
 * SP `users` (cherry-picked) → plaintext payload for
 * `systems.encryptedData`. The persister encrypts the result before writing.
 *
 * Fields imported:
 *  - `username` → `name`
 *  - `desc` → `description`
 *  - `color` (as-is)
 *  - `avatarUrl` (persister hands this to the avatar fetcher)
 *  - `defaultPrivacyBucket` resolved via `ctx.translate("privacy-bucket", _)`;
 *    fails closed on miss — the profile cannot be materialised without its
 *    default bucket reference.
 */
import { failed, mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPUser } from "../sources/sp-types.js";

export interface MappedSystemProfile {
  readonly name: string;
  readonly description: string | null;
  readonly color: string | null;
  readonly avatarUrl: string | null;
  readonly defaultBucketId: string | null;
}

export function mapSystemProfile(
  sp: SPUser,
  ctx: MappingContext,
): MapperResult<MappedSystemProfile> {
  let defaultBucketId: string | null = null;
  if (sp.defaultPrivacyBucket !== undefined && sp.defaultPrivacyBucket !== null) {
    const resolved = ctx.translate("privacy-bucket", sp.defaultPrivacyBucket);
    if (resolved === null) {
      return failed({
        kind: "fk-miss",
        message: `FK miss: privacy-bucket ${sp.defaultPrivacyBucket} not in translation table`,
        missingRefs: [sp.defaultPrivacyBucket],
        targetField: "defaultPrivacyBucket",
      });
    }
    defaultBucketId = resolved;
  }

  const payload: MappedSystemProfile = {
    // SP guarantees username is non-empty at the schema level (z.string().min(1)).
    name: sp.username,
    description: sp.desc ?? null,
    color: sp.color ?? null,
    avatarUrl: sp.avatarUrl ?? null,
    defaultBucketId,
  };
  return mapped(payload);
}
