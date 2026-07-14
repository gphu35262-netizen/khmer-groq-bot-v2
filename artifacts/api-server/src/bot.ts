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
import {
  textToSpeechFile,
  cleanupFile as cleanupTts,
} from "./bot/services/tts";
import {
  generateImage,
  cleanupFile as cleanupImg,
} from "./bot/services/image";
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

// ── Static texts ───────────────────────────────────────────────────────────

function welcomeText(name: string): string {
  return (
    `🤖 *ស្វាគមន៍មកកាន់ Khmer AI Bot, ${name}!* 🇰🇭\n\n` +
    `ខ្ញុំជាជំនួយការ AI ឆ្លាតវៃ ដែលឆ្លើយជាភាសាខ្មែរ 100%\n\n` +
    `*មុខងារដែលមាន:*\n` +
    `💬 *Chat AI* — ឆ្លើយសំណួរ ចងចាំការសន្ទនា\n` +
    `🎨 *Create Image* — បង្កើតរូបភាពពីពាក្យ\n` +
    `🔊 *Voice AI* — បម្លែងអក្សរទៅជាសំឡេង\n` +
    `📥 *Video Download* — ទាញយក YouTube, TikTok, Facebook\n` +
    `🧠 *Memory AI* — មើល/លុបការចងចាំ\n` +
    `⚙️ *Settings* — ការកំណត់\n\n` +
    `👇 *ជ្រើសរើសមុខងារ:*`
  );
}

const MENU_TEXT =
  `🏠 *Menu ចម្បង*\n\n` +
  `👇 ជ្រើសរើសមុខងារដែលអ្នកចង់ប្រើ:`;

const MODE_INSTRUCTIONS: Record<string, string> = {
  chat:
    `💬 *Chat AI Mode* ✅\n\n` +
    `ខ្ញុំចងចាំការសន្ទនារបស់អ្នក 🧠\n` +
    `សូមសរសេរសំណួរ ឬប្រធានបទដែលចង់ដឹង:`,
  image:
    `🎨 *Create Image Mode* ✅\n\n` +
    `សូមបញ្ជាក់ *អ្វីដែលចង់បង្កើត* ជាភាសាខ្មែរ:\n\n` +
    `_ឧ: ភ្នំ ពន្លឺព្រះអាទិត្យ ស្រស់ស្អាត_\n` +
    `_ឧ: Logo អ្នកជំនួញ ខ្មែរ modern_\n` +
    `_ឧ: Poster ព្រឹត្តិការណ៍ ខ្មែរ colorful_`,
  voice:
    `🔊 *Voice AI Mode* ✅\n\n` +
    `សូមសរសេរ *ពាក្យ ឬប្រយោគ* ដែលចង់ស្ដាប់ជាសំឡេង:\n\n` +
    `_ខ្ញុំនឹងបំប្លែងអក្សររបស់អ្នកទៅជាសំឡេងខ្មែរ 🎙️_`,
  video:
    `📥 *Video Download Mode* ✅\n\n` +
    `គាំទ្រ:\n` +
    `▪️ YouTube\n` +
    `▪️ TikTok\n` +
    `▪️ Facebook\n\n` +
    `សូម *ផ្ញើ Link វីដេអូ* មកខ្ញុំ:`,
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
): Promise<void> {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
    });
  } catch {
    // Ignore "message is not modified" and similar benign errors
  }
}

async function sendError(
  chatId: number,
  err: unknown,
  fallback: string,
): Promise<void> {
  const msg = err instanceof Error ? err.message : fallback;
  logger.error({ err, chatId }, "Bot handler error");
  await bot.sendMessage(chatId, `❌ ${msg}`, {
    reply_markup: backMenuKeyboard,
  });
}

/** Keeps the "typing…" indicator alive every 4 s for long operations. */
function keepTyping(chatId: number): ReturnType<typeof setInterval> {
  return setInterval(() => {
    bot.sendChatAction(chatId, "typing").catch(() => {});
  }, 4_000);
}

