/** Options for creating an event bus. */
export interface EventBusOptions {
  /** Called when a listener throws. Defaults to rethrowing asynchronously. */
  readonly onError?: (error: unknown) => void;
}

/** A typed, synchronous, in-process event emitter. */
export interface EventBus<TMap> {
  /** Subscribe to an event type. Returns an unsubscribe function. */
  on<K extends keyof TMap & string>(type: K, listener: (event: TMap[K]) => void): () => void;
  /** Emit an event to all current subscribers of its type. */
  emit<K extends keyof TMap & string>(type: K, event: TMap[K]): void;
  /** Remove all listeners for all event types. */
  removeAll(): void;
}

/** Create a new typed event bus with no external dependencies. */
export function createEventBus<TMap>(options?: EventBusOptions): EventBus<TMap> {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const handleError: (error: unknown) => void =
    options?.onError ??
    ((err) => {
      queueMicrotask(() => {
        throw err;
      });
    });

  return {
    on(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      const wrapped = listener as (event: unknown) => void;
      set.add(wrapped);
      return () => {
        set.delete(wrapped);
        if (set.size === 0) listeners.delete(type);
      };
    },

    emit(type, event) {
      const set = listeners.get(type);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(event);
        } catch (err: unknown) {
          handleError(err);
        }
      }
    },

    removeAll() {
      listeners.clear();
    },
  };
}
