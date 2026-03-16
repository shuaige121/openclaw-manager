import { parseAllowedIpsFromEnv } from "./lib/ip-allowlist";
import { createServer } from "./server";
import { ActionHistoryService } from "./services/action-history";
import {
  ManagerTelegramBotService,
  readManagerTelegramBotConfig,
} from "./services/manager-telegram-bot";
import { ProjectRegistryService } from "./services/project-registry";

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
const registryService = new ProjectRegistryService();
const actionHistoryService = new ActionHistoryService();
const app = createServer({
  registryService,
  actionHistoryService,
  accessControl: {
    allowedIps: parseAllowedIpsFromEnv(process.env),
    trustProxy: process.env.MANAGER_TRUST_PROXY === "1",
  },
});
const managerTelegramBotConfig = readManagerTelegramBotConfig(process.env);

app.listen(port, host, () => {
  console.log(`OpenClaw manager API listening on http://${host}:${port}`);

  if (managerTelegramBotConfig) {
    const botService = new ManagerTelegramBotService({
      token: managerTelegramBotConfig.token,
      allowedUserIds: managerTelegramBotConfig.allowedUserIds,
      apiBaseUrl: managerTelegramBotConfig.apiBaseUrl,
      pollTimeoutSeconds: managerTelegramBotConfig.pollTimeoutSeconds,
      registryService,
      actionHistoryService,
    });
    botService.start();
    console.log("[manager-telegram-bot] polling started");
  }
});
