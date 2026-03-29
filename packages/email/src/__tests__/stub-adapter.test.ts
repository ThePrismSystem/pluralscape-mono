import { describe, expect, it } from "vitest";

import { StubEmailAdapter } from "../adapters/stub.js";

import { runEmailAdapterContract } from "./email-adapter.contract.js";

describe("StubEmailAdapter", () => {
  runEmailAdapterContract(() => new StubEmailAdapter());

  it("has providerName 'stub'", () => {
    const adapter = new StubEmailAdapter();
    expect(adapter.providerName).toBe("stub");
  });

  it("returns null messageId", async () => {
    const adapter = new StubEmailAdapter();
    const result = await adapter.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(result.messageId).toBeNull();
  });
});
