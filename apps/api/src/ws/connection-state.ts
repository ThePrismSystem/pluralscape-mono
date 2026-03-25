import type { SlidingWindowCounter } from "./sliding-window-counter.js";
import type { AuthContext } from "../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { WSContext } from "hono/ws";

/** Valid replication profile types (single source of truth). */
export const PROFILE_TYPES = ["owner-full", "owner-lite", "friend"] as const;

/** Replication profile types from the sync protocol. */
export type ProfileType = (typeof PROFILE_TYPES)[number];

/** Shared fields across all connection phases. */
interface ConnectionBase {
  readonly connectionId: string;
  readonly ws: WSContext;
  readonly connectedAt: number;
  /** Client IP for per-IP unauthenticated connection limiting (ephemeral, never persisted). */
  readonly clientIp: string | undefined;
  readonly subscribedDocs: Set<string>;
  readonly mutationWindow: SlidingWindowCounter;
  readonly readWindow: SlidingWindowCounter;
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
  readonly systemId: SystemId;
  readonly profileType: ProfileType;
}

/** Discriminated union of all connection phases. */
export type SyncConnectionState = AwaitingAuthState | AuthenticatedState;

/** Connection lifecycle phases (derived from the union). */
export type ConnectionPhase = SyncConnectionState["phase"];
