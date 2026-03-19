import type { AuthContext } from "../lib/auth-context.js";
import type { WSContext } from "hono/ws";

/** Replication profile types from the sync protocol. */
export type ProfileType = "owner-full" | "owner-lite" | "friend";

/** Shared fields across all connection phases. */
interface ConnectionBase {
  readonly connectionId: string;
  readonly ws: WSContext;
  readonly connectedAt: number;
  subscribedDocs: Set<string>;
  mutationCount: number;
  mutationWindowStart: number;
  mutationPreviousCount: number;
  readCount: number;
  readWindowStart: number;
  readPreviousCount: number;
  rateLimitStrikes: number;
  authTimeoutHandle: ReturnType<typeof setTimeout> | null;
}

/** Connection waiting for AuthenticateRequest. */
export interface AwaitingAuthState extends ConnectionBase {
  readonly phase: "awaiting-auth";
  readonly auth: null;
  readonly systemId: null;
  readonly profileType: null;
}

/** Successfully authenticated connection. */
export interface AuthenticatedState extends ConnectionBase {
  readonly phase: "authenticated";
  readonly auth: AuthContext;
  readonly systemId: string;
  readonly profileType: ProfileType;
}

/** Connection in the process of closing. */
export interface ClosingState extends ConnectionBase {
  readonly phase: "closing";
  readonly auth: AuthContext | null;
  readonly systemId: string | null;
  readonly profileType: ProfileType | null;
}

/** Discriminated union of all connection phases. */
export type SyncConnectionState = AwaitingAuthState | AuthenticatedState | ClosingState;

/** Connection lifecycle phases (derived from the union). */
export type ConnectionPhase = SyncConnectionState["phase"];
