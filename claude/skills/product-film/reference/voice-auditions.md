# Voice auditions

Same line read by each candidate, judged by `google/gemini-3.8-flash` acting
as a casting director (September 2026). Line: "You asked for one short
video. What came back was sideways, squashed, and three days late. Meet
CapSend. Send a link, and get back the original."

| Rank | Model / voice | Notes from the judge |
| --- | --- | --- |
| 1 | `minimax/speech-2.8-hd` / `English_expressive_narrator` | British RP, polished, "premium feel". |
| 2 | `google/gemini-3.8-flash-tts` / `Puck` | US, crisp, great comedic timing, bright on the brand. **Chosen** (US audience). |
| 3 | `google/gemini-3.8-flash-tts` / `Achird` | Warm, natural, conversational. |
| 4 | `google/gemini-3.8-flash-tts` / `Sadachbia` | High energy, borders on infomercial. |
| 5 | `openai/gpt-audio` / `marin` | Clean but safe. |
| 6 | `google/gemini-3.8-flash-tts` / `Charon` | Too heavy and slow. |
| 7 | `openai/gpt-audio` / `cedar` | Old-school broadcast cadence. |
| 8 | Zephyr, Laomedeia, Aoede, Kore (Gemini) | Flat or synthetic. |
| 9 | `minimax/speech-2.8-hd` / `English_Trustworth_Man` | Too dark and slow. |

To recast, change `voice:` in `script.yaml` and run `npm run voice`.
