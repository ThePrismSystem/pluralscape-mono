import { describe, expectTypeOf, it } from "vitest";

import type { CheckInRecordId, MemberId, SystemId, TimerId } from "../ids.js";
import type {
  ArchivedCheckInRecord,
  ArchivedTimerConfig,
  CheckInRecord,
  TimerConfig,
} from "../timer.js";
import type { UnixMillis } from "../timestamps.js";
import type { AuditMetadata } from "../utility.js";

describe("TimerConfig", () => {
  it("extends AuditMetadata", () => {
    expectTypeOf<TimerConfig>().toExtend<AuditMetadata>();
  });

  it("has correct field types", () => {
    expectTypeOf<TimerConfig["id"]>().toEqualTypeOf<TimerId>();
    expectTypeOf<TimerConfig["systemId"]>().toEqualTypeOf<SystemId>();
    expectTypeOf<TimerConfig["intervalMinutes"]>().toEqualTypeOf<number | null>();
    expectTypeOf<TimerConfig["wakingHoursOnly"]>().toEqualTypeOf<boolean | null>();
    expectTypeOf<TimerConfig["wakingStart"]>().toEqualTypeOf<string | null>();
    expectTypeOf<TimerConfig["wakingEnd"]>().toEqualTypeOf<string | null>();
    expectTypeOf<TimerConfig["promptText"]>().toBeString();
    expectTypeOf<TimerConfig["enabled"]>().toEqualTypeOf<boolean>();
  });

  it("has archived as false literal", () => {
    expectTypeOf<TimerConfig["archived"]>().toEqualTypeOf<false>();
  });

  it("ArchivedTimerConfig has archived as true literal", () => {
    expectTypeOf<ArchivedTimerConfig["archived"]>().toEqualTypeOf<true>();
  });
});

describe("CheckInRecord", () => {
  it("does not extend AuditMetadata (log-like entity without OCC)", () => {
    expectTypeOf<CheckInRecord>().not.toExtend<AuditMetadata>();
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
      | "archived"
      | "archivedAt"
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
    expectTypeOf<CheckInRecord["archived"]>().toEqualTypeOf<boolean>();
    expectTypeOf<CheckInRecord["archivedAt"]>().toEqualTypeOf<UnixMillis | null>();
  });

  it("ArchivedCheckInRecord has archived as true literal", () => {
    expectTypeOf<ArchivedCheckInRecord["archived"]>().toEqualTypeOf<true>();
  });
});
