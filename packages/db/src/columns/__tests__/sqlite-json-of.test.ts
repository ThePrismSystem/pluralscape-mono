import { sqliteTable } from "drizzle-orm/sqlite-core";
import { describe, expectTypeOf, test } from "vitest";

import { sqliteJsonOf } from "../sqlite.js";

import type { InferSelectModel } from "drizzle-orm";

interface Color {
  hex: string;
  alpha: number;
}

describe("sqliteJsonOf<T>", () => {
  test("preserves T as the inferred select type", () => {
    const colorsTable = sqliteTable("test", {
      colors: sqliteJsonOf<readonly Color[]>("colors").notNull(),
    });

    type Row = InferSelectModel<typeof colorsTable>;
    expectTypeOf<Row["colors"]>().toEqualTypeOf<readonly Color[]>();
    // Reference the table at runtime so the binding isn't elided.
    expectTypeOf(colorsTable).toEqualTypeOf<typeof colorsTable>();
  });
});
