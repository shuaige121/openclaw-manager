import type { BulkIntent, ProjectListItem } from "../types";

type BulkToolbarProps = {
  selectedProjects: ProjectListItem[];
  bulkIntent: BulkIntent | null;
  onIntentChange: (intent: BulkIntent) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
};

const bulkLabels: Record<BulkIntent, string> = {
  hooks: "批量 Hook",
  skills: "批量 Skill",
  memory: "批量记忆",
  config: "批量配置 Patch",
};

export function BulkToolbar({
  selectedProjects,
  bulkIntent,
  onIntentChange,
  onSelectAll,
  onClearSelection,
}: BulkToolbarProps) {
  const names = selectedProjects.map((project) => project.name).join("、");

  return (
    <section className="bulk-toolbar">
      <div>
        <p className="panel-kicker">批量操作</p>
        <h2>已选 {selectedProjects.length} 个项目</h2>
        <p className="muted-copy">
          单项目深控交给各自 Control UI，跨项目变更由 manager 统一执行。
        </p>
      </div>

      <div className="bulk-actions">
        {Object.entries(bulkLabels).map(([intent, label]) => (
          <button
            key={intent}
            type="button"
            className={`ghost-button${bulkIntent === intent ? " ghost-button-active" : ""}`}
            onClick={() => onIntentChange(intent as BulkIntent)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bulk-footer">
        <p className="muted-copy">
          当前选择：<span className="strong-inline">{names}</span>
        </p>
        <div className="bulk-footer-actions">
          <button type="button" className="link-button" onClick={onSelectAll}>
            选中全部
          </button>
          <button type="button" className="link-button" onClick={onClearSelection}>
            清空选择
          </button>
        </div>
      </div>
    </section>
  );
}
