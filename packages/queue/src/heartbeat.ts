/**
 * Handle for emitting heartbeats from within a running job handler.
 *
 * The worker creates a HeartbeatHandle per job and passes it via JobHandlerContext.
 * Calling heartbeat() updates the job's lastHeartbeatAt timestamp, preventing
 * the job from being classified as stalled by findStalledJobs().
 */
export interface HeartbeatHandle {
  /** Emits a heartbeat for the running job. Safe to call from async handlers. */
  heartbeat(): Promise<void>;
}
