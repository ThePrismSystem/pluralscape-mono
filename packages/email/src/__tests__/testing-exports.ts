// Public test utilities for consumers running contract tests against their own adapters.

export { runEmailAdapterContract } from "./email-adapter.contract.js";
export { InMemoryEmailAdapter } from "../adapters/in-memory.js";
export type { SentEmail } from "../adapters/in-memory.js";
