export function spawnHello(): Worker {
  return new Worker(new URL("./hello-worker.ts", import.meta.url), {
    type: "module",
  });
}
