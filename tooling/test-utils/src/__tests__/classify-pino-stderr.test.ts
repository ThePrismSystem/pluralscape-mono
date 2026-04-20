import { describe, expect, it } from "vitest";

import { createStderrClassifier } from "../e2e/classify-pino-stderr.js";

describe("createStderrClassifier", () => {
  it("forwards valid pino ERROR (level:50) JSON lines", () => {
    const classifier = createStderrClassifier();
    const line = `{"level":50,"time":1,"msg":"boom"}`;
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe(`${line}\n`);
    expect(result.tailLines).toEqual([line]);
  });

  it("forwards valid pino FATAL (level:60) JSON lines", () => {
    const classifier = createStderrClassifier();
    const line = `{"level":60,"time":1,"msg":"dead"}`;
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe(`${line}\n`);
    expect(result.tailLines).toEqual([line]);
  });

  it("suppresses low-level pino (level:30 INFO) JSON lines", () => {
    const classifier = createStderrClassifier();
    const line = `{"level":30,"time":1,"msg":"starting up"}`;
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe("");
    // Still captured in tail for diagnostic purposes
    expect(result.tailLines).toEqual([line]);
  });

  it('forwards a pino ERROR whose msg contains the literal string "level":50', () => {
    // Regression: old classifier used line.includes('"level":50') on
    // the WHOLE line, so a true ERROR whose msg embedded that substring
    // in a *different* context would still suppress. Worse: a DEBUG whose
    // msg contained "level":50 would be force-forwarded. Parse-based
    // classification on the outer level field must be unaffected by
    // msg content.
    const classifier = createStderrClassifier();
    const line = `{"level":50,"msg":"query failed: WHERE \\"level\\":50"}`;
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe(`${line}\n`);
  });

  it('suppresses level:30 even when the msg contains the literal string "level":50', () => {
    // The dangerous inverse of the above: old code would FORWARD this
    // low-level line because the chunk-level `.includes('"level":50')`
    // short-circuited the suppression branch. New classifier must
    // look at the outer level field only.
    const classifier = createStderrClassifier();
    const line = `{"level":30,"msg":"received request with level:50 tag"}`;
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe("");
    expect(result.tailLines).toEqual([line]);
  });

  it("forwards non-JSON lines (Bun EADDRINUSE / raw stderr)", () => {
    const classifier = createStderrClassifier();
    const line = "error: listen EADDRINUSE: address already in use 0.0.0.0:10099";
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe(`${line}\n`);
    expect(result.tailLines).toEqual([line]);
  });

  it("forwards JSON without a level field (unknown structured output)", () => {
    const classifier = createStderrClassifier();
    const line = `{"msg":"no level here"}`;
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe(`${line}\n`);
  });

  it("forwards JSON where level is non-numeric (unknown shape)", () => {
    const classifier = createStderrClassifier();
    const line = `{"level":"info","msg":"string level"}`;
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe(`${line}\n`);
  });

  it("buffers a JSON line split across two chunks and emits it on completion", () => {
    const classifier = createStderrClassifier();
    const first = classifier.process(`{"level":50,"msg":"par`);
    expect(first.forwarded).toBe("");
    expect(first.tailLines).toEqual([]);

    const second = classifier.process(`tial"}\n`);
    expect(second.forwarded).toBe(`{"level":50,"msg":"partial"}\n`);
    expect(second.tailLines).toEqual([`{"level":50,"msg":"partial"}`]);
  });

  it("classifies mixed chunk with pino INFO line and raw Bun error correctly", () => {
    // Original bug: classifier ran on the entire chunk; a raw error
    // sharing a `data` event with a pino INFO got suppressed because
    // the whole chunk matched the low-level pino regex.
    const classifier = createStderrClassifier();
    const input = [
      `{"level":30,"msg":"starting"}`,
      `error: listen EADDRINUSE: 0.0.0.0:10099`,
      "",
    ].join("\n");
    const result = classifier.process(input);
    // INFO suppressed, raw error forwarded
    expect(result.forwarded).toBe(`error: listen EADDRINUSE: 0.0.0.0:10099\n`);
    expect(result.tailLines).toEqual([
      `{"level":30,"msg":"starting"}`,
      `error: listen EADDRINUSE: 0.0.0.0:10099`,
    ]);
  });

  it("applies the configured prefix to forwarded lines only", () => {
    const classifier = createStderrClassifier({ prefix: "[api-e2e] " });
    const line = `error: something broke`;
    const result = classifier.process(`${line}\n`);
    expect(result.forwarded).toBe(`[api-e2e] ${line}\n`);
    // Tail captures the raw line without the display prefix
    expect(result.tailLines).toEqual([line]);
  });

  it("skips empty lines introduced by trailing \\n", () => {
    const classifier = createStderrClassifier();
    const result = classifier.process(`\n\n`);
    expect(result.forwarded).toBe("");
    expect(result.tailLines).toEqual([]);
  });

  it("flush() emits any trailing partial line", () => {
    const classifier = createStderrClassifier();
    const partial = classifier.process(`error: unterminated`);
    expect(partial.forwarded).toBe("");
    expect(partial.tailLines).toEqual([]);

    const flushed = classifier.flush();
    expect(flushed.forwarded).toBe(`error: unterminated\n`);
    expect(flushed.tailLines).toEqual([`error: unterminated`]);
  });

  it("flush() is a no-op when the buffer is empty", () => {
    const classifier = createStderrClassifier();
    classifier.process(`complete\n`);
    const flushed = classifier.flush();
    expect(flushed.forwarded).toBe("");
    expect(flushed.tailLines).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const classifier = createStderrClassifier();
    const result = classifier.process(`error: windows\r\n`);
    expect(result.forwarded).toBe(`error: windows\n`);
    expect(result.tailLines).toEqual([`error: windows`]);
  });

  it("emits only fully-terminated lines even when the last line is incomplete", () => {
    const classifier = createStderrClassifier();
    const result = classifier.process(`first\nsecond incomplete`);
    expect(result.forwarded).toBe(`first\n`);
    expect(result.tailLines).toEqual([`first`]);
    const flushed = classifier.flush();
    expect(flushed.forwarded).toBe(`second incomplete\n`);
  });
});
