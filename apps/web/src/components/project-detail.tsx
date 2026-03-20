import { useEffect, useState } from "react";
import { AgentList } from "./agent-list";
import { ChannelConfig } from "./channel-config";
import type {
  BulkIntent,
  ManagerAuthProfile,
  ProjectActionName,
  ProjectListItem,
  ProjectMemoryMode,
  ProjectSmokeTestResponse,
  ProjectTemplateDefinition,
  ProjectTemplateId,
} from "../types";

type ProjectDetailProps = {
  project: ProjectListItem | null;
  managerAuth: ManagerAuthProfile | null;
  bulkIntent: BulkIntent | null;
  selectedCount: number;
  deleting: boolean;
  activeAction: ProjectActionName | null;
  scanningCompatibility: boolean;
  smokeTesting: boolean;
  modelUpdating: boolean;
  memoryUpdating: boolean;
  templateApplying: boolean;
  catalogActionKey: string | null;
  smokeTestResult: ProjectSmokeTestResponse | null;
  templates: ProjectTemplateDefinition[];
  onEdit: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onRunAction: (projectId: string, action: ProjectActionName) => void;
  onScanCompatibility: (projectId: string) => void;
  onRunSmokeTest: (projectId: string) => void;
  onUpdateModel: (projectId: string, payload: { modelRef: string; restartIfRunning: boolean }) => void;
  onUpdateMemoryMode: (
    projectId: string,
    payload: { mode: ProjectMemoryMode; restartIfRunning: boolean },
  ) => void;
  onApplyTemplate: (
    projectId: string,
    payload: { templateId: ProjectTemplateId; restartIfRunning: boolean },
  ) => void;
  onManageHook: (
    projectId: string,
    hookName: string,
    mode: "enable" | "disable" | "remove",
  ) => void;
  onManageSkill: (
    projectId: string,
    skillName: string,
    mode: "enable" | "disable" | "remove",
  ) => void;
  showAgentList?: boolean;
  /** When true, renders without the outer <aside> wrapper (for inline use in expanded card). */
  inline?: boolean;
};

