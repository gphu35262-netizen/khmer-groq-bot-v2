# Khmer AI Bot — Telegram

Bot Telegram AI ពេញលេញ ដែលឆ្លើយជាភាសាខ្មែរ 100% មានមុខងារ Chat AI, Image Generator, Voice TTS, Video Downloader, Memory, និង Settings។

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — start the bot + API server
- `pnpm run typecheck` — full typecheck across all packages

## Required Secrets

| Secret | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From [@BotFather](https://t.me/BotFather) |
| `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) |

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + pino logger
- Telegram: `node-telegram-bot-api` (polling mode)
- AI Chat: Groq SDK — `llama-3.3-70b-versatile`
- TTS: `google-tts-api` — free Google TTS, Khmer (km)
- Image Gen: Pollinations.ai — free, no API key needed
- Video: `yt-dlp-wrap` — YouTube, TikTok, Facebook

## Bot Commands & Features

| Feature | How to use |
|---|---|
| `/start` | Welcome message + main menu |
| `/menu` | Show main menu anytime |
| 💬 Chat AI | AI replies in Khmer, remembers last 20 messages |
| 🎨 Create Image | Type Khmer description → AI generates image |
| 🔊 Voice AI | Type text → get Khmer audio voice |
| 📥 Video Download | Send YouTube / TikTok / Facebook URL → pick quality |
| 🧠 Memory AI | View/clear conversation history |
| ⚙️ Settings | Toggle Auto Voice (read AI replies aloud) |

## Where things live

```
artifacts/api-server/src/
├── bot.ts                  # Main bot — all routing, handlers, menus
├── bot/
│   ├── types.ts            # UserState, ChatMessage, UserMode types
│   ├── menu.ts             # Inline keyboard definitions
│   ├── memory.ts           # Per-user conversation memory (Map)
│   └── services/
│       ├── ai.ts           # Groq chat + prompt translation
│       ├── tts.ts          # Google TTS → mp3 → Telegram voice
│       ├── image.ts        # Pollinations.ai image generation
│       └── video.ts        # yt-dlp binary + download logic
```

## Architecture decisions

- Bot runs in **polling mode** — no webhook or HTTPS domain needed.
- Image generation uses **Pollinations.ai** (free, no API key) via `flux` model; Khmer prompts are first translated to English by Groq for better results.
- yt-dlp binary is auto-downloaded to `/tmp/yt-dlp` on first video request.
- Conversation memory is **in-process** (Map) — resets on server restart. 20-message rolling window per user.
- Auto Voice setting sends Groq replies as voice messages automatically when ON.
- All user state (mode, history, settings) stored per `userId`, not `chatId`.

## 24/7 Operation

For the bot to run 24/7 (even when you close your phone), **deploy this project** using the Publish button. Replit's deployment keeps the server alive continuously.

## User preferences

- Bot language: ភាសាខ្មែរ 100%
- AI model: llama-3.3-70b-versatile (Groq)
- Image model: flux (Pollinations.ai)
- Video max quality: 720p (48MB Telegram limit enforced)
