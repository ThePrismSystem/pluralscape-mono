import { describe, expectTypeOf, it } from "vitest";

import type { ImportSource, SourceDocument, SourceMode } from "../../sources/source.types.js";
import type { SpCollectionName } from "../../sources/sp-collections.js";

describe("ImportSource", () => {
  it("iterate yields typed documents for a collection", () => {
    expectTypeOf<ImportSource["iterate"]>().toBeFunction();
    expectTypeOf<ImportSource["iterate"]>().parameter(0).toEqualTypeOf<SpCollectionName>();
  });

  it("iterate returns an AsyncIterable of SourceDocument", () => {
    type RT = ReturnType<ImportSource["iterate"]>;
    expectTypeOf<RT>().toExtend<AsyncIterable<SourceDocument>>();
  });

  it("SourceMode is the discriminator for api vs file", () => {
    expectTypeOf<SourceMode>().toEqualTypeOf<"api" | "file" | "fake">();
  });

  it("ImportSource exposes a mode getter", () => {
    expectTypeOf<ImportSource["mode"]>().toEqualTypeOf<SourceMode>();
  });

  it("ImportSource exposes a close method", () => {
    expectTypeOf<ImportSource["close"]>().returns.toEqualTypeOf<Promise<void>>();
  });

  it("SourceDocument carries the raw document plus its source ID and collection", () => {
    expectTypeOf<SourceDocument>().toExtend<{
      collection: SpCollectionName;
      sourceId: string;
      document: unknown;
    }>();
  });
});
