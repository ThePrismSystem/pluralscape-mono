import { createMappingContext } from "@pluralscape/import-core";
import { describe, expect, it } from "vitest";

import { mapSwitchBatch } from "../../mappers/switch.mapper.js";

import type { PkMappedFrontingSession } from "../../mappers/switch.mapper.js";
import type { BatchMapperOutput, SourceDocument } from "@pluralscape/import-core";

function makeSwitch(timestamp: string, members: readonly string[], id?: string): SourceDocument {
  return {
    sourceId: id ?? `sw-${timestamp}`,
    document: { timestamp, members },
  };
}

function payload(output: BatchMapperOutput): PkMappedFrontingSession {
  if (output.result.status !== "mapped") {
    throw new Error(`Expected mapped, got ${output.result.status}`);
  }
  return output.result.payload as PkMappedFrontingSession;
}

function findSession(
  sessions: readonly BatchMapperOutput[],
  memberId: string,
  startTime?: number,
): PkMappedFrontingSession {
  const match = sessions.find((s) => {
    const p = payload(s);
    if (p.memberId !== memberId) return false;
    return startTime === undefined || p.startTime === startTime;
  });
  if (match === undefined) {
    throw new Error(`No session found for memberId=${memberId}, startTime=${String(startTime)}`);
  }
  return payload(match);
}

function allSessions(
  sessions: readonly BatchMapperOutput[],
  memberId: string,
): PkMappedFrontingSession[] {
  return sessions
    .filter((s) => s.result.status === "mapped")
    .map((s) => payload(s))
    .filter((p) => p.memberId === memberId);
}

