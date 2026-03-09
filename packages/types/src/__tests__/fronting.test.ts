import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ActiveFrontingSession,
  CoFrontState,
  CompletedFrontingSession,
  CustomFront,
  FrontingSession,
  FrontingType,
  Switch,
} from "../fronting.js";
import type {
  CustomFrontId,
  FrontingSessionId,
  MemberId,
  SubsystemId,
  SwitchId,
  SystemId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("FrontingType", () => {
  it("accepts valid values", () => {
    assertType<FrontingType>("fronting");
    assertType<FrontingType>("co-conscious");
  });

  it("rejects invalid values", () => {
    // @ts-expect-error invalid fronting type
    assertType<FrontingType>("dormant");
  });

  it("is exhaustive in a switch", () => {
    function handleFrontingType(type: FrontingType): string {
      switch (type) {
        case "fronting":
          return "fronting";
        case "co-conscious":
          return "co-conscious";
        default: {
          const _exhaustive: never = type;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleFrontingType).toBeFunction();
  });
});

describe("FrontingSession", () => {
  it("discriminates on endTime — null narrows to ActiveFrontingSession", () => {
    function handleSession(session: FrontingSession): void {
      if (session.endTime === null) {
        expectTypeOf(session).toEqualTypeOf<ActiveFrontingSession>();
      } else {
        expectTypeOf(session).toEqualTypeOf<CompletedFrontingSession>();
        expectTypeOf(session.endTime).toEqualTypeOf<UnixMillis>();
      }
    }
    expectTypeOf(handleSession).toBeFunction();
  });

  it("has shared fields on both variants", () => {
    expectTypeOf<ActiveFrontingSession["id"]>().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<ActiveFrontingSession["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ActiveFrontingSession["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<ActiveFrontingSession["startTime"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<ActiveFrontingSession["frontingType"]>().toEqualTypeOf<FrontingType>();
    expectTypeOf<ActiveFrontingSession["comment"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ActiveFrontingSession["customFrontId"]>().toEqualTypeOf<CustomFrontId | null>();
    expectTypeOf<ActiveFrontingSession["subsystemId"]>().toEqualTypeOf<SubsystemId | null>();
  });

  it("ActiveFrontingSession extends AuditMetadata", () => {
    expectTypeOf<ActiveFrontingSession>().toExtend<AuditMetadata>();
  });

  it("CompletedFrontingSession extends AuditMetadata", () => {
    expectTypeOf<CompletedFrontingSession>().toExtend<AuditMetadata>();
  });
});

describe("Switch", () => {
  it("has correct field types", () => {
    expectTypeOf<Switch["id"]>().toEqualTypeOf<SwitchId>();
    expectTypeOf<Switch["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<Switch["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<Switch["timestamp"]>().toEqualTypeOf<UnixMillis>();
  });

  it("does not extend AuditMetadata", () => {
    expectTypeOf<Switch>().not.toExtend<AuditMetadata>();
  });
});

describe("CustomFront", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<CustomFront>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<CustomFront["id"]>().toEqualTypeOf<CustomFrontId>();
    expectTypeOf<CustomFront["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<CustomFront["name"]>().toBeString();
    expectTypeOf<CustomFront["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CustomFront["color"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CustomFront["emoji"]>().toEqualTypeOf<string | null>();
  });

  it("has archived as boolean (not literal)", () => {
    expectTypeOf<CustomFront["archived"]>().toEqualTypeOf<boolean>();
  });

  it("has nullable archivedAt", () => {
    expectTypeOf<CustomFront["archivedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("CoFrontState", () => {
  it("has timestamp and activeSessions", () => {
    expectTypeOf<CoFrontState["timestamp"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<CoFrontState["activeSessions"]>().toEqualTypeOf<
      readonly ActiveFrontingSession[]
    >();
  });
});
