import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ACTION_HISTORY_PATH } from "../paths";
import type {
  ActionHistoryEntry,
  ActionHistoryListResponse,
  ActionHistoryStoreData,
} from "../types/project";

const MAX_HISTORY_ITEMS = 300;
const MAX_OUTPUT_LENGTH = 4000;
const MAX_DETAIL_LENGTH = 1200;

type AppendHistoryEntryInput = Omit<ActionHistoryEntry, "id" | "createdAt"> & {
  createdAt?: string;
};

function normalizeText(value: string | null, limit: number): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length <= limit) {
    return trimmed;
  }

  return `${trimmed.slice(0, limit)}...`;
}

function normalizeEntry(input: AppendHistoryEntryInput): ActionHistoryEntry {
  return {
    id: crypto.randomUUID(),
    kind: input.kind,
    ok: input.ok,
    createdAt: input.createdAt ?? new Date().toISOString(),
    projects: input.projects,
    summary: normalizeText(input.summary, 220) ?? "History entry",
    detail: normalizeText(input.detail, MAX_DETAIL_LENGTH) ?? "",
    command: normalizeText(input.command, 1000),
    stdout: normalizeText(input.stdout, MAX_OUTPUT_LENGTH),
    stderr: normalizeText(input.stderr, MAX_OUTPUT_LENGTH),
    durationMs: input.durationMs,
    actionName: normalizeText(input.actionName, 120) ?? "action",
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStore(value: unknown): ActionHistoryStoreData {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.items)) {
    return {
      version: 1,
      items: [],
    };
  }

  const items = value.items.filter((entry): entry is ActionHistoryEntry => {
    return (
      isObject(entry) &&
      typeof entry.id === "string" &&
      typeof entry.kind === "string" &&
      typeof entry.ok === "boolean" &&
      typeof entry.createdAt === "string" &&
      Array.isArray(entry.projects) &&
      typeof entry.summary === "string" &&
      typeof entry.detail === "string" &&
      (typeof entry.command === "string" || entry.command === null) &&
      (typeof entry.stdout === "string" || entry.stdout === null) &&
      (typeof entry.stderr === "string" || entry.stderr === null) &&
      (typeof entry.durationMs === "number" || entry.durationMs === null) &&
      typeof entry.actionName === "string"
    );
  });

  return {
    version: 1,
    items,
  };
}

export class ActionHistoryService {
  private readonly historyPath: string;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(historyPath = ACTION_HISTORY_PATH) {
    this.historyPath = historyPath;
  }

  async listEntries(options?: {
    limit?: number;
    projectId?: string | null;
  }): Promise<ActionHistoryListResponse> {
    const store = await this.readStore();
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 200);
    const projectId = options?.projectId?.trim() || null;
    const items = store.items.filter((entry) => {
      if (!projectId) {
        return true;
      }

      return entry.projects.some((project) => project.id === projectId);
    });

    return {
      items: items.slice(0, limit),
      generatedAt: new Date().toISOString(),
      totalItems: items.length,
    };
  }

  async appendEntry(input: AppendHistoryEntryInput): Promise<ActionHistoryEntry> {
    const entry = normalizeEntry(input);

    await this.updateStore((store) => {
      store.items.unshift(entry);
      if (store.items.length > MAX_HISTORY_ITEMS) {
        store.items = store.items.slice(0, MAX_HISTORY_ITEMS);
      }
      return store;
    });

    return entry;
  }

  private async ensureStoreFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.historyPath), { recursive: true });

    try {
      await fs.access(this.historyPath);
    } catch {
      const emptyStore: ActionHistoryStoreData = {
        version: 1,
        items: [],
      };
      await fs.writeFile(this.historyPath, `${JSON.stringify(emptyStore, null, 2)}\n`, "utf8");
    }
  }

  private async readStore(): Promise<ActionHistoryStoreData> {
    await this.ensureStoreFile();
    const raw = await fs.readFile(this.historyPath, "utf8");
    return parseStore(JSON.parse(raw) as unknown);
  }

  private async writeStore(store: ActionHistoryStoreData): Promise<void> {
    await fs.writeFile(this.historyPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }

  private async updateStore(
    updater: (store: ActionHistoryStoreData) => ActionHistoryStoreData,
  ): Promise<void> {
    const operation = this.writeChain.then(async () => {
      const currentStore = await this.readStore();
      const nextStore = updater(structuredClone(currentStore));
      await this.writeStore(nextStore);
    });

    this.writeChain = operation.then(
      () => undefined,
      () => undefined,
    );

    await operation;
  }
}
