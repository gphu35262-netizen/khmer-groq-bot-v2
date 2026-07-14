import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import { logger } from "./lib/logger";
import {
  mainMenuKeyboard,
  mainReplyKeyboard,
  backMenuKeyboard,
  memoryMenuKeyboard,
  settingsKeyboard,
  videoQualityKeyboard,
  MENU_TRIGGERS,
} from "./bot/menu";
import * as memory from "./bot/memory";
import {
  chatWithAI,
  translatePromptToEnglish,
  summarizeText,
  translateText,
} from "./bot/services/ai";
import { textToSpeechFile, cleanupFile as cleanupTts } from "./bot/services/tts";
import { generateImage, cleanupFile as cleanupImg } from "./bot/services/image";
import {
  downloadVideo,
  getVideoInfo,
  isValidVideoUrl,
  formatDuration,
  cleanupFile as cleanupVid,
} from "./bot/services/video";
import {
  removeImageBackground,
  cleanupFile as cleanupBg,
} from "./bot/services/removebg";
import { enhancePhoto, cleanupFile as cleanupEnhance } from "./bot/services/enhance";
import { generateQRCode, cleanupFile as cleanupQr } from "./bot/services/qr";
import { extractTextFromImage } from "./bot/services/ocr";
import type { UserMode } from "./bot/types";

// ── Bootstrap ──────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Register slash commands so they appear in the "/" menu in Telegram
bot.setMyCommands([
  { command: "start", description: "ចាប់ផ្ដើម Bot + Menu" },
  { command: "menu", description: "បើក Menu ចម្បង" },
  { command: "help", description: "ជំនួយ" },
]).catch(() => {});

// ── Static texts ───────────────────────────────────────────────────────────

function welcomeText(name: string): string {
  return (
    `🤖 *ស្វាគមន៍, ${name}!* 🇰🇭\n\n` +
    `ខ្ញុំជា *Khmer AI Bot* — ជំនួយការ AI ឆ្លាតវៃ 100% ភាសាខ្មែរ\n\n` +
    `📋 *Menu* បង្ហាញខាងក្រោម 👇\n` +
    `ចុចប៊ូតុងណាមួយដើម្បីចាប់ផ្ដើម:`
  );
}

