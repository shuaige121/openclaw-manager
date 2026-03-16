import fs from "node:fs/promises";
import path from "node:path";
import { MANAGER_TELEGRAM_STATE_PATH } from "../paths";

type ManagerTelegramState = {
  version: 1;
  offset: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseState(value: unknown): ManagerTelegramState {
  if (!isObject(value) || value.version !== 1 || typeof value.offset !== "number") {
    return {
      version: 1,
      offset: 0,
    };
  }

  return {
    version: 1,
    offset: value.offset,
  };
}

export class ManagerTelegramStateService {
  private readonly statePath: string;
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(statePath = MANAGER_TELEGRAM_STATE_PATH) {
    this.statePath = statePath;
  }

  async readOffset(): Promise<number> {
    const state = await this.readState();
    return state.offset;
  }

  async writeOffset(offset: number): Promise<void> {
    await this.updateState(() => ({
      version: 1,
      offset,
    }));
  }

  private async ensureStateFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });

    try {
      await fs.access(this.statePath);
    } catch {
      await fs.writeFile(
        this.statePath,
        `${JSON.stringify({ version: 1, offset: 0 }, null, 2)}\n`,
        "utf8",
      );
    }
  }

  private async readState(): Promise<ManagerTelegramState> {
    await this.ensureStateFile();
    const raw = await fs.readFile(this.statePath, "utf8");
    return parseState(JSON.parse(raw) as unknown);
  }

  private async updateState(
    updater: (state: ManagerTelegramState) => ManagerTelegramState,
  ): Promise<void> {
    const operation = this.writeChain.then(async () => {
      const currentState = await this.readState();
      const nextState = updater(currentState);
      await fs.writeFile(this.statePath, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
    });

    this.writeChain = operation.then(
      () => undefined,
      () => undefined,
    );

    await operation;
  }
}