// ── /start ─────────────────────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name ?? "អ្នក";
  logger.info({ chatId, name }, "/start");
  memory.setMode(chatId, "start");
  await bot.sendMessage(chatId, welcomeText(name), {
    parse_mode: "Markdown",
    reply_markup: mainMenuKeyboard,
  });
});

// ── /menu ──────────────────────────────────────────────────────────────────

bot.onText(/\/menu/, async (msg) => {
  await sendMainMenu(msg.chat.id);
});

// ── /help ──────────────────────────────────────────────────────────────────

bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(
    msg.chat.id,
    `🆘 *ជំនួយ — Khmer AI Bot*\n\n` +
      `*/start* — ចាប់ផ្ដើម Bot\n` +
      `*/menu* — បើក Menu ចម្បង\n` +
      `*/help* — មើលជំនួយ\n\n` +
      `*របៀបប្រើ:*\n` +
      `1️⃣ ចុចប៊ូតុងក្នុង Menu\n` +
      `2️⃣ សរសេរ ឬផ្ញើ Link\n` +
      `3️⃣ Bot នឹងឆ្លើយតប\n\n` +
      `_ប្រសិនបើមានបញ្ហា សូម /start ម្ដងទៀត_`,
    { parse_mode: "Markdown", reply_markup: backMenuKeyboard },
  );
});

// ── Callback Queries ───────────────────────────────────────────────────────