// Instructions shown when a mode is selected
const MODE_INSTRUCTIONS: Record<string, string> = {
  chat:
    `💬 *Chat AI Mode* ✅\n\n` +
    `ខ្ញុំចងចាំការសន្ទនារបស់អ្នក 🧠\n` +
    `សូមសរសេរសំណួរ ឬប្រធានបទ:`,
  image:
    `🖼️ *បង្កើតរូប AI Mode* ✅\n\n` +
    `វាយ *ពណ៌នារូបភាព* ជាភាសាខ្មែរ:\n\n` +
    `_ឧ: ភ្នំ ពន្លឺព្រះអាទិត្យ ស្រស់ស្អាត_\n` +
    `_ឧ: Logo modern ខ្មែរ_`,
  voice:
    `🗣️ *Text to Voice Mode* ✅\n\n` +
    `វាយ *ពាក្យ ឬប្រយោគ* ដែលចង់ស្ដាប់ជាសំឡេង:\n\n` +
    `_ខ្ញុំបំប្លែងអក្សរទៅជាសំឡេងខ្មែរ 🎙️_`,
  video:
    `📥 *Video Download Mode* ✅\n\n` +
    `ផ្ញើ *Link វីដេអូ* (YouTube / TikTok / Facebook):`,
  removebg:
    `🖼️ *លុប Background Mode* ✅\n\n` +
    `*ផ្ញើរូបភាព* ដែលចង់លុប Background:\n\n` +
    `_Output: PNG មានភាពបន្លាស (Transparent)_\n` +
    `⏳ _ដំណើរការ 30–60 វិនាទី_`,
  enhance:
    `📷 *លុបស្នាម Mode* ✅\n\n` +
    `*ផ្ញើរូបភាព* ដែលចង់ធ្វើឲ្យស្អាត:\n\n` +
    `✨ _លុបស្នាម • ពន្លឺ • ពណ៌ស្រស់ស្អាតជាង_`,
  ocr:
    `📄 *Copy អក្សរ Mode* ✅\n\n` +
    `*ផ្ញើរូបភាព* ដែលមានអក្សរ:\n\n` +
    `_AI នឹង Copy អក្សរទាំងអស់ចេញពីរូបភាព 📋_`,
  qr:
    `🔍 *QR Code Mode* ✅\n\n` +
    `វាយ *អត្ថបទ* ឬ Link ដែលចង់ធ្វើ QR:\n\n` +
    `_ឧ: https://t.me/yourbot_\n` +
    `_ឧ: ឈ្មោះ: សុខ ដារ៉ា Tel: 012345678_`,
  summarize:
    `✍️ *សង្ខេបអត្ថបទ Mode* ✅\n\n` +
    `*ផ្ញើអត្ថបទ* ដែលចង់សង្ខេប:\n\n` +
    `_AI នឹងសង្ខេបជា 3–5 ចំណុចសំខាន់ 📝_`,
  translate:
    `🌐 *បកប្រែភាសា Mode* ✅\n\n` +
    `*វាយអត្ថបទ* ដែលចង់បកប្រែ:\n\n` +
    `• ខ្មែរ → English\n` +
    `• English → ខ្មែរ\n` +
    `• ភាសាផ្សេង → ខ្មែរ\n\n` +
    `_🤖 Auto-Detect ភាសា_`,
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Send the main inline menu (also resets mode to "start"). */
async function sendMainMenu(chatId: number): Promise<void> {
  memory.setMode(chatId, "start");
  await bot.sendMessage(
    chatId,
    `🏠 *Menu ចម្បង* — ជ្រើសរើសមុខងារ:`,
    { parse_mode: "Markdown", reply_markup: mainMenuKeyboard },
  );
}

/** Show mode instructions + back button. */
async function sendModeInstruction(chatId: number, userId: number, modeKey: string): Promise<void> {
  memory.setMode(userId, modeKey as UserMode);
  const text = MODE_INSTRUCTIONS[modeKey];
  if (!text) {
    await sendMainMenu(chatId);
    return;
  }
  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: backMenuKeyboard,
  });
}

async function safeEditText(chatId: number, messageId: number, text: string): Promise<void> {
  try {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
    });
  } catch {
    /* ignore "message not modified" */
  }
}

async function sendError(chatId: number, err: unknown, fallback: string): Promise<void> {
  const msg =
    err instanceof Error
      ? err.message.slice(0, 300)
      : fallback;
  logger.error({ err, chatId }, "Bot error");
  await bot.sendMessage(chatId, `❌ ${msg}`, { reply_markup: backMenuKeyboard }).catch(() => {});
}

/** Keeps the typing indicator alive every 4 s during long operations. */
function keepTyping(chatId: number): ReturnType<typeof setInterval> {
  return setInterval(() => {
    bot.sendChatAction(chatId, "typing").catch(() => {});
  }, 4_000);
}

