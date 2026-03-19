import type { AuthContext } from "../lib/auth-context.js";
import type { WSContext } from "hono/ws";

/** Connection lifecycle phases (state machine). */
export type ConnectionPhase = "awaiting-auth" | "authenticated" | "closing";

/** Replication profile types from the sync protocol. */
export type ProfileType = "owner-full" | "owner-lite" | "friend";

/** Server-side state for a single WebSocket connection. */
export interface SyncConnectionState {
  readonly connectionId: string;
  readonly ws: WSContext;
  readonly connectedAt: number;
  phase: ConnectionPhase;
  auth: AuthContext | null;
  systemId: string | null;
  profileType: ProfileType | null;
  subscribedDocs: Set<string>;
  mutationCount: number;
  mutationWindowStart: number;
  readCount: number;
  readWindowStart: number;
  rateLimitStrikes: number;
  authTimeoutHandle: ReturnType<typeof setTimeout> | null;
}
