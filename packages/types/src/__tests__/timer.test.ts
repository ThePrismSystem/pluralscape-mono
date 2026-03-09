import { describe, expectTypeOf, it } from "vitest";

import type { CheckInRecordId, MemberId, SystemId, TimerId } from "../ids.js";
import type { CheckInRecord, TimerConfig } from "../timer.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("TimerConfig", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<TimerConfig>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<TimerConfig["id"]>().toEqualTypeOf<TimerId>();
    expectTypeOf<TimerConfig["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<TimerConfig["name"]>().toBeString();
    expectTypeOf<TimerConfig["description"]>().toEqualTypeOf<string | null>();
    expectTypeOf<TimerConfig["intervalSeconds"]>().toEqualTypeOf<number>();
    expectTypeOf<TimerConfig["enabled"]>().toEqualTypeOf<boolean>();
    expectTypeOf<TimerConfig["lastTriggeredAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});

describe("CheckInRecord", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<CheckInRecord>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<CheckInRecord["id"]>().toEqualTypeOf<CheckInRecordId>();
    expectTypeOf<CheckInRecord["timerId"]>().toEqualTypeOf<TimerId>();
    expectTypeOf<CheckInRecord["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<CheckInRecord["respondedByMemberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<CheckInRecord["response"]>().toEqualTypeOf<string | null>();
    expectTypeOf<CheckInRecord["triggeredAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<CheckInRecord["respondedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });
});