/** Downloads a Telegram file to a Buffer. */
async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const link = await bot.getFileLink(fileId);
  const res = await axios.get<ArrayBuffer>(link, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

// ── /start ─────────────────────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name ?? "អ្នក";
  logger.info({ chatId, name }, "/start");
  memory.setMode(chatId, "start");

  // Send welcome with the PERSISTENT Reply Keyboard so it shows at the bottom
  await bot.sendMessage(chatId, welcomeText(name), {
    parse_mode: "Markdown",
    reply_markup: mainReplyKeyboard,
  });

  // Then send the inline Menu below the welcome message
  await bot.sendMessage(
    chatId,
    `📋 *ជ្រើសរើសមុខងារ:*`,
    { parse_mode: "Markdown", reply_markup: mainMenuKeyboard },
  );
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
      `*/start* — ចាប់ផ្ដើម + Menu\n` +
      `*/menu* — Menu ចម្បង\n` +
      `*/help* — ជំនួយ\n\n` +
      `*📋 មុខងារ:*\n` +
      `🖼️ លុបBG — លុប Background ចេញពីរូប\n` +
      `📷 លុបស្នាម — ធ្វើឲ្យរូបស្អាតជាង\n` +
      `📄 Copy អក្សរ — OCR ចេញអក្សរពីរូប\n` +
      `🔍 QR Code — បង្កើត QR Code\n` +
      `🤖 AI Chat — ចម្លើយ AI ភាសាខ្មែរ\n` +
      `🗣️ Text to Voice — អក្សរ → សំឡេង\n` +
      `🖼️ បង្កើតរូប AI — AI Image Generation\n` +
      `✍️ សង្ខេបអត្ថបទ — AI Summarize\n` +
      `🌐 បកប្រែភាសា — Auto Translate\n\n` +
      `_ប្រសិនបើមានបញ្ហា សូម /start ម្ដងទៀត_`,
    { parse_mode: "Markdown", reply_markup: backMenuKeyboard },
  );
});

// ── Callback Queries (Inline keyboard button presses) ──────────────────────

bot.on("callback_query", async (query) => {
  if (!query.message || !query.data) return;

  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  const msgId = query.message.message_id;

  // Always acknowledge immediately to stop the loading spinner
  await bot.answerCallbackQuery(query.id).catch(() => {});

  logger.info({ chatId, data }, "callback_query");

  try {
    // ── Back to main menu ────────────────────────────────────────────────
    if (data === "mode_start") {
      await sendMainMenu(chatId);
      return;
    }

    // ── Memory panel ─────────────────────────────────────────────────────
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

    // ── Clear memory ──────────────────────────────────────────────────────
    if (data === "memory_clear") {
      memory.clearHistory(userId);
      await bot.sendMessage(
        chatId,
        `🗑️ *ការចងចាំត្រូវបានលុបចោល!* ✅\n\nBot នឹងចាប់ផ្ដើមការសន្ទនាថ្មី 🔄`,
        { parse_mode: "Markdown", reply_markup: backMenuKeyboard },
      );
      return;
    }

    // ── Settings panel ────────────────────────────────────────────────────
    if (data === "mode_settings") {
      memory.setMode(userId, "settings");
      const state = memory.getState(userId);
      await bot.sendMessage(
        chatId,
        `⚙️ *Settings*\n\n🔊 *Auto Voice* — AI ឆ្លើយជាសំឡេងដោយស្វ័យប្រវត្តិ`,
        {
          parse_mode: "Markdown",
          reply_markup: settingsKeyboard(state.settings.autoVoice),
        },
      );
      return;
    }

    // ── Toggle auto-voice ─────────────────────────────────────────────────
    if (data === "settings_toggle_voice") {
      const newVal = memory.toggleAutoVoice(userId);
      try {
        await bot.editMessageReplyMarkup(settingsKeyboard(newVal), {
          chat_id: chatId,
          message_id: msgId,
        });
      } catch {
        /* ignore */
      }
      await bot.sendMessage(
        chatId,
        newVal
          ? "🔊 *Auto Voice បានបើក!* ចម្លើយ AI នឹងអានជាសំឡេង 🎙️"
          : "🔇 *Auto Voice បានបិទ។*",
        { parse_mode: "Markdown" },
      );
      return;
    }

    // ── Video quality selection ───────────────────────────────────────────
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
        `📥 *កំពុងទាញយកវីដេអូ ${quality}p...*\n⏳ 1–3 នាទី`,
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
            `🎬 *${result.title}*\n\n📱 ${quality}p\n_Khmer AI Bot 🤖_`,
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

    // ── Feature mode switches (all other mode_* buttons) ─────────────────
    const MODE_KEYS = [
      "mode_chat", "mode_image", "mode_voice", "mode_video",
      "mode_removebg", "mode_enhance", "mode_ocr",
      "mode_qr", "mode_summarize", "mode_translate",
    ];

    if (MODE_KEYS.includes(data)) {
      const modeKey = data.replace("mode_", "");
      await sendModeInstruction(chatId, userId, modeKey);
      return;
    }

    // Unknown callback — just show menu
    await sendMainMenu(chatId);

  } catch (err) {
    logger.error({ err, chatId, data }, "callback_query error");
    await bot.sendMessage(chatId, "❌ មានបញ្ហា សូមចុច /start ម្ដងទៀត").catch(() => {});
  }
});

