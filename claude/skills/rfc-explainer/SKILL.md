---
name: rfc-explainer
description: >-
  Turn a long RFC, design doc, or spec (usually from a PR) into a single
  self-contained interactive HTML walkthrough with light and dark mode: a
  story-first section order, state scrubbers, step-through sequence
  simulators, a hoverable schema, a persona permission matrix, a quiz, and
  inline reviewer notes with an auto-built index. Use when the user asks to
  "explain this RFC", "walk me through the spec/design doc", "make an HTML
  version of the RFC", "help me understand PR N's RFC", or wants an
  approachable, interactive explainer for a technical proposal.
---

# RFC Explainer

Build one HTML file that teaches a reader an RFC in the order they'd want to learn it, lets them poke at the tricky mechanisms, and flags what a careful reviewer would question. It has no external dependencies and works from `file://`.

Files in this skill:

- `assets/template.html`: start every explainer from this. It has the theme tokens, dark mode, layout, nav, and the widget engine. Content goes in the HTML sections and the `EXPLAINER` config object.
- `examples/event-signups-explainer.html`: a finished explainer for a 680-line RFC (Pulse event sign-ups). Read it before your first build. It shows every widget, a custom widget, inline reviewer notes, and the tone.
- `scripts/verify.mjs`: a Playwright check that drives the page in light and dark mode at desktop and mobile widths.

## Workflow

### 1. Get the whole RFC

- From a PR: `gh pr view N --json title,body,files,headRefName`, then read the RFC file from the branch (`gh pr diff N` or `git show origin/<branch>:<path>`). Read all of it. Skimming causes wrong explanations.
- Note the code the RFC references (modules, files, line numbers). Open the ones that bear on correctness claims; you need them for reviewer notes.

### 2. Outline in learning order

RFCs are written in decision order. Rearrange into this order, then merge or drop sections to fit. Aim for 10–18 sections.

1. **The story**: today's problem in plain terms, three beats (before, during, after), and one callout with the invariant everything serves.
2. **The pieces**: vocabulary cards for nouns and actors. Define every term the later sections use.
3. **Lifecycle or state**: what's stored vs. derived, and what each actor sees in each state. Use a **scrubber**.
4. **The core mechanism**: the hardest part (concurrency, consistency, ordering, auth flow). Use a **sim** with 2–4 scenarios, including the edge cases people get wrong. Follow it with the trimmed code and a result table.
5. **Why the mechanism works**: constraints, indexes, invariants, with the SQL or code.
6. **Data model**: a **schema** widget, with notes from the RFC on each column.
7. **Secondary systems**: live updates, background jobs, imports, notifications. Use a `flow` for pipelines and `cards` for rules.
8. **Who can do what**: a **matrix** with one persona per chip.
9. **Load, risks, and rollout**.
10. **Roads not taken** (`<details>`) and the **decision log** table.
11. **Build plan / testing**.
12. **Check yourself**: a **quiz**.
13. **Reviewer notes**: the auto-built index.

### 3. Pick widgets by content

| The RFC has… | Use |
| --- | --- |
| A status enum plus time windows, a state machine, or phases | `scrubber`, with a `preview` HTML mock of what the user sees per phase |
| Races, retries, locks, multi-party protocols, queue handoffs | `sim`: one lane per actor, the shared system lane marked `system: true`, and `state` panels for index or lock or queue contents |
| New tables or columns | `schema`, with `true` on the 4th element of a column for the columns the design depends on |
| Roles, permissions, visibility rules | `matrix`, with cells from a legend (`yes`, `no`, `404`, redirect…) |
| A behavior that only clicks when seen (rate limiting, fan-out, throttling) | `custom` widget (see the presence demo in the example) |
| Sequential pipeline | static `.flow` |
| Alternatives | `<details>` |

Use 3–6 widgets. A widget has to teach something prose can't; don't add one for decoration.

### 4. Review pass

Read the RFC adversarially and verify claims against the code it cites. Look for:

- Transaction and concurrency bugs: work done after an error inside an aborted Postgres transaction, unspecified lock order, assumptions about which constraint fires.
- State transitions that never get handled: reopen, retry, cancel, a scheduled job that has already run.
- Contradictions between sections (a table vs. the decision log, requirements vs. design).
- Auth gaps: routes that skip a check, mount-only checks.
- Unclear numbering or terminology that makes review comments hard to anchor.

Put each finding **inline, in the section it concerns**, as a dashed note:

```html
<div class="rnote" id="rn-short-slug" data-sev="hi|md|lo" data-label="check|gap|nit">
  <span class="rlabel">Reviewer note</span><span class="sev hi">check</span><b>One-line claim.</b>
  <p>What the RFC says, why it's wrong or missing, and what to do.</p>
</div>
```

- `hi` means it will cause a bug. `md` is a gap or an unverified assumption. `lo` is a nit.
- Label findings you couldn't confirm as "check" and word them as something to confirm. Don't overstate them.
- Notes with no natural section go in `#review` after the `<ol id="review-index">`. The index builds itself from every `.rnote[id]`, sorted by severity.
- Reviewer notes are your voice; the rest of the page explains the RFC as written. Keep the two separate.

### 5. Build

1. Copy `assets/template.html` to the output path. Default: next to the RFC as `<rfc-name>-explainer.html`. Don't commit unless asked.
2. Replace every `{{placeholder}}`, then replace or delete the placeholder sections and widgets.
3. Each `<section>` needs an `id`, an `<h2><small>NN</small>Title</h2>`, and a short `data-toc` label. The nav, scroll highlight, and review index all read these.
4. Put widget data in `EXPLAINER.<type>.<key>` and mount with `<div data-widget="<type>" data-key="<key>"></div>`. Config strings are inserted as HTML, so `<code>` works. Don't paste untrusted text into them.
5. Leave the ENGINE block alone. If a widget needs new behavior, write a `custom` widget instead of forking the engine.
6. Custom CSS goes in the `<style>` block after the template rules, using tokens only.

### 6. Write it well

- Follow the user's voice and style rules (CLAUDE.md, output style). Explain mechanisms with their real names: function, table, index, job.
- Lead each section with the mechanism in one or two sentences, then the detail. Use short paragraphs and cards where a list of rules fits.
- Stay faithful. Use the RFC's exact identifiers, don't invent behavior, and say so where the explainer simplifies.
- Scenario narration (`say`) explains *why* the step happens, not just what.
- Quiz: 5–8 questions aimed at likely misconceptions. Each explanation names the mechanism.

### 7. Design rules

- **Colors only through tokens** (`var(--…)`). Hex values outside the token blocks break dark mode. The one exception is fixed fills that carry white text in both themes, like avatars.
- To add a token, add it to `:root`, `:root[data-theme=dark]`, **and** the `prefers-color-scheme` block.
- No thick one-sided accent borders (the "side-tab" look). Callouts use a full 1px tinted border and a colored heading.
- Keep the layout: sticky nav, 70ch prose, and widgets at full width. Mobile collapses everything to one column.

### 8. Verify

Playwright usually isn't installed globally. Install it in a scratch directory with a writable browser path:

```bash
mkdir -p /tmp/pw && cd /tmp/pw && npm init -y >/dev/null && npm i playwright >/dev/null
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers npx playwright install chromium
# Linux only, if Chromium fails to launch: PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers npx playwright install-deps chromium

cd /tmp/pw && PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers \
  node ~/.claude/skills/rfc-explainer/scripts/verify.mjs <explainer.html> /tmp/pw/shots
```

The script clicks through every scrubber phase, sim scenario, schema column, and quiz question. It reports JS errors, missing widget configs, leftover `{{placeholders}}`, a broken theme toggle or theme persistence, and a review index that doesn't match the notes. It exits non-zero on any failure and writes per-section screenshots in both themes.

**Look at the screenshots.** Check at least the hero, each widget section, and the review section in both themes, plus the mobile shots. Fix contrast, overflow, and layout problems before reporting.

### 9. Report

Tell the user the file path, what's interactive, and the top reviewer notes (`hi` and `md`) in a sentence each. Mention that the file is untracked.
