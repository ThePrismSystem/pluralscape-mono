import type {
  AuthCredentials,
  AuthEvent,
  AuthListener,
  AuthSession,
  AuthStateSnapshot,
} from "./auth-types.js";
import type { KdfMasterKey } from "@pluralscape/crypto";

type InternalState =
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "locked"; readonly credentials: AuthCredentials }
  | {
      readonly kind: "unlocked";
      readonly credentials: AuthCredentials;
      readonly masterKey: KdfMasterKey;
      readonly identityKeys: AuthSession["identityKeys"];
    };

function buildSnapshot(internal: InternalState): AuthStateSnapshot {
  switch (internal.kind) {
    case "unauthenticated":
      return { state: "unauthenticated", session: null, credentials: null };

    case "locked":
      return { state: "locked", session: null, credentials: internal.credentials };

    case "unlocked": {
      const session: AuthSession = {
        credentials: internal.credentials,
        masterKey: internal.masterKey,
        identityKeys: internal.identityKeys,
      };
      return { state: "unlocked", session, credentials: internal.credentials };
    }

    default: {
      const _exhaustive: never = internal;
      throw new Error(`Unhandled state: ${(_exhaustive as InternalState).kind}`);
    }
  }
}

/**
 * Pure, framework-agnostic auth state machine.
 *
 * The snapshot returned by `getSnapshot()` is referentially stable between
 * dispatches — a new object is only created when `dispatch()` changes state.
 * This satisfies the `useSyncExternalStore` contract.
 */
export class AuthStateMachine {
  private internal: InternalState = { kind: "unauthenticated" };
  private cachedSnapshot: AuthStateSnapshot = buildSnapshot(this.internal);
  private readonly listeners = new Set<AuthListener>();

  getSnapshot(): AuthStateSnapshot {
    return this.cachedSnapshot;
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(event: AuthEvent): void {
    const prev = this.internal;

    switch (event.type) {
      case "LOGIN":
        this.internal = {
          kind: "unlocked",
          credentials: event.credentials,
          masterKey: event.masterKey,
          identityKeys: event.identityKeys,
        };
        break;

      case "LOCK":
        if (prev.kind === "unlocked") {
          this.internal = { kind: "locked", credentials: prev.credentials };
        }
        break;

      case "UNLOCK":
        if (prev.kind === "locked") {
          this.internal = {
            kind: "unlocked",
            credentials: prev.credentials,
            masterKey: event.masterKey,
            identityKeys: event.identityKeys,
          };
        }
        break;

      case "LOGOUT":
        this.internal = { kind: "unauthenticated" };
        break;

      default: {
        const _exhaustive: never = event;
        throw new Error(`Unhandled event: ${(_exhaustive as AuthEvent).type}`);
      }
    }

    if (this.internal !== prev) {
      this.cachedSnapshot = buildSnapshot(this.internal);
      for (const listener of this.listeners) {
        listener(this.cachedSnapshot);
      }
    }
  }
}