// ── All incoming messages (photo + text) ───────────────────────────────────

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id ?? chatId;

  // ── Photo messages ───────────────────────────────────────────────────────
  if (msg.photo && msg.photo.length > 0) {
    const mode = memory.getState(userId).mode;
    logger.info({ chatId, mode }, "photo received");

    try {
      if (mode === "removebg") {
        const loadingMsg = await bot.sendMessage(
          chatId,
          `🖼️ *កំពុងលុប Background...*\n⏳ 30–60 វិនាទី`,
          { parse_mode: "Markdown" },
        );
        const typingTimer = keepTyping(chatId);
        let outPath: string | null = null;
        try {
          const photo = msg.photo[msg.photo.length - 1]!;
          const buf = await downloadTelegramFile(photo.file_id);
          outPath = await removeImageBackground(buf);
          clearInterval(typingTimer);
          await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
          await bot.sendDocument(chatId, outPath, {
            caption:
              `✅ *លុប Background សម្រេច!*\n\nFormat: PNG (Transparent)\n_Khmer AI Bot 🤖_`,
            parse_mode: "Markdown",
            reply_markup: backMenuKeyboard,
          });
        } catch (err) {
          clearInterval(typingTimer);
          await safeEditText(chatId, loadingMsg.message_id, "❌ លុប Background បរាជ័យ!");
          await sendError(chatId, err, "លុប Background មិនបាន");
        } finally {
          if (outPath) cleanupBg(outPath);
        }
        return;
      }

      if (mode === "enhance") {
        const loadingMsg = await bot.sendMessage(
          chatId,
          `📷 *កំពុងធ្វើឲ្យរូបស្អាត...*`,
          { parse_mode: "Markdown" },
        );
        const typingTimer = keepTyping(chatId);
        let outPath: string | null = null;
        try {
          const photo = msg.photo[msg.photo.length - 1]!;
          const buf = await downloadTelegramFile(photo.file_id);
          outPath = await enhancePhoto(buf);
          clearInterval(typingTimer);
          await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
          await bot.sendPhoto(chatId, outPath, {
            caption:
              `✨ *រូបភាពបានធ្វើឲ្យស្អាត!*\n\n• លុបស្នាម ✅\n• ពន្លឺ ✅\n• ពណ៌ ✅\n_Khmer AI Bot 🤖_`,
            parse_mode: "Markdown",
            reply_markup: backMenuKeyboard,
          });
        } catch (err) {
          clearInterval(typingTimer);
          await safeEditText(chatId, loadingMsg.message_id, "❌ ធ្វើឲ្យស្អាតបរាជ័យ!");
          await sendError(chatId, err, "ធ្វើឲ្យស្អាតមិនបាន");
        } finally {
          if (outPath) cleanupEnhance(outPath);
        }
        return;
      }

      if (mode === "ocr") {
        const loadingMsg = await bot.sendMessage(
          chatId,
          `📄 *AI កំពុង Copy អក្សរ...*`,
          { parse_mode: "Markdown" },
        );
        const typingTimer = keepTyping(chatId);
        try {
          const photo = msg.photo[msg.photo.length - 1]!;
          const buf = await downloadTelegramFile(photo.file_id);
          const extracted = await extractTextFromImage(buf);
          clearInterval(typingTimer);
          await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
          await bot.sendMessage(
            chatId,
            `📄 *អក្សរដែល Copy បាន:*\n\n${extracted}`,
            { parse_mode: "Markdown", reply_markup: backMenuKeyboard },
          );
        } catch (err) {
          clearInterval(typingTimer);
          await safeEditText(chatId, loadingMsg.message_id, "❌ Copy អក្សរបរាជ័យ!");
          await sendError(chatId, err, "Copy អក្សរមិនបាន");
        }
        return;
      }

      // Photo in wrong mode → guide the user
      await bot.sendMessage(
        chatId,
        `📸 ចង់ทำ​អ្វីជាមួយរូបនេះ?\n\nជ្រើស​ "🖼️ លុបBG" "📷 លុបស្នាម" ឬ "📄 Copy អក្សរ" ខាងក្រោម:`,
        { reply_markup: mainMenuKeyboard },
      );
    } catch (err) {
      logger.error({ err, chatId }, "photo handler error");
    }
    return;
  }

  // ── Text messages ────────────────────────────────────────────────────────
  const text = msg.text;
  if (!text || text.startsWith("/")) return;

  // ── Reply Keyboard button press routing ───────────────────────────────
  // When a user taps a button in the Reply Keyboard, Telegram sends its
  // label as a plain text message. Intercept those here.
  if (MENU_TRIGGERS[text] !== undefined) {
    const targetMode = MENU_TRIGGERS[text]!;
    logger.info({ chatId, targetMode }, "menu trigger");

    try {
      if (targetMode === "settings") {
        memory.setMode(userId, "settings");
        const state = memory.getState(userId);
        await bot.sendMessage(
          chatId,
          `⚙️ *Settings*\n\n🔊 *Auto Voice* — AI ឆ្លើយជាសំឡេងដោយស្វ័យប្រវត្តិ`,
          {
            parse_mode: "Markdown",
            reply_markup: settingsKeyboard(state.settings.autoVoice),
          },
        );
      } else {
        await sendModeInstruction(chatId, userId, targetMode);
      }
    } catch (err) {
      logger.error({ err, chatId }, "menu trigger error");
      await sendError(chatId, err, "មានបញ្ហា សូមព្យាយាមម្ដងទៀត");
    }
    return;
  }

  const state = memory.getState(userId);
  // Default: no mode set yet → treat as chat
  const mode: UserMode = state.mode === "start" ? "chat" : state.mode;

  logger.info({ chatId, mode, preview: text.slice(0, 60) }, "text message");

  // ── 💬 Chat AI ────────────────────────────────────────────────────────
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

      // Auto-voice
      if (state.settings.autoVoice) {
        let audioPath: string | null = null;
        try {
          await bot.sendChatAction(chatId, "record_voice");
          const plain = reply.replace(/[*_`[\]()#]/g, "").slice(0, 500);
          audioPath = await textToSpeechFile(plain);
          await bot.sendVoice(chatId, audioPath);
        } catch { /* non-critical */ } finally {
          if (audioPath) cleanupTts(audioPath);
        }
      }
    } catch (err) {
      clearInterval(typingTimer);
      await sendError(chatId, err, "AI ឆ្លើយមិនបាន សូមព្យាយាមម្ដងទៀត");
    }
    return;
  }

  // ── 🖼️ Image Generator ─────────────────────────────────────────────────
  if (mode === "image") {
    const loadingMsg = await bot.sendMessage(
      chatId,
      `🖼️ *កំពុងបង្កើតរូប...*\n📝 _${text}_\n⏳ 30–60 វិនាទី`,
      { parse_mode: "Markdown" },
    );
    const typingTimer = keepTyping(chatId);
    let imgPath: string | null = null;
    try {
      await safeEditText(chatId, loadingMsg.message_id,
        `🖼️ *កំពុងបង្កើតរូប...*\n📝 _${text}_\n🔄 កំពុងបកប្រែ...`);
      const englishPrompt = await translatePromptToEnglish(text);
      await safeEditText(chatId, loadingMsg.message_id,
        `🖼️ *កំពុងបង្កើតរូប...*\n✨ _${englishPrompt}_\n⏳ កំពុងបង្កើត...`);
      imgPath = await generateImage(englishPrompt);
      clearInterval(typingTimer);
      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
      await bot.sendPhoto(chatId, imgPath, {
        caption: `🖼️ *រូបភាពរបស់អ្នក*\n\n📝 ${text}\n_Khmer AI Bot 🤖_`,
        parse_mode: "Markdown",
        reply_markup: backMenuKeyboard,
      });
    } catch (err) {
      clearInterval(typingTimer);
      await safeEditText(chatId, loadingMsg.message_id, "❌ បង្កើតរូបបរាជ័យ!");
      await sendError(chatId, err, "បង្កើតរូបភាពមិនបាន");
    } finally {
      if (imgPath) cleanupImg(imgPath);
    }
    return;
  }

  // ── 🗣️ Voice TTS ──────────────────────────────────────────────────────
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

  // ── 📥 Video Download ─────────────────────────────────────────────────
  if (mode === "video") {
    const url = text.trim();
    if (!isValidVideoUrl(url)) {
      await bot.sendMessage(
        chatId,
        `⚠️ *Link មិនត្រឹមត្រូវ!*\n\nផ្ញើ Link ពី YouTube / TikTok / Facebook`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    const loadingMsg = await bot.sendMessage(chatId, "🔍 *កំពុងពិនិត្យ...*", {
      parse_mode: "Markdown",
    });

    try {
      const info = await getVideoInfo(url);
      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
      memory.setPendingVideoUrl(userId, url);
      await bot.sendMessage(
        chatId,
        `📹 *ព័ត៌មានវីដេអូ*\n\n🎬 ${info.title}\n⏱️ ${formatDuration(info.duration)}\n👤 ${info.uploader}\n\n📥 *ជ្រើសរើសគុណភាព:*`,
        { parse_mode: "Markdown", reply_markup: videoQualityKeyboard(url) },
      );
    } catch (err) {
      await safeEditText(chatId, loadingMsg.message_id, "❌ ពិនិត្យវីដេអូបរាជ័យ!");
      await sendError(chatId, err, "ទាញព័ត៌មានវីដេអូបរាជ័យ");
    }
    return;
  }

  // ── 🔍 QR Code ───────────────────────────────────────────────────────
  if (mode === "qr") {
    await bot.sendChatAction(chatId, "upload_photo");
    let qrPath: string | null = null;
    try {
      qrPath = await generateQRCode(text);
      await bot.sendPhoto(chatId, qrPath, {
        caption:
          `🔍 *QR Code*\n\n📝 _${text.slice(0, 80)}${text.length > 80 ? "…" : ""}_\n_Khmer AI Bot 🤖_`,
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

  // ── ✍️ Summarize ─────────────────────────────────────────────────────
  if (mode === "summarize") {
    if (text.length < 30) {
      await bot.sendMessage(
        chatId,
        `⚠️ *អត្ថបទខ្លីពេក!*\n\nផ្ញើអត្ថបទវែងជាង 30 អក្សរ 📝`,
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

  // ── 🌐 Translate ─────────────────────────────────────────────────────
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

  // ── Fallback (settings/memory mode — show menu) ───────────────────────
  await sendMainMenu(chatId);
});

// ── Polling error ──────────────────────────────────────────────────────────

bot.on("polling_error", (err) => {
  logger.error({ err }, "Telegram polling error");
});

logger.info("🤖 Khmer AI Bot started with polling");

export { bot };
