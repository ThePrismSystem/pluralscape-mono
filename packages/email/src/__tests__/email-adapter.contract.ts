/**
 * Contract test suite for EmailAdapter implementations.
 *
 * Usage:
 *   import { runEmailAdapterContract } from "./email-adapter.contract.js";
 *   runEmailAdapterContract(() => new YourEmailAdapter());
 *
 * The factory function is called before each test to produce a fresh adapter.
 */
import { describe, expect, it } from "vitest";

import type { EmailAdapter } from "../interface.js";

function makeTestParams() {
  return {
    to: "test@example.com",
    subject: "Test Subject",
    html: "<p>Hello</p>",
    text: "Hello",
  } as const;
}

export function runEmailAdapterContract(factory: () => EmailAdapter): void {
  describe("EmailAdapter contract", () => {
    // ── 1. providerName ─────────────────────────────────────────────
    describe("providerName", () => {
      it("returns a non-empty string", () => {
        const adapter = factory();
        expect(typeof adapter.providerName).toBe("string");
        expect(adapter.providerName.length).toBeGreaterThan(0);
      });
    });

    // ── 2. send — basic ─────────────────────────────────────────────
    describe("send", () => {
      it("returns a result with messageId (string or null)", async () => {
        const adapter = factory();
        const result = await adapter.send(makeTestParams());
        expect(result).toHaveProperty("messageId");
        const id = result.messageId;
        expect(id === null || typeof id === "string").toBe(true);
      });

      it("accepts a single recipient string", async () => {
        const adapter = factory();
        const result = await adapter.send(makeTestParams());
        expect(result).toBeDefined();
      });

      it("accepts an array of recipients", async () => {
        const adapter = factory();
        const result = await adapter.send({
          ...makeTestParams(),
          to: ["a@example.com", "b@example.com"],
        });
        expect(result).toBeDefined();
      });

      it("accepts optional from and replyTo", async () => {
        const adapter = factory();
        const result = await adapter.send({
          ...makeTestParams(),
          from: "custom@example.com",
          replyTo: "reply@example.com",
        });
        expect(result).toBeDefined();
      });
    });

    // ── 3. send — idempotent interface ──────────────────────────────
    describe("send — multiple calls", () => {
      it("can send multiple emails sequentially", async () => {
        const adapter = factory();
        const result1 = await adapter.send(makeTestParams());
        const result2 = await adapter.send({
          ...makeTestParams(),
          subject: "Second Email",
        });
        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
      });
    });
  });
}
