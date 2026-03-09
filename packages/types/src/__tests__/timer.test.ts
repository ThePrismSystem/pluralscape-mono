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
    expectTypeOf<TimerConfig["intervalMinutes"]>().toEqualTypeOf<number>();
    expectTypeOf<TimerConfig["wakingHoursOnly"]>().toEqualTypeOf<boolean>();
    expectTypeOf<TimerConfig["wakingStart"]>().toBeString();
    expectTypeOf<TimerConfig["wakingEnd"]>().toBeString();
    expectTypeOf<TimerConfig["promptText"]>().toBeString();
    expectTypeOf<TimerConfig["enabled"]>().toEqualTypeOf<boolean>();
  });
});

describe("CheckInRecord", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<CheckInRecord>().toExtend<AuditMetadata>();
  });

  it("has exactly the expected keys", () => {
    expectTypeOf<keyof CheckInRecord>().toEqualTypeOf<
      | "id"
      | "timerConfigId"
      | "systemId"
      | "scheduledAt"
      | "respondedByMemberId"
      | "respondedAt"
      | "dismissed"
      | "createdAt"
      | "updatedAt"
      | "version"
    >();
  });

  it("has correct field types", () => {
    expectTypeOf<CheckInRecord["id"]>().toEqualTypeOf<CheckInRecordId>();
    expectTypeOf<CheckInRecord["timerConfigId"]>().toEqualTypeOf<TimerId>();
    expectTypeOf<CheckInRecord["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<CheckInRecord["scheduledAt"]>().toEqualTypeOf<UnixMillis>();
    expectTypeOf<CheckInRecord["respondedByMemberId"]>().toEqualTypeOf<MemberId | null>();
    expectTypeOf<CheckInRecord["respondedAt"]>().toEqualTypeOf<UnixMillis | null>();
    expectTypeOf<CheckInRecord["dismissed"]>().toEqualTypeOf<boolean>();
  });
});
