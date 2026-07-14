import TelegramBot from "node-telegram-bot-api";
import { logger } from "./lib/logger";
import {
  mainMenuKeyboard,
  backMenuKeyboard,
  memoryMenuKeyboard,
  settingsKeyboard,
  videoQualityKeyboard,
} from "./bot/menu";
import * as memory from "./bot/memory";
import { chatWithAI, translatePromptToEnglish } from "./bot/services/ai";
import { textToSpeechFile, cleanupFile as cleanupTts } from "./bot/services/tts";
import { generateImage, cleanupFile as cleanupImg } from "./bot/services/image";
import {
  downloadVideo,
  getVideoInfo,
  isValidVideoUrl,
  formatDuration,
  cleanupFile as cleanupVid,
} from "./bot/services/video";

// ── Bootstrap ──────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// ── Texts ──────────────────────────────────────────────────────────────────

const WELCOME_TEXT = `🤖 *ស្វាគមន៍មកកាន់ Khmer AI Bot\\!* 🇰🇭

ខ្ញុំជាជំនួយការ AI ឆ្លាតវៃ ដែលឆ្លើយជាភាសាខ្មែរ 100%

*មុខងារដែលមាន:*
💬 *Chat AI* — ឆ្លើយសំណួរ ចងចាំការសន្ទនា
🎨 *Create Image* — បង្កើតរូបភាពពីពាក្យ
🔊 *Voice AI* — បម្លែងអក្សរទៅជាសំឡេង
📥 *Video Download* — ទាញយក YouTube, TikTok, Facebook
🧠 *Memory AI* — មើល/លុបការចងចាំ
⚙️ *Settings* — ការកំណត់

👇 *ជ្រើសរើសមុខងារ:*`;

const MENU_TEXT = `🏠 *Menu ចម្បង*

👇 ជ្រើសរើសមុខងារដែលអ្នកចង់ប្រើ:`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  chat: `💬 *Chat AI Mode*\n\nអ្នកស្ថិតក្នុង Chat AI Mode ✅\n\nខ្ញុំចងចាំការសន្ទនារបស់អ្នក 🧠\nសូមសរសេរសំណួរ ឬប្រធានបទដែលចង់ដឹង:`,
  image: `🎨 *Create Image Mode*\n\nអ្នកស្ថិតក្នុង Image Generator Mode ✅\n\nសូមបញ្ជាក់ពី *អ្វីដែលចង់បង្កើត* ជាភាសាខ្មែរ:\n\n_ឧ: បង្កើតរូប ភ្នំ វ​ រ​ ពន្លឺព្រះអាទិត្យ ស្រស់ស្អាត_\n_ឧ: Logo អ្នកជំនួញ ខ្មែរ modern_\n_ឧ: Poster ព្រឹត្តិការណ៍ ខ្មែរ colorful_`,
  voice: `🔊 *Voice AI Mode*\n\nអ្នកស្ថិតក្នុង Voice AI Mode ✅\n\nសូមសរសេរ *ពាក្យ ឬប្រយោគ* ដែលចង់ស្ដាប់ជាសំឡេង:\n\n_ខ្ញុំនឹងបំប្លែងអក្សររបស់អ្នកទៅជាសំឡេងខ្មែរ 🎙️_`,
  video: `📥 *Video Download Mode*\n\nអ្នកស្ថិតក្នុង Video Download Mode ✅\n\nគាំទ្រ:\n▪️ YouTube\n▪️ TikTok\n▪️ Facebook\n\nសូម *ផ្ញើ Link វីដេអូ* មកខ្ញុំ:`,
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function sendMainMenu(chatId: number, text = MENU_TEXT): Promise<void> {
  memory.setMode(chatId, "start");
  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard,
  });
}

async function safeEditText(
  chatId: number,
  messageId: number,
  text: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      ...extra,
    });
  } catch {
    // ignore "message is not modified" errors
  }
}

async function sendError(chatId: number, err: unknown, fallback: string): Promise<void> {
  const msg = err instanceof Error ? err.message : fallback;
  logger.error({ err, chatId }, "Bot error");
  await bot.sendMessage(chatId, `❌ ${msg}`, {
    reply_markup: backMenuKeyboard,
  });
}

