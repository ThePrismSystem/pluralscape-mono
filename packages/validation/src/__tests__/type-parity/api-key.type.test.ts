import { describe, expectTypeOf, it } from "vitest";

import { ApiKeyEncryptedPayloadSchema } from "../../api-key.js";

import type { ApiKeyEncryptedPayload, Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("ApiKey Zod parity (Class C — ApiKeyEncryptedPayload)", () => {
  it("z.infer<typeof ApiKeyEncryptedPayloadSchema> equals ApiKeyEncryptedPayload", () => {
    expectTypeOf<
      Equal<z.infer<typeof ApiKeyEncryptedPayloadSchema>, ApiKeyEncryptedPayload>
    >().toEqualTypeOf<true>();
  });
});
