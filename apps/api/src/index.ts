import { Hono } from "hono";

const DEFAULT_PORT = 10045;
const port = Number(process.env["API_PORT"]) || DEFAULT_PORT;

const app = new Hono();

app.get("/", (c) => {
  return c.json({ status: "ok", service: "pluralscape-api" });
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

Bun.serve({
  port,
  fetch: app.fetch,
});

// eslint-disable-next-line no-console -- startup log is intentional
console.log(`Pluralscape API listening on port ${String(port)}`);
