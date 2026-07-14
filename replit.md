# Telegram AI Bot (Khmer)

A Telegram AI bot powered by Groq that replies to all users in Khmer (ភាសាខ្មែរ).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — start the bot + API server
- `pnpm run typecheck` — full typecheck across all packages

## Required Secrets

Set these in Replit Secrets (already configured if you followed setup):

| Secret | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) on Telegram |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- Telegram: `node-telegram-bot-api` (polling mode)
- AI: Groq SDK — `llama-3.3-70b-versatile`

## Bot Commands

| Command | Description |
|---|---|
| `/start` | Welcome message in Khmer |
| (any text) | AI reply in Khmer via Groq |

## Where things live

- `artifacts/api-server/src/bot.ts` — Telegram bot logic (commands, Groq integration)
- `artifacts/api-server/src/index.ts` — server entry point (starts bot + Express)

## Architecture decisions

- Bot runs in **polling mode** — no webhook or public HTTPS URL needed; works out of the box on Replit.
- All AI responses are forced to Khmer via a system prompt sent to Groq on every message.
- The bot is imported directly from `index.ts` so it starts alongside the Express server.

## User preferences

- Bot language: Khmer (ភាសាខ្មែរ)
- AI model: llama-3.3-70b-versatile via Groq

## Gotchas

- Do not set `TELEGRAM_BOT_TOKEN` or `GROQ_API_KEY` via `setEnvVars` — they are secrets and must be managed via `requestSecrets`.
- Polling mode means only one instance of the bot should run at a time; do not start duplicate workflows.
