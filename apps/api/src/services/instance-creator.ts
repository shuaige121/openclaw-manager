import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HttpError } from "../lib/http-error";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type ChannelType = "telegram" | "wecom" | "feishu" | "whatsapp" | "none";
type SandboxMode = "off" | "all";

type ChannelConfigResult = {
  channels: JsonObject;
  pluginEntries: JsonObject;
};

const BASE_PORT = 18800;
const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";
const DEFAULT_SANDBOX_MODE: SandboxMode = "off";
const DEFAULT_CHANNEL_TYPE: ChannelType = "none";

export interface CreateInstanceOptions {
  profileName: string;
  displayName: string;
  description?: string;
  model?: string;
  port?: number;
  channelType?: ChannelType;
  channelCredentials?: Record<string, string>;
  sandboxMode?: SandboxMode;
  tags?: string[];
}

export interface CreateInstanceResult {
  profileName: string;
  port: number;
  configPath: string;
  workspacePath: string;
  stateDirPath: string;
}

function sanitizeProfileName(profileName: string): string {
  const sanitized = profileName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (sanitized.length === 0) {
    throw new HttpError(
      400,
      "profileName must contain at least one alphanumeric character after sanitization.",
    );
  }

  return sanitized;
}

function requireDisplayName(displayName: string): string {
  const normalized = displayName.trim();

  if (normalized.length === 0) {
    throw new HttpError(400, "displayName must be a non-empty string.");
  }

  return normalized;
}

function normalizeModel(model?: string): string {
  const normalized = model?.trim() ?? "";
  return normalized.length > 0 ? normalized : DEFAULT_MODEL;
}

function normalizeSandboxMode(sandboxMode?: SandboxMode): SandboxMode {
  return sandboxMode ?? DEFAULT_SANDBOX_MODE;
}

function normalizeChannelType(channelType?: ChannelType): ChannelType {
  return channelType ?? DEFAULT_CHANNEL_TYPE;
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }

  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
}

function resolvePort(requestedPort: number | undefined, existingPorts: readonly number[]): number {
  if (requestedPort === undefined) {
    return allocatePort([...existingPorts]);
  }

  if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
    throw new HttpError(400, "port must be an integer between 1 and 65535.");
  }

  if (existingPorts.includes(requestedPort)) {
    throw new HttpError(409, `Port ${requestedPort} is already allocated.`);
  }

  return requestedPort;
}

function requireChannelCredential(
  credentials: Record<string, string> | undefined,
  fieldName: string,
  channelType: Exclude<ChannelType, "none" | "whatsapp">,
): string {
  const value = credentials?.[fieldName]?.trim() ?? "";

  if (value.length === 0) {
    throw new HttpError(400, `${fieldName} must be provided for ${channelType} channels.`);
  }

  return value;
}

function buildChannelConfig(
  channelType: ChannelType,
  credentials: Record<string, string> | undefined,
): ChannelConfigResult {
  switch (channelType) {
    case "telegram":
      return {
        channels: {
          telegram: {
            enabled: true,
            botToken: requireChannelCredential(credentials, "botToken", "telegram"),
            dmPolicy: "open",
          },
        },
        pluginEntries: {},
      };
    case "wecom":
      return {
        channels: {
          wecom: {
            enabled: true,
            botId: requireChannelCredential(credentials, "botId", "wecom"),
            secret: requireChannelCredential(credentials, "secret", "wecom"),
            dmPolicy: "open",
            groupPolicy: "disabled",
            allowFrom: ["*"],
          },
        },
        pluginEntries: {
          "wecom-openclaw-plugin": {
            enabled: true,
          },
        },
      };
    case "feishu":
      return {
        channels: {
          feishu: {
            enabled: true,
            domain: "feishu",
            accounts: {
              main: {
                appId: requireChannelCredential(credentials, "appId", "feishu"),
                appSecret: requireChannelCredential(credentials, "appSecret", "feishu"),
              },
            },
          },
        },
        pluginEntries: {},
      };
    case "whatsapp":
      return {
        channels: {
          whatsapp: {
            enabled: true,
            dmPolicy: "pairing",
          },
        },
        pluginEntries: {},
      };
    case "none":
      return {
        channels: {},
        pluginEntries: {},
      };
  }
}

