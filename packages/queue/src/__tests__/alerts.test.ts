import { describe, expect, it, vi } from "vitest";

import { checkAlerts } from "../observability/alerts.js";

import type { QueueHealthSummary } from "../observability/health.js";
import type { UnixMillis } from "@pluralscape/types";

function makeSummary(overrides: Partial<QueueHealthSummary> = {}): QueueHealthSummary {
  return {
    timestamp: 1000 as UnixMillis,
    pendingCount: 0,
    runningCount: 0,
    dlqDepth: 0,
    stalledCount: 0,
    isWorkerRunning: false,
    metrics: {
      totalEnqueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalDeadLettered: 0,
      byType: {},
    },
    errors: [],
    ...overrides,
  };
}

describe("checkAlerts", () => {
  it("does not fire when DLQ depth is below threshold", () => {
    const onAlert = vi.fn();
    checkAlerts(makeSummary({ dlqDepth: 4 }), { dlqDepthThreshold: 5, onAlert });
    expect(onAlert).not.toHaveBeenCalled();
  });

  it("fires when DLQ depth reaches threshold", () => {
    const onAlert = vi.fn();
    checkAlerts(makeSummary({ dlqDepth: 5 }), { dlqDepthThreshold: 5, onAlert });
    expect(onAlert).toHaveBeenCalledOnce();
    expect(onAlert).toHaveBeenCalledWith(
      "DLQ depth threshold exceeded",
      expect.objectContaining({ dlqDepth: 5, threshold: 5 }),
    );
  });

  it("does not fire when stalled count is below threshold", () => {
    const onAlert = vi.fn();
    checkAlerts(makeSummary({ stalledCount: 2 }), { stalledJobThreshold: 3, onAlert });
    expect(onAlert).not.toHaveBeenCalled();
  });

  it("fires when stalled count reaches threshold", () => {
    const onAlert = vi.fn();
    checkAlerts(makeSummary({ stalledCount: 3 }), { stalledJobThreshold: 3, onAlert });
    expect(onAlert).toHaveBeenCalledOnce();
    expect(onAlert).toHaveBeenCalledWith(
      "Stalled job threshold exceeded",
      expect.objectContaining({ stalledCount: 3, threshold: 3 }),
    );
  });

  it("fires both alerts when both thresholds are breached", () => {
    const onAlert = vi.fn();
    checkAlerts(makeSummary({ dlqDepth: 10, stalledCount: 5 }), {
      dlqDepthThreshold: 5,
      stalledJobThreshold: 3,
      onAlert,
    });
    expect(onAlert).toHaveBeenCalledTimes(2);
  });

  it("does not fire when no thresholds are configured", () => {
    const onAlert = vi.fn();
    checkAlerts(makeSummary({ dlqDepth: 100, stalledCount: 50 }), { onAlert });
    expect(onAlert).not.toHaveBeenCalled();
  });
});
