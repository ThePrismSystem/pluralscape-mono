import { describe, expectTypeOf, it } from "vitest";

import type {
  ActiveFrontingSession,
  ArchivedCustomFront,
  ArchivedFrontingComment,
  ArchivedFrontingSession,
  CoFrontState,
  CompletedFrontingSession,
  CustomFront,
  FrontingComment,
  FrontingSession,
  OuttriggerSentiment,
} from "../fronting.js";
import type {
  CustomFrontId,
  FrontingCommentId,
  FrontingSessionId,
  HexColor,
  MemberId,
  SystemId,
} from "../ids.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata, EntityReference } from "../utility.js";

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
    expectTypeOf<ActiveFrontingSession["comment"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ActiveFrontingSession["customFrontId"]>().toEqualTypeOf<CustomFrontId | null>();
    expectTypeOf<ActiveFrontingSession["linkedStructure"]>().toEqualTypeOf<EntityReference<
      "subsystem" | "side-system" | "layer"
    > | null>();
    expectTypeOf<ActiveFrontingSession["positionality"]>().toEqualTypeOf<string | null>();
    expectTypeOf<ActiveFrontingSession["outtrigger"]>().toEqualTypeOf<string | null>();
    expectTypeOf<
      ActiveFrontingSession["outtriggerSentiment"]
    >().toEqualTypeOf<OuttriggerSentiment | null>();
  });

  it("CompletedFrontingSession has individual field types", () => {
    expectTypeOf<CompletedFrontingSession["id"]>().toEqualTypeOf<FrontingSessionId>();
    expectTypeOf<CompletedFrontingSession["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<CompletedFrontingSession["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<CompletedFrontingSession["startTime"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<CompletedFrontingSession["endTime"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<CompletedFrontingSession["comment"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CompletedFrontingSession["customFrontId"]>().toEqualTypeOf<CustomFrontId | null>();
    expectTypeOf<CompletedFrontingSession["linkedStructure"]>().toEqualTypeOf<EntityReference<
      "subsystem" | "side-system" | "layer"
    > | null>();
    expectTypeOf<CompletedFrontingSession["positionality"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CompletedFrontingSession["outtrigger"]>().toEqualTypeOf<string | null>();
    expectTypeOf<
      CompletedFrontingSession["outtriggerSentiment"]
    >().toEqualTypeOf<OuttriggerSentiment | null>();
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
