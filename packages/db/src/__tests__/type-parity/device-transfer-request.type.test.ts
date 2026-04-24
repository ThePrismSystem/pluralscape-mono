/**
 * Drizzle parity check: the DeviceTransferRequest row shape inferred
 * from the `device_transfer_requests` table structurally matches
 * `DeviceTransferRequestServerMetadata` in @pluralscape/types.
 *
 * The server extends the domain type with three transfer-validation
 * columns (encryptedKeyMaterial, codeSalt, codeAttempts) needed to
 * enforce Argon2id-derived transfer codes and brute-force caps. See
 * `member.type.test.ts` for the general rationale behind the
 * brand-stripped comparison.
 */

import { describe, expectTypeOf, it } from "vitest";

import { deviceTransferRequests } from "../../schema/pg/auth.js";

import type { DeviceTransferRequestServerMetadata, Equal } from "@pluralscape/types";
import type { InferSelectModel } from "drizzle-orm";

describe("DeviceTransferRequest Drizzle parity", () => {
  it("device_transfer_requests Drizzle row has the same property keys as DeviceTransferRequestServerMetadata", () => {
    type Row = InferSelectModel<typeof deviceTransferRequests>;
    expectTypeOf<keyof Row>().toEqualTypeOf<keyof DeviceTransferRequestServerMetadata>();
  });

  it("device_transfer_requests Drizzle row equals DeviceTransferRequestServerMetadata", () => {
    type Row = InferSelectModel<typeof deviceTransferRequests>;
    expectTypeOf<Equal<Row, DeviceTransferRequestServerMetadata>>().toEqualTypeOf<true>();
  });
});
