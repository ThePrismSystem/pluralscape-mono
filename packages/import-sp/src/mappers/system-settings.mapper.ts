/**
 * System settings mapper.
 *
 * SP `private` (cherry-picked) → plaintext payload for
 * `system_settings.encryptedData`. Cherry-picks three fields — everything
 * else on the SP document is intentionally ignored.
 *
 * Accepts a {@link MappingContext} to keep the per-mapper signature uniform
 * across the engine's dispatcher, even though it currently uses neither
 * the translation table nor the warning buffer.
 */
import { mapped, type MapperResult } from "./mapper-result.js";

import type { MappingContext } from "./context.js";
import type { SPPrivate } from "../sources/sp-types.js";

export interface MappedSystemSettings {
  readonly locale: string | null;
  readonly frontingNotificationsEnabled: boolean;
  readonly boardNotificationsEnabled: boolean;
}

export function mapSystemSettings(
  sp: SPPrivate,
  ctx: MappingContext,
): MapperResult<MappedSystemSettings> {
  // Uniform signature with the rest of the engine's mappers; this mapper
  // currently uses neither the translation table nor the warning buffer.
  void ctx;
  const payload: MappedSystemSettings = {
    locale: sp.locale ?? null,
    frontingNotificationsEnabled: sp.frontNotifs ?? false,
    boardNotificationsEnabled: sp.messageBoardNotifs ?? false,
  };
  return mapped(payload);
}
