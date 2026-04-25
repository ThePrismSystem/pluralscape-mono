/**
 * Zod parity for Member. Locks the canonical chain:
 * - G3: Domain ↔ Zod encrypted input
 * - G4: Body Zod ↔ data-package transform output (inline-shape form)
 *
 * Body shapes are owned by the Zod schemas; no interface types exist in
 * `@pluralscape/types` to assert against.
 *
 * Note: `@pluralscape/data` depends on `@pluralscape/validation`, so we
 * cannot import from `@pluralscape/data` here without creating a circular
 * dependency. G4 assertions inline the transform output shapes directly;
 * the canonical, import-anchored form lives in the data package per
 * follow-up bean `types-1spw`.
 */

import { describe, expectTypeOf, it } from "vitest";

import {
  CreateMemberBodySchema,
  DuplicateMemberBodySchema,
  MemberEncryptedInputSchema,
  UpdateMemberBodySchema,
} from "../../member.js";

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

describe("Member parity (G4: Body Zod ↔ Transform output)", () => {
  it("CreateMemberBodySchema matches encryptMemberInput return shape", () => {
    // Mirrors encryptMemberInput in packages/data/src/transforms/member.ts.
    expectTypeOf<
      Equal<z.infer<typeof CreateMemberBodySchema>, { encryptedData: string }>
    >().toEqualTypeOf<true>();
  });

  it("UpdateMemberBodySchema matches encryptMemberUpdate return shape", () => {
    // Mirrors encryptMemberUpdate in packages/data/src/transforms/member.ts.
    expectTypeOf<
      Equal<z.infer<typeof UpdateMemberBodySchema>, { encryptedData: string; version: number }>
    >().toEqualTypeOf<true>();
  });

  it("DuplicateMemberBodySchema includes the same wire envelope plus duplication knobs", () => {
    type Inferred = z.infer<typeof DuplicateMemberBodySchema>;
    type Expected = {
      encryptedData: string;
      copyPhotos: boolean;
      copyFields: boolean;
      copyMemberships: boolean;
    };
    expectTypeOf<Equal<Inferred, Expected>>().toEqualTypeOf<true>();
  });
});
