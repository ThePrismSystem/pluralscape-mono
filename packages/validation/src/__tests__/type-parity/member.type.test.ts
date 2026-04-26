/**
 * G3 parity for Member (Domain ↔ Zod encrypted input). G4 (Body Zod ↔
 * Transform output) lives in `packages/data/src/__tests__/type-parity/`
 * because data depends on validation; the inverse import direction would
 * create a workspace cycle. See bean `types-1spw`.
 */

import { describe, expectTypeOf, it } from "vitest";

import { MemberEncryptedInputSchema } from "../../member.js";

import type {
  Equal,
  Member,
  MemberEncryptedFields,
  MemberEncryptedInput,
} from "@pluralscape/types";
import type { z } from "zod/v4";

describe("Member parity (G3: Domain ↔ Zod encrypted input)", () => {
  it("MemberEncryptedInputSchema matches Pick<Member, MemberEncryptedFields>", () => {
    expectTypeOf<
      Equal<z.infer<typeof MemberEncryptedInputSchema>, Pick<Member, MemberEncryptedFields>>
    >().toEqualTypeOf<true>();
  });

  it("MemberEncryptedInput (canonical alias) matches Pick<Member, MemberEncryptedFields>", () => {
    expectTypeOf<
      Equal<MemberEncryptedInput, Pick<Member, MemberEncryptedFields>>
    >().toEqualTypeOf<true>();
  });
});
