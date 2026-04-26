import { describe, it, expectTypeOf } from "vitest";

import type { JournalEntryEncryptedFields } from "../entities/journal-entry.js";
import type { NoteEncryptedFields } from "../entities/note.js";
import type { Equal } from "../type-assertions.js";
import type { AuditMetadata } from "../utility.js";

describe("JournalEntry encrypted-fields policy guard", () => {
  it("contains exactly the fields encrypted before server storage", () => {
    type Expected = "title" | "author" | "blocks" | "tags" | "linkedEntities" | "frontingSnapshots";
    expectTypeOf<Equal<JournalEntryEncryptedFields, Expected>>().toEqualTypeOf<true>();
  });

  it("JournalEntryEncryptedFields excludes the allowlisted plaintext keys", () => {
    type Allowlist = "id" | "systemId" | "frontingSessionId" | "archived" | keyof AuditMetadata;
    expectTypeOf<Extract<JournalEntryEncryptedFields, Allowlist>>().toEqualTypeOf<never>();
  });
});

describe("Note encrypted-fields policy guard", () => {
  it("contains exactly the fields encrypted before server storage", () => {
    type Expected = "title" | "content" | "backgroundColor";
    expectTypeOf<Equal<NoteEncryptedFields, Expected>>().toEqualTypeOf<true>();
  });

  it("NoteEncryptedFields excludes the allowlisted plaintext keys", () => {
    type Allowlist = "id" | "systemId" | "author" | "archived" | keyof AuditMetadata;
    expectTypeOf<Extract<NoteEncryptedFields, Allowlist>>().toEqualTypeOf<never>();
  });
});
