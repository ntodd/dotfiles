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

export type FeedbackListAction =
  | { kind: "overview" }
  | { kind: "toggle-select"; index: number }
  | { kind: "disposition"; index: number }
  | { kind: "edit-response"; index: number }
  | { kind: "edit-note"; index: number }
  | { kind: "chat"; index: number }
  | { kind: "investigate"; index: number }
  | { kind: "fix"; index: number }
  | { kind: "verify"; index: number }
  | { kind: "refresh" }
  | { kind: "submit" }
  | { kind: "close" };

export interface FeedbackRow {
  index: number;
  status: string;
  kind: string;
  location: string;
  title: string;
  selected: boolean;
  noted: boolean;
  outdated: boolean;
}

function statusColor(status: string): "error" | "warning" | "success" | "muted" | "accent" {
  if (status === "untriaged") return "warning";
  if (status === "accepted" || status === "fixed") return "accent";
  if (status === "verified" || status === "disputed" || status === "resolved") return "success";
  if (status === "deferred" || status === "replied") return "muted";
  return "error";
}

export class FeedbackList extends Container {
  #list: SelectList;
  #theme: Theme;
  #done: (result: FeedbackListAction) => void;
  #selectedIndex: number;
  #header: string;

  constructor(
    tui: TUI,
    theme: Theme,
    keybindings: KeybindingsManager,
    items: FeedbackRow[],
    header: string,
    done: (result: FeedbackListAction) => void,
  ) {
    super();
    this.#theme = theme;
    this.#done = done;
    this.#selectedIndex = items[0]?.index ?? 0;
    this.#header = header;

    const selectItems: SelectItem[] = items.map(row => {
      const suffix = [row.kind === "check" ? "check" : "", row.outdated ? "outdated" : "", row.noted ? "note" : ""]
        .filter(Boolean)
        .join(" · ");
      return {
        value: String(row.index),
        label: `${theme.fg(statusColor(row.status), row.status.toUpperCase())}  ${row.title}`,
        icon: row.selected ? "*" : undefined,
        description: suffix ? `${row.location} · ${suffix}` : row.location,
      };
    });
    this.#list = new SelectList(selectItems, Math.min(items.length, 14), getSelectListTheme());
    this.#list.onSelectionChange = item => {
      this.#selectedIndex = Number(item.value);
    };
    this.#list.onSelect = item => {
      this.#done({ kind: "chat", index: Number(item.value) });
    };
    this.addChild(this.#list);
    void tui;
    void keybindings;
  }

  override handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q") {
      this.#done({ kind: "close" });
      return;
    }
    const indexedActions: Record<string, FeedbackListAction["kind"]> = {
      x: "toggle-select",
      d: "disposition",
      r: "edit-response",
      n: "edit-note",
      c: "chat",
      i: "investigate",
      f: "fix",
      v: "verify",
    };
    const indexedKind = indexedActions[data];
    if (indexedKind) {
      this.#done({ kind: indexedKind, index: this.#selectedIndex } as FeedbackListAction);
      return;
    }
    if (data === "o") {
      this.#done({ kind: "overview" });
      return;
    }
    if (data === "u") {
      this.#done({ kind: "refresh" });
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
    const lines: string[] = [this.#theme.fg("accent", this.#header), ""];
    for (const line of this.#list.render(inner)) {
      lines.push(truncateToWidth(replaceTabs(line), width));
    }
    lines.push("");
    const help = this.#theme.fg(
      "muted",
      "enter/c discuss  i investigate  f fix  v verify  d status  r reply  x select  u refresh  s submit  o overview  q close",
    );
    lines.push(truncateToWidth(help, width));
    return lines;
  }

  override invalidate(): void {
    this.#list.invalidate();
    super.invalidate();
  }
}
