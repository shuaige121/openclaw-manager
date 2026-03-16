import type { BulkIntent, ManagerAuthProfile, ProjectActionName, ProjectListItem } from "../types";

type ProjectDetailProps = {
  project: ProjectListItem | null;
  managerAuth: ManagerAuthProfile | null;
  bulkIntent: BulkIntent | null;
  selectedCount: number;
  deleting: boolean;
  activeAction: ProjectActionName | null;
  scanningCompatibility: boolean;
  onEdit: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onRunAction: (projectId: string, action: ProjectActionName) => void;
  onScanCompatibility: (projectId: string) => void;
};

const bulkDescriptions: Record<BulkIntent, string> = {
  hooks: "对选中项目批量启用、禁用或分发 hooks.internal.entries.* 相关改动。",
  skills: "对选中项目批量分发 skill 目录，并 patch skills.entries.* 或 agent skill allowlist。",
  memory: "对选中项目批量追加或删除 manager 写入的记忆块，不直接改 SQLite 索引。",
  config: "对选中项目批量做安全的配置 patch，适合少量高频字段。",
};

const compatibilityTone: Record<ProjectListItem["compatibility"]["status"], string> = {
  full: "tone-ok",
  runtime_only: "tone-warn",
  incompatible: "tone-bad",
};

const compatibilityLabel: Record<ProjectListItem["compatibility"]["status"], string> = {
  full: "完美适配",
  runtime_only: "运行兼容",
  incompatible: "高风险",
};

const checkLabel: Record<ProjectListItem["compatibility"]["checks"][number]["name"], string> = {
  lifecycle: "Lifecycle",
  gateway_probe: "Gateway Probe",
  web_ui: "Web UI",
  config_patch: "Config Patch",
  hooks: "Hooks",
  skills: "Skills",
  memory: "Memory",
};

function formatLastSeen(value: string | null): string {
  if (!value) {
    return "尚未探测到";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ProjectDetail({
  project,
  managerAuth,
  bulkIntent,
  selectedCount,
  deleting,
  activeAction,
  scanningCompatibility,
  onEdit,
  onDelete,
  onRunAction,
  onScanCompatibility,
}: ProjectDetailProps) {
  if (!project) {
    return (
      <aside className="detail-panel">
        <p className="panel-kicker">项目详情</p>
        <h2>选择一个项目</h2>
        <p className="muted-copy">
          左侧点一个项目就能看它的 gateway、auth、路径和 Control UI 入口。
        </p>
      </aside>
    );
  }

  return (
    <aside className="detail-panel">
      <header className="detail-header">
        <div>
          <p className="panel-kicker">项目详情</p>
          <h2>{project.name}</h2>
        </div>
        <div className="project-badges">
          <span className="tag-pill">Port {project.gatewayPort}</span>
          <span className="tag-pill">{project.auth.strategy}</span>
          <span className={`status-pill ${compatibilityTone[project.compatibility.status]}`}>
            {compatibilityLabel[project.compatibility.status]}
          </span>
        </div>
      </header>

      <p className="muted-copy">{project.description}</p>

      <div className="detail-actions">
        <a href={project.endpoints.controlUiUrl} target="_blank" rel="noreferrer">
          打开项目 Control UI
        </a>
        <a href={project.endpoints.gatewayUrl} target="_blank" rel="noreferrer">
          打开 Gateway
        </a>
        <a href={project.endpoints.healthUrl} target="_blank" rel="noreferrer">
          打开 Health
        </a>
      </div>

      <div className="panel-action-row">
        <button
          type="button"
          className="ghost-button"
          onClick={() => onRunAction(project.id, "start")}
          disabled={activeAction !== null}
        >
          {activeAction === "start" ? "启动中..." : "启动"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onRunAction(project.id, "stop")}
          disabled={activeAction !== null}
        >
          {activeAction === "stop" ? "停止中..." : "停止"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onRunAction(project.id, "restart")}
          disabled={activeAction !== null}
        >
          {activeAction === "restart" ? "重启中..." : "重启"}
        </button>
        <button type="button" className="ghost-button" onClick={() => onEdit(project.id)}>
          编辑注册表
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onScanCompatibility(project.id)}
          disabled={scanningCompatibility || activeAction !== null}
        >
          {scanningCompatibility ? "扫描中..." : "重新扫描兼容性"}
        </button>
        <button
          type="button"
          className="ghost-button ghost-button-danger"
          onClick={() => onDelete(project.id)}
          disabled={deleting}
        >
          {deleting ? "删除中..." : "删除项目"}
        </button>
      </div>

      <section className="detail-section">
        <p className="section-label">兼容性扫描</p>
        <div className="callout-box">
          <strong>当前结论：</strong> {compatibilityLabel[project.compatibility.status]}
          <br />
          <strong>说明：</strong> {project.compatibility.reason}
          <br />
          <strong>上次扫描：</strong> {formatLastSeen(project.compatibility.lastScannedAt)}
          <br />
          <strong>手动覆盖：</strong>{" "}
          {project.compatibility.manualOverride ? compatibilityLabel[project.compatibility.manualOverride] : "未设置"}
        </div>
        <dl className="detail-list">
          {project.compatibility.checks.map((check) => (
            <div key={check.name}>
              <dt>{checkLabel[check.name]}</dt>
              <dd>
                <span className={`status-pill ${check.supported ? "tone-ok" : "tone-warn"}`}>
                  {check.supported ? "ok" : "partial"}
                </span>{" "}
                {check.message}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="detail-section">
        <p className="section-label">Gateway / Auth</p>
        <dl className="detail-list">
          <div>
            <dt>默认 manager auth</dt>
            <dd>{managerAuth?.label ?? "未配置"}</dd>
          </div>
          <div>
            <dt>当前项目 auth</dt>
            <dd>{project.auth.label}</dd>
          </div>
          <div>
            <dt>覆盖模式</dt>
            <dd>{project.auth.mode === "inherit_manager" ? "继承默认" : "项目自定义"}</dd>
          </div>
          <div>
            <dt>最后探测</dt>
            <dd>{formatLastSeen(project.lastSeenAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <p className="section-label">路径</p>
        <dl className="detail-list">
          <div>
            <dt>Root</dt>
            <dd>{project.paths.rootPath}</dd>
          </div>
          <div>
            <dt>Config</dt>
            <dd>{project.paths.configPath}</dd>
          </div>
          <div>
            <dt>Workspace</dt>
            <dd>{project.paths.workspacePath}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <p className="section-label">单个与批量</p>
        <div className="callout-box">
          <strong>单项目深控：</strong> 直接跳它自己的 Control UI。<br />
          <strong>批量动作：</strong> 由 manager 对选中项目统一执行，不去同时嵌多个 UI。
        </div>
        <div className="callout-box callout-box-muted">
          OpenClaw Control UI 默认禁止 iframe 内嵌，所以第一版仍以新标签打开为主。
        </div>
      </section>

      <section className="detail-section">
        <p className="section-label">批量上下文</p>
        <div className="callout-box">
          <strong>当前已选：</strong> {selectedCount} 个项目
          <br />
          <strong>当前面板：</strong>{" "}
          {bulkIntent ? bulkDescriptions[bulkIntent] : "先在上方批量栏里选一个操作类型。"}
        </div>
      </section>
    </aside>
  );
}
