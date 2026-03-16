import { useEffect, useState, type FormEvent } from "react";
import type {
  ManagerAuthProfile,
  ProjectAuthMode,
  ProjectAuthStrategy,
  ProjectCapabilities,
  ProjectDetailResponse,
  ProjectGatewayProtocol,
  ProjectUpsertPayload,
} from "../types";

type ProjectEditorProps = {
  mode: "create" | "edit";
  managerAuth: ManagerAuthProfile | null;
  initialProject: ProjectDetailResponse["registry"] | null;
  busy: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (payload: ProjectUpsertPayload) => Promise<void>;
};

type EditorState = {
  id: string;
  name: string;
  description: string;
  protocol: ProjectGatewayProtocol;
  host: string;
  port: string;
  tags: string;
  rootPath: string;
  configPath: string;
  workspacePath: string;
  authMode: ProjectAuthMode;
  authStrategy: ProjectAuthStrategy;
  authLabel: string;
  authSecret: string;
  startCommand: string;
  stopCommand: string;
  restartCommand: string;
  bulkHooks: boolean;
  bulkSkills: boolean;
  bulkMemory: boolean;
  bulkConfigPatch: boolean;
};

const DEFAULT_CAPABILITIES: ProjectCapabilities = {
  bulkHooks: true,
  bulkSkills: true,
  bulkMemory: true,
  bulkConfigPatch: true,
};

function createDefaultState(): EditorState {
  return {
    id: "",
    name: "",
    description: "",
    protocol: "http",
    host: "127.0.0.1",
    port: "",
    tags: "",
    rootPath: "",
    configPath: "",
    workspacePath: "",
    authMode: "inherit_manager",
    authStrategy: "token",
    authLabel: "项目自定义 token",
    authSecret: "",
    startCommand: "",
    stopCommand: "",
    restartCommand: "",
    ...DEFAULT_CAPABILITIES,
  };
}

function createStateFromProject(project: ProjectDetailResponse["registry"]): EditorState {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    protocol: project.gateway.protocol,
    host: project.gateway.host,
    port: String(project.gateway.port),
    tags: project.tags.join(", "),
    rootPath: project.paths.rootPath,
    configPath: project.paths.configPath,
    workspacePath: project.paths.workspacePath,
    authMode: project.auth.mode,
    authStrategy: project.auth.strategy,
    authLabel: project.auth.label,
    authSecret: "",
    startCommand: project.lifecycle.startCommand,
    stopCommand: project.lifecycle.stopCommand,
    restartCommand: project.lifecycle.restartCommand,
    bulkHooks: project.capabilities.bulkHooks,
    bulkSkills: project.capabilities.bulkSkills,
    bulkMemory: project.capabilities.bulkMemory,
    bulkConfigPatch: project.capabilities.bulkConfigPatch,
  };
}

