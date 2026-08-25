import {
  Markdown,
  type TUI,
  matchesKey,
  truncateToWidth,
} from "@oh-my-pi/pi-tui";
import { getMarkdownTheme, type Theme } from "@oh-my-pi/pi-coding-agent";
import type { ReviewPresentationMode } from "./review-core.ts";

export type ReviewViewerAction =
  | { kind: "select"; mode: ReviewPresentationMode }
  | { kind: "close" };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export class ReviewViewer {
  #tui: TUI;
  #theme: Theme;
  #done: (result: ReviewViewerAction) => void;
  #mode: ReviewPresentationMode;
  #markdown: Markdown;
  #offset = 0;
  #contentHeight = 8;
  #lineCount = 0;

  constructor(
    tui: TUI,
    theme: Theme,
    mode: ReviewPresentationMode,
    text: string,
    done: (result: ReviewViewerAction) => void,
  ) {
    this.#tui = tui;
    this.#theme = theme;
    this.#mode = mode;
    this.#done = done;
    this.#markdown = new Markdown(text, 1, 0, getMarkdownTheme());
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q") {
      this.#done({ kind: "close" });
      return;
    }

    if (
      matchesKey(data, "tab") ||
      matchesKey(data, "left") ||
      matchesKey(data, "right") ||
      data === "t"
    ) {
      this.#done({ kind: "select", mode: this.#mode === "original" ? "ste" : "original" });
      return;
    }
    if (data === "1" && this.#mode !== "original") {
      this.#done({ kind: "select", mode: "original" });
      return;
    }
    if (data === "2" && this.#mode !== "ste") {
      this.#done({ kind: "select", mode: "ste" });
      return;
    }

    const pageSize = Math.max(1, this.#contentHeight - 1);
    const maxOffset = Math.max(0, this.#lineCount - this.#contentHeight);
    if (matchesKey(data, "up") || data === "k") {
      this.#offset = clamp(this.#offset - 1, 0, maxOffset);
    } else if (matchesKey(data, "down") || data === "j") {
      this.#offset = clamp(this.#offset + 1, 0, maxOffset);
    } else if (matchesKey(data, "pageUp") || data === "b") {
      this.#offset = clamp(this.#offset - pageSize, 0, maxOffset);
    } else if (
      matchesKey(data, "pageDown") ||
      matchesKey(data, "space") ||
      matchesKey(data, "enter")
    ) {
      this.#offset = clamp(this.#offset + pageSize, 0, maxOffset);
    } else if (matchesKey(data, "home") || data === "g") {
      this.#offset = 0;
    } else if (matchesKey(data, "end") || data === "G") {
      this.#offset = maxOffset;
    } else {
      return;
    }
    this.#tui.requestRender();
  }

  render(width: number): string[] {
    const innerWidth = Math.max(20, width - 2);
    const rendered = this.#markdown.render(innerWidth);
    this.#lineCount = rendered.length;
    this.#contentHeight = Math.max(5, this.#tui.terminal.rows - 8);
    const maxOffset = Math.max(0, this.#lineCount - this.#contentHeight);
    this.#offset = clamp(this.#offset, 0, maxOffset);

    const original =
      this.#mode === "original"
        ? this.#theme.fg("accent", this.#theme.bold("[1 Original]"))
        : this.#theme.fg("muted", " 1 Original ");
    const ste =
      this.#mode === "ste"
        ? this.#theme.fg("accent", this.#theme.bold("[2 STE-style]"))
        : this.#theme.fg("muted", " 2 STE-style ");
    const start = this.#lineCount === 0 ? 0 : this.#offset + 1;
    const end = Math.min(this.#lineCount, this.#offset + this.#contentHeight);
    const linesAbove = this.#offset;
    const linesBelow = Math.max(0, this.#lineCount - end);
    const progress =
      linesBelow > 0
        ? this.#theme.fg(
            "warning",
            `Showing ${start}-${end} of ${this.#lineCount} · ↓ ${linesBelow} more lines — Space/PgDn/↓ to continue`,
          )
        : this.#theme.fg(
            "success",
            `${linesAbove > 0 ? `↑ ${linesAbove} lines above · ` : ""}End of review`,
          );
    const help = this.#theme.fg(
      "muted",
      "tab/t/←/→: format  ↑/↓/j/k: line  space/enter/pgup/pgdn: page  home/end: jump  esc/q: close",
    );

    return [
      truncateToWidth(`${original}  ${ste}`, width),
      truncateToWidth(progress, width),
      "",
      ...rendered
        .slice(this.#offset, this.#offset + this.#contentHeight)
        .map(line => truncateToWidth(line, width)),
      "",
      truncateToWidth(help, width),
    ];
  }

  invalidate(): void {
    this.#markdown.invalidate();
  }
}