bot.on("callback_query", async (query) => {
  if (!query.message || !query.data) return;

  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const msgId = query.message.message_id;

  // Always acknowledge quickly to stop the loading spinner on the button
  await bot.answerCallbackQuery(query.id).catch(() => {});

  // ── Back to main menu ──────────────────────────────────────────────────

  if (data === "mode_start") {
    await sendMainMenu(chatId);
    return;
  }

  // ── Feature mode switches ──────────────────────────────────────────────

  if (["mode_chat", "mode_image", "mode_voice", "mode_video"].includes(data)) {
    const modeKey = data.replace("mode_", "") as
      | "chat"
      | "image"
      | "voice"
      | "video";
    memory.setMode(userId, modeKey);
    await bot.sendMessage(chatId, MODE_INSTRUCTIONS[modeKey]!, {
      parse_mode: "Markdown",
      reply_markup: backMenuKeyboard,
    });
    return;
  }

  // ── Memory panel ───────────────────────────────────────────────────────

  if (data === "mode_memory") {
    memory.setMode(userId, "memory");
    const count = memory.getHistoryCount(userId);
    const state = memory.getState(userId);
    const lastThree = state.history.slice(-3);

    let preview = "";
    for (const m of lastThree) {
      const who = m.role === "user" ? "👤" : "🤖";
      const snippet = m.content.replace(/[*_`]/g, "").slice(0, 55);
      preview += `\n${who}: ${snippet}${m.content.length > 55 ? "…" : ""}`;
    }

    const body =
      count > 0
        ? `\n*សារចុងក្រោយ:*\`\`\`${preview}\`\`\``
        : "\n_មិនទាន់មានការចងចាំ_";

    await bot.sendMessage(
      chatId,
      `🧠 *Memory AI*\n\n📊 ចំនួនសារ: *${count}* / 20${body}`,
      { parse_mode: "Markdown", reply_markup: memoryMenuKeyboard },
    );
    return;
  }

  if (data === "memory_clear") {
    memory.clearHistory(userId);
    await bot.sendMessage(
      chatId,
      `🗑️ *ការចងចាំត្រូវបានលុបចោល!*\n\nBot នឹងចាប់ផ្ដើមការសន្ទនាថ្មី 🔄`,
      { parse_mode: "Markdown", reply_markup: backMenuKeyboard },
    );
    return;
  }

  // ── Settings panel ─────────────────────────────────────────────────────

  if (data === "mode_settings") {
    memory.setMode(userId, "settings");
    const state = memory.getState(userId);
    await bot.sendMessage(
      chatId,
      `⚙️ *Settings*\n\n🔊 *Auto Voice* — ស្ដាប់ចម្លើយ AI ជាសំឡេងដោយស្វ័យប្រវត្តិ`,
      {
        parse_mode: "Markdown",
        reply_markup: settingsKeyboard(state.settings.autoVoice),
      },
    );
    return;
  }

  if (data === "settings_toggle_voice") {
    const newVal = memory.toggleAutoVoice(userId);
    // Try to update the button in-place; fall back to a new message
    try {
      await bot.editMessageReplyMarkup(settingsKeyboard(newVal), {
        chat_id: chatId,
        message_id: msgId,
      });
    } catch {
      await bot.sendMessage(
        chatId,
        `⚙️ *Settings*\n\n🔊 Auto Voice: ${newVal ? "✅ ON" : "❌ OFF"}`,
        {
          parse_mode: "Markdown",
          reply_markup: settingsKeyboard(newVal),
        },
      );
    }
    await bot.sendMessage(
      chatId,
      newVal
        ? "🔊 *Auto Voice បានបើក!* ចម្លើយ AI នឹងត្រូវបានអានជាសំឡេង 🎙️"
        : "🔇 *Auto Voice បានបិទ។*",
      { parse_mode: "Markdown" },
    );
    return;
  }

  // ── Video quality download ─────────────────────────────────────────────

  if (data === "dl_360" || data === "dl_720") {
    const pendingUrl = memory.getPendingVideoUrl(userId);
    if (!pendingUrl) {
      await bot.sendMessage(
        chatId,
        "⚠️ URL វីដេអូបានផុតអាយុ។ សូមផ្ញើ Link ម្ដងទៀត។",
        { reply_markup: backMenuKeyboard },
      );
      return;
    }

    const quality = data === "dl_360" ? "360" : "720";
    const loadingMsg = await bot.sendMessage(
      chatId,
      `📥 *កំពុងទាញយកវីដេអូ ${quality}p...*\n⏳ សូមរង់ចាំ — អាចចំណាយពេល 1–3 នាទី`,
      { parse_mode: "Markdown" },
    );

    const typingTimer = keepTyping(chatId);
    let filePath: string | null = null;
    try {
      const result = await downloadVideo(pendingUrl, quality);
      filePath = result.filePath;
      clearInterval(typingTimer);
      memory.setPendingVideoUrl(userId, null);

      await safeEditText(chatId, loadingMsg.message_id, "✅ *ទាញយករួច! កំពុងផ្ញើ...*");
      await bot.sendVideo(chatId, filePath, {
        caption:
          `🎬 *${result.title}*\n\n` +
          `📱 គុណភាព: ${quality}p\n` +
          `_ទាញយកដោយ Khmer AI Bot 🤖_`,
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });
      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    } catch (err) {
      clearInterval(typingTimer);
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

  // Ignore commands — handled by onText listeners above
  if (!text || text.startsWith("/")) return;

  const state = memory.getState(userId);
  // Default: if user hasn't picked a mode yet, treat as chat
  const mode = state.mode === "start" ? "chat" : state.mode;

  logger.info({ chatId, mode, preview: text.slice(0, 60) }, "text message");

  // ── 💬 Chat AI ─────────────────────────────────────────────────────────

  if (mode === "chat") {
    await bot.sendChatAction(chatId, "typing");
    const typingTimer = keepTyping(chatId);
    try {
      const reply = await chatWithAI(text, state.history);
      clearInterval(typingTimer);

      memory.addMessage(userId, { role: "user", content: text });
      memory.addMessage(userId, { role: "assistant", content: reply });
      memory.setLastAIResponse(userId, reply);

      await bot.sendMessage(chatId, reply, {
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });

      // Auto-voice: read the AI reply aloud if the user enabled it
      if (state.settings.autoVoice) {
        await bot.sendChatAction(chatId, "record_voice");
        let audioPath: string | null = null;
        try {
          const plain = reply.replace(/[*_`[\]()#]/g, "").slice(0, 500);
          audioPath = await textToSpeechFile(plain);
          await bot.sendVoice(chatId, audioPath);
        } catch {
          // Non-critical — skip silently
        } finally {
          if (audioPath) cleanupTts(audioPath);
        }
      }
    } catch (err) {
      clearInterval(typingTimer);
      await sendError(chatId, err, "AI ឆ្លើយមិនបាន សូមព្យាយាមម្ដងទៀត");
    }
    return;
  }

  // ── 🎨 Image Generator ─────────────────────────────────────────────────

  if (mode === "image") {
    const loadingMsg = await bot.sendMessage(
      chatId,
      `🎨 *កំពុងបង្កើតរូបភាព...*\n📝 _${text}_\n⏳ 30–60 វិនាទី`,
      { parse_mode: "Markdown" },
    );
    const typingTimer = keepTyping(chatId);
    let imgPath: string | null = null;
    try {
      await safeEditText(
        chatId,
        loadingMsg.message_id,
        `🎨 *កំពុងបង្កើតរូបភាព...*\n📝 _${text}_\n🔄 កំពុងបកប្រែ...`,
      );

      const englishPrompt = await translatePromptToEnglish(text);

      await safeEditText(
        chatId,
        loadingMsg.message_id,
        `🎨 *កំពុងបង្កើតរូបភាព...*\n📝 _${text}_\n✨ _${englishPrompt}_\n⏳ កំពុងបង្កើត...`,
      );

      imgPath = await generateImage(englishPrompt);
      clearInterval(typingTimer);

      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
      await bot.sendPhoto(chatId, imgPath, {
        caption:
          `🎨 *រូបភាពរបស់អ្នក*\n\n` +
          `📝 ${text}\n` +
          `_បង្កើតដោយ Khmer AI Bot 🤖_`,
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });
    } catch (err) {
      clearInterval(typingTimer);
      await safeEditText(chatId, loadingMsg.message_id, "❌ បង្កើតរូបភាពបរាជ័យ!");
      await sendError(chatId, err, "បង្កើតរូបភាពមិនបាន សូមព្យាយាមម្ដងទៀត");
    } finally {
      if (imgPath) cleanupImg(imgPath);
    }
    return;
  }

  // ── 🔊 Voice TTS ───────────────────────────────────────────────────────

  if (mode === "voice") {
    await bot.sendChatAction(chatId, "record_voice");
    const typingTimer = keepTyping(chatId);
    let audioPath: string | null = null;
    try {
      audioPath = await textToSpeechFile(text);
      clearInterval(typingTimer);
      await bot.sendVoice(chatId, audioPath, {
        caption: `🔊 _${text.slice(0, 100)}${text.length > 100 ? "…" : ""}_`,
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });
    } catch (err) {
      clearInterval(typingTimer);
      await sendError(chatId, err, "TTS មិនអាចបំប្លែងបានទេ");
    } finally {
      if (audioPath) cleanupTts(audioPath);
    }
    return;
  }

  // ── 📥 Video Download ──────────────────────────────────────────────────

  if (mode === "video") {
    const url = text.trim();
    if (!isValidVideoUrl(url)) {
      await bot.sendMessage(
        chatId,
        `⚠️ *Link មិនត្រឹមត្រូវ!*\n\nសូមផ្ញើ Link ពី:\n▪️ YouTube\n▪️ TikTok\n▪️ Facebook`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    const loadingMsg = await bot.sendMessage(
      chatId,
      "🔍 *កំពុងពិនិត្យវីដេអូ...*",
      { parse_mode: "Markdown" },
    );

    try {
      const info = await getVideoInfo(url);
      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

      memory.setPendingVideoUrl(userId, url);

      await bot.sendMessage(
        chatId,
        `📹 *ព័ត៌មានវីដេអូ*\n\n` +
          `🎬 *ចំណងជើង:* ${info.title}\n` +
          `⏱️ *រយៈពេល:* ${formatDuration(info.duration)}\n` +
          `👤 *Channel:* ${info.uploader}\n\n` +
          `📥 *ជ្រើសរើសគុណភាព:*`,
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

  // ── Fallback: settings/memory modes → show menu ────────────────────────

  await sendMainMenu(chatId);
});

// ── Polling error ──────────────────────────────────────────────────────────

bot.on("polling_error", (err) => {
  logger.error({ err }, "Telegram polling error");
});

logger.info("🤖 Khmer AI Bot started with polling");

export { bot };