const bulkDescriptions: Record<BulkIntent, string> = {
  hooks: "对选中机器人批量启用或禁用钩子。",
  skills: "对选中机器人批量启用或禁用技能。",
  memory: "对选中机器人批量追加或删除记忆内容。",
  config: "对选中机器人批量修改配置。",
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

const authStrategyLabel: Record<ProjectListItem["auth"]["strategy"], string> = {
  token: "令牌",
  password: "密码",
};

const checkLabel: Record<ProjectListItem["compatibility"]["checks"][number]["name"], string> = {
  lifecycle: "生命周期",
  gateway_probe: "网关探测",
  web_ui: "网页界面",
  config_patch: "配置补丁",
  hooks: "钩子",
  skills: "技能",
  memory: "记忆",
};

const memoryModeLabel: Record<ProjectMemoryMode, string> = {
  normal: "正常记忆",
  locked: "锁定记忆",
  stateless: "白纸模式",
};

const memoryModeDescription: Record<ProjectMemoryMode, string> = {
  normal: "可读可写。允许记忆插件、自动记忆刷新，以及后续沉淀长期记忆。",
  locked: "只读记忆。允许读取已有记忆，但不再新增会话记忆或压缩记忆。",
  stateless: "完全白纸。既不读记忆，也不写记忆，适合客服机器人或严格无状态机器人。",
};

const sandboxModeLabel: Record<ProjectListItem["sandbox"]["mode"], string> = {
  off: "关闭",
  "non-main": "仅非主会话",
  all: "全部会话",
};

const sandboxScopeLabel: Record<ProjectListItem["sandbox"]["scope"], string> = {
  session: "每会话一个沙箱",
  agent: "每个代理一个沙箱",
  shared: "所有会话共享",
};

const sandboxBackendLabel: Record<ProjectListItem["sandbox"]["backend"], string> = {
  docker: "Docker",
  ssh: "SSH",
  openshell: "OpenShell",
};

const workspaceAccessLabel: Record<ProjectListItem["sandbox"]["workspaceAccess"], string> = {
  none: "不暴露工作区",
  ro: "只读工作区",
  rw: "读写工作区",
};

const skillSourceLabel: Record<ProjectListItem["skills"]["catalogEntries"][number]["source"], string> = {
  bundled: "官方",
  managed: "共享",
  workspace: "本地",
  config_only: "仅配置",
};

function formatModelName(ref: string): string {
  const name = ref.includes("/") ? ref.split("/").pop()! : ref;
  const map: Record<string, string> = {
    "claude-opus-4-6": "Claude Opus",
    "claude-sonnet-4-6": "Claude Sonnet",
    "claude-haiku-4-5": "Claude Haiku",
    "gpt-4": "GPT-4",
    "gpt-4o": "GPT-4o",
    "gpt-5": "GPT-5",
  };
  return map[name] ?? name;
}

function deriveTemplateId(project: ProjectListItem): ProjectTemplateId {
  if (project.memory.mode === "stateless" && project.sandbox.mode === "off") {
    return "stateless";
  }

  if (project.sandbox.mode !== "off") {
    return "sandboxed";
  }

  return "general";
}

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

function formatModelLabel(modelRef: string, alias?: string | null): string {
  return alias ? `${alias} · ${formatModelName(modelRef)}` : formatModelName(modelRef);
}

export function ProjectDetail({
  project,
  managerAuth,
  bulkIntent,
  selectedCount,
  deleting,
  activeAction,
  scanningCompatibility,
  smokeTesting,
  modelUpdating,
  memoryUpdating,
  templateApplying,
  catalogActionKey,
  smokeTestResult,
  templates,
  onEdit,
  onDelete,
  onRunAction,
  onScanCompatibility,
  onRunSmokeTest,
  onUpdateModel,
  onUpdateMemoryMode,
  onApplyTemplate,
  onManageHook,
  onManageSkill,
  showAgentList = true,
  inline,
}: ProjectDetailProps) {
  const [modelRef, setModelRef] = useState("");
  const [restartIfRunning, setRestartIfRunning] = useState(true);
  const [memoryMode, setMemoryMode] = useState<ProjectMemoryMode>("normal");
  const [restartMemoryIfRunning, setRestartMemoryIfRunning] = useState(true);
  const [templateId, setTemplateId] = useState<ProjectTemplateId>("general");
  const [restartTemplateIfRunning, setRestartTemplateIfRunning] = useState(true);
  const [draftHookName, setDraftHookName] = useState("");
  const [draftSkillName, setDraftSkillName] = useState("");
  const [showChannelConfig, setShowChannelConfig] = useState(false);

  useEffect(() => {
    if (!project) {
      setModelRef("");
      setRestartIfRunning(true);
      setMemoryMode("normal");
      setRestartMemoryIfRunning(true);
      setTemplateId("general");
      setRestartTemplateIfRunning(true);
      setDraftHookName("");
      setDraftSkillName("");
      return;
    }

    setModelRef(project.model.primaryRef ?? project.model.configuredModels[0]?.ref ?? "");
    setRestartIfRunning(true);
    setMemoryMode(project.memory.mode);
    setRestartMemoryIfRunning(true);
    setTemplateId(deriveTemplateId(project));
    setRestartTemplateIfRunning(true);
    setDraftHookName("");
    setDraftSkillName("");
  }, [project]);

  useEffect(() => {
    setShowChannelConfig(false);
  }, [project?.id]);

  if (!project) {
    if (inline) {
      return null;
    }
    return (
      <aside className="detail-panel">
        <p className="panel-kicker">机器人详情</p>
        <h2>选择一个机器人</h2>
        <p className="muted-copy">
          点击任意一个机器人查看详情。
        </p>
      </aside>
    );
  }

  const selectedTemplate =
    templates.find((template) => template.id === templateId) ?? templates[0] ?? null;
  const projectId = project.id;
  const officialSkillPreview = project.skills.catalogEntries
    .filter((entry) => entry.official)
    .slice(0, 6)
    .map((entry) => entry.name);

  function isCatalogActionBusy(kind: "hook" | "skill", name: string, mode: "enable" | "disable" | "remove") {
    return catalogActionKey === `${kind}:${projectId}:${name}:${mode}`;
  }

  const activeSmokeResult =
    smokeTestResult?.projectId === project.id ? smokeTestResult : project.lastSmokeTest;

  const detailContent = (
    <>
      {showAgentList ? <AgentList agents={project.agents ?? []} /> : null}

      {!inline ? (
        <>
          <header className="detail-header">
            <div>
              <p className="panel-kicker">机器人详情</p>
              <h2>{project.name}</h2>
            </div>
            <div className="project-badges">
              <span className="tag-pill">端口 {project.gatewayPort}</span>
              <span className="tag-pill">{authStrategyLabel[project.auth.strategy]}</span>
              <span className={`status-pill ${compatibilityTone[project.compatibility.status]}`}>
                {compatibilityLabel[project.compatibility.status]}
              </span>
            </div>
          </header>

          <p className="muted-copy">{project.description}</p>
        </>
      ) : null}

      <div className="detail-actions">
        <a href={project.endpoints.controlUiUrl} target="_blank" rel="noreferrer">
          打开控制台 &#8599;
        </a>
        <a href={project.endpoints.gatewayUrl} target="_blank" rel="noreferrer">
          打开服务 &#8599;
        </a>
        <a href={project.endpoints.healthUrl} target="_blank" rel="noreferrer">
          健康检查 &#8599;
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
          编辑设置
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onScanCompatibility(project.id)}
          disabled={scanningCompatibility || activeAction !== null}
        >
          {scanningCompatibility ? "检测中..." : "重新检测"}
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => onRunSmokeTest(project.id)}
          disabled={smokeTesting || activeAction !== null}
        >
          {smokeTesting ? "测试中..." : "运行测试"}
        </button>
        <button
          type="button"
          className="ghost-button ghost-button-danger"
          onClick={() => onDelete(project.id)}
          disabled={deleting}
        >
          {deleting ? "删除中..." : "删除机器人"}
        </button>
      </div>

      <section className="detail-section">
        <div className="panel-action-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => setShowChannelConfig((value) => !value)}
            aria-expanded={showChannelConfig}
            aria-controls={`channel-config-panel-${projectId}`}
          >
            {showChannelConfig ? "消息通道 ▲" : "消息通道 ▼"}
          </button>
        </div>
        {showChannelConfig ? (
          <div id={`channel-config-panel-${projectId}`}>
            <ChannelConfig projectId={projectId} />
          </div>
        ) : null}
      </section>

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
                  {check.supported ? "支持" : "部分支持"}
                </span>{" "}
                {check.message}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="detail-section">
        <p className="section-label">功能测试</p>
        {activeSmokeResult ? (
          <>
            <div className="callout-box">
              <strong>最近一次：</strong> {formatLastSeen(activeSmokeResult.finishedAt)}
              <br />
              <strong>通过率：</strong> {activeSmokeResult.summary.passed}/{activeSmokeResult.summary.total}
              <br />
              <strong>提供方 / 模型：</strong> {activeSmokeResult.summary.provider ?? "未知"} /{" "}
              {activeSmokeResult.summary.model ? formatModelName(activeSmokeResult.summary.model) : "未知"}
            </div>
            <div className="catalog-list">
              {activeSmokeResult.results.map((result) => (
                <article key={result.id} className="catalog-item">
                  <div className="catalog-item-header">
                    <div className="catalog-item-title">
                      <strong>{result.label}</strong>
                      <span className={`status-pill ${result.ok ? "tone-ok" : "tone-bad"}`}>
                        {result.ok ? "通过" : "失败"}
                      </span>
                      <span className="tag-pill">{result.durationMs}ms</span>
                      {result.toolHint ? <span className="tag-pill">{result.toolHint}</span> : null}
                    </div>
                  </div>
                  <div className="catalog-item-meta">{result.outputText || "没有文本输出"}</div>
                  {result.error ? <div className="catalog-item-meta">{result.error}</div> : null}
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="callout-box callout-box-muted">
            还没有运行过测试。点击"运行测试"检查机器人是否工作正常。
          </div>
        )}
      </section>

      <section className="detail-section">
        <p className="section-label">服务 / 认证</p>
        <dl className="detail-list">
          <div>
            <dt>默认认证</dt>
            <dd>{managerAuth?.label ?? "未配置"}</dd>
          </div>
          <div>
            <dt>当前机器人认证</dt>
            <dd>{project.auth.label}</dd>
          </div>
          <div>
            <dt>覆盖模式</dt>
            <dd>{project.auth.mode === "inherit_manager" ? "继承默认" : "自定义"}</dd>
          </div>
          <div>
            <dt>最后探测</dt>
            <dd>{formatLastSeen(project.lastSeenAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <p className="section-label">默认模型</p>
        <div className="callout-box">
          <strong>当前默认：</strong>{" "}
          {project.model.primaryRef ? formatModelName(project.model.primaryRef) : "未显式设置"}
          <br />
          <strong>最近实测：</strong>{" "}
          {project.model.lastObservedRef
            ? `${project.model.lastObservedProvider ?? "未知"} / ${formatModelName(project.model.lastObservedRef)}`
            : "还没有测试数据"}
          <br />
          <strong>实测时间：</strong> {formatLastSeen(project.model.lastObservedAt)}
          <br />
          <strong>模型目录：</strong>{" "}
          {project.model.catalogMode === "allowlist"
            ? `白名单（${project.model.configuredModels.length} 个已配置模型）`
            : "开放（未限制白名单，可直接手填模型引用）"}
          <br />
          <strong>兜底模型：</strong>{" "}
          {project.model.fallbackRefs.length > 0
            ? project.model.fallbackRefs.map((ref) => formatModelName(ref)).join(", ")
            : "未设置"}
        </div>
        {project.model.configuredModels.length > 0 ? (
          <label className="form-field">
            <span>已配置模型</span>
            <select
              value={
                project.model.configuredModels.some((entry) => entry.ref === modelRef) ? modelRef : "__custom__"
              }
              onChange={(event) => {
                if (event.target.value === "__custom__") {
                  return;
                }
                setModelRef(event.target.value);
              }}
              disabled={modelUpdating}
            >
              {project.model.configuredModels.map((entry) => (
                <option key={entry.ref} value={entry.ref}>
                  {formatModelLabel(entry.ref, entry.alias)}
                </option>
              ))}
              <option value="__custom__">手动输入其他模型</option>
            </select>
          </label>
        ) : null}
        <label className="form-field">
          <span>模型引用</span>
          <input
            value={modelRef}
            onChange={(event) => setModelRef(event.target.value)}
            placeholder="例如 claude-opus-4-6"
            disabled={modelUpdating}
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={restartIfRunning}
            onChange={(event) => setRestartIfRunning(event.target.checked)}
            disabled={modelUpdating}
          />
          <span>运行中时自动重启，让模型变更立即生效</span>
        </label>
        <div className="panel-action-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => onUpdateModel(project.id, { modelRef, restartIfRunning })}
            disabled={modelUpdating || modelRef.trim().length === 0 || activeAction !== null}
          >
            {modelUpdating ? "保存中..." : "保存默认模型"}
          </button>
        </div>
      </section>

      <section className="detail-section">
        <p className="section-label">记忆策略</p>
        <div className="callout-box">
          <strong>当前模式：</strong> {memoryModeLabel[project.memory.mode]}<br />
          <strong>读取记忆：</strong> {project.memory.canReadMemory ? "允许" : "关闭"}<br />
          <strong>写入记忆：</strong> {project.memory.canWriteMemory ? "允许" : "关闭"}<br />
          <strong>记忆插件：</strong> {project.memory.effectivePluginSlot ?? "未设置"}<br />
          <strong>会话记忆钩子：</strong> {project.memory.sessionMemoryHookEnabled ? "启用" : "关闭"}<br />
          <strong>记忆刷新：</strong> {project.memory.memoryFlushEnabled ? "启用" : "关闭"}
        </div>
        <label className="form-field">
          <span>记忆模式</span>
          <select
            value={memoryMode}
            onChange={(event) => setMemoryMode(event.target.value as ProjectMemoryMode)}
            disabled={memoryUpdating}
          >
            <option value="normal">正常记忆</option>
            <option value="locked">锁定记忆</option>
            <option value="stateless">白纸模式</option>
          </select>
        </label>
        <div className="callout-box callout-box-muted">{memoryModeDescription[memoryMode]}</div>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={restartMemoryIfRunning}
            onChange={(event) => setRestartMemoryIfRunning(event.target.checked)}
            disabled={memoryUpdating}
          />
          <span>运行中时自动重启，让记忆策略立即生效</span>
        </label>
        <div className="panel-action-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => onUpdateMemoryMode(project.id, { mode: memoryMode, restartIfRunning: restartMemoryIfRunning })}
            disabled={memoryUpdating || activeAction !== null || memoryMode === project.memory.mode}
          >
            {memoryUpdating ? "保存中..." : "保存记忆策略"}
          </button>
        </div>
      </section>

      <section className="detail-section">
        <p className="section-label">钩子</p>
        <div className="callout-box">
          <strong>已配置：</strong> {project.hooks.entries.length} 个
          <br />
          <strong>已启用：</strong> {project.hooks.enabledCount} 个
        </div>
        <div className="form-grid">
          <label className="form-field">
            <span>钩子名称</span>
            <input
              value={draftHookName}
              onChange={(event) => setDraftHookName(event.target.value)}
              placeholder="daily-summary"
              disabled={catalogActionKey !== null}
            />
          </label>
        </div>
        <div className="panel-action-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => onManageHook(project.id, draftHookName, "enable")}
            disabled={catalogActionKey !== null || draftHookName.trim().length === 0}
          >
            启用钩子
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onManageHook(project.id, draftHookName, "disable")}
            disabled={catalogActionKey !== null || draftHookName.trim().length === 0}
          >
            禁用钩子
          </button>
          <button
            type="button"
            className="ghost-button ghost-button-danger"
            onClick={() => onManageHook(project.id, draftHookName, "remove")}
            disabled={catalogActionKey !== null || draftHookName.trim().length === 0}
          >
            移除条目
          </button>
        </div>
        {project.hooks.entries.length > 0 ? (
          <div className="catalog-list">
            {project.hooks.entries.map((entry) => (
              <article key={entry.name} className="catalog-item">
                <div className="catalog-item-header">
                  <div className="catalog-item-title">
                    <strong>{entry.name}</strong>
                    <span className={`status-pill ${entry.enabled ? "tone-ok" : "tone-muted"}`}>
                      {entry.enabled ? "已启用" : "已禁用"}
                    </span>
                    <span className="tag-pill">内置</span>
                  </div>
                  <div className="catalog-item-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onManageHook(project.id, entry.name, "enable")}
                      disabled={catalogActionKey !== null || entry.enabled}
                    >
                      {isCatalogActionBusy("hook", entry.name, "enable") ? "处理中..." : "启用"}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onManageHook(project.id, entry.name, "disable")}
                      disabled={catalogActionKey !== null || !entry.enabled}
                    >
                      {isCatalogActionBusy("hook", entry.name, "disable") ? "处理中..." : "禁用"}
                    </button>
                    <button
                      type="button"
                      className="ghost-button ghost-button-danger"
                      onClick={() => onManageHook(project.id, entry.name, "remove")}
                      disabled={catalogActionKey !== null}
                    >
                      {isCatalogActionBusy("hook", entry.name, "remove") ? "处理中..." : "移除"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="callout-box callout-box-muted">
            还没有任何钩子条目，直接在上面填名字就能创建并启用。
          </div>
        )}
      </section>

      <section className="detail-section">
        <p className="section-label">技能</p>
        <div className="callout-box">
          <strong>已配置：</strong> {project.skills.configuredEntries.length} 个
          <br />
          <strong>已启用：</strong> {project.skills.enabledCount} 个
          <br />
          <strong>官方技能：</strong> {project.skills.officialCount} 个
          <br />
          <strong>非官方技能：</strong> {project.skills.customCount} 个
        </div>
        {officialSkillPreview.length > 0 ? (
          <div className="callout-box callout-box-muted">
            <strong>官方技能示例</strong>
            <br />
            {officialSkillPreview.join(", ")}
          </div>
        ) : null}
        <div className="form-grid">
          <label className="form-field">
            <span>技能名称</span>
            <input
              list={`skill-catalog-${project.id}`}
              value={draftSkillName}
              onChange={(event) => setDraftSkillName(event.target.value)}
              placeholder="github"
              disabled={catalogActionKey !== null}
            />
            <datalist id={`skill-catalog-${project.id}`}>
              {project.skills.catalogEntries.map((entry) => (
                <option key={entry.name} value={entry.name}>
                  {skillSourceLabel[entry.source]}
                </option>
              ))}
            </datalist>
          </label>
        </div>
        <div className="panel-action-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() => onManageSkill(project.id, draftSkillName, "enable")}
            disabled={catalogActionKey !== null || draftSkillName.trim().length === 0}
          >
            启用技能
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onManageSkill(project.id, draftSkillName, "disable")}
            disabled={catalogActionKey !== null || draftSkillName.trim().length === 0}
          >
            禁用技能
          </button>
          <button
            type="button"
            className="ghost-button ghost-button-danger"
            onClick={() => onManageSkill(project.id, draftSkillName, "remove")}
            disabled={catalogActionKey !== null || draftSkillName.trim().length === 0}
          >
            移除条目
          </button>
        </div>
        {project.skills.configuredEntries.length > 0 ? (
          <div className="catalog-list">
            {project.skills.configuredEntries.map((entry) => (
              <article key={entry.name} className="catalog-item">
                <div className="catalog-item-header">
                  <div className="catalog-item-title">
                    <strong>{entry.name}</strong>
                    <span className={`status-pill ${entry.enabled ? "tone-ok" : "tone-muted"}`}>
                      {entry.enabled ? "已启用" : "已禁用"}
                    </span>
                    <span className="tag-pill">{entry.official ? "官方" : "自定义"}</span>
                    <span className="tag-pill">{skillSourceLabel[entry.source]}</span>
                  </div>
                  <div className="catalog-item-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onManageSkill(project.id, entry.name, "enable")}
                      disabled={catalogActionKey !== null || entry.enabled}
                    >
                      {isCatalogActionBusy("skill", entry.name, "enable") ? "处理中..." : "启用"}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onManageSkill(project.id, entry.name, "disable")}
                      disabled={catalogActionKey !== null || !entry.enabled}
                    >
                      {isCatalogActionBusy("skill", entry.name, "disable") ? "处理中..." : "禁用"}
                    </button>
                    <button
                      type="button"
                      className="ghost-button ghost-button-danger"
                      onClick={() => onManageSkill(project.id, entry.name, "remove")}
                      disabled={catalogActionKey !== null}
                    >
                      {isCatalogActionBusy("skill", entry.name, "remove") ? "处理中..." : "移除"}
                    </button>
                  </div>
                </div>
                {entry.path ? <div className="catalog-item-meta">{entry.path}</div> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="callout-box callout-box-muted">
            还没有任何技能条目。可以直接输入名字启用，也可以从列表里选择。
          </div>
        )}
      </section>

      <section className="detail-section">
        <p className="section-label">沙盒</p>
        <div className="callout-box">
          <strong>当前模式：</strong> {sandboxModeLabel[project.sandbox.mode]}<br />
          <strong>后端：</strong> {sandboxBackendLabel[project.sandbox.backend]}<br />
          <strong>作用域：</strong> {sandboxScopeLabel[project.sandbox.scope]}<br />
          <strong>工作区访问：</strong> {workspaceAccessLabel[project.sandbox.workspaceAccess]}<br />
          <strong>Docker 网络：</strong> {project.sandbox.dockerNetwork ?? "默认值"}<br />
          <strong>Docker 镜像：</strong> {project.sandbox.dockerImage ?? "OpenClaw 默认镜像"}
        </div>
        {project.sandbox.toolAllow.length > 0 || project.sandbox.toolDeny.length > 0 ? (
          <div className="callout-box callout-box-muted">
            <strong>沙盒工具策略</strong>
            <br />
            允许：{project.sandbox.toolAllow.length > 0 ? project.sandbox.toolAllow.join(", ") : "默认"}
            <br />
            禁止：{project.sandbox.toolDeny.length > 0 ? project.sandbox.toolDeny.join(", ") : "默认"}
          </div>
        ) : null}
      </section>

      <section className="detail-section">
        <p className="section-label">模板</p>
        <label className="form-field">
          <span>策略模板</span>
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value as ProjectTemplateId)}
            disabled={templateApplying || templates.length === 0}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        {selectedTemplate ? (
          <>
            <div className="callout-box">
              <strong>{selectedTemplate.summary}</strong>
              <br />
              {selectedTemplate.description}
              <br />
              <strong>模板记忆：</strong> {memoryModeLabel[selectedTemplate.memoryMode]}
              <br />
              <strong>模板沙盒：</strong> {sandboxModeLabel[selectedTemplate.sandbox.mode]} /{" "}
              {sandboxBackendLabel[selectedTemplate.sandbox.backend]} / {sandboxScopeLabel[selectedTemplate.sandbox.scope]} /{" "}
              {workspaceAccessLabel[selectedTemplate.sandbox.workspaceAccess]}
            </div>
            <div className="callout-box callout-box-muted">
              {selectedTemplate.notes.map((note) => (
                <div key={note}>{note}</div>
              ))}
            </div>
          </>
        ) : (
          <div className="callout-box callout-box-muted">当前没有可用模板。</div>
        )}
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={restartTemplateIfRunning}
            onChange={(event) => setRestartTemplateIfRunning(event.target.checked)}
            disabled={templateApplying || templates.length === 0}
          />
          <span>运行中时自动重启，让模板立即生效</span>
        </label>
        <div className="panel-action-row">
          <button
            type="button"
            className="ghost-button"
            onClick={() =>
              onApplyTemplate(project.id, {
                templateId,
                restartIfRunning: restartTemplateIfRunning,
              })
            }
            disabled={templateApplying || activeAction !== null || selectedTemplate === null}
          >
            {templateApplying ? "套用中..." : "套用模板"}
          </button>
        </div>
      </section>

      <section className="detail-section">
        <p className="section-label">路径</p>
        <dl className="detail-list">
          <div>
            <dt>根目录</dt>
            <dd>{project.paths.rootPath}</dd>
          </div>
          <div>
            <dt>配置文件</dt>
            <dd>{project.paths.configPath}</dd>
          </div>
          <div>
            <dt>工作区</dt>
            <dd>{project.paths.workspacePath}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-section">
        <p className="section-label">单个与批量</p>
        <div className="callout-box">
          <strong>单个管理：</strong> 打开这个机器人自己的控制台。<br />
          <strong>批量操作：</strong> 对选中的多个机器人统一执行操作。
        </div>
        <div className="callout-box callout-box-muted">
          控制台以新标签页打开。
        </div>
      </section>

      <section className="detail-section">
        <p className="section-label">批量上下文</p>
        <div className="callout-box">
          <strong>当前已选：</strong> {selectedCount} 个机器人
          <br />
          <strong>当前面板：</strong>{" "}
          {bulkIntent ? bulkDescriptions[bulkIntent] : "先在上方选择一个批量操作类型。"}
        </div>
      </section>
    </>
  );

  if (inline) {
    return <div className="detail-inline">{detailContent}</div>;
  }

  return <aside className="detail-panel">{detailContent}</aside>;
}