function buildManagerMeta(opts: CreateInstanceOptions, profileName: string): JsonObject | null {
  const description = opts.description?.trim() ?? "";
  const tags = normalizeTags(opts.tags);
  const managerMeta: JsonObject = {
    profileName,
  };

  if (description.length > 0) {
    managerMeta.description = description;
  }

  if (tags.length > 0) {
    managerMeta.tags = tags;
  }

  return Object.keys(managerMeta).length > 0 ? managerMeta : null;
}

async function ensureSharedAuthProfiles(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await fs.copyFile(sourcePath, targetPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new HttpError(
        500,
        `Shared auth profile source file was not found at ${sourcePath}.`,
      );
    }

    throw error;
  }
}

async function ensureSymlink(targetPath: string, linkPath: string): Promise<void> {
  try {
    await fs.symlink(targetPath, linkPath);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
      throw error;
    }

    const stats = await fs.lstat(linkPath);
    if (!stats.isSymbolicLink()) {
      throw new HttpError(409, `Cannot create symlink at ${linkPath} because the path already exists.`);
    }

    const existingTarget = await fs.readlink(linkPath);
    const resolvedExistingTarget = path.resolve(path.dirname(linkPath), existingTarget);
    const resolvedRequestedTarget = path.resolve(targetPath);

    if (resolvedExistingTarget !== resolvedRequestedTarget) {
      throw new HttpError(
        409,
        `Symlink at ${linkPath} points to ${resolvedExistingTarget}, expected ${resolvedRequestedTarget}.`,
      );
    }
  }
}

export function allocatePort(existingPorts: number[]): number {
  const usedPorts = new Set(existingPorts);
  let port = BASE_PORT;

  while (usedPorts.has(port)) {
    port += 1;
  }

  return port;
}

export function buildOpenclaConfig(opts: CreateInstanceOptions, port: number): JsonObject {
  const profileName = sanitizeProfileName(opts.profileName);
  const displayName = requireDisplayName(opts.displayName);
  const { channels, pluginEntries } = buildChannelConfig(
    normalizeChannelType(opts.channelType),
    opts.channelCredentials,
  );
  const config: JsonObject = {
    agents: {
      defaults: {
        model: {
          primary: normalizeModel(opts.model),
        },
        workspace: `~/.openclaw/workspace-${profileName}`,
        heartbeat: {
          every: "0m",
        },
      },
      list: [
        {
          id: "main",
          default: true,
          name: displayName,
          identity: {
            name: displayName,
            emoji: "🤖",
          },
          sandbox: {
            mode: normalizeSandboxMode(opts.sandboxMode),
          },
        },
      ],
    },
    gateway: {
      port,
      bind: "loopback",
    },
    channels,
    plugins: {
      entries: pluginEntries,
    },
  };
  const managerMeta = buildManagerMeta(opts, profileName);

  if (managerMeta) {
    config.meta = {
      openclawManager: managerMeta,
    };
  }

  return config;
}

export async function createInstance(
  opts: CreateInstanceOptions,
  existingPorts: number[],
): Promise<CreateInstanceResult> {
  const profileName = sanitizeProfileName(opts.profileName);
  const port = resolvePort(opts.port, existingPorts);
  const config = buildOpenclaConfig(
    {
      ...opts,
      profileName,
      displayName: requireDisplayName(opts.displayName),
    },
    port,
  );

  const homeDir = os.homedir();
  const sharedStateDirPath = path.join(homeDir, ".openclaw");
  const stateDirPath = path.join(homeDir, `.openclaw-${profileName}`);
  const configPath = path.join(stateDirPath, "openclaw.json");
  const workspacePath = path.join(sharedStateDirPath, `workspace-${profileName}`);
  const agentAuthDirPath = path.join(stateDirPath, "agents", "main", "agent");
  const sharedAuthProfilesPath = path.join(
    sharedStateDirPath,
    "agents",
    "main",
    "agent",
    "auth-profiles.json",
  );
  const instanceAuthProfilesPath = path.join(agentAuthDirPath, "auth-profiles.json");
  const sharedExtensionsPath = path.join(sharedStateDirPath, "extensions");
  const instanceExtensionsPath = path.join(stateDirPath, "extensions");

  await fs.mkdir(stateDirPath, { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.mkdir(agentAuthDirPath, { recursive: true });
  await ensureSharedAuthProfiles(sharedAuthProfilesPath, instanceAuthProfilesPath);
  await ensureSymlink(sharedExtensionsPath, instanceExtensionsPath);

  return {
    profileName,
    port,
    configPath,
    workspacePath,
    stateDirPath,
  };
}
