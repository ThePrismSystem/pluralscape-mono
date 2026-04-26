/**
 * Zod parity for PrivacyBucket. Locks the canonical chain:
 * - G3: Domain ↔ Zod encrypted input
 *
 * Note: `@pluralscape/data` depends on `@pluralscape/validation`, so we
 * cannot import from `@pluralscape/data` here without creating a circular
 * dependency. G4 assertions (data-package transform output) live in the
 * data package per follow-up bean `types-1spw`.
 */

import { describe, expectTypeOf, it } from "vitest";

import { PrivacyBucketEncryptedInputSchema } from "../../privacy.js";

import type {
  Equal,
  PrivacyBucket,
  PrivacyBucketEncryptedFields,
  PrivacyBucketEncryptedInput,
} from "@pluralscape/types";
import type { z } from "zod/v4";

describe("PrivacyBucket parity (G3: Domain ↔ Zod encrypted input)", () => {
  it("PrivacyBucketEncryptedInputSchema matches Pick<PrivacyBucket, PrivacyBucketEncryptedFields>", () => {
    expectTypeOf<
      Equal<
        z.infer<typeof PrivacyBucketEncryptedInputSchema>,
        Pick<PrivacyBucket, PrivacyBucketEncryptedFields>
      >
    >().toEqualTypeOf<true>();
  });

  it("PrivacyBucketEncryptedInput (canonical alias) matches Pick<PrivacyBucket, PrivacyBucketEncryptedFields>", () => {
    expectTypeOf<
      Equal<PrivacyBucketEncryptedInput, Pick<PrivacyBucket, PrivacyBucketEncryptedFields>>
    >().toEqualTypeOf<true>();
  });
});
