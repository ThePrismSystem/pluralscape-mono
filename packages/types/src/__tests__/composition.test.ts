import { assertType, describe, expectTypeOf, it } from "vitest";

import type { Member, MemberListItem, System } from "../identity.js";
import type { MemberId, SystemSettingsId } from "../ids.js";
import type { PaginatedResult } from "../pagination.js";
import type { ApiError, Result } from "../results.js";
import type { CreateInput, UpdateInput } from "../utility.js";

describe("CreateInput<Member>", () => {
  it("strips id and audit fields, keeps domain fields", () => {
    type Input = CreateInput<Member>;
    type HasId = "id" extends keyof Input ? true : false;
    expectTypeOf<HasId>().toEqualTypeOf<false>();
    type HasCreatedAt = "createdAt" extends keyof Input ? true : false;
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>();
    type HasUpdatedAt = "updatedAt" extends keyof Input ? true : false;
    expectTypeOf<HasUpdatedAt>().toEqualTypeOf<false>();
    type HasVersion = "version" extends keyof Input ? true : false;
    expectTypeOf<HasVersion>().toEqualTypeOf<false>();

    expectTypeOf<Input>().toHaveProperty("systemId");
    expectTypeOf<Input>().toHaveProperty("name");
    expectTypeOf<Input>().toHaveProperty("pronouns");
  });
});

describe("CreateInput<System>", () => {
  it("strips audit fields but keeps settingsId", () => {
    type Input = CreateInput<System>;
    type HasSettingsId = "settingsId" extends keyof Input ? true : false;
    expectTypeOf<HasSettingsId>().toEqualTypeOf<true>();
    expectTypeOf<Input["settingsId"]>().toEqualTypeOf<SystemSettingsId>();
  });
});

describe("UpdateInput<Member>", () => {
  it("all fields optional, audit fields stripped", () => {
    type Input = UpdateInput<Member>;

    type HasId = "id" extends keyof Input ? true : false;
    expectTypeOf<HasId>().toEqualTypeOf<false>();
    type HasCreatedAt = "createdAt" extends keyof Input ? true : false;
    expectTypeOf<HasCreatedAt>().toEqualTypeOf<false>();
    type HasUpdatedAt = "updatedAt" extends keyof Input ? true : false;
    expectTypeOf<HasUpdatedAt>().toEqualTypeOf<false>();
    type HasVersion = "version" extends keyof Input ? true : false;
    expectTypeOf<HasVersion>().toEqualTypeOf<false>();

    // All remaining fields should be optional
    assertType<Input>({});
    assertType<Input>({ name: "updated" });
  });
});

describe("PaginatedResult<MemberListItem>", () => {
  it("items are readonly MemberListItem array", () => {
    type Result = PaginatedResult<MemberListItem>;
    expectTypeOf<Result["items"]>().toEqualTypeOf<readonly MemberListItem[]>();
    expectTypeOf<Result["items"][0]["id"]>().toEqualTypeOf<MemberId>();
  });
});

describe("Result<System, ApiError>", () => {
  it("discriminates correctly", () => {
    function handle(r: Result<System, ApiError>): string {
      if (r.ok) {
        expectTypeOf(r.value).toEqualTypeOf<System>();
        return r.value.name;
      }
      expectTypeOf(r.error).toEqualTypeOf<ApiError>();
      return r.error.message;
    }
    expectTypeOf(handle).toBeFunction();
  });
});
