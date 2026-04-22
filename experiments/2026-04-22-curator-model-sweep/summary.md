# Curator model sweep — 2026-04-22T00:29:46.769Z

15/16 models returned a valid curator object. Total cost across runs: $0.469884. Total tokens: 281354.

| Model | Status | ms | in tok | out tok | total tok | cost | body chars |
|---|---|---:|---:|---:|---:|---:|---:|
| `deepseek/deepseek-v3.2-speciale` | ok | 391721 | 14538 | 16375 | 30913 | $0.025465 | 3787 |
| `deepseek/deepseek-v3.2` | ok | 26157 | 14423 | 951 | 15374 | $0.004135 | 4497 |
| `openai/gpt-5.4-mini` | ok | 13066 | 14499 | 1553 | 16052 | $0.017863 | 7037 |
| `openai/gpt-5.4` | ok | 25275 | 14499 | 1301 | 15800 | $0.055762 | 6303 |
| `anthropic/claude-sonnet-4.6` | ok | 15340 | 16712 | 368 | 17080 | $0.055656 | 1596 |
| `anthropic/claude-haiku-4.5` | ok | 22996 | 16711 | 1617 | 18328 | $0.024796 | 6640 |
| `qwen/qwen3.6-plus` | ok | 104051 | 15195 | 5613 | 20808 | $0.015884 | 5320 |
| `moonshotai/kimi-k2.6` | ok | 146904 | 14450 | 10346 | 24796 | $0.055109 | 6214 |
| `google/gemma-4-31b-it` | ok | 39693 | 15241 | 828 | 16069 | $0.002465 | 3321 |
| `z-ai/glm-5.1` | ok | 119417 | 14690 | 5360 | 20050 | $0.034184 | 6209 |
| `x-ai/grok-4.20` | ok | 11662 | 14155 | 1370 | 15525 | $0.036415 | 6428 |
| `xiaomi/mimo-v2-pro` | ok | 21826 | 15094 | 1207 | 16301 | $0.018715 | 5488 |
| `minimax/minimax-m2.7` | **fail** | 208209 | — | — | — | — | — |
| `google/gemini-3.1-pro-preview` | ok | 56789 | 15157 | 6928 | 22085 | $0.113450 | 4698 |
| `google/gemini-3.1-flash-lite-preview` | ok | 5079 | 15241 | 846 | 16087 | $0.005079 | 3482 |
| `google/gemini-3-flash-preview` | ok | 7631 | 15157 | 929 | 16086 | $0.004905 | 4070 |

## Failures

- `minimax/minimax-m2.7` — No object generated: the model did not return a response.
