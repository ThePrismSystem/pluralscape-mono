import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  ActiveFrontingSession,
  ArchivedCustomFront,
  ArchivedFrontingComment,
  ArchivedFrontingSession,
  ArchivedSwitch,
  CoFrontState,
  CompletedFrontingSession,
  CustomFront,
  FrontingComment,
  FrontingSession,
  FrontingType,
  OuttriggerSentiment,
  Switch,
} from "../fronting.js";
import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  HexColor,
  MemberId,
  SwitchId,
  SystemId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata, EntityReference } from "../utility.js";

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
    expectTypeOf<ActiveFrontingSession["linkedStructure"]>().toEqualTypeOf<EntityReference<
      "subsystem" | "side-system" | "layer"
    > | null>();
    expectTypeOf<ActiveFrontingSession["positionality"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ActiveFrontingSession["outtrigger"]>().toEqualTypeOf<{
      readonly reason: string;
      readonly sentiment: OuttriggerSentiment;
    } | null>();
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
    expectTypeOf<CompletedFrontingSession["linkedStructure"]>().toEqualTypeOf<EntityReference<
      "subsystem" | "side-system" | "layer"
    > | null>();
    expectTypeOf<CompletedFrontingSession["positionality"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CompletedFrontingSession["outtrigger"]>().toEqualTypeOf<{
      readonly reason: string;
      readonly sentiment: OuttriggerSentiment;
    } | null>();
  });

  it("ActiveFrontingSession extends AuditMetadata", () => {
    expectTypeOf<ActiveFrontingSession>().toExtend<AuditMetadata>();
  });

  it("CompletedFrontingSession extends AuditMetadata", () => {
    expectTypeOf<CompletedFrontingSession>().toExtend<AuditMetadata>();
  });

  it("has archived as false literal on both variants", () => {
    expectTypeOf<ActiveFrontingSession["archived"]>().toEqualTypeOf<false>();
    expectTypeOf<CompletedFrontingSession["archived"]>().toEqualTypeOf<false>();
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

  it("has archived as false literal", () => {
    expectTypeOf<Switch["archived"]>().toEqualTypeOf<false>();
  });

  it("has exact shape", () => {
    expectTypeOf<keyof Switch>().toEqualTypeOf<
      "id" | "systemId" | "memberIds" | "timestamp" | "archived"
    >();
  });
});

describe("ArchivedSwitch", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedSwitch["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedSwitch["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves core Switch fields", () => {
    expectTypeOf<ArchivedSwitch["id"]>().toEqualTypeOf<SwitchId>();
    expectTypeOf<ArchivedSwitch["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ArchivedSwitch["memberIds"]>().toEqualTypeOf<readonly [MemberId, ...MemberId[]]>();
    expectTypeOf<ArchivedSwitch["timestamp"]>().toEqualTypeOf<UnixMillis>();
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

describe("FrontingComment", () => {
  it("has correct field types", () => {
    expectTypeOf<FrontingComment["id"]>().toEqualTypeOf<FrontingCommentId>();
    expectTypeOf<FrontingComment["frontingSessionId"]>().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<FrontingComment["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<FrontingComment["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<FrontingComment["content"]>().toBeString();
  });

  it("extends AuditMetadata", () => {
    expectTypeOf<FrontingComment>().toExtend<AuditMetadata>();
    expectTypeOf<FrontingComment["createdAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<FrontingComment["updatedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<FrontingComment["version"]>().toEqualTypeOf<number>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<FrontingComment["archived"]>().toEqualTypeOf<false>();
  });
});

describe("ArchivedFrontingComment", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedFrontingComment["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedFrontingComment["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves core FrontingComment fields", () => {
    expectTypeOf<ArchivedFrontingComment["id"]>().toEqualTypeOf<FrontingCommentId>();
    expectTypeOf<ArchivedFrontingComment["frontingSessionId"]>().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<ArchivedFrontingComment["content"]>().toBeString();
  });
});

describe("ArchivedFrontingSession", () => {
  it("has archived as true literal", () => {
    expectTypeOf<ArchivedFrontingSession["archived"]>().toEqualTypeOf<true>();
  });

  it("has archivedAt timestamp", () => {
    expectTypeOf<ArchivedFrontingSession["archivedAt"]>().toEqualTypeOf<UnixMillis>();
  });

  it("preserves core FrontingSession fields", () => {
    expectTypeOf<ArchivedFrontingSession["id"]>().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<ArchivedFrontingSession["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<ArchivedFrontingSession["memberId"]>().toEqualTypeOf<MemberId>();
  });
});
