import type { ActionHistoryEntry } from "../types";

type ActionHistoryPanelProps = {
  title: string;
  subtitle: string;
  items: ActionHistoryEntry[];
  emptyMessage: string;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function ActionHistoryPanel({
  title,
  subtitle,
  items,
  emptyMessage,
}: ActionHistoryPanelProps) {
  return (
    <aside className="detail-panel">
      <header className="detail-header">
        <div>
          <p className="panel-kicker">动作历史</p>
          <h2>{title}</h2>
        </div>
      </header>

      <p className="muted-copy">{subtitle}</p>

      {items.length === 0 ? (
        <div className="callout-box callout-box-muted">{emptyMessage}</div>
      ) : (
        <div className="history-list">
          {items.map((item) => (
            <article key={item.id} className={`history-item ${item.ok ? "history-item-ok" : "history-item-bad"}`}>
              <header className="history-item-header">
                <strong>{item.summary}</strong>
                <span className="tag-pill">{formatTimestamp(item.createdAt)}</span>
              </header>
              <p className="muted-copy">{item.projects.map((project) => project.name).join("、")}</p>
              <p className="history-detail">{item.detail}</p>
              {item.command ? (
                <pre className="history-output">
                  <code>{item.command}</code>
                </pre>
              ) : null}
              {item.stdout ? (
                <pre className="history-output">
                  <code>{item.stdout}</code>
                </pre>
              ) : null}
              {item.stderr ? (
                <pre className="history-output history-output-error">
                  <code>{item.stderr}</code>
                </pre>
              ) : null}
              {item.durationMs !== null ? (
                <span className="summary-hint">耗时 {item.durationMs}ms</span>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
