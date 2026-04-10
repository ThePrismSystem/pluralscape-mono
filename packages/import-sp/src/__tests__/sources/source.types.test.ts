import { describe, expectTypeOf, it } from "vitest";

import type { ImportDataSource, SourceDocument, SourceMode } from "../../sources/source.types.js";
import type { SpCollectionName } from "../../sources/sp-collections.js";

describe("ImportDataSource", () => {
  it("iterate yields typed documents for a collection", () => {
    expectTypeOf<ImportDataSource["iterate"]>().toBeFunction();
    expectTypeOf<ImportDataSource["iterate"]>().parameter(0).toEqualTypeOf<SpCollectionName>();
  });

  it("iterate returns an AsyncIterable of SourceDocument", () => {
    type RT = ReturnType<ImportDataSource["iterate"]>;
    expectTypeOf<RT>().toExtend<AsyncIterable<SourceDocument>>();
  });

  it("SourceMode is the discriminator for api vs file", () => {
    expectTypeOf<SourceMode>().toEqualTypeOf<"api" | "file" | "fake">();
  });

  it("ImportDataSource exposes a mode getter", () => {
    expectTypeOf<ImportDataSource["mode"]>().toEqualTypeOf<SourceMode>();
  });

  it("ImportDataSource exposes a close method", () => {
    expectTypeOf<ImportDataSource["close"]>().returns.toEqualTypeOf<Promise<void>>();
  });

  it("SourceDocument carries the raw document plus its source ID and collection", () => {
    expectTypeOf<SourceDocument>().toExtend<{
      collection: SpCollectionName;
      sourceId: string;
      document: unknown;
    }>();
  });
});
