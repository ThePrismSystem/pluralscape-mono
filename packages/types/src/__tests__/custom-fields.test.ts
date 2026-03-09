import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  FieldBucketVisibility,
  FieldDefinition,
  FieldType,
  FieldValue,
  FieldValueUnion,
} from "../custom-fields.js";
import type { BucketId, FieldDefinitionId, FieldValueId, MemberId, SystemId } from "../ids.js";
import type { AuditMetadata } from "../utility.js";

describe("FieldType", () => {
  it("accepts valid field types", () => {
    assertType<FieldType>("text");
    assertType<FieldType>("number");
    assertType<FieldType>("boolean");
    assertType<FieldType>("date");
    assertType<FieldType>("color");
    assertType<FieldType>("select");
    assertType<FieldType>("multi-select");
    assertType<FieldType>("url");
  });

  it("rejects invalid field types", () => {
    // @ts-expect-error invalid field type
    assertType<FieldType>("textarea");
  });

  it("is exhaustive in a switch", () => {
    function handleType(type: FieldType): string {
      switch (type) {
        case "text":
        case "number":
        case "boolean":
        case "date":
        case "color":
        case "select":
        case "multi-select":
        case "url":
          return type;
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleType).toBeFunction();
  });
});

describe("FieldBucketVisibility", () => {
  it("has exactly the expected keys", () => {
    expectTypeOf<keyof FieldBucketVisibility>().toEqualTypeOf<"fieldDefinitionId" | "bucketId">();
  });

  it("has correct field types", () => {
    expectTypeOf<FieldBucketVisibility["fieldDefinitionId"]>().toEqualTypeOf<FieldDefinitionId>();
    expectTypeOf<FieldBucketVisibility["bucketId"]>().toEqualTypeOf<BucketId>();
  });
});

describe("FieldDefinition", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<FieldDefinition>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<FieldDefinition["id"]>().toEqualTypeOf<FieldDefinitionId>();
    expectTypeOf<FieldDefinition["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FieldDefinition["name"]>().toBeString();
    expectTypeOf<FieldDefinition["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<FieldDefinition["fieldType"]>().toEqualTypeOf<FieldType>();
    expectTypeOf<FieldDefinition["options"]>().toEqualTypeOf<readonly string[] | null>();
    expectTypeOf<FieldDefinition["required"]>().toEqualTypeOf<boolean>();
    expectTypeOf<FieldDefinition["sortOrder"]>().toEqualTypeOf<number>();
  });
});

describe("FieldValue", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<FieldValue>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<FieldValue["id"]>().toEqualTypeOf<FieldValueId>();
    expectTypeOf<FieldValue["fieldDefinitionId"]>().toEqualTypeOf<FieldDefinitionId>();
    expectTypeOf<FieldValue["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<FieldValue["value"]>().toEqualTypeOf<FieldValueUnion>();
  });
});

describe("FieldValueUnion", () => {
  it("discriminates on fieldType", () => {
    function handleValue(v: FieldValueUnion): unknown {
      switch (v.fieldType) {
        case "text":
          expectTypeOf(v.value).toBeString();
          return v.value;
        case "number":
          expectTypeOf(v.value).toBeNumber();
          return v.value;
        case "boolean":
          expectTypeOf(v.value).toBeBoolean();
          return v.value;
        case "date":
          expectTypeOf(v.value).toBeString();
          return v.value;
        case "color":
          expectTypeOf(v.value).toBeString();
          return v.value;
        case "select":
          expectTypeOf(v.value).toBeString();
          return v.value;
        case "multi-select":
          expectTypeOf(v.value).toEqualTypeOf<readonly string[]>();
          return v.value;
        case "url":
          expectTypeOf(v.value).toBeString();
          return v.value;
        default: {
          const _exhaustive: never = v;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleValue).toBeFunction();
  });
});
