import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ProjectConfiguredSkillEntry,
  ProjectHookEntry,
  ProjectHooksProfile,
  ProjectSkillCatalogEntry,
  ProjectSkillsProfile,
  StoredProjectRecord,
} from "../types/project";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readProjectConfig(project: StoredProjectRecord): Promise<JsonObject | null> {
  try {
    const raw = await fs.readFile(project.paths.configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readObjectAtPath(source: JsonObject | null, segments: string[]): JsonObject | null {
  let current: unknown = source;

  for (const segment of segments) {
    if (!isObject(current) || !(segment in current)) {
      return null;
    }

    current = current[segment];
  }

  return isObject(current) ? current : null;
}

function sortByName<T extends { name: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => left.name.localeCompare(right.name));
}

function readEnabledFlag(value: unknown): boolean {
  if (!isObject(value)) {
    return true;
  }

  const enabled = value.enabled;
  return typeof enabled === "boolean" ? enabled : true;
}

export async function readProjectHooksProfile(
  project: StoredProjectRecord,
): Promise<ProjectHooksProfile> {
  const config = await readProjectConfig(project);
  const entriesObject = readObjectAtPath(config, ["hooks", "internal", "entries"]);

  if (!entriesObject) {
    return {
      entries: [],
      enabledCount: 0,
    };
  }

  const entries: ProjectHookEntry[] = Object.entries(entriesObject)
    .filter(([, value]) => isObject(value))
    .map(([name, value]) => ({
      name,
      enabled: readEnabledFlag(value),
      source: "internal",
    }));

  return {
    entries: sortByName(entries),
    enabledCount: entries.filter((entry) => entry.enabled).length,
  };
}

async function scanSkillDirectory(
  baseDir: string,
  source: ProjectSkillCatalogEntry["source"],
  official: boolean,
): Promise<ProjectSkillCatalogEntry[]> {
  try {
    const entries = await fs.readdir(baseDir, {
      withFileTypes: true,
    });
    const discovered = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const skillPath = path.join(baseDir, entry.name);
          const skillMarker = path.join(skillPath, "SKILL.md");
          if (!(await pathExists(skillMarker))) {
            return null;
          }

          return {
            name: entry.name,
            source,
            official,
            path: skillPath,
          } satisfies ProjectSkillCatalogEntry;
        }),
    );

    return discovered.filter((entry) => entry !== null);
  } catch {
    return [];
  }
}

function mergeCatalogEntries(
  catalogEntries: ProjectSkillCatalogEntry[],
): ProjectSkillCatalogEntry[] {
  const priority: Record<ProjectSkillCatalogEntry["source"], number> = {
    workspace: 4,
    managed: 3,
    bundled: 2,
    config_only: 1,
  };
  const merged = new Map<string, ProjectSkillCatalogEntry>();

  for (const entry of catalogEntries) {
    const current = merged.get(entry.name);
    if (!current || priority[entry.source] >= priority[current.source]) {
      merged.set(entry.name, entry);
    }
  }

  return sortByName([...merged.values()]);
}

export async function readProjectSkillsProfile(
  project: StoredProjectRecord,
): Promise<ProjectSkillsProfile> {
  const config = await readProjectConfig(project);
  const configEntries = readObjectAtPath(config, ["skills", "entries"]);
  const [bundledEntries, managedEntries, workspaceEntries] = await Promise.all([
    scanSkillDirectory(path.join(project.paths.rootPath, "skills"), "bundled", true),
    scanSkillDirectory(path.join(os.homedir(), ".openclaw", "skills"), "managed", false),
    scanSkillDirectory(path.join(project.paths.workspacePath, "skills"), "workspace", false),
  ]);

  const catalogMap = new Map<string, ProjectSkillCatalogEntry>(
    mergeCatalogEntries([...bundledEntries, ...managedEntries, ...workspaceEntries]).map((entry) => [
      entry.name,
      entry,
    ]),
  );

  const configuredEntries: ProjectConfiguredSkillEntry[] = [];

  if (configEntries) {
    for (const [name, value] of Object.entries(configEntries)) {
      const catalogEntry = catalogMap.get(name) ?? {
        name,
        source: "config_only" as const,
        official: false,
        path: null,
      };

      configuredEntries.push({
        ...catalogEntry,
        enabled: readEnabledFlag(value),
      });

      if (!catalogMap.has(name)) {
        catalogMap.set(name, catalogEntry);
      }
    }
  }

  const catalogEntries = sortByName([...catalogMap.values()]);

  return {
    configuredEntries: sortByName(configuredEntries),
    catalogEntries,
    enabledCount: configuredEntries.filter((entry) => entry.enabled).length,
    officialCount: catalogEntries.filter((entry) => entry.official).length,
    customCount: catalogEntries.filter((entry) => !entry.official).length,
  };
}
