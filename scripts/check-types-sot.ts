import { spawn } from "node:child_process";

export interface CheckStep {
  name: string;
  run: () => Promise<{ ok: boolean; output: string }>;
}

function runShell(cmd: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout.on("data", (d: Buffer) => {
      out += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      out += d.toString();
    });
    proc.on("close", (code) => resolve({ ok: code === 0, output: out }));
  });
}

export async function runChecks(steps: CheckStep[]): Promise<number> {
  for (const step of steps) {
    const startedAt = Date.now();
    process.stderr.write(`[types:check-sot] ${step.name} …\n`);
    const { ok, output } = await step.run();
    const ms = Date.now() - startedAt;
    if (ok) {
      process.stderr.write(`[types:check-sot] ${step.name} ok (${ms}ms)\n`);
    } else {
      process.stderr.write(`[types:check-sot] ${step.name} FAIL (${ms}ms)\n${output}\n`);
      return 1;
    }
  }
  return 0;
}

const PHASE_0_STEPS: CheckStep[] = [
  {
    name: "typecheck @pluralscape/types",
    run: () => runShell("pnpm", ["--filter", "@pluralscape/types", "typecheck"]),
  },
];

/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
  void runChecks(PHASE_0_STEPS).then((code) => process.exit(code));
}
/* c8 ignore stop */