function keepTyping(chatId: number): NodeJS.Timer {
  return setInterval(() => {
    bot.sendChatAction(chatId, "typing").catch(() => {});
  }, 4000);
}

// ── /start ─────────────────────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name ?? "អ្នក";
  logger.info({ chatId, name }, "/start");
  memory.setMode(chatId, "start");
  await bot.sendMessage(
    chatId,
    WELCOME_TEXT.replace("Khmer AI Bot\\!", `Khmer AI Bot, ${name}\\!`),
    { parse_mode: "MarkdownV2", reply_markup: mainMenuKeyboard },
  );
});

// ── /menu ──────────────────────────────────────────────────────────────────

bot.onText(/\/menu/, async (msg) => {
  await sendMainMenu(msg.chat.id);
});

// ── Callback Queries ───────────────────────────────────────────────────────

bot.on("callback_query", async (query) => {
  if (!query.message || !query.data) return;

  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const msgId = query.message.message_id;

  await bot.answerCallbackQuery(query.id);

  // ── Mode switches ────────────────────────────────────────────────────────

  if (data === "mode_start") {
    await sendMainMenu(chatId);
    return;
  }

  if (
    data === "mode_chat" ||
    data === "mode_image" ||
    data === "mode_voice" ||
    data === "mode_video"
  ) {
    const modeKey = data.replace("mode_", "") as "chat" | "image" | "voice" | "video";
    memory.setMode(userId, modeKey);
    await bot.sendMessage(chatId, MODE_INSTRUCTIONS[modeKey]!, {
      parse_mode: "Markdown",
      reply_markup: backMenuKeyboard,
    });
    return;
  }

  // ── Memory ───────────────────────────────────────────────────────────────

  if (data === "mode_memory") {
    memory.setMode(userId, "memory");
    const count = memory.getHistoryCount(userId);
    const state = memory.getState(userId);
    const lastThree = state.history.slice(-3);
    let preview = "";
    for (const m of lastThree) {
      const role = m.role === "user" ? "👤 អ្នក" : "🤖 AI";
      preview += `\n${role}: ${m.content.slice(0, 60)}${m.content.length > 60 ? "…" : ""}`;
    }

    const text =
      `🧠 *Memory AI*\n\n` +
      `📊 ចំនួនសារដែលចងចាំ: *${count}* / 20\n` +
      (count > 0
        ? `\n*សារចុងក្រោយ:*\`\`\`${preview}\`\`\``
        : "\n_មិនទាន់មានការចងចាំ_");
    await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: memoryMenuKeyboard,
    });
    return;
  }

  if (data === "memory_clear") {
    memory.clearHistory(userId);
    await bot.sendMessage(
      chatId,
      "🗑️ *ការចងចាំត្រូវបានលុបចោលរួចហើយ!*\n\nBotនឹងចាប់ផ្ដើមការសន្ទនាថ្មី 🔄",
      { parse_mode: "Markdown", reply_markup: backMenuKeyboard },
    );
    return;
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  if (data === "mode_settings") {
    memory.setMode(userId, "settings");
    const state = memory.getState(userId);
    await bot.sendMessage(
      chatId,
      `⚙️ *Settings*\n\n🔊 Auto Voice — ស្ដាប់ចម្លើយ AI ជាសំឡេងដោយស្វ័យប្រវត្តិ`,
      { parse_mode: "Markdown", reply_markup: settingsKeyboard(state.settings.autoVoice) },
    );
    return;
  }

  if (data === "settings_toggle_voice") {
    const newVal = memory.toggleAutoVoice(userId);
    const state = memory.getState(userId);
    try {
      await bot.editMessageReplyMarkup(settingsKeyboard(newVal), {
        chat_id: chatId,
        message_id: msgId,
      });
    } catch {
      await bot.sendMessage(
        chatId,
        `⚙️ *Settings*\n\n🔊 Auto Voice: ${newVal ? "✅ ON" : "❌ OFF"}`,
        { parse_mode: "Markdown", reply_markup: settingsKeyboard(state.settings.autoVoice) },
      );
    }
    await bot.sendMessage(
      chatId,
      newVal
        ? "🔊 Auto Voice បានបើក! ចម្លើយ AI នឹងត្រូវបានអានជាសំឡេង។"
        : "🔇 Auto Voice បានបិទ។",
    );
    return;
  }

  // ── Video quality selection ───────────────────────────────────────────────

  if (data === "dl_360" || data === "dl_720") {
    const state = memory.getState(userId);
    const pendingUrl = (state as unknown as { pendingVideoUrl?: string }).pendingVideoUrl;
    if (!pendingUrl) {
      await bot.sendMessage(chatId, "⚠️ URL វីដេអូបានផុតអាយុ។ សូមផ្ញើ Link ម្ដងទៀត។");
      return;
    }

    const quality = data === "dl_360" ? "360" : "720";
    const loadingMsg = await bot.sendMessage(
      chatId,
      `📥 *កំពុងទាញយកវីដេអូ ${quality}p...*\n⏳ សូមរង់ចាំ វាអាចចំណាយពេល 1-3 នាទី`,
      { parse_mode: "Markdown" },
    );

    const typingTimer = keepTyping(chatId);
    let filePath: string | null = null;
    try {
      const result = await downloadVideo(pendingUrl, quality as "360" | "720");
      filePath = result.filePath;
      clearInterval(typingTimer as unknown as number);

      await safeEditText(chatId, loadingMsg.message_id, "✅ *ទាញយករួច! កំពុងផ្ញើ...*");
      await bot.sendVideo(
        chatId,
        filePath,
        { caption: `🎬 *${result.title}*\n\n📱 គុណភាព: ${quality}p\n\n_ទាញយកដោយ Khmer AI Bot 🤖_`, parse_mode: "Markdown" },
      );
      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    } catch (err) {
      clearInterval(typingTimer as unknown as number);
      await safeEditText(chatId, loadingMsg.message_id, "❌ ទាញយកបរាជ័យ!");
      await sendError(chatId, err, "ទាញយកវីដេអូបរាជ័យ");
    } finally {
      if (filePath) cleanupVid(filePath);
    }
    return;
  }
});