function toTagArray(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function ProjectEditor({
  mode,
  managerAuth,
  initialProject,
  busy,
  errorMessage,
  onCancel,
  onSubmit,
}: ProjectEditorProps) {
  const [state, setState] = useState<EditorState>(createDefaultState);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "create") {
      setState(createDefaultState());
      setLocalError(null);
      return;
    }

    if (initialProject) {
      setState(createStateFromProject(initialProject));
      setLocalError(null);
    }
  }, [initialProject, mode]);

  function updateField<Key extends keyof EditorState>(key: Key, value: EditorState[Key]) {
    setState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    const port = Number.parseInt(state.port, 10);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      setLocalError("Gateway port 必须是 1 到 65535 之间的整数。");
      return;
    }

    if (state.authMode === "custom" && mode === "create" && state.authSecret.trim().length === 0) {
      setLocalError("创建自定义 auth 项目时，secret 不能为空。");
      return;
    }

    const payload: ProjectUpsertPayload = {
      id: state.id.trim().toLowerCase(),
      name: state.name.trim(),
      description: state.description.trim(),
      gateway: {
        protocol: state.protocol,
        host: state.host.trim(),
        port,
      },
      tags: toTagArray(state.tags),
      paths: {
        rootPath: state.rootPath.trim(),
        configPath: state.configPath.trim(),
        workspacePath: state.workspacePath.trim(),
      },
      auth:
        state.authMode === "inherit_manager"
          ? {
              mode: "inherit_manager",
            }
          : {
              mode: "custom",
              strategy: state.authStrategy,
              label: state.authLabel.trim(),
              ...(state.authSecret.trim().length > 0 ? { secret: state.authSecret.trim() } : {}),
            },
      lifecycle: {
        startCommand: state.startCommand,
        stopCommand: state.stopCommand,
        restartCommand: state.restartCommand,
      },
      capabilities: {
        bulkHooks: state.bulkHooks,
        bulkSkills: state.bulkSkills,
        bulkMemory: state.bulkMemory,
        bulkConfigPatch: state.bulkConfigPatch,
      },
    };

    await onSubmit(payload);
  }

  return (
    <aside className="detail-panel">
      <header className="detail-header">
        <div>
          <p className="panel-kicker">{mode === "create" ? "新增项目" : "编辑项目"}</p>
          <h2>{mode === "create" ? "写入新的项目注册记录" : initialProject?.name ?? "编辑注册表"}</h2>
        </div>
      </header>

      <p className="muted-copy">
        这里只改 manager 注册表，不替代单项目 OpenClaw Control UI。创建后就会进入项目总览卡片。
      </p>

      <div className="callout-box">
        <strong>默认 manager auth：</strong> {managerAuth?.label ?? "未配置"}
        <br />
        <strong>项目 auth：</strong>{" "}
        {state.authMode === "inherit_manager" ? "继承默认" : "项目自定义"}
      </div>

      <form className="project-form" onSubmit={handleSubmit}>
        <section className="detail-section">
          <p className="section-label">基础信息</p>
          <div className="form-grid">
            <label className="form-field">
              <span>项目 ID</span>
              <input
                value={state.id}
                onChange={(event) => updateField("id", event.target.value)}
                placeholder="例如 main-prod"
                disabled={mode === "edit" || busy}
              />
            </label>
            <label className="form-field">
              <span>项目名</span>
              <input
                value={state.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="例如 Main Assistant"
                disabled={busy}
              />
            </label>
            <label className="form-field form-field-full">
              <span>描述</span>
              <textarea
                value={state.description}
                onChange={(event) => updateField("description", event.target.value)}
                rows={3}
                placeholder="这个项目是做什么的"
                disabled={busy}
              />
            </label>
            <label className="form-field form-field-full">
              <span>Tags</span>
              <input
                value={state.tags}
                onChange={(event) => updateField("tags", event.target.value)}
                placeholder="prod, default, ops"
                disabled={busy}
              />
            </label>
          </div>
        </section>

        <section className="detail-section">
          <p className="section-label">Gateway</p>
          <div className="form-grid">
            <label className="form-field">
              <span>Protocol</span>
              <select
                value={state.protocol}
                onChange={(event) => updateField("protocol", event.target.value as ProjectGatewayProtocol)}
                disabled={busy}
              >
                <option value="http">http</option>
                <option value="https">https</option>
              </select>
            </label>
            <label className="form-field">
              <span>Host</span>
              <input
                value={state.host}
                onChange={(event) => updateField("host", event.target.value)}
                placeholder="127.0.0.1"
                disabled={busy}
              />
            </label>
            <label className="form-field">
              <span>Port</span>
              <input
                value={state.port}
                onChange={(event) => updateField("port", event.target.value)}
                placeholder="18789"
                inputMode="numeric"
                disabled={busy}
              />
            </label>
          </div>
        </section>

        <section className="detail-section">
          <p className="section-label">路径</p>
          <div className="form-grid">
            <label className="form-field form-field-full">
              <span>Root Path</span>
              <input
                value={state.rootPath}
                onChange={(event) => updateField("rootPath", event.target.value)}
                placeholder="/srv/openclaw/projects/main"
                disabled={busy}
              />
            </label>
            <label className="form-field form-field-full">
              <span>Config Path</span>
              <input
                value={state.configPath}
                onChange={(event) => updateField("configPath", event.target.value)}
                placeholder="/srv/openclaw/projects/main/openclaw.json"
                disabled={busy}
              />
            </label>
            <label className="form-field form-field-full">
              <span>Workspace Path</span>
              <input
                value={state.workspacePath}
                onChange={(event) => updateField("workspacePath", event.target.value)}
                placeholder="/srv/openclaw/projects/main/workspace"
                disabled={busy}
              />
            </label>
          </div>
        </section>

        <section className="detail-section">
          <p className="section-label">Auth</p>
          <div className="form-grid">
            <label className="form-field">
              <span>Auth 模式</span>
              <select
                value={state.authMode}
                onChange={(event) => updateField("authMode", event.target.value as ProjectAuthMode)}
                disabled={busy}
              >
                <option value="inherit_manager">继承 manager 默认 auth</option>
                <option value="custom">项目自定义 auth</option>
              </select>
            </label>
            {state.authMode === "custom" ? (
              <>
                <label className="form-field">
                  <span>Strategy</span>
                  <select
                    value={state.authStrategy}
                    onChange={(event) =>
                      updateField("authStrategy", event.target.value as ProjectAuthStrategy)
                    }
                    disabled={busy}
                  >
                    <option value="token">token</option>
                    <option value="password">password</option>
                  </select>
                </label>
                <label className="form-field form-field-full">
                  <span>Auth Label</span>
                  <input
                    value={state.authLabel}
                    onChange={(event) => updateField("authLabel", event.target.value)}
                    placeholder="项目自定义 token"
                    disabled={busy}
                  />
                </label>
                <label className="form-field form-field-full">
                  <span>{mode === "edit" ? "新的 Secret（留空则沿用旧值）" : "Secret"}</span>
                  <input
                    type="password"
                    value={state.authSecret}
                    onChange={(event) => updateField("authSecret", event.target.value)}
                    placeholder={mode === "edit" ? "不改就留空" : "输入 token 或 password"}
                    disabled={busy}
                  />
                </label>
              </>
            ) : null}
          </div>
        </section>

        <section className="detail-section">
          <p className="section-label">Lifecycle Commands</p>
          <div className="form-grid">
            <label className="form-field form-field-full">
              <span>Start Command</span>
              <textarea
                value={state.startCommand}
                onChange={(event) => updateField("startCommand", event.target.value)}
                rows={2}
                disabled={busy}
              />
            </label>
            <label className="form-field form-field-full">
              <span>Stop Command</span>
              <textarea
                value={state.stopCommand}
                onChange={(event) => updateField("stopCommand", event.target.value)}
                rows={2}
                disabled={busy}
              />
            </label>
            <label className="form-field form-field-full">
              <span>Restart Command</span>
              <textarea
                value={state.restartCommand}
                onChange={(event) => updateField("restartCommand", event.target.value)}
                rows={2}
                disabled={busy}
              />
            </label>
          </div>
        </section>

        <section className="detail-section">
          <p className="section-label">Capabilities</p>
          <div className="checkbox-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={state.bulkHooks}
                onChange={(event) => updateField("bulkHooks", event.target.checked)}
                disabled={busy}
              />
              <span>允许批量 Hook</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={state.bulkSkills}
                onChange={(event) => updateField("bulkSkills", event.target.checked)}
                disabled={busy}
              />
              <span>允许批量 Skill</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={state.bulkMemory}
                onChange={(event) => updateField("bulkMemory", event.target.checked)}
                disabled={busy}
              />
              <span>允许批量记忆</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={state.bulkConfigPatch}
                onChange={(event) => updateField("bulkConfigPatch", event.target.checked)}
                disabled={busy}
              />
              <span>允许批量配置 Patch</span>
            </label>
          </div>
        </section>

        {localError || errorMessage ? (
          <div className="callout-box callout-box-danger">{localError ?? errorMessage}</div>
        ) : null}

        <div className="panel-action-row">
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "保存中..." : mode === "create" ? "创建项目" : "保存修改"}
          </button>
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            取消
          </button>
        </div>
      </form>
    </aside>
  );
}
