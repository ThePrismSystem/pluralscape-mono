import type { QueueHealthSummary } from "./health.js";

export interface AlertConfig {
  /** Alert when dead-letter queue depth reaches or exceeds this value. */
  dlqDepthThreshold?: number;
  /** Alert when stalled job count reaches or exceeds this value. */
  stalledJobThreshold?: number;
  onAlert: (message: string, data: Record<string, unknown>) => void;
}

/** Checks health summary against thresholds and fires alerts for any violations. */
export function checkAlerts(summary: QueueHealthSummary, config: AlertConfig): void {
  const { dlqDepthThreshold, stalledJobThreshold, onAlert } = config;

  if (dlqDepthThreshold !== undefined && summary.dlqDepth >= dlqDepthThreshold) {
    onAlert("DLQ depth threshold exceeded", {
      dlqDepth: summary.dlqDepth,
      threshold: dlqDepthThreshold,
    });
  }

  if (stalledJobThreshold !== undefined && summary.stalledCount >= stalledJobThreshold) {
    onAlert("Stalled job threshold exceeded", {
      stalledCount: summary.stalledCount,
      threshold: stalledJobThreshold,
    });
  }
}
