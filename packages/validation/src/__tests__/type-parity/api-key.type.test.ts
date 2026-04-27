import { describe, expectTypeOf, it } from "vitest";

import { ApiKeyEncryptedPayloadSchema } from "../../api-key.js";

import type { ApiKeyEncryptedPayload, Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("ApiKey Zod parity (Class C — ApiKeyEncryptedPayload)", () => {
  it("z.output<typeof ApiKeyEncryptedPayloadSchema> equals ApiKeyEncryptedPayload (memory side)", () => {
    expectTypeOf<
      Equal<z.output<typeof ApiKeyEncryptedPayloadSchema>, ApiKeyEncryptedPayload>
    >().toEqualTypeOf<true>();
  });
});
