import { describe, expectTypeOf, it } from "vitest";

import type {
  PersistableEntity,
  Persister,
  PersisterUpsertResult,
} from "../../persistence/persister.types.js";
import type { ImportEntityType, ImportError } from "@pluralscape/types";

describe("Persister", () => {
  it("upsertEntity returns whether the entity was created or updated", () => {
    expectTypeOf<PersisterUpsertResult>().toEqualTypeOf<{
      readonly action: "created" | "updated" | "skipped";
      readonly pluralscapeEntityId: string;
    }>();
  });

  it("Persister upsertEntity accepts a discriminated PersistableEntity", () => {
    expectTypeOf<Persister["upsertEntity"]>().parameter(0).toExtend<PersistableEntity>();
  });

  it("Persister recordError accepts an ImportError", () => {
    expectTypeOf<Persister["recordError"]>().parameter(0).toEqualTypeOf<ImportError>();
  });

  it("Persister exposes a flush method that returns a Promise<void>", () => {
    expectTypeOf<Persister["flush"]>().returns.toEqualTypeOf<Promise<void>>();
  });

  it("PersistableEntity is a discriminated union over ImportEntityType", () => {
    type PE = PersistableEntity;
    expectTypeOf<PE["entityType"]>().toEqualTypeOf<ImportEntityType>();
  });
});
