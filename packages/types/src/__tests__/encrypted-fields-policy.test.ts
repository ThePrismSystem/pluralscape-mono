import { describe, it, expectTypeOf } from "vitest";

import type { JournalEntryEncryptedFields } from "../entities/journal-entry.js";
import type { Equal } from "../type-assertions.js";

describe("encrypted-fields policy guard", () => {
  it("JournalEntryEncryptedFields equals the documented literal union", () => {
    type Expected = "title" | "author" | "blocks" | "tags" | "linkedEntities" | "frontingSnapshots";
    expectTypeOf<Equal<JournalEntryEncryptedFields, Expected>>().toEqualTypeOf<true>();
  });

  it("JournalEntryEncryptedFields excludes the allowlisted plaintext keys", () => {
    type Allowlist = "id" | "systemId" | "frontingSessionId" | "archived";
    expectTypeOf<Extract<JournalEntryEncryptedFields, Allowlist>>().toEqualTypeOf<never>();
  });
});
