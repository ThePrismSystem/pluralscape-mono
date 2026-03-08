import { assertType, describe, expectTypeOf, it } from "vitest";

import type { EntityType } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type {
  AuditMetadata,
  CreateInput,
  DateRange,
  DeepReadonly,
  EntityReference,
  SortDirection,
  UpdateInput,
} from "../utility.js";

describe("CreateInput", () => {
  it("strips id, createdAt, updatedAt, and version", () => {
    interface Entity {
      readonly id: string;
      readonly name: string;
      readonly createdAt: UnixMillis;
      readonly updatedAt: UnixMillis;
      readonly version: number;
    }

    type Input = CreateInput<Entity>;
    expectTypeOf<Input>().toEqualTypeOf<{ readonly name: string }>();
  });

  it("preserves fields not in the strip list", () => {
    interface Entity {
      readonly id: string;
      readonly name: string;
      readonly description: string | null;
      readonly createdAt: UnixMillis;
      readonly updatedAt: UnixMillis;
      readonly version: number;
    }

    type Input = CreateInput<Entity>;
    expectTypeOf<Input>().toHaveProperty("name");
    expectTypeOf<Input>().toHaveProperty("description");
    // Stripped fields should not be present
    type HasId = "id" extends keyof Input ? true : false;
    expectTypeOf<HasId>().toEqualTypeOf<false>();
    type HasCreatedAt = "createdAt" extends keyof Input ? true : false;
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>();
  });
});

describe("UpdateInput", () => {
  it("strips id and createdAt, makes rest partial", () => {
    interface Entity {
      readonly id: string;
      readonly name: string;
      readonly description: string | null;
      readonly createdAt: UnixMillis;
      readonly updatedAt: UnixMillis;
    }

    type Input = UpdateInput<Entity>;

    // Stripped fields should not be present
    type HasId = "id" extends keyof Input ? true : false;
    expectTypeOf<HasId>().toEqualTypeOf<false>();
    type HasCreatedAt = "createdAt" extends keyof Input ? true : false;
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>();

    // Fields are optional (partial)
    assertType<Input>({});
    assertType<Input>({ name: "updated" });
  });
});

describe("DeepReadonly", () => {
  it("makes nested objects readonly", () => {
    interface Nested {
      a: {
        b: {
          c: string;
        };
      };
    }

    type DR = DeepReadonly<Nested>;
    expectTypeOf<DR>().toEqualTypeOf<{
      readonly a: {
        readonly b: {
          readonly c: string;
        };
      };
    }>();
  });

  it("makes arrays readonly", () => {
    interface WithArray {
      items: string[];
    }

    type DR = DeepReadonly<WithArray>;
    expectTypeOf<DR["items"]>().toEqualTypeOf<readonly string[]>();
  });
});

describe("DateRange", () => {
  it("has start and end as UnixMillis", () => {
    expectTypeOf<DateRange["start"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<DateRange["end"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("AuditMetadata", () => {
  it("has timestamp and version fields", () => {
    expectTypeOf<AuditMetadata["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AuditMetadata["updatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<AuditMetadata["version"]>().toEqualTypeOf<number>();
  });
});

describe("SortDirection", () => {
  it("is a union of asc and desc", () => {
    assertType<SortDirection>("asc");
    assertType<SortDirection>("desc");
    // @ts-expect-error invalid sort direction
    assertType<SortDirection>("up");
  });
});

describe("EntityReference", () => {
  it("has entityType and entityId", () => {
    expectTypeOf<EntityReference["entityType"]>().toEqualTypeOf<EntityType>();
    expectTypeOf<EntityReference["entityId"]>().toBeString();
  });
});
