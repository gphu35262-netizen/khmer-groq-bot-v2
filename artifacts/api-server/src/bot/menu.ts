import type { InlineKeyboardMarkup } from "node-telegram-bot-api";

export const mainMenuKeyboard: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "💬 Chat AI", callback_data: "mode_chat" },
      { text: "🎨 Create Image", callback_data: "mode_image" },
    ],
    [
      { text: "🔊 Voice AI", callback_data: "mode_voice" },
      { text: "📥 Video Download", callback_data: "mode_video" },
    ],
    [
      { text: "🧠 Memory AI", callback_data: "mode_memory" },
      { text: "⚙️ Settings", callback_data: "mode_settings" },
    ],
  ],
};

export const backMenuKeyboard: InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: "🏠 ត្រឡប់ Menu", callback_data: "mode_start" }],
  ],
};

export const memoryMenuKeyboard: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "🗑️ លុបការចងចាំ", callback_data: "memory_clear" },
      { text: "🏠 ត្រឡប់ Menu", callback_data: "mode_start" },
    ],
  ],
};

export const settingsKeyboard = (
  autoVoice: boolean,
): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      {
        text: autoVoice
          ? "🔊 Auto Voice: ✅ ON"
          : "🔇 Auto Voice: ❌ OFF",
        callback_data: "settings_toggle_voice",
      },
    ],
    [{ text: "🗑️ លុប Memory ទាំងអស់", callback_data: "memory_clear" }],
    [{ text: "🏠 ត្រឡប់ Menu", callback_data: "mode_start" }],
  ],
});

export const videoQualityKeyboard = (
  _url: string,
): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { text: "📱 360p (ខ្នាតតូច)", callback_data: "dl_360" },
      { text: "💻 720p (ខ្នាតធំ)", callback_data: "dl_720" },
    ],
    [{ text: "❌ បោះបង់", callback_data: "mode_start" }],
  ],
});
