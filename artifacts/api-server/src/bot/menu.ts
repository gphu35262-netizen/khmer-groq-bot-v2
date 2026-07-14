import type { InlineKeyboardMarkup } from "node-telegram-bot-api";

export const mainMenuKeyboard: InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: "🖼️ លុបBG", callback_data: "mode_removebg" },
      { text: "📷 លុបស្នាម", callback_data: "mode_enhance" },
    ],
    [
      { text: "📄 Copy អក្សរ", callback_data: "mode_ocr" },
      { text: "🔍 QR Code", callback_data: "mode_qr" },
    ],
    [
      { text: "🤖 AI Chat", callback_data: "mode_chat" },
      { text: "🗣️ Text to Voice", callback_data: "mode_voice" },
    ],
    [
      { text: "🖼️ បង្កើតរូប AI", callback_data: "mode_image" },
      { text: "✍️ សង្ខេបអត្ថបទ", callback_data: "mode_summarize" },
    ],
    [
      { text: "🌐 បកប្រែភាសា", callback_data: "mode_translate" },
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
