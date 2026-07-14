import type {
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
} from "node-telegram-bot-api";

// ── Persistent bottom keyboard (replaces the typing keyboard) ───────────────
// Shown once on /start and stays visible permanently.
// Tapping a button sends its text as a message → handled in MENU_TRIGGERS.
export const mainReplyKeyboard = {
  keyboard: [
    [{ text: "🖼️ លុបBG" }, { text: "📷 លុបស្នាម" }],
    [{ text: "📄 Copy អក្សរ" }, { text: "🔍 QR Code" }],
    [{ text: "🤖 AI Chat" }, { text: "🗣️ Text to Voice" }],
    [{ text: "🖼️ បង្កើតរូប AI" }, { text: "✍️ សង្ខេបអត្ថបទ" }],
    [{ text: "🌐 បកប្រែភាសា" }, { text: "⚙️ Settings" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
} as unknown as ReplyKeyboardMarkup;

// ── Inline keyboards (shown inside messages) ────────────────────────────────

export const mainInlineKeyboard: InlineKeyboardMarkup = {
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

// Keep old name for compat
export const mainMenuKeyboard = mainInlineKeyboard;

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

export const settingsKeyboard = (autoVoice: boolean): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      {
        text: autoVoice ? "🔊 Auto Voice: ✅ ON" : "🔇 Auto Voice: ❌ OFF",
        callback_data: "settings_toggle_voice",
      },
    ],
    [{ text: "🗑️ លុប Memory ទាំងអស់", callback_data: "memory_clear" }],
    [{ text: "🏠 ត្រឡប់ Menu", callback_data: "mode_start" }],
  ],
});

export const videoQualityKeyboard = (_url: string): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { text: "📱 360p (ខ្នាតតូច)", callback_data: "dl_360" },
      { text: "💻 720p (ខ្នាតធំ)", callback_data: "dl_720" },
    ],
    [{ text: "❌ បោះបង់", callback_data: "mode_start" }],
  ],
});

// ── Text values that the Reply Keyboard sends ───────────────────────────────
// When a user taps a Reply Keyboard button, Telegram sends its `.text` as a
// plain message. Map those texts to the matching mode key.
export const MENU_TRIGGERS: Record<string, string> = {
  "🖼️ លុបBG": "removebg",
  "📷 លុបស្នាម": "enhance",
  "📄 Copy អក្សរ": "ocr",
  "🔍 QR Code": "qr",
  "🤖 AI Chat": "chat",
  "🗣️ Text to Voice": "voice",
  "🖼️ បង្កើតរូប AI": "image",
  "✍️ សង្ខេបអត្ថបទ": "summarize",
  "🌐 បកប្រែភាសា": "translate",
  "⚙️ Settings": "settings",
};
