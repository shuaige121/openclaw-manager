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
  const intentAvailability: Record<BulkIntent, { enabled: boolean; reason: string }> = {
    hooks: {
      enabled: selectedProjects.every((project) => project.capabilities.bulkHooks),
      reason: "有项目禁用了批量 Hook。",
    },
    skills: {
      enabled: selectedProjects.every((project) => project.capabilities.bulkSkills),
      reason: "有项目禁用了批量 Skill。",
    },
    memory: {
      enabled: selectedProjects.every(
        (project) => project.capabilities.bulkMemory && project.memory.mode === "normal",
      ),
      reason: "有项目不是 normal 记忆模式，或禁用了批量记忆。",
    },
    config: {
      enabled: selectedProjects.every((project) => project.capabilities.bulkConfigPatch),
      reason: "有项目禁用了批量配置 Patch。",
    },
  };

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
            disabled={!intentAvailability[intent as BulkIntent].enabled}
            title={intentAvailability[intent as BulkIntent].enabled ? undefined : intentAvailability[intent as BulkIntent].reason}
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
