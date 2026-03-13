import { assertType, describe, expectTypeOf, it } from "vitest";

import type { LifecycleEventId, MemberId, SubsystemId, SystemId } from "../ids.js";
import type {
  ArchivalEvent,
  DiscoveryEvent,
  DormancyEndEvent,
  DormancyStartEvent,
  FormChangeEvent,
  FusionEvent,
  LifecycleEvent,
  LifecycleEventType,
  MergeEvent,
  NameChangeEvent,
  SplitEvent,
  SubsystemFormationEvent,
  UnmergeEvent,
} from "../lifecycle.js";
import type { UnixMillis } from "../timestamps.js";

describe("LifecycleEvent base fields", () => {
  it("all variants share common fields", () => {
    expectTypeOf<SplitEvent["id"]>().toEqualTypeOf<LifecycleEventId>();
    expectTypeOf<SplitEvent["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<SplitEvent["occurredAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<SplitEvent["recordedAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<SplitEvent["notes"]>().toEqualTypeOf<string | null>();
  });
});

describe("SplitEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<SplitEvent["eventType"]>().toEqualTypeOf<"split">();
    expectTypeOf<SplitEvent["sourceMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<SplitEvent["resultMemberIds"]>().toEqualTypeOf<readonly MemberId[]>();
  });
});

describe("FusionEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<FusionEvent["eventType"]>().toEqualTypeOf<"fusion">();
    expectTypeOf<FusionEvent["sourceMemberIds"]>().toEqualTypeOf<readonly MemberId[]>();
    expectTypeOf<FusionEvent["resultMemberId"]>().toEqualTypeOf<MemberId>();
  });
});

describe("MergeEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<MergeEvent["eventType"]>().toEqualTypeOf<"merge">();
    expectTypeOf<MergeEvent["memberIds"]>().toEqualTypeOf<readonly MemberId[]>();
  });
});

describe("UnmergeEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<UnmergeEvent["eventType"]>().toEqualTypeOf<"unmerge">();
    expectTypeOf<UnmergeEvent["memberIds"]>().toEqualTypeOf<readonly MemberId[]>();
  });
});

describe("DormancyStartEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<DormancyStartEvent["eventType"]>().toEqualTypeOf<"dormancy-start">();
    expectTypeOf<DormancyStartEvent["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<
      DormancyStartEvent["relatedLifecycleEventId"]
    >().toEqualTypeOf<LifecycleEventId | null>();
  });
});

describe("DormancyEndEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<DormancyEndEvent["eventType"]>().toEqualTypeOf<"dormancy-end">();
    expectTypeOf<DormancyEndEvent["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<
      DormancyEndEvent["relatedLifecycleEventId"]
    >().toEqualTypeOf<LifecycleEventId | null>();
  });
});

describe("DiscoveryEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<DiscoveryEvent["eventType"]>().toEqualTypeOf<"discovery">();
    expectTypeOf<DiscoveryEvent["memberId"]>().toEqualTypeOf<MemberId>();
  });
});

describe("ArchivalEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<ArchivalEvent["eventType"]>().toEqualTypeOf<"archival">();
    expectTypeOf<ArchivalEvent["memberId"]>().toEqualTypeOf<MemberId>();
  });
});

describe("SubsystemFormationEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<SubsystemFormationEvent["eventType"]>().toEqualTypeOf<"subsystem-formation">();
    expectTypeOf<SubsystemFormationEvent["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<SubsystemFormationEvent["resultSubsystemId"]>().toEqualTypeOf<SubsystemId>();
  });
});

describe("FormChangeEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<FormChangeEvent["eventType"]>().toEqualTypeOf<"form-change">();
    expectTypeOf<FormChangeEvent["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<FormChangeEvent["previousForm"]>().toEqualTypeOf<string | null>();
    expectTypeOf<FormChangeEvent["newForm"]>().toEqualTypeOf<string | null>();
  });
});

describe("NameChangeEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<NameChangeEvent["eventType"]>().toEqualTypeOf<"name-change">();
    expectTypeOf<NameChangeEvent["memberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<NameChangeEvent["previousName"]>().toEqualTypeOf<string | null>();
    expectTypeOf<NameChangeEvent["newName"]>().toEqualTypeOf<string>();
  });
});

describe("LifecycleEvent discriminated union", () => {
  it("discriminates on eventType", () => {
    function handleEvent(event: LifecycleEvent): string {
      switch (event.eventType) {
        case "split":
          expectTypeOf(event).toEqualTypeOf<SplitEvent>();
          return event.sourceMemberId;
        case "fusion":
          expectTypeOf(event).toEqualTypeOf<FusionEvent>();
          return event.resultMemberId;
        case "merge":
          expectTypeOf(event).toEqualTypeOf<MergeEvent>();
          return event.memberIds.join(",");
        case "unmerge":
          expectTypeOf(event).toEqualTypeOf<UnmergeEvent>();
          return event.memberIds.join(",");
        case "dormancy-start":
          expectTypeOf(event).toEqualTypeOf<DormancyStartEvent>();
          return event.memberId;
        case "dormancy-end":
          expectTypeOf(event).toEqualTypeOf<DormancyEndEvent>();
          return event.memberId;
        case "discovery":
          expectTypeOf(event).toEqualTypeOf<DiscoveryEvent>();
          return event.memberId;
        case "archival":
          expectTypeOf(event).toEqualTypeOf<ArchivalEvent>();
          return event.memberId;
        case "subsystem-formation":
          expectTypeOf(event).toEqualTypeOf<SubsystemFormationEvent>();
          return event.resultSubsystemId;
        case "form-change":
          expectTypeOf(event).toEqualTypeOf<FormChangeEvent>();
          return event.memberId;
        case "name-change":
          expectTypeOf(event).toEqualTypeOf<NameChangeEvent>();
          return event.newName;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    }
    expectTypeOf(handleEvent).toBeFunction();
  });
});

describe("LifecycleEventType", () => {
  it("accepts all event types", () => {
    assertType<LifecycleEventType>("split");
    assertType<LifecycleEventType>("fusion");
    assertType<LifecycleEventType>("merge");
    assertType<LifecycleEventType>("unmerge");
    assertType<LifecycleEventType>("dormancy-start");
    assertType<LifecycleEventType>("dormancy-end");
    assertType<LifecycleEventType>("discovery");
    assertType<LifecycleEventType>("archival");
    assertType<LifecycleEventType>("subsystem-formation");
    assertType<LifecycleEventType>("form-change");
    assertType<LifecycleEventType>("name-change");
  });

  it("rejects invalid types", () => {
    // @ts-expect-error invalid event type
    assertType<LifecycleEventType>("deletion");
  });
});
