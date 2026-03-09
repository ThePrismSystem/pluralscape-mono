import { assertType, describe, expectTypeOf, it } from "vitest";

import type { EventId, MemberId, SystemId } from "../ids.js";
import type {
  ArchivalEvent,
  DiscoveryEvent,
  DormancyEndEvent,
  DormancyStartEvent,
  FusionEvent,
  LifecycleEvent,
  LifecycleEventType,
  MergeEvent,
  SplitEvent,
  UnmergeEvent,
} from "../lifecycle.js";
import type { UnixMillis } from "../timestamps.js";

describe("LifecycleEvent base fields", () => {
  it("all variants share common fields", () => {
    expectTypeOf<SplitEvent["id"]>().toEqualTypeOf<EventId>();
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
    expectTypeOf<MergeEvent["sourceMemberIds"]>().toEqualTypeOf<readonly MemberId[]>();
    expectTypeOf<MergeEvent["resultMemberId"]>().toEqualTypeOf<MemberId>();
  });
});

describe("UnmergeEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<UnmergeEvent["eventType"]>().toEqualTypeOf<"unmerge">();
    expectTypeOf<UnmergeEvent["sourceMemberId"]>().toEqualTypeOf<MemberId>();
    expectTypeOf<UnmergeEvent["resultMemberIds"]>().toEqualTypeOf<readonly MemberId[]>();
  });
});

describe("DormancyStartEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<DormancyStartEvent["eventType"]>().toEqualTypeOf<"dormancy-start">();
    expectTypeOf<DormancyStartEvent["memberId"]>().toEqualTypeOf<MemberId>();
  });
});

describe("DormancyEndEvent", () => {
  it("has correct discriminator and fields", () => {
    expectTypeOf<DormancyEndEvent["eventType"]>().toEqualTypeOf<"dormancy-end">();
    expectTypeOf<DormancyEndEvent["memberId"]>().toEqualTypeOf<MemberId>();
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
          return event.resultMemberId;
        case "unmerge":
          expectTypeOf(event).toEqualTypeOf<UnmergeEvent>();
          return event.sourceMemberId;
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
  });

  it("rejects invalid types", () => {
    // @ts-expect-error invalid event type
    assertType<LifecycleEventType>("deletion");
  });
});
