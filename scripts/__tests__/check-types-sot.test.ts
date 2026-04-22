import { describe, expect, it, vi } from "vitest";

import { runChecks, type CheckStep } from "../check-types-sot.js";

describe("runChecks", () => {
  it("runs each step in order and returns 0 on all-pass", async () => {
    const order: string[] = [];
    const steps: CheckStep[] = [
      {
        name: "a",
        run: async () => {
          order.push("a");
          return { ok: true, output: "" };
        },
      },
      {
        name: "b",
        run: async () => {
          order.push("b");
          return { ok: true, output: "" };
        },
      },
    ];
    const exitCode = await runChecks(steps);
    expect(exitCode).toBe(0);
    expect(order).toEqual(["a", "b"]);
  });

  it("short-circuits on first failure and returns 1", async () => {
    const order: string[] = [];
    const steps: CheckStep[] = [
      {
        name: "a",
        run: async () => {
          order.push("a");
          return { ok: false, output: "err-a" };
        },
      },
      {
        name: "b",
        run: async () => {
          order.push("b");
          return { ok: true, output: "" };
        },
      },
    ];
    const exitCode = await runChecks(steps);
    expect(exitCode).toBe(1);
    expect(order).toEqual(["a"]);
  });

  it("emits a summary line per step to stderr", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const steps: CheckStep[] = [
      {
        name: "typecheck-types",
        run: async () => ({ ok: true, output: "" }),
      },
    ];
    await runChecks(steps);
    const calls = spy.mock.calls.map((c) => String(c[0])).join("");
    expect(calls).toContain("typecheck-types");
    expect(calls).toMatch(/ok|pass/i);
    spy.mockRestore();
  });
});
