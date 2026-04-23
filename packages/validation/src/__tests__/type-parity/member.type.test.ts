/**
 * Zod parity check: `z.infer<typeof CreateMemberBodySchema>` and its
 * siblings structurally match their domain-type counterparts from
 * `@pluralscape/types`.
 *
 * Catches drift between Zod validation schemas and the canonical domain
 * types. See ADR-023.
 */

import { describe, expectTypeOf, it } from "vitest";

import type {
  CreateMemberBodySchema,
  DuplicateMemberBodySchema,
  MemberEncryptedInputSchema,
  UpdateMemberBodySchema,
} from "../../member.js";
import type {
  CreateMemberBody,
  DuplicateMemberBody,
  Equal,
  Member,
  MemberEncryptedFields,
  UpdateMemberBody,
} from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Member Zod parity", () => {
  it("CreateMemberBodySchema matches CreateMemberBody", () => {
    expectTypeOf<
      Equal<z.infer<typeof CreateMemberBodySchema>, CreateMemberBody>
    >().toEqualTypeOf<true>();
  });

  it("UpdateMemberBodySchema matches UpdateMemberBody", () => {
    expectTypeOf<
      Equal<z.infer<typeof UpdateMemberBodySchema>, UpdateMemberBody>
    >().toEqualTypeOf<true>();
  });

  it("DuplicateMemberBodySchema matches DuplicateMemberBody", () => {
    expectTypeOf<
      Equal<z.infer<typeof DuplicateMemberBodySchema>, DuplicateMemberBody>
    >().toEqualTypeOf<true>();
  });

  it("MemberEncryptedInputSchema matches Pick<Member, MemberEncryptedFields>", () => {
    // Mirrors `MemberEncryptedInput` in `@pluralscape/data` without creating
    // a reverse dependency from validation → data.
    expectTypeOf<
      Equal<z.infer<typeof MemberEncryptedInputSchema>, Pick<Member, MemberEncryptedFields>>
    >().toEqualTypeOf<true>();
  });
});
