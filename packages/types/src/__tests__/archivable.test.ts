import { describe, expectTypeOf, it } from "vitest";

import type { Archivable, Archived, Equal } from "../index.js";

interface Sample {
  readonly id: string;
  readonly name: string;
  readonly archived: false;
}

describe("Archivable<T>", () => {
  it("equals T | Archived<T>", () => {
    expectTypeOf<Equal<Archivable<Sample>, Sample | Archived<Sample>>>().toEqualTypeOf<true>();
  });

  it("narrows on archived discriminant", () => {
    const check = (value: Archivable<Sample>) => {
      if (value.archived) {
        expectTypeOf(value).toEqualTypeOf<Archived<Sample>>();
      } else {
        expectTypeOf(value).toEqualTypeOf<Sample>();
      }
    };
    void check;
  });

  it("rejects archived: true without archivedAt at the type level", () => {
    // @ts-expect-error — Archived<T> requires archivedAt
    const _bad: Archivable<Sample> = { id: "x", name: "n", archived: true };
    void _bad;
  });
});
