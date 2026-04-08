/**
 * System settings mapper.
 *
 * SP `private` (cherry-picked) → plaintext payload for
 * `system_settings.encryptedData`. Cherry-picks three fields — everything
 * else on the SP document is intentionally ignored.
 *
 * No FK resolution, so no {@link MappingContext} parameter — the engine's
 * dispatcher calls this without one.
 */
import { mapped, type MapperResult } from "./mapper-result.js";

import type { SPPrivate } from "../sources/sp-types.js";

export interface MappedSystemSettings {
  readonly locale: string | null;
  readonly frontingNotificationsEnabled: boolean;
  readonly boardNotificationsEnabled: boolean;
}

export function mapSystemSettings(sp: SPPrivate): MapperResult<MappedSystemSettings> {
  const payload: MappedSystemSettings = {
    locale: sp.locale ?? null,
    frontingNotificationsEnabled: sp.frontNotifs ?? false,
    boardNotificationsEnabled: sp.messageBoardNotifs ?? false,
  };
  return mapped(payload);
}