describe("mapSwitchBatch", () => {
  it("produces correct sessions from a simple sequence", () => {
    // [A]@T1 -> [A,B]@T2 -> [B]@T3 -> []@T4 -> [C]@T5
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");
    ctx.register("member", "B", "ps_B");
    ctx.register("member", "C", "ps_C");

    const t1 = "2024-01-01T00:00:00Z";
    const t2 = "2024-01-01T01:00:00Z";
    const t3 = "2024-01-01T02:00:00Z";
    const t4 = "2024-01-01T03:00:00Z";
    const t5 = "2024-01-01T04:00:00Z";

    const docs = [
      makeSwitch(t1, ["A"]),
      makeSwitch(t2, ["A", "B"]),
      makeSwitch(t3, ["B"]),
      makeSwitch(t4, []),
      makeSwitch(t5, ["C"]),
    ];

    const results = mapSwitchBatch(docs, ctx);
    const mapped = results.filter((r) => r.result.status === "mapped");

    // A: [T1, T3)
    const aSession = findSession(mapped, "ps_A", Date.parse(t1));
    expect(aSession.endTime).toBe(Date.parse(t3));

    // B: [T2, T4)
    const bSession = findSession(mapped, "ps_B", Date.parse(t2));
    expect(bSession.endTime).toBe(Date.parse(t4));

    // C: [T5, null)
    const cSession = findSession(mapped, "ps_C");
    expect(cSession.startTime).toBe(Date.parse(t5));
    expect(cSession.endTime).toBeNull();
  });

  it("produces active sessions for a single switch", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");
    ctx.register("member", "B", "ps_B");

    const t1 = "2024-06-15T12:00:00Z";
    const docs = [makeSwitch(t1, ["A", "B"])];
    const results = mapSwitchBatch(docs, ctx);
    const sessions = results.filter((r) => r.result.status === "mapped");

    expect(sessions).toHaveLength(2);
    for (const s of sessions) {
      const p = payload(s);
      expect(p.startTime).toBe(Date.parse(t1));
      expect(p.endTime).toBeNull();
    }
  });

  it("closes all sessions when an empty switch occurs", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");

    const t1 = "2024-01-01T00:00:00Z";
    const t2 = "2024-01-01T01:00:00Z";

    const docs = [makeSwitch(t1, ["A"]), makeSwitch(t2, [])];
    const results = mapSwitchBatch(docs, ctx);
    const sessions = results.filter((r) => r.result.status === "mapped");

    expect(sessions).toHaveLength(1);
    const session = findSession(sessions, "ps_A");
    expect(session.startTime).toBe(Date.parse(t1));
    expect(session.endTime).toBe(Date.parse(t2));
  });

  it("handles rapid-fire switches within one second", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");
    ctx.register("member", "B", "ps_B");
    ctx.register("member", "C", "ps_C");

    const t1 = "2024-01-01T12:00:00.000Z";
    const t2 = "2024-01-01T12:00:00.300Z";
    const t3 = "2024-01-01T12:00:00.700Z";

    const docs = [makeSwitch(t1, ["A"]), makeSwitch(t2, ["B"]), makeSwitch(t3, ["C"])];
    const results = mapSwitchBatch(docs, ctx);
    const sessions = results.filter((r) => r.result.status === "mapped");

    // A: [T1, T2), B: [T2, T3), C: [T3, null)
    const aSession = findSession(sessions, "ps_A");
    expect(aSession.endTime).toBe(Date.parse(t2));

    const bSession = findSession(sessions, "ps_B");
    expect(bSession.endTime).toBe(Date.parse(t3));

    const cSession = findSession(sessions, "ps_C");
    expect(cSession.endTime).toBeNull();
  });

  it("handles member reappearance across non-adjacent switches", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");
    ctx.register("member", "B", "ps_B");

    const t1 = "2024-01-01T00:00:00Z";
    const t2 = "2024-01-01T01:00:00Z";
    const t3 = "2024-01-01T02:00:00Z";

    const docs = [makeSwitch(t1, ["A"]), makeSwitch(t2, ["B"]), makeSwitch(t3, ["A"])];
    const results = mapSwitchBatch(docs, ctx);

    // A appears twice: [T1,T2) and [T3,null)
    const aSessions = allSessions(results, "ps_A");
    expect(aSessions).toHaveLength(2);
    expect(aSessions[0]?.endTime).toBe(Date.parse(t2));
    expect(aSessions[1]?.endTime).toBeNull();
  });

  it("emits a warning and skips unknown member IDs", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");
    // "B" is NOT registered

    const t1 = "2024-01-01T00:00:00Z";
    const docs = [makeSwitch(t1, ["A", "B"])];
    const results = mapSwitchBatch(docs, ctx);
    const sessions = results.filter((r) => r.result.status === "mapped");

    // Only A gets a session
    expect(sessions).toHaveLength(1);
    const session = findSession(sessions, "ps_A");
    expect(session.startTime).toBe(Date.parse(t1));
    expect(ctx.warnings.some((w) => w.message.includes("B"))).toBe(true);
  });

  it("returns empty output for no switches", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    const results = mapSwitchBatch([], ctx);
    expect(results).toEqual([]);
  });

  it("processes duplicate timestamps in array order", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");
    ctx.register("member", "B", "ps_B");

    const t1 = "2024-01-01T12:00:00Z";
    // Two switches at the same timestamp — second one wins
    const docs = [makeSwitch(t1, ["A"], "sw-1"), makeSwitch(t1, ["B"], "sw-2")];
    const results = mapSwitchBatch(docs, ctx);
    const sessions = results.filter((r) => r.result.status === "mapped");

    // A: [T1, T1+1ms) — closed immediately by the second switch; bumped by 1 ms
    // to avoid zero-duration rejection by the API
    const aSession = findSession(sessions, "ps_A");
    expect(aSession.startTime).toBe(Date.parse(t1));
    expect(aSession.endTime).toBe(Date.parse(t1) + 1);

    // B: [T1, null) — still active
    const bSession = findSession(sessions, "ps_B");
    expect(bSession.endTime).toBeNull();
  });

  it("sets customFrontId and structureEntityId to undefined on every session", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");

    const docs = [makeSwitch("2024-01-01T00:00:00Z", ["A"])];
    const results = mapSwitchBatch(docs, ctx);
    const sessions = results.filter((r) => r.result.status === "mapped");

    expect(sessions).toHaveLength(1);
    const first = sessions[0];
    const p = payload(first as BatchMapperOutput);
    expect(p.customFrontId).toBeUndefined();
    expect(p.structureEntityId).toBeUndefined();
  });

  it("generates deterministic sourceEntityId from memberId and startTime", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");

    const t1 = "2024-01-01T00:00:00Z";
    const docs = [makeSwitch(t1, ["A"])];
    const results = mapSwitchBatch(docs, ctx);

    expect(results).toHaveLength(1);
    const first = results[0];
    if (first !== undefined) {
      expect(first.sourceEntityId).toBe(`session:A:${String(Date.parse(t1))}`);
    }
  });

  it("skips switches with invalid documents and emits warning", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");

    const validTimestamp = "2024-01-01T00:00:00Z";
    const docs: SourceDocument[] = [
      { sourceId: "sw-bad", document: { timestamp: "not-a-date", members: ["A"] } },
      makeSwitch(validTimestamp, ["A"]),
    ];
    const results = mapSwitchBatch(docs, ctx);
    const sessions = results.filter((r) => r.result.status === "mapped");

    // Only the valid switch produces a session
    expect(sessions).toHaveLength(1);
    const session = findSession(sessions, "ps_A");
    expect(session.startTime).toBe(Date.parse(validTimestamp));
    expect(session.endTime).toBeNull();

    // Warning emitted for the invalid doc
    expect(ctx.warnings.some((w) => w.entityId === "sw-bad")).toBe(true);
  });

  it("sorts unsorted switches by timestamp before processing", () => {
    const ctx = createMappingContext({ sourceMode: "fake" });
    ctx.register("member", "A", "ps_A");
    ctx.register("member", "B", "ps_B");

    const t1 = "2024-01-01T00:00:00Z";
    const t2 = "2024-01-01T01:00:00Z";

    // Provide in reverse order
    const docs = [makeSwitch(t2, ["B"]), makeSwitch(t1, ["A"])];
    const results = mapSwitchBatch(docs, ctx);
    const sessions = results.filter((r) => r.result.status === "mapped");

    // A: [T1, T2), B: [T2, null)
    const aSession = findSession(sessions, "ps_A");
    expect(aSession.startTime).toBe(Date.parse(t1));
    expect(aSession.endTime).toBe(Date.parse(t2));
  });
});
