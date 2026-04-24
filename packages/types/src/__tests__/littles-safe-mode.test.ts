import { assertType, describe, expectTypeOf, it } from "vitest";

import type { BlobId, SafeModeContentId, SystemId } from "../ids.js";
import type {
  LittlesSafeModeConfig,
  SafeModeContentItem,
  SafeModeUIFlags,
} from "../littles-safe-mode.js";

describe("SafeModeUIFlags", () => {
  it("has all boolean flag fields", () => {
    expectTypeOf<SafeModeUIFlags["largeButtons"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["iconDriven"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["noDeletion"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["noSettings"]>().toEqualTypeOf<boolean>();
    expectTypeOf<SafeModeUIFlags["noAnalytics"]>().toEqualTypeOf<boolean>();
  });
});

describe("SafeModeContentItem", () => {
  it("has correct field types", () => {
    expectTypeOf<SafeModeContentItem["id"]>().toEqualTypeOf<SafeModeContentId>();
    expectTypeOf<SafeModeContentItem["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SafeModeContentItem["contentType"]>().toEqualTypeOf<"link" | "video" | "media">();
    expectTypeOf<SafeModeContentItem["url"]>().toEqualTypeOf<string | null>();
    expectTypeOf<SafeModeContentItem["blobRef"]>().toEqualTypeOf<BlobId | null>();
    expectTypeOf<SafeModeContentItem["title"]>().toEqualTypeOf<string>();
    expectTypeOf<SafeModeContentItem["description"]>().toEqualTypeOf<string>();
    expectTypeOf<SafeModeContentItem["sortOrder"]>().toEqualTypeOf<number>();
  });

  it("accepts valid content types", () => {
    assertType<SafeModeContentItem["contentType"]>("link");
    assertType<SafeModeContentItem["contentType"]>("video");
    assertType<SafeModeContentItem["contentType"]>("media");
  });

  it("rejects invalid content types", () => {
    // @ts-expect-error invalid content type
    assertType<SafeModeContentItem["contentType"]>("image");
  });
});

describe("LittlesSafeModeConfig", () => {
  it("has enabled boolean", () => {
    expectTypeOf<LittlesSafeModeConfig["enabled"]>().toEqualTypeOf<boolean>();
  });

  it("has allowedContentIds as readonly SafeModeContentId array", () => {
    expectTypeOf<LittlesSafeModeConfig["allowedContentIds"]>().toEqualTypeOf<
      readonly SafeModeContentId[]
    >();
  });

  it("has simplifiedUIFlags as SafeModeUIFlags", () => {
    expectTypeOf<LittlesSafeModeConfig["simplifiedUIFlags"]>().toEqualTypeOf<SafeModeUIFlags>();
  });
});
