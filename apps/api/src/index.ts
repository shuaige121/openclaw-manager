import { createServer } from "./server";

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "0.0.0.0";

function resolvePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(rawPort, 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return port;
}

function resolveHost(rawHost: string | undefined): string {
  if (rawHost === undefined || rawHost.trim().length === 0) {
    return DEFAULT_HOST;
  }

  return rawHost.trim();
}

const port = resolvePort(process.env.PORT);
const host = resolveHost(process.env.HOST);
const app = createServer();

app.listen(port, host, () => {
  console.log(`OpenClaw manager API listening on http://${host}:${port}`);
});
