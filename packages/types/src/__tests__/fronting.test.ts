import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ActiveFrontingSession,
  ArchivedCustomFront,
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
  HexColor,
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

  it("CompletedFrontingSession has individual field types", () => {
    expectTypeOf<CompletedFrontingSession["id"]>().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<CompletedFrontingSession["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<CompletedFrontingSession["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<CompletedFrontingSession["startTime"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<CompletedFrontingSession["endTime"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<CompletedFrontingSession["frontingType"]>().toEqualTypeOf<FrontingType>();
    expectTypeOf<CompletedFrontingSession["comment"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CompletedFrontingSession["customFrontId"]>().toEqualTypeOf<CustomFrontId | null>();
    expectTypeOf<CompletedFrontingSession["subsystemId"]>().toEqualTypeOf<SubsystemId | null>();
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
    expectTypeOf<Switch["memberIds"]>().toEqualTypeOf<readonly [MemberId, ...MemberId[]]>();
    expectTypeOf<Switch["timestamp"]>().toEqualTypeOf<UnixMillis>();
  });

  it("does not extend AuditMetadata", () => {
    expectTypeOf<Switch>().not.toExtend<AuditMetadata>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof Switch>().toEqualTypeOf<"id" | "systemId" | "memberIds" | "timestamp">();
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
    expectTypeOf<CustomFront["color"]>().toEqualTypeOf<HexColor | null>();
    expectTypeOf<CustomFront["emoji"]>().toEqualTypeOf<string | null>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<CustomFront["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedCustomFront", () => {
  it("has all CustomFront fields except archived", () => {
    expectTypeOf<ArchivedCustomFront["id"]>().toEqualTypeOf<CustomFrontId>();
    expectTypeOf<ArchivedCustomFront["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ArchivedCustomFront["name"]>().toBeString();
  });

  it("has archived as true literal", () => {
    expectTypeOf<ArchivedCustomFront["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedCustomFront["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });
});

describe("CoFrontState", () => {
  it("has timestamp and activeSessions", () => {
    expectTypeOf<CoFrontState["timestamp"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<CoFrontState["activeSessions"]>().toEqualTypeOf<
      readonly ActiveFrontingSession[]
    >();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof CoFrontState>().toEqualTypeOf<"timestamp" | "activeSessions">();
  });
});
