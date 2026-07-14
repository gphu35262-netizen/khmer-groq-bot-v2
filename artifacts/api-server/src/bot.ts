import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import { logger } from "./lib/logger";
import {
  mainMenuKeyboard,
  backMenuKeyboard,
  memoryMenuKeyboard,
  settingsKeyboard,
  videoQualityKeyboard,
} from "./bot/menu";
import * as memory from "./bot/memory";
import { chatWithAI, translatePromptToEnglish, summarizeText, translateText } from "./bot/services/ai";
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
import { removeImageBackground, cleanupFile as cleanupBg } from "./bot/services/removebg";
import { enhancePhoto, cleanupFile as cleanupEnhance } from "./bot/services/enhance";
import { generateQRCode, cleanupFile as cleanupQr } from "./bot/services/qr";
import { extractTextFromImage } from "./bot/services/ocr";

// ── Bootstrap ──────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// ── Static texts ───────────────────────────────────────────────────────────

function welcomeText(name: string): string {
  return (
    `🤖 *ស្វាគមន៍មកកាន់ Khmer AI Bot, ${name}!* 🇰🇭\n\n` +
    `ខ្ញុំជាជំនួយការ AI ឆ្លាតវៃ ដែលឆ្លើយជាភាសាខ្មែរ 100%\n\n` +
    `*🌟 មុខងារទាំងអស់:*\n` +
    `🖼️ *លុបBG* — លុប Background ចេញពីរូបភាព\n` +
    `📷 *លុបស្នាម* — ធ្វើឲ្យរូបភាពស្រស់ស្អាត\n` +
    `📄 *Copy អក្សរ* — Copy អក្សរចេញពីរូបភាព\n` +
    `🔍 *QR Code* — បង្កើត QR Code ពីអក្សរ\n` +
    `🤖 *AI Chat* — ឆ្លើយសំណួរ ចងចាំការសន្ទនា\n` +
    `🗣️ *Text to Voice* — បម្លែងអក្សរទៅជាសំឡេង\n` +
    `🖼️ *បង្កើតរូប AI* — បង្កើតរូបភាពពីពាក្យ\n` +
    `✍️ *សង្ខេបអត្ថបទ* — សង្ខេបអត្ថបទវែង\n` +
    `🌐 *បកប្រែភាសា* — បកប្រែ Auto-Detect\n` +
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
    `🎨 *បង្កើតរូប AI Mode* ✅\n\n` +
    `សូមបញ្ជាក់ *អ្វីដែលចង់បង្កើត* ជាភាសាខ្មែរ:\n\n` +
    `_ឧ: ភ្នំ ពន្លឺព្រះអាទិត្យ ស្រស់ស្អាត_\n` +
    `_ឧ: Logo អ្នកជំនួញ ខ្មែរ modern_\n` +
    `_ឧ: Poster ព្រឹត្តិការណ៍ ខ្មែរ colorful_`,
  voice:
    `🗣️ *Text to Voice Mode* ✅\n\n` +
    `សូមសរសេរ *ពាក្យ ឬប្រយោគ* ដែលចង់ស្ដាប់ជាសំឡេង:\n\n` +
    `_ខ្ញុំនឹងបំប្លែងអក្សររបស់អ្នកទៅជាសំឡេងខ្មែរ 🎙️_`,
  video:
    `📥 *Video Download Mode* ✅\n\n` +
    `គាំទ្រ:\n` +
    `▪️ YouTube\n` +
    `▪️ TikTok\n` +
    `▪️ Facebook\n\n` +
    `សូម *ផ្ញើ Link វីដេអូ* មកខ្ញុំ:`,
  removebg:
    `🖼️ *លុប Background Mode* ✅\n\n` +
    `សូម *ផ្ញើរូបភាព* ដែលចង់លុប Background:\n\n` +
    `_ខ្ញុំនឹងលុប Background ហើយផ្ញើរូប PNG ត្រឡប់_\n` +
    `⚠️ _ការដំណើរការអាចចំណាយពេល 30–60 វិនាទី_`,
  enhance:
    `📷 *លុបស្នាម Mode* ✅\n\n` +
    `សូម *ផ្ញើរូបភាព* ដែលចង់ធ្វើឲ្យស្រស់ស្អាត:\n\n` +
    `✨ _ខ្ញុំនឹង: លុបស្នាម, ពន្លឺ, ពណ៌ស្រស់ស្អាតជាង_`,
  ocr:
    `📄 *Copy អក្សរ Mode* ✅\n\n` +
    `សូម *ផ្ញើរូបភាព* ដែលមានអក្សរ:\n\n` +
    `_ខ្ញុំនឹង Copy អក្សរទាំងអស់ចេញពីរូបភាព 📋_`,
  qr:
    `🔍 *QR Code Mode* ✅\n\n` +
    `សូម *សរសេរអត្ថបទ* ឬ Link ដែលចង់ធ្វើ QR Code:\n\n` +
    `_ឧ: https://t.me/yourbot_\n` +
    `_ឧ: ឈ្មោះ: សុខ ដារ៉ា, Tel: 012345678_`,
  summarize:
    `✍️ *សង្ខេបអត្ថបទ Mode* ✅\n\n` +
    `សូម *ផ្ញើអត្ថបទ* ដែលចង់សង្ខេប:\n\n` +
    `_ខ្ញុំនឹងសង្ខេបជា 3–5 ចំណុចសំខាន់ 📝_`,
  translate:
    `🌐 *បកប្រែភាសា Mode* ✅\n\n` +
    `សូម *សរសេរអត្ថបទ* ដែលចង់បកប្រែ:\n\n` +
    `• ខ្មែរ → Auto បកប្រែជាអង់គ្លេស\n` +
    `• អង់គ្លេស → Auto បកប្រែជាខ្មែរ\n` +
    `• ភាសាផ្សេង → Auto បកប្រែជាខ្មែរ\n\n` +
    `_🤖 AI Auto-Detect ភាសា_`,
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

/** Downloads a Telegram file into a Buffer using getFileLink + axios. */
async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const link = await bot.getFileLink(fileId);
  const response = await axios.get<ArrayBuffer>(link, {
    responseType: "arraybuffer",
  });
  return Buffer.from(response.data);
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
      `*មុខងារ:*\n` +
      `🖼️ លុបBG · 📷 លុបស្នាម · 📄 Copy · 🔍 QR\n` +
      `🤖 AI Chat · 🗣️ Voice · 🖼️ Image AI\n` +
      `✍️ សង្ខេប · 🌐 បកប្រែ · ⚙️ Settings\n\n` +
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

  await bot.answerCallbackQuery(query.id).catch(() => {});

  // ── Back to main menu ──────────────────────────────────────────────────

  if (data === "mode_start") {
    await sendMainMenu(chatId);
    return;
  }

  // ── Feature mode switches ──────────────────────────────────────────────

  const allModes = [
    "mode_chat", "mode_image", "mode_voice", "mode_video",
    "mode_removebg", "mode_enhance", "mode_ocr",
    "mode_qr", "mode_summarize", "mode_translate",
  ];

  if (allModes.includes(data)) {
    const modeKey = data.replace("mode_", "") as Parameters<typeof memory.setMode>[1];
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

// ── Photo Messages ─────────────────────────────────────────────────────────

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id ?? chatId;

  // ── Handle photo messages ──────────────────────────────────────────────
  if (msg.photo && msg.photo.length > 0) {
    const state = memory.getState(userId);
    const mode = state.mode;

    logger.info({ chatId, mode }, "photo message");

    if (mode === "removebg") {
      const loadingMsg = await bot.sendMessage(
        chatId,
        `🖼️ *កំពុងលុប Background...*\n⏳ 30–60 វិនាទី (ទាញយក AI Model លើកដំបូង)`,
        { parse_mode: "Markdown" },
      );
      const typingTimer = keepTyping(chatId);
      let outPath: string | null = null;
      try {
        const photo = msg.photo[msg.photo.length - 1]!;
        const buffer = await downloadTelegramFile(photo.file_id);
        outPath = await removeImageBackground(buffer);
        clearInterval(typingTimer);
        await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        await bot.sendDocument(chatId, outPath, {
          caption:
            `✅ *លុប Background សម្រេច!*\n\n` +
            `📄 Format: PNG (Transparent)\n` +
            `_បង្កើតដោយ Khmer AI Bot 🤖_`,
          parse_mode: "Markdown",
          reply_markup: backMenuKeyboard,
        });
      } catch (err) {
        clearInterval(typingTimer);
        await safeEditText(chatId, loadingMsg.message_id, "❌ លុប Background បរាជ័យ!");
        await sendError(chatId, err, "លុប Background មិនបាន សូមព្យាយាមម្ដងទៀត");
      } finally {
        if (outPath) cleanupBg(outPath);
      }
      return;
    }

    if (mode === "enhance") {
      const loadingMsg = await bot.sendMessage(
        chatId,
        `📷 *កំពុងធ្វើឲ្យរូបភាពស្រស់ស្អាត...*`,
        { parse_mode: "Markdown" },
      );
      const typingTimer = keepTyping(chatId);
      let outPath: string | null = null;
      try {
        const photo = msg.photo[msg.photo.length - 1]!;
        const buffer = await downloadTelegramFile(photo.file_id);
        outPath = await enhancePhoto(buffer);
        clearInterval(typingTimer);
        await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        await bot.sendPhoto(chatId, outPath, {
          caption:
            `✨ *រូបភាពបានធ្វើឲ្យស្រស់ស្អាត!*\n\n` +
            `• លុបស្នាម ✅\n• ពន្លឺ ✅\n• ពណ៌ ✅\n` +
            `_បង្កើតដោយ Khmer AI Bot 🤖_`,
          parse_mode: "Markdown",
          reply_markup: backMenuKeyboard,
        });
      } catch (err) {
        clearInterval(typingTimer);
        await safeEditText(chatId, loadingMsg.message_id, "❌ ធ្វើឲ្យស្រស់ស្អាតបរាជ័យ!");
        await sendError(chatId, err, "ធ្វើឲ្យស្រស់ស្អាតមិនបាន");
      } finally {
        if (outPath) cleanupEnhance(outPath);
      }
      return;
    }

    if (mode === "ocr") {
      const loadingMsg = await bot.sendMessage(
        chatId,
        `📄 *កំពុង Copy អក្សរ...*\n⏳ AI កំពុងអាន...`,
        { parse_mode: "Markdown" },
      );
      const typingTimer = keepTyping(chatId);
      try {
        const photo = msg.photo[msg.photo.length - 1]!;
        const buffer = await downloadTelegramFile(photo.file_id);
        const extracted = await extractTextFromImage(buffer);
        clearInterval(typingTimer);
        await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        await bot.sendMessage(
          chatId,
          `📄 *អក្សរដែល Copy បាន:*\n\n` + extracted,
          { parse_mode: "Markdown", reply_markup: backMenuKeyboard },
        );
      } catch (err) {
        clearInterval(typingTimer);
        await safeEditText(chatId, loadingMsg.message_id, "❌ Copy អក្សរបរាជ័យ!");
        await sendError(chatId, err, "Copy អក្សរមិនបាន");
      }
      return;
    }

    // Photo sent but not in a photo mode
    await bot.sendMessage(
      chatId,
      `📸 *ជ្រើសរើសមុខងារដំបូង:*\n\n` +
        `• 🖼️ *លុបBG* — លុប Background\n` +
        `• 📷 *លុបស្នាម* — ធ្វើឲ្យស្រស់ស្អាត\n` +
        `• 📄 *Copy អក្សរ* — Copy អក្សរពីរូប`,
      { parse_mode: "Markdown", reply_markup: mainMenuKeyboard },
    );
    return;
  }

  // ── Handle text messages ───────────────────────────────────────────────
  const text = msg.text;
  if (!text || text.startsWith("/")) return;

  const state = memory.getState(userId);
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

  // ── 🗣️ Voice TTS ───────────────────────────────────────────────────────

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

  // ── 🔍 QR Code ─────────────────────────────────────────────────────────

  if (mode === "qr") {
    await bot.sendChatAction(chatId, "upload_photo");
    let qrPath: string | null = null;
    try {
      qrPath = await generateQRCode(text);
      await bot.sendPhoto(chatId, qrPath, {
        caption:
          `🔍 *QR Code*\n\n` +
          `📝 _${text.slice(0, 80)}${text.length > 80 ? "…" : ""}_\n` +
          `_បង្កើតដោយ Khmer AI Bot 🤖_`,
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });
    } catch (err) {
      await sendError(chatId, err, "បង្កើត QR Code មិនបាន");
    } finally {
      if (qrPath) cleanupQr(qrPath);
    }
    return;
  }

  // ── ✍️ Summarize ────────────────────────────────────────────────────────

  if (mode === "summarize") {
    if (text.length < 50) {
      await bot.sendMessage(
        chatId,
        `⚠️ *អត្ថបទខ្លីពេក!*\n\nសូមផ្ញើអត្ថបទវែងជាង 50 អក្សរ 📝`,
        { parse_mode: "Markdown", reply_markup: backMenuKeyboard },
      );
      return;
    }
    await bot.sendChatAction(chatId, "typing");
    const typingTimer = keepTyping(chatId);
    try {
      const summary = await summarizeText(text);
      clearInterval(typingTimer);
      await bot.sendMessage(chatId, summary, {
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });
    } catch (err) {
      clearInterval(typingTimer);
      await sendError(chatId, err, "សង្ខេបអត្ថបទមិនបាន");
    }
    return;
  }

  // ── 🌐 Translate ────────────────────────────────────────────────────────

  if (mode === "translate") {
    await bot.sendChatAction(chatId, "typing");
    const typingTimer = keepTyping(chatId);
    try {
      const result = await translateText(text);
      clearInterval(typingTimer);
      await bot.sendMessage(chatId, result, {
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });
    } catch (err) {
      clearInterval(typingTimer);
      await sendError(chatId, err, "បកប្រែភាសាមិនបាន");
    }
    return;
  }

  // ── Fallback ────────────────────────────────────────────────────────────

  await sendMainMenu(chatId);
});

// ── Polling error ──────────────────────────────────────────────────────────

bot.on("polling_error", (err) => {
  logger.error({ err }, "Telegram polling error");
});

logger.info("🤖 Khmer AI Bot started with polling");

export { bot };
