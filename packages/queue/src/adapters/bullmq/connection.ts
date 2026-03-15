import IORedis from "ioredis";

/** Configuration for connecting to a Valkey (Redis-compatible) instance. */
export interface ValkeyConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly password?: string;
  readonly db?: number;
  readonly tls?: boolean;
}

/**
 * Creates an ioredis connection configured for use with BullMQ and Valkey.
 *
 * Exported for reuse by the real-time subsystem (ADR 007).
 * Sets `maxRetriesPerRequest: null` as required by BullMQ.
 */
export function createValkeyConnection(config: ValkeyConnectionConfig): IORedis {
  return new IORedis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    tls: config.tls ? {} : undefined,
    maxRetriesPerRequest: null,
  });
}
