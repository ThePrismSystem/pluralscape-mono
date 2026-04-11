import { describe, expectTypeOf, it } from "vitest";

import type { ImportDataSource, SourceEvent, SourceMode } from "../../sources/source.types.js";
import type { SpCollectionName } from "../../sources/sp-collections.js";

describe("ImportDataSource", () => {
  it("iterate yields typed documents for a collection", () => {
    expectTypeOf<ImportDataSource["iterate"]>().toBeFunction();
    expectTypeOf<ImportDataSource["iterate"]>().parameter(0).toEqualTypeOf<SpCollectionName>();
  });

  it("iterate returns an AsyncIterable of SourceEvent", () => {
    type RT = ReturnType<ImportDataSource["iterate"]>;
    expectTypeOf<RT>().toExtend<AsyncIterable<SourceEvent>>();
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

  it("SourceEvent is a discriminated union of doc and drop variants", () => {
    type DocVariant = Extract<SourceEvent, { kind: "doc" }>;
    type DropVariant = Extract<SourceEvent, { kind: "drop" }>;

    expectTypeOf<DocVariant>().toExtend<{
      kind: "doc";
      collection: SpCollectionName;
      sourceId: string;
      document: unknown;
    }>();

    expectTypeOf<DropVariant>().toExtend<{
      kind: "drop";
      collection: SpCollectionName;
      sourceId: string | null;
      reason: string;
    }>();
  });
});
