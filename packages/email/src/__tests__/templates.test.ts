import { describe, expect, it } from "vitest";

import { escapeHtml } from "../templates/base-layout.js";
import { renderTemplate } from "../templates/render.js";

describe("renderTemplate", () => {
  describe("recovery-key-regenerated", () => {
    const vars = {
      timestamp: "2026-03-29T12:00:00Z",
      deviceInfo: "Chrome on macOS",
    } as const;

    it("returns subject, html, and text", () => {
      const result = renderTemplate("recovery-key-regenerated", vars);
      expect(result.subject).toBe("Your recovery key was regenerated");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("includes timestamp in html", () => {
      const result = renderTemplate("recovery-key-regenerated", vars);
      expect(result.html).toContain(vars.timestamp);
    });

    it("includes device info in html", () => {
      const result = renderTemplate("recovery-key-regenerated", vars);
      expect(result.html).toContain(vars.deviceInfo);
    });

    it("includes timestamp in text", () => {
      const result = renderTemplate("recovery-key-regenerated", vars);
      expect(result.text).toContain(vars.timestamp);
    });

    it("includes device info in text", () => {
      const result = renderTemplate("recovery-key-regenerated", vars);
      expect(result.text).toContain(vars.deviceInfo);
    });

    it("includes security guidance in text", () => {
      const result = renderTemplate("recovery-key-regenerated", vars);
      expect(result.text).toContain("If you did not");
    });
  });

  describe("new-device-login", () => {
    const vars = {
      timestamp: "2026-03-29T14:30:00Z",
      deviceInfo: "Firefox on Linux",
      ipAddress: "192.168.1.42",
    } as const;

    it("returns subject, html, and text", () => {
      const result = renderTemplate("new-device-login", vars);
      expect(result.subject).toBe("New device login detected");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("includes all variables in html", () => {
      const result = renderTemplate("new-device-login", vars);
      expect(result.html).toContain(vars.timestamp);
      expect(result.html).toContain(vars.deviceInfo);
      expect(result.html).toContain(vars.ipAddress);
    });

    it("includes all variables in text", () => {
      const result = renderTemplate("new-device-login", vars);
      expect(result.text).toContain(vars.timestamp);
      expect(result.text).toContain(vars.deviceInfo);
      expect(result.text).toContain(vars.ipAddress);
    });
  });

  describe("password-changed", () => {
    const vars = { timestamp: "2026-03-29T16:00:00Z" } as const;

    it("returns subject, html, and text", () => {
      const result = renderTemplate("password-changed", vars);
      expect(result.subject).toBe("Your password was changed");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("includes timestamp in both formats", () => {
      const result = renderTemplate("password-changed", vars);
      expect(result.html).toContain(vars.timestamp);
      expect(result.text).toContain(vars.timestamp);
    });

    it("includes security guidance", () => {
      const result = renderTemplate("password-changed", vars);
      expect(result.text).toContain("If you did not");
      expect(result.text).toContain("recovery key");
    });
  });

  describe("two-factor-changed", () => {
    it("handles enabled action", () => {
      const result = renderTemplate("two-factor-changed", {
        timestamp: "2026-03-29T18:00:00Z",
        action: "enabled",
      });
      expect(result.subject).toBe("Two-factor authentication settings changed");
      expect(result.html).toContain("enabled");
      expect(result.text).toContain("enabled");
    });

    it("handles disabled action", () => {
      const result = renderTemplate("two-factor-changed", {
        timestamp: "2026-03-29T18:00:00Z",
        action: "disabled",
      });
      expect(result.html).toContain("disabled");
      expect(result.text).toContain("disabled");
    });

    it("handles method-changed action", () => {
      const result = renderTemplate("two-factor-changed", {
        timestamp: "2026-03-29T18:00:00Z",
        action: "method-changed",
      });
      expect(result.html).toContain("changed to a different method");
      expect(result.text).toContain("changed to a different method");
    });

    it("includes timestamp", () => {
      const ts = "2026-03-29T18:00:00Z";
      const result = renderTemplate("two-factor-changed", {
        timestamp: ts,
        action: "enabled",
      });
      expect(result.html).toContain(ts);
      expect(result.text).toContain(ts);
    });
  });

  describe("webhook-failure-digest", () => {
    const vars = {
      webhookUrl: "https://example.com/webhook",
      failureCount: 42,
      lastError: "Connection timeout",
      timeRangeStart: "2026-03-28T00:00:00Z",
      timeRangeEnd: "2026-03-29T00:00:00Z",
    } as const;

    it("returns subject, html, and text", () => {
      const result = renderTemplate("webhook-failure-digest", vars);
      expect(result.subject).toBe("Webhook delivery failures detected");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("includes all variables in html", () => {
      const result = renderTemplate("webhook-failure-digest", vars);
      expect(result.html).toContain(vars.webhookUrl);
      expect(result.html).toContain(String(vars.failureCount));
      expect(result.html).toContain(vars.lastError);
      expect(result.html).toContain(vars.timeRangeStart);
      expect(result.html).toContain(vars.timeRangeEnd);
    });

    it("includes all variables in text", () => {
      const result = renderTemplate("webhook-failure-digest", vars);
      expect(result.text).toContain(vars.webhookUrl);
      expect(result.text).toContain(String(vars.failureCount));
      expect(result.text).toContain(vars.lastError);
      expect(result.text).toContain(vars.timeRangeStart);
      expect(result.text).toContain(vars.timeRangeEnd);
    });
  });

  describe("account-change-email", () => {
    const vars = {
      oldEmail: "old@example.com",
      newEmail: "new@example.com",
      timestamp: "2026-04-17T12:00:00Z",
    } as const;

    it("returns subject, html, and text", () => {
      const result = renderTemplate("account-change-email", vars);
      expect(result.subject).toBe("Your Pluralscape account email was changed");
      expect(typeof result.html).toBe("string");
      expect(typeof result.text).toBe("string");
    });

    it("includes old and new email in html", () => {
      const result = renderTemplate("account-change-email", vars);
      expect(result.html).toContain(vars.oldEmail);
      expect(result.html).toContain(vars.newEmail);
    });

    it("includes timestamp in html and text", () => {
      const result = renderTemplate("account-change-email", vars);
      expect(result.html).toContain(vars.timestamp);
      expect(result.text).toContain(vars.timestamp);
    });

    it("includes old and new email in text", () => {
      const result = renderTemplate("account-change-email", vars);
      expect(result.text).toContain(vars.oldEmail);
      expect(result.text).toContain(vars.newEmail);
    });

    it("includes security guidance in text", () => {
      const result = renderTemplate("account-change-email", vars);
      expect(result.text).toContain("If you did not");
      expect(result.text).toContain("recovery key");
    });

    it("omits IP line when ipAddress not provided", () => {
      const result = renderTemplate("account-change-email", vars);
      expect(result.html).not.toContain("Request IP");
      expect(result.text).not.toContain("Request IP");
    });

    it("includes IP line when ipAddress provided", () => {
      const result = renderTemplate("account-change-email", {
        ...vars,
        ipAddress: "203.0.113.42",
      });
      expect(result.html).toContain("Request IP");
      expect(result.html).toContain("203.0.113.42");
      expect(result.text).toContain("Request IP");
      expect(result.text).toContain("203.0.113.42");
    });

    it("escapes HTML in email addresses (XSS prevention)", () => {
      const result = renderTemplate("account-change-email", {
        oldEmail: "<script>alert(1)</script>@old.example",
        newEmail: '"><img src=x onerror=alert(1)>@new.example',
        timestamp: "2026-04-17T12:00:00Z",
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).not.toContain("<img");
      expect(result.html).toContain("&lt;script&gt;");
      expect(result.html).toContain("&lt;img");
    });

    it("escapes HTML in ipAddress (XSS prevention)", () => {
      const result = renderTemplate("account-change-email", {
        ...vars,
        ipAddress: '<img src=x onerror="alert(1)">',
      });
      expect(result.html).not.toContain("<img");
      expect(result.html).toContain("&lt;img");
    });
  });

  describe("base layout", () => {
    it("wraps html in a full document", () => {
      const result = renderTemplate("password-changed", { timestamp: "now" });
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("</html>");
    });

    it("includes Pluralscape branding", () => {
      const result = renderTemplate("password-changed", { timestamp: "now" });
      expect(result.html).toContain("Pluralscape");
    });

    it("includes responsive viewport meta tag", () => {
      const result = renderTemplate("password-changed", { timestamp: "now" });
      expect(result.html).toContain('name="viewport"');
    });

    it("includes automated message footer", () => {
      const result = renderTemplate("password-changed", { timestamp: "now" });
      expect(result.html).toContain("automated message");
    });
  });

  describe("escapeHtml", () => {
    it("escapes ampersand", () => {
      expect(escapeHtml("a&b")).toBe("a&amp;b");
    });

    it("escapes less-than", () => {
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    });

    it("escapes double quotes", () => {
      expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
    });

    it("escapes single quotes", () => {
      expect(escapeHtml("it's")).toBe("it&#x27;s");
    });

    it("handles strings with no special characters", () => {
      expect(escapeHtml("hello world")).toBe("hello world");
    });

    it("handles empty string", () => {
      expect(escapeHtml("")).toBe("");
    });
  });

  describe("XSS prevention", () => {
    it("escapes HTML in template variables", () => {
      const result = renderTemplate("password-changed", {
        timestamp: '<script>alert("xss")</script>',
      });
      expect(result.html).not.toContain("<script>");
      expect(result.html).toContain("&lt;script&gt;");
    });

    it("escapes HTML in device info", () => {
      const result = renderTemplate("new-device-login", {
        timestamp: "now",
        deviceInfo: '<img onerror="alert(1)" src="x">',
        ipAddress: "127.0.0.1",
      });
      expect(result.html).not.toContain("<img");
      expect(result.html).toContain("&lt;img");
    });
  });
});
