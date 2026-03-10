import { describe, expect, it } from "vitest";

import { ENABLE_PGCRYPTO } from "../dialect.js";

describe("ENABLE_PGCRYPTO", () => {
  it("contains CREATE EXTENSION statement", () => {
    expect(ENABLE_PGCRYPTO).toBe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  });
});
