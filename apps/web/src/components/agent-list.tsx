import type { AgentInfo } from "../types";

type AgentListProps = {
  agents: AgentInfo[];
};

const memoryModeLabels = {
  normal: "正常",
  locked: "锁定",
  stateless: "无记忆",
} as const;

const sandboxModeLabels = {
  off: "关闭",
  all: "全部隔离",
  "non-main": "非主隔离",
} as const;

function formatMemoryMode(memoryMode: string): string {
  return memoryModeLabels[memoryMode as keyof typeof memoryModeLabels] ?? memoryMode;
}

function formatSandboxMode(sandboxMode: string): string {
  return sandboxModeLabels[sandboxMode as keyof typeof sandboxModeLabels] ?? sandboxMode;
}

function formatTools(tools: AgentInfo["tools"]): string {
  const denyAll = tools.deny.length === 1 && tools.deny[0] === "*";

  if (denyAll) {
    if (tools.allow.length > 0) {
      return `仅 ${tools.allow.join(", ")}`;
    }

    return "全部禁用";
  }

  if (tools.allow.length === 0 && tools.deny.length === 0) {
    return "全部开放";
  }

  return "自定义";
}

function formatCardChannels(boundChannels: string[]): string {
  return boundChannels.length > 0 ? boundChannels.join("、") : "无通道";
}

function formatSummaryChannels(boundChannels: string[]): string {
  return boundChannels.join(", ") || "无";
}

function capitalizeToken(token: string): string {
  if (token.length === 0) {
    return token;
  }

  return `${token[0].toUpperCase()}${token.slice(1)}`;
}

function prettifyModelRef(modelRef: string): string {
  const trimmedModelRef = modelRef.trim();

  if (trimmedModelRef.length === 0) {
    return "未设置";
  }

  const providerStripped = trimmedModelRef.includes("/")
    ? trimmedModelRef.split("/").slice(1).join("/")
    : trimmedModelRef;
  const modelSlug = providerStripped.split("/").at(-1) ?? providerStripped;

  if (modelSlug.startsWith("claude-opus")) {
    return "Claude Opus";
  }

  if (modelSlug.startsWith("claude-sonnet")) {
    return "Claude Sonnet";
  }

  return modelSlug
    .split(/[-_]+/)
    .filter((token) => token.length > 0)
    .map(capitalizeToken)
    .join(" ");
}

export function AgentList({ agents }: AgentListProps) {
  const isSingleDefaultAgent = agents.length === 1 && agents[0]?.isDefault === true;
  const heading = isSingleDefaultAgent ? "人设" : "人设列表";

  if (agents.length === 0) {
    return (
      <section className="agent-list" aria-label={heading}>
        <p className="section-label">{heading}</p>
        <p className="agent-list-empty muted-copy">暂无人设</p>
      </section>
    );
  }

  if (isSingleDefaultAgent) {
    const agent = agents[0];

    return (
      <section className="agent-list" aria-label={heading}>
        <p className="section-label">{heading}</p>
        <p className="agent-list-summary">
          {agent.emoji} {agent.name} · {prettifyModelRef(agent.model)} · 记忆:{" "}
          {formatMemoryMode(agent.memoryMode)} · 通道: {formatSummaryChannels(agent.boundChannels)}
        </p>
      </section>
    );
  }

  return (
    <section className="agent-list" aria-label={heading}>
      <p className="section-label">{heading}</p>
      <div className="agent-list-grid">
        {agents.map((agent) => (
          <article key={agent.id} className="agent-list-card">
            <div className="agent-list-card-header">
              <div className="agent-list-card-title">
                <span className="agent-list-card-emoji" aria-hidden="true">
                  {agent.emoji}
                </span>
                <h3>{agent.name}</h3>
              </div>
            </div>

            <dl className="agent-list-meta">
              <div>
                <dt>模型</dt>
                <dd>{prettifyModelRef(agent.model)}</dd>
              </div>
              <div>
                <dt>记忆</dt>
                <dd>{formatMemoryMode(agent.memoryMode)}</dd>
              </div>
              <div>
                <dt>沙盒</dt>
                <dd>{formatSandboxMode(agent.sandboxMode)}</dd>
              </div>
              <div>
                <dt>工具</dt>
                <dd>{formatTools(agent.tools)}</dd>
              </div>
              <div>
                <dt>通道</dt>
                <dd>{formatCardChannels(agent.boundChannels)}</dd>
              </div>
            </dl>

            {agent.isDefault ? (
              <div className="agent-list-card-footer">
                <span className="agent-list-badge">默认</span>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
