import { describe, expect, it } from "vitest";

import { InMemoryEmailAdapter } from "../adapters/in-memory.js";

import { runEmailAdapterContract } from "./email-adapter.contract.js";

describe("InMemoryEmailAdapter", () => {
  runEmailAdapterContract(() => new InMemoryEmailAdapter());

  it("has providerName 'in-memory'", () => {
    const adapter = new InMemoryEmailAdapter();
    expect(adapter.providerName).toBe("in-memory");
  });

  it("returns a non-null messageId", async () => {
    const adapter = new InMemoryEmailAdapter();
    const result = await adapter.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(result.messageId).not.toBeNull();
    expect(typeof result.messageId).toBe("string");
  });

  it("captures sent emails in the sent array", async () => {
    const adapter = new InMemoryEmailAdapter();
    expect(adapter.sentCount).toBe(0);
    expect(adapter.sent).toHaveLength(0);

    await adapter.send({
      to: "a@example.com",
      subject: "First",
      html: "<p>1</p>",
      text: "1",
    });

    expect(adapter.sentCount).toBe(1);
    expect(adapter.sent[0]?.to).toBe("a@example.com");
    expect(adapter.sent[0]?.subject).toBe("First");
  });

  it("captures from and replyTo when provided", async () => {
    const adapter = new InMemoryEmailAdapter();
    await adapter.send({
      to: "b@example.com",
      subject: "With sender",
      html: "<p>Hi</p>",
      text: "Hi",
      from: "custom@example.com",
      replyTo: "reply@example.com",
    });

    expect(adapter.lastSent?.from).toBe("custom@example.com");
    expect(adapter.lastSent?.replyTo).toBe("reply@example.com");
  });

  it("stores from and replyTo as undefined when not provided", async () => {
    const adapter = new InMemoryEmailAdapter();
    await adapter.send({
      to: "c@example.com",
      subject: "No sender",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(adapter.lastSent?.from).toBeUndefined();
    expect(adapter.lastSent?.replyTo).toBeUndefined();
  });

  it("lastSent returns the most recent email", async () => {
    const adapter = new InMemoryEmailAdapter();
    await adapter.send({
      to: "a@example.com",
      subject: "First",
      html: "<p>1</p>",
      text: "1",
    });
    await adapter.send({
      to: "b@example.com",
      subject: "Second",
      html: "<p>2</p>",
      text: "2",
    });

    expect(adapter.lastSent?.subject).toBe("Second");
    expect(adapter.sentCount).toBe(2);
  });

  it("lastSent returns undefined when no emails sent", () => {
    const adapter = new InMemoryEmailAdapter();
    expect(adapter.lastSent).toBeUndefined();
  });

  it("clear removes all sent emails", async () => {
    const adapter = new InMemoryEmailAdapter();
    await adapter.send({
      to: "a@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(adapter.sentCount).toBe(1);

    adapter.clear();
    expect(adapter.sentCount).toBe(0);
    expect(adapter.sent).toHaveLength(0);
    expect(adapter.lastSent).toBeUndefined();
  });

  it("records sentAt timestamp", async () => {
    const adapter = new InMemoryEmailAdapter();
    const before = new Date();
    await adapter.send({
      to: "a@example.com",
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    const after = new Date();

    const last = adapter.lastSent;
    expect(last).toBeDefined();
    if (last === undefined) return;
    expect(last.sentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(last.sentAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("preserves array recipients", async () => {
    const adapter = new InMemoryEmailAdapter();
    const recipients = ["a@example.com", "b@example.com"];
    await adapter.send({
      to: recipients,
      subject: "Multi",
      html: "<p>Hi</p>",
      text: "Hi",
    });

    expect(adapter.lastSent?.to).toEqual(recipients);
  });
});
