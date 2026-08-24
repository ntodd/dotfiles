// Interactive issues list for the pr-review extension.
//
// Rendered through `ctx.ui.custom(...)` from the `/pr-issues` command loop.
// The component is deliberately stateless between renders: the command
// handler owns the ReviewState and re-invokes `custom()` after every action,
// so each pass gets a fresh list built from the latest state.
//
// Keys:
//   up/down (or j/k)  navigate
//   /                 filter by text
//   enter / c         quick tool-free discussion
//   i                 investigate with the issue-digger agent
//   v                 open the full review viewer and switch presentation format
//   o                 discuss the PR walkthrough and senior-engineering gate
//   m                 toggle "flag for inline PR comment"
//   n                 edit a personal note for the issue
//   s                 go to submit

import {
  Container,
  KeybindingsManager,
  SelectList,
  type SelectItem,
  TUI,
  matchesKey,
  replaceTabs,
  truncateToWidth,
} from "@oh-my-pi/pi-tui";
import { getSelectListTheme, type Theme } from "@oh-my-pi/pi-coding-agent";

export type IssueListAction =
  | { kind: "overview" }
  | { kind: "view" }
  | { kind: "toggle-flag"; index: number }
  | { kind: "edit-note"; index: number }
  | { kind: "chat"; index: number }
  | { kind: "investigate"; index: number }
  | { kind: "submit" }
  | { kind: "close" };

export interface IssueRow {
  index: number;
  severity: string;
  location: string;
  title: string;
  flagged: boolean;
  noted: boolean;
}

function severityColor(severity: string): "error" | "warning" | "success" | "muted" {
  const s = severity.toLowerCase();
  if (s === "blocker" || s === "critical" || s === "major") return "error";
  if (s === "minor") return "warning";
  if (s === "nit" || s === "style" || s === "praise") return "success";
  return "muted";
}

export class IssueList extends Container {
  #list: SelectList;
  #theme: Theme;
  #done: (result: IssueListAction) => void;
  #selectedFindingIndex: number;
  #header: string;

  constructor(
    tui: TUI,
    theme: Theme,
    keybindings: KeybindingsManager,
    items: IssueRow[],
    header: string,
    done: (result: IssueListAction) => void,
  ) {
    super();
    this.#theme = theme;
    this.#done = done;
    this.#selectedFindingIndex = items[0]?.index ?? 0;
    this.#header = header;

    const selectItems: SelectItem[] = items.map(row => ({
      value: String(row.index),
      label: `${theme.fg(severityColor(row.severity), row.severity.toUpperCase())}  ${row.title}`,
      icon: row.flagged ? "⚑" : undefined,
      description: row.noted ? `${row.location} · note` : row.location,
    }));
    this.#list = new SelectList(selectItems, Math.min(items.length, 14), getSelectListTheme());
    this.#list.onSelectionChange = item => {
      this.#selectedFindingIndex = Number(item.value);
    };
    this.#list.onSelect = item => {
      this.#done({ kind: "chat", index: Number(item.value) });
    };
    this.addChild(this.#list);
    void tui;
    void keybindings;
  }

  override handleInput(data: string): void {
    // Actions that change state or leave the list are handled here;
    // navigation and filtering fall through to the select list.
    if (matchesKey(data, "escape") || data === "q") {
      this.#done({ kind: "close" });
      return;
    }
    if (data === "m") {
      this.#done({ kind: "toggle-flag", index: this.#selectedFindingIndex });
      return;
    }
    if (data === "n") {
      this.#done({ kind: "edit-note", index: this.#selectedFindingIndex });
      return;
    }
    if (data === "c") {
      this.#done({ kind: "chat", index: this.#selectedFindingIndex });
      return;
    }
    if (data === "i") {
      this.#done({ kind: "investigate", index: this.#selectedFindingIndex });
      return;
    }
    if (data === "v") {
      this.#done({ kind: "view" });
      return;
    }
    if (data === "o") {
      this.#done({ kind: "overview" });
      return;
    }
    if (data === "s") {
      this.#done({ kind: "submit" });
      return;
    }
    this.#list.handleInput(data);
  }

  override render(width: number): readonly string[] {
    const inner = Math.max(10, width - 2);
    const lines: string[] = [];
    lines.push(this.#theme.fg("accent", this.#header));
    lines.push("");
    for (const line of this.#list.render(inner)) {
      lines.push(truncateToWidth(replaceTabs(line), width));
    }
    lines.push("");
    const help = this.#theme.fg(
      "muted",
      "enter/c: discuss  i: investigate  v: view  o: overview  m: flag  n: note  s: submit  /: filter  esc/q: close",
    );
    lines.push(truncateToWidth(help, width));
    return lines;
  }

  override invalidate(): void {
    this.#list.invalidate();
    super.invalidate();
  }
}
