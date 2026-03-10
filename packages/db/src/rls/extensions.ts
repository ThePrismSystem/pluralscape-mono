/**
 * PostgreSQL extension management.
 *
 * Extensions required by the application that must be created
 * during database setup / migration.
 */

/** SQL to enable pgcrypto for defense-in-depth encryption at rest. */
export const ENABLE_PGCRYPTO = "CREATE EXTENSION IF NOT EXISTS pgcrypto";
