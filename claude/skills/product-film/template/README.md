# Product film

Built from the `product-film` skill template. `script.yaml` drives the edit:
change a line, run `npm run voice` and `npm run render`, and the timeline
re-flows around it.

| Step | Command |
| --- | --- |
| Check the API key (limited + expiring) | `npm run check-key` |
| Free dry run (placeholder VO and music) | `npm run dry-run` |
| Voiceover / review it | `npm run voice`, `npm run review -- vo` |
| Music takes / review / pick | `npm run music -- --takes 3`, `npm run review -- music`, `npm run music:pick -- 2` |
| Stills, then clips | `npm run images`, `npm run clips` (`--only id`, `--force id`) |
| Sound effects | `npm run sfx` |
| Timeline | `npm run timeline` |
| Preview | `npm run studio`, `npx tsx pipeline/stills.ts 3 12.5` |
| Render a version | `VERSION=v1 npm run render` (or `-- quick`) |
| AI review of a cut | `npm run review -- video out/v1/film.mp4` |
| Publish to a public bucket | `npm run publish -- v1` |

Paid calls are logged in `.work/costs.jsonl`. See the skill's SKILL.md for
the full process and its lessons.
