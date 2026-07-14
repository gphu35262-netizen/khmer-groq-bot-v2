import TelegramBot from "node-telegram-bot-api";
import Groq from "groq-sdk";
import { logger } from "./lib/logger";

const TELEGRAM_BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const GROQ_API_KEY = process.env["GROQ_API_KEY"];

if (!TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN environment variable is required.");
}
if (!GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY environment variable is required.");
}

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
const groq = new Groq({ apiKey: GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a helpful AI assistant. You MUST always respond exclusively in Khmer (ភាសាខ្មែរ). No matter what language the user writes in, your response must always be in Khmer only. Be friendly, clear, and helpful.`;

const START_MESSAGE = `សួស្ដី! 👋 ខ្ញុំជាជំនួយការ AI របស់អ្នក។

ខ្ញុំអាចឆ្លើយតបនឹងសំណួររបស់អ្នកគ្រប់យ៉ាងជាភាសាខ្មែរ។

🤖 សូមសរសេរសំណួររបស់អ្នក ហើយខ្ញុំនឹងជួយអ្នក!`;

// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.first_name ?? "អ្នក";

  logger.info({ chatId, username }, "User started bot");

  await bot.sendMessage(chatId, `${START_MESSAGE}`);
});

// Handle all other text messages
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Ignore commands (already handled above)
  if (!text || text.startsWith("/")) return;

  logger.info({ chatId, text }, "Received message");

  // Send typing indicator
  await bot.sendChatAction(chatId, "typing");

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      "សូមអភ័យទោស ខ្ញុំមិនអាចឆ្លើយតបបានទេ។ សូមព្យាយាមម្តងទៀត។";

    logger.info({ chatId, reply }, "Sending reply");
    await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
  } catch (err) {
    logger.error({ err, chatId }, "Groq API error");
    await bot.sendMessage(
      chatId,
      "សូមអភ័យទោស មានបញ្ហាបច្ចេកទេស។ សូមព្យាយាមម្តងទៀតក្រោយ។",
    );
  }
});

bot.on("polling_error", (err) => {
  logger.error({ err }, "Telegram polling error");
});

logger.info("Telegram bot started with polling");

export { bot };
