import { describe, expectTypeOf, it } from "vitest";

import type { BlobId } from "../ids.js";
import type { ImageSource } from "../image-source.js";

describe("ImageSource", () => {
  it("discriminates on kind — blob variant", () => {
    function handleSource(source: ImageSource): string {
      switch (source.kind) {
        case "blob":
          expectTypeOf(source.blobRef).toEqualTypeOf<BlobId>();
          return source.blobRef;
        case "external":
          expectTypeOf(source.url).toEqualTypeOf<string>();
          return source.url;
        default: {
          const _exhaustive: never = source;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleSource).toBeFunction();
  });

  it("blob variant has blobRef field", () => {
    type BlobVariant = Extract<ImageSource, { kind: "blob" }>;
    expectTypeOf<BlobVariant["blobRef"]>().toEqualTypeOf<BlobId>();
  });

  it("external variant has url field", () => {
    type ExternalVariant = Extract<ImageSource, { kind: "external" }>;
    expectTypeOf<ExternalVariant["url"]>().toEqualTypeOf<string>();
  });
});
