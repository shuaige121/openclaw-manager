import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { TestContext } from "node:test";
import request from "supertest";
import { createServer } from "../src/server";
import { ActionHistoryService } from "../src/services/action-history";
import { ProjectRegistryService } from "../src/services/project-registry";
import type { ProjectRegistryData, StoredProjectRecord } from "../src/types/project";

type ProjectFixtureOptions = {
  id: string;
  name?: string;
  description?: string;
  gatewayPort?: number;
  config?: Record<string, unknown>;
  lifecycle?: Partial<StoredProjectRecord["lifecycle"]>;
};

export type ApiTestContext = {
  request: request.SuperTest<request.Test>;
  tempDir: string;
  registryPath: string;
  historyPath: string;
  readProjectConfig: (projectId: string) => Promise<Record<string, unknown>>;
  readProjectMemory: (projectId: string) => Promise<string>;
};

function createDefaultConfig(port: number): Record<string, unknown> {
  return {
    gateway: {
      port,
    },
    hooks: {
      internal: {
        enabled: false,
        entries: {},
      },
    },
    skills: {
      entries: {},
    },
  };
}

export async function createProjectFixture(
  tempDir: string,
  options: ProjectFixtureOptions,
): Promise<StoredProjectRecord> {
  const rootPath = path.join(tempDir, options.id);
  const workspacePath = path.join(rootPath, "workspace");
  const configPath = path.join(rootPath, "openclaw.json");
  const controlUiMarkerPath = path.join(rootPath, "src", "gateway");
  const gatewayPort = options.gatewayPort ?? 19900;

  await mkdir(workspacePath, { recursive: true });
  await mkdir(controlUiMarkerPath, { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify(options.config ?? createDefaultConfig(gatewayPort), null, 2)}\n`,
    "utf8",
  );
  await writeFile(path.join(controlUiMarkerPath, "control-ui.ts"), "export {};\n", "utf8");

  return {
    id: options.id,
    name: options.name ?? options.id,
    description: options.description ?? `${options.id} project fixture`,
    gateway: {
      protocol: "http",
      host: "127.0.0.1",
      port: gatewayPort,
    },
    tags: ["test"],
    paths: {
      rootPath,
      configPath,
      workspacePath,
    },
    auth: {
      mode: "inherit_manager",
    },
    lifecycle: {
      startCommand: options.lifecycle?.startCommand ?? "printf started",
      stopCommand: options.lifecycle?.stopCommand ?? "printf stopped",
      restartCommand: options.lifecycle?.restartCommand ?? "printf restarted",
    },
    capabilities: {
      bulkHooks: true,
      bulkSkills: true,
      bulkMemory: true,
      bulkConfigPatch: true,
    },
    compatibility: {
      status: "full",
      reason: "Fixture placeholder compatibility state.",
      lastScannedAt: "2026-03-17T00:00:00.000Z",
      manualOverride: null,
      checks: [
        {
          name: "lifecycle",
          supported: true,
          message: "Fixture placeholder.",
        },
        {
          name: "gateway_probe",
          supported: true,
          message: "Fixture placeholder.",
        },
        {
          name: "web_ui",
          supported: true,
          message: "Fixture placeholder.",
        },
        {
          name: "config_patch",
          supported: true,
          message: "Fixture placeholder.",
        },
        {
          name: "hooks",
          supported: true,
          message: "Fixture placeholder.",
        },
        {
          name: "skills",
          supported: true,
          message: "Fixture placeholder.",
        },
        {
          name: "memory",
          supported: true,
          message: "Fixture placeholder.",
        },
      ],
    },
  };
}

export async function createApiTestContext(
  context: TestContext,
  options?: {
    projects?: StoredProjectRecord[];
    accessControl?: {
      allowedIps?: string[];
      trustProxy?: boolean;
    };
  },
): Promise<ApiTestContext> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-manager-api-test-"));
  const registryPath = path.join(tempDir, "projects.json");
  const historyPath = path.join(tempDir, "action-history.json");

  context.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const registry: ProjectRegistryData = {
    version: 1,
    managerAuth: {
      strategy: "token",
      label: "test manager token",
      secret: "test-secret",
    },
    projects: options?.projects ?? [],
  };

  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  await writeFile(historyPath, `${JSON.stringify({ version: 1, items: [] }, null, 2)}\n`, "utf8");

  const registryService = new ProjectRegistryService(registryPath);
  const actionHistoryService = new ActionHistoryService(historyPath);
  const app = createServer({
    registryService,
    actionHistoryService,
    serveWeb: false,
    accessControl: options?.accessControl,
  });

  return {
    request: request(app),
    tempDir,
    registryPath,
    historyPath,
    async readProjectConfig(projectId: string) {
      const raw = await readFile(path.join(tempDir, projectId, "openclaw.json"), "utf8");
      return JSON.parse(raw) as Record<string, unknown>;
    },
    async readProjectMemory(projectId: string) {
      const memoryPath = path.join(tempDir, projectId, "workspace", "MEMORY.md");
      return readFile(memoryPath, "utf8");
    },
  };
}

export function expectJsonObject(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}
