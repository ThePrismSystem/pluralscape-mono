import { describe, expectTypeOf, it } from "vitest";

import { DeviceInfoSchema } from "../../session.js";

import type { DeviceInfo, Equal } from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Session Zod parity (Class C — DeviceInfo)", () => {
  it("z.infer<typeof DeviceInfoSchema> equals DeviceInfo", () => {
    expectTypeOf<Equal<z.infer<typeof DeviceInfoSchema>, DeviceInfo>>().toEqualTypeOf<true>();
  });
});