// ── Text Messages ──────────────────────────────────────────────────────────

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id ?? chatId;
  const text = msg.text;

  if (!text || text.startsWith("/")) return;

  const state = memory.getState(userId);
  const mode = state.mode;

  logger.info({ chatId, mode, text: text.slice(0, 50) }, "message");

  // Default: if no mode set, treat as chat
  const activeMode = mode === "start" ? "chat" : mode;

  // ── Chat AI ───────────────────────────────────────────────────────────────

  if (activeMode === "chat") {
    await bot.sendChatAction(chatId, "typing");
    const typingTimer = keepTyping(chatId);
    try {
      const reply = await chatWithAI(text, state.history);
      clearInterval(typingTimer as unknown as number);

      memory.addMessage(userId, { role: "user", content: text });
      memory.addMessage(userId, { role: "assistant", content: reply });
      memory.setLastAIResponse(userId, reply);

      await bot.sendMessage(chatId, reply, {
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });

      // Auto-voice if enabled
      if (state.settings.autoVoice) {
        await bot.sendChatAction(chatId, "record_voice");
        let audioPath: string | null = null;
        try {
          audioPath = await textToSpeechFile(reply.replace(/[*_`]/g, "").slice(0, 500));
          await bot.sendVoice(chatId, audioPath);
        } catch {
          // silently skip auto-voice errors
        } finally {
          if (audioPath) cleanupTts(audioPath);
        }
      }
    } catch (err) {
      clearInterval(typingTimer as unknown as number);
      await sendError(chatId, err, "AI ឆ្លើយមិនបាន សូមព្យាយាមម្ដងទៀត");
    }
    return;
  }

  // ── Image Generator ──────────────────────────────────────────────────────

  if (activeMode === "image") {
    const loadingMsg = await bot.sendMessage(
      chatId,
      `🎨 *កំពុងបង្កើតរូបភាព...*\n\n📝 ប្រធានបទ: _${text}_\n⏳ សូមរង់ចាំ 30-60 វិនាទី`,
      { parse_mode: "Markdown" },
    );
    const typingTimer = keepTyping(chatId);
    let imgPath: string | null = null;
    try {
      // Translate Khmer prompt to English for better image generation
      await safeEditText(
        chatId,
        loadingMsg.message_id,
        `🎨 *កំពុងបង្កើតរូបភាព...*\n\n📝 ប្រធានបទ: _${text}_\n🔄 កំពុងបកប្រែ...`,
      );
      const englishPrompt = await translatePromptToEnglish(text);

      await safeEditText(
        chatId,
        loadingMsg.message_id,
        `🎨 *កំពុងបង្កើតរូបភាព...*\n\n📝 ប្រធានបទ: _${text}_\n✨ ${englishPrompt}\n⏳ កំពុងបង្កើត...`,
      );
      imgPath = await generateImage(englishPrompt);
      clearInterval(typingTimer as unknown as number);

      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
      await bot.sendPhoto(chatId, imgPath, {
        caption: `🎨 *រូបភាពរបស់អ្នក*\n\n📝 ${text}\n\n_បង្កើតដោយ Khmer AI Bot 🤖_`,
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });
    } catch (err) {
      clearInterval(typingTimer as unknown as number);
      await safeEditText(chatId, loadingMsg.message_id, "❌ បង្កើតរូបភាពបរាជ័យ!");
      await sendError(chatId, err, "បង្កើតរូបភាពមិនបាន សូមព្យាយាមម្ដងទៀត");
    } finally {
      if (imgPath) cleanupImg(imgPath);
    }
    return;
  }

  // ── Voice TTS ────────────────────────────────────────────────────────────

  if (activeMode === "voice") {
    await bot.sendChatAction(chatId, "record_voice");
    const typingTimer = keepTyping(chatId);
    let audioPath: string | null = null;
    try {
      audioPath = await textToSpeechFile(text);
      clearInterval(typingTimer as unknown as number);
      await bot.sendVoice(chatId, audioPath, {
        caption: `🔊 *សំឡេង*: _${text.slice(0, 100)}${text.length > 100 ? "…" : ""}_`,
        parse_mode: "Markdown",
      });
    } catch (err) {
      clearInterval(typingTimer as unknown as number);
      await sendError(chatId, err, "TTS មិនអាចបំប្លែងបានទេ");
    } finally {
      if (audioPath) cleanupTts(audioPath);
    }
    return;
  }

  // ── Video Download ───────────────────────────────────────────────────────

  if (activeMode === "video") {
    const url = text.trim();
    if (!isValidVideoUrl(url)) {
      await bot.sendMessage(
        chatId,
        "⚠️ *Link មិនត្រឹមត្រូវ!*\n\nសូមផ្ញើ Link ពី:\n▪️ YouTube\n▪️ TikTok\n▪️ Facebook",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const loadingMsg = await bot.sendMessage(chatId, "🔍 *កំពុងពិនិត្យវីដេអូ...*", {
      parse_mode: "Markdown",
    });

    try {
      const info = await getVideoInfo(url);
      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

      // Store URL in user state for quality selection
      const extState = state as unknown as { pendingVideoUrl?: string };
      extState.pendingVideoUrl = url;

      const duration = formatDuration(info.duration);
      await bot.sendMessage(
        chatId,
        `📹 *ព័ត៌មានវីដេអូ*\n\n🎬 *ចំណងជើង:* ${info.title}\n⏱️ *រយៈពេល:* ${duration}\n👤 *Channel:* ${info.uploader}\n\n📥 *ជ្រើសរើសគុណភាព:*`,
        {
          parse_mode: "Markdown",
          reply_markup: videoQualityKeyboard(url),
        },
      );
    } catch (err) {
      await safeEditText(chatId, loadingMsg.message_id, "❌ ពិនិត្យវីដេអូបរាជ័យ!");
      await sendError(chatId, err, "ទាញយកព័ត៌មានវីដេអូបរាជ័យ");
    }
    return;
  }

  // ── Settings mode: just show menu ────────────────────────────────────────
  if (activeMode === "settings" || activeMode === "memory") {
    await sendMainMenu(chatId);
  }
});

// ── Polling error ──────────────────────────────────────────────────────────

bot.on("polling_error", (err) => {
  logger.error({ err }, "Telegram polling error");
});

logger.info("🤖 Khmer AI Bot started with polling");

export { bot };
