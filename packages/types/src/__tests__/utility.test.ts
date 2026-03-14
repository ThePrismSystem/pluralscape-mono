import { assertType, describe, expectTypeOf, it } from "vitest";

import type { EntityType } from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type {
  Archived,
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
    type HasId = "id" extends keyof Input ? true : false;
    expectTypeOf<HasId>().toEqualTypeOf<false>();
    type HasCreatedAt = "createdAt" extends keyof Input ? true : false;
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>();
  });

  it("preserves optional fields as optional", () => {
    interface Entity {
      readonly id: string;
      readonly name: string;
      readonly nickname?: string;
      readonly createdAt: UnixMillis;
      readonly updatedAt: UnixMillis;
      readonly version: number;
    }

    type Input = CreateInput<Entity>;
    assertType<Input>({ name: "test" });
    assertType<Input>({ name: "test", nickname: "t" });
  });
});

describe("UpdateInput", () => {
  it("strips id, createdAt, updatedAt, and version, makes rest partial", () => {
    interface Entity {
      readonly id: string;
      readonly name: string;
      readonly description: string | null;
      readonly createdAt: UnixMillis;
      readonly updatedAt: UnixMillis;
      readonly version: number;
    }

    type Input = UpdateInput<Entity>;

    type HasId = "id" extends keyof Input ? true : false;
    expectTypeOf<HasId>().toEqualTypeOf<false>();
    type HasCreatedAt = "createdAt" extends keyof Input ? true : false;
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>();
    type HasUpdatedAt = "updatedAt" extends keyof Input ? true : false;
    expectTypeOf<HasUpdatedAt>().toEqualTypeOf<false>();
    type HasVersion = "version" extends keyof Input ? true : false;
    expectTypeOf<HasVersion>().toEqualTypeOf<false>();

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

  it("passes through primitives unchanged", () => {
    expectTypeOf<DeepReadonly<string>>().toEqualTypeOf<string>();
    expectTypeOf<DeepReadonly<number>>().toEqualTypeOf<number>();
    expectTypeOf<DeepReadonly<boolean>>().toEqualTypeOf<boolean>();
  });

  it("preserves Date as Date", () => {
    expectTypeOf<DeepReadonly<Date>>().toEqualTypeOf<Date>();
  });

  it("converts Map to ReadonlyMap", () => {
    expectTypeOf<DeepReadonly<Map<string, number>>>().toEqualTypeOf<ReadonlyMap<string, number>>();
  });

  it("converts Set to ReadonlySet", () => {
    expectTypeOf<DeepReadonly<Set<string>>>().toEqualTypeOf<ReadonlySet<string>>();
  });

  it("preserves functions as-is", () => {
    type Fn = (x: number) => string;
    expectTypeOf<DeepReadonly<Fn>>().toExtend<Fn>();
    expectTypeOf<Fn>().toExtend<DeepReadonly<Fn>>();
  });
});

describe("DateRange", () => {
  it("has start and end as UnixMillis", () => {
    expectTypeOf<DateRange["start"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<DateRange["end"]>().toEqualTypeOf<UnixMillis>();
  });

  it("rejects plain numbers for start/end", () => {
    // @ts-expect-error plain numbers not assignable to UnixMillis
    assertType<DateRange>({ start: 100, end: 200 });
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

describe("Archived", () => {
  it("replaces archived: false with archived: true and adds archivedAt", () => {
    interface TestEntity {
      readonly id: string;
      readonly name: string;
      readonly archived: false;
    }

    type ArchivedTest = Archived<TestEntity>;
    expectTypeOf<ArchivedTest["archived"]>().toEqualTypeOf<true>();
    expectTypeOf<ArchivedTest["archivedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ArchivedTest["id"]>().toBeString();
    expectTypeOf<ArchivedTest["name"]>().toBeString();
  });

  it("preserves all fields except archived from the original type", () => {
    interface TestEntity extends AuditMetadata {
      readonly id: string;
      readonly name: string;
      readonly description: string | null;
      readonly archived: false;
    }

    type ArchivedTest = Archived<TestEntity>;
    expectTypeOf<ArchivedTest["id"]>().toBeString();
    expectTypeOf<ArchivedTest["name"]>().toBeString();
    expectTypeOf<ArchivedTest["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ArchivedTest["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ArchivedTest["updatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ArchivedTest["version"]>().toEqualTypeOf<number>();
  });

  it("rejects types without archived: false", () => {
    interface NoArchived {
      readonly id: string;
    }

    // @ts-expect-error type without archived: false cannot be used with Archived
    const _check: Archived<NoArchived> = {} as never;
    void _check;
  });
});

describe("EntityReference", () => {
  it("has entityType and entityId", () => {
    expectTypeOf<EntityReference["entityType"]>().toEqualTypeOf<EntityType>();
    expectTypeOf<EntityReference["entityId"]>().toBeString();
  });

  it("accepts a generic parameter for entity type narrowing", () => {
    type SystemRef = EntityReference<"system">;
    expectTypeOf<SystemRef["entityType"]>().toEqualTypeOf<"system">();
    expectTypeOf<SystemRef["entityId"]>().toBeString();
  });
});
