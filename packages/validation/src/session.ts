import { z } from "zod/v4";

import type { DeviceInfo } from "@pluralscape/types";

/**
 * Zod schema for `DeviceInfo` — the auxiliary type encrypted inside a
 * Session row's `encryptedData` blob. Per ADR-023 Class C convention,
 * this schema is named after the auxiliary type (no `SessionEncryptedInputSchema`
 * alias). The compile-time parity test in
 * `__tests__/type-parity/session.type.test.ts` asserts
 * `z.infer<typeof DeviceInfoSchema>` ≡ `DeviceInfo`.
 *
 * Currently a parity gate only — not yet wired to a runtime parse boundary.
 */
export const DeviceInfoSchema: z.ZodType<DeviceInfo> = z
  .object({
    platform: z.string(),
    appVersion: z.string(),
    deviceName: z.string(),
  })
  .readonly();
