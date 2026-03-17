/**
 * Registration timing benchmark — manual tool, NOT a CI test.
 *
 * Measures real registration latency to verify ANTI_ENUM_TARGET_MS is safe.
 * If real registration consistently exceeds the anti-enumeration target,
 * an attacker can distinguish real vs fake paths by response time.
 *
 * Usage:
 *   pnpm tsx apps/api/src/__tests__/benchmarks/registration-timing.bench.ts
 *
 * Requires: running PostgreSQL, valid .env with EMAIL_HASH_PEPPER, crypto deps.
 */

import { getDb } from "../../lib/db.js";
import { ANTI_ENUM_TARGET_MS } from "../../routes/auth/auth.constants.js";
import { registerAccount } from "../../services/auth.service.js";

/** Number of registration trials to run. */
const TRIAL_COUNT = 20;

interface BenchmarkResult {
  readonly trialMs: number[];
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly mean: number;
  readonly antiEnumTarget: number;
  readonly failureCount: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}

async function runBenchmark(): Promise<BenchmarkResult> {
  const db = await getDb();
  const timings: number[] = [];
  let failureCount = 0;

  console.info(`Running ${String(TRIAL_COUNT)} registration trials...\n`);

  for (let i = 0; i < TRIAL_COUNT; i++) {
    const uniqueEmail = `bench-${String(i)}-${String(Date.now())}@example.com`;
    const start = performance.now();

    try {
      await registerAccount(
        db,
        {
          email: uniqueEmail,
          password: "benchmark-password-1234",
          recoveryKeyBackupConfirmed: true,
          accountType: "system",
        },
        "web",
        { ipAddress: null, userAgent: "benchmark-tool" },
      );
    } catch {
      // Account may fail for various reasons — we still measure timing
      failureCount++;
    }

    const elapsed = performance.now() - start;
    timings.push(elapsed);
    console.info(`  Trial ${String(i + 1).padStart(2)}: ${elapsed.toFixed(1)}ms`);
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;

  return {
    trialMs: sorted,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    mean,
    antiEnumTarget: ANTI_ENUM_TARGET_MS,
    failureCount,
  };
}

async function main(): Promise<void> {
  const result = await runBenchmark();

  console.info("\n--- Results ---");
  console.info(`  Trials:            ${String(result.trialMs.length)}`);
  console.info(`  Failures:          ${String(result.failureCount)}`);
  console.info(`  Mean:              ${result.mean.toFixed(1)}ms`);
  console.info(`  P50:               ${result.p50.toFixed(1)}ms`);
  console.info(`  P95:               ${result.p95.toFixed(1)}ms`);
  console.info(`  P99:               ${result.p99.toFixed(1)}ms`);
  console.info(`  ANTI_ENUM_TARGET:  ${String(result.antiEnumTarget)}ms`);
  console.info("");

  if (result.failureCount === result.trialMs.length) {
    console.warn("WARNING: All trials failed — timing data may not reflect real registration.");
  }

  if (result.p95 > result.antiEnumTarget) {
    console.warn(
      `WARNING: P95 (${result.p95.toFixed(1)}ms) exceeds ANTI_ENUM_TARGET_MS (${String(result.antiEnumTarget)}ms).`,
    );
    console.warn(
      `  Recommended: increase ANTI_ENUM_TARGET_MS to at least ${String(Math.ceil(result.p95 * 1.2))}ms (p95 + 20% buffer).`,
    );
  } else if (result.p99 > result.antiEnumTarget) {
    console.warn(
      `CAUTION: P99 (${result.p99.toFixed(1)}ms) exceeds ANTI_ENUM_TARGET_MS (${String(result.antiEnumTarget)}ms).`,
    );
    console.warn("  Consider applying fixed-delay to BOTH real and fake paths.");
  } else {
    console.info("OK: Registration timing is within the anti-enumeration target.");
  }

  process.exit(0);
}

void main();
