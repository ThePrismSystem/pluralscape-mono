/**
 * Vitest setup for design-system tests.
 *
 * Configures the React act() environment flag so react-test-renderer
 * does not emit "not configured to support act()" warnings.
 */

// Tell React we are inside a test environment that supports act().
// Without this flag react-test-renderer emits a warning on every act() call.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
