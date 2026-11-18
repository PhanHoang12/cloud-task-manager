import { useId, useState, type ReactNode } from "react";
import { ArrowDownWideNarrow, SlidersHorizontal } from "lucide-react";
import "./collection-toolbar.css";

export default function CollectionToolbar({ scope, search, sort, sortOptions, onSort, activeCount, disabled, children, actions }: {
  scope: "projects" | "tasks"; search: ReactNode; sort: string; sortOptions: readonly { value: string; label: string }[];
  onSort: (value: string) => void; activeCount: number; disabled: boolean; children: ReactNode; actions?: ReactNode;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return <div className="collection-controls">
    <div className={`collection-toolbar${scope === "tasks" ? " kb-control-bar" : ""}`}>
      {search}
      <button type="button" className="ui-button ui-secondary collection-filter-toggle" aria-expanded={expanded} aria-controls={id} disabled={disabled}
        onClick={() => setExpanded(value => !value)}><SlidersHorizontal size={16} aria-hidden="true"/>Filters{activeCount > 0 && <span className="collection-filter-count">{activeCount}</span>}</button>
      <label className="collection-sort"><ArrowDownWideNarrow size={16} aria-hidden="true"/><select aria-label={`Sort ${scope}`} value={sort} disabled={disabled} onChange={event => onSort(event.target.value)}>
        {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      {actions}
    </div>
    <div id={id} className="collection-filter-panel" role="group" aria-label={`${scope === "projects" ? "Project" : "Task"} filters`} hidden={!expanded}>
      {children}
    </div>
  </div>;
}
