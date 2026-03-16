import { spawn } from "node:child_process";
import { HttpError } from "../lib/http-error";
import type { CommandExecutionResult, ProjectActionName, StoredProjectRecord } from "../types/project";

const COMMAND_TIMEOUT_MS = 60_000;

function getActionCommand(project: StoredProjectRecord, action: ProjectActionName): string {
  if (action === "start") {
    return project.lifecycle.startCommand;
  }

  if (action === "stop") {
    return project.lifecycle.stopCommand;
  }

  return project.lifecycle.restartCommand;
}

async function runCommand(command: string, cwd: string): Promise<CommandExecutionResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn("/bin/sh", ["-lc", command], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (
      ok: boolean,
      exitCode: number | null,
      signal: NodeJS.Signals | null,
      stderrSuffix = "",
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      resolve({
        ok,
        command,
        exitCode,
        signal,
        stdout: stdout.trim(),
        stderr: `${stderr}${stderrSuffix}`.trim(),
        durationMs: Date.now() - startedAt,
      });
    };

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      finish(false, null, "SIGTERM", "\nCommand timed out after 60000ms.");
    }, COMMAND_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      finish(false, null, null, `\n${error.message}`);
    });
    child.on("close", (exitCode, signal) => {
      finish(exitCode === 0, exitCode, signal);
    });
  });
}

export async function executeProjectAction(
  project: StoredProjectRecord,
  action: ProjectActionName,
): Promise<CommandExecutionResult> {
  const command = getActionCommand(project, action).trim();

  if (command.length === 0) {
    throw new HttpError(400, `Project "${project.id}" does not define a ${action} command.`);
  }

  return runCommand(command, project.paths.rootPath);
}
