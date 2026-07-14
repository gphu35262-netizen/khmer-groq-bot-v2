import Groq from "groq-sdk";
import type { ChatMessage } from "../types";

const SYSTEM_PROMPT = `អ្នកជា AI Assistant ឆ្លាតវៃ ដែលឆ្លើយជាភាសាខ្មែរ 100%។
ច្បាប់ដែលត្រូវអនុវត្ត:
- ឆ្លើយជាភាសាខ្មែរតែប៉ុណ្ណោះ ទោះបីអ្នកប្រើសរសេរភាសាណាក៏ដោយ
- ប្រើ Emoji ស្រស់ស្អាត ត្រឹមត្រូវ ដើម្បីធ្វើឲ្យចម្លើយងាយអាន
- ឆ្លើយឲ្យច្បាស់ ងាយយល់ មិនស្មុគស្មាញ
- មានសុភាព អធ្យាស្រ័យ និងស្មោះត្រង់
- ប្រើ Markdown formatting ត្រឹមត្រូវ (bold **អក្សរ**, italic _អក្សរ_)
- ឆ្លើយឲ្យវែង ពេញលេញ ផ្ដល់ព័ត៌មានគ្រប់គ្រាន់`;

let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!groqClient) {
    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export async function chatWithAI(
  userMessage: string,
  history: ChatMessage[],
): Promise<string> {
  const groq = getGroq();

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    max_tokens: 1500,
    temperature: 0.75,
  });

  return (
    completion.choices[0]?.message?.content?.trim() ??
    "សូមអភ័យទោស ខ្ញុំមិនអាចឆ្លើយបានទេ។ 🙏"
  );
}

export async function translatePromptToEnglish(khmerPrompt: string): Promise<string> {
  const groq = getGroq();

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a translator. Translate the user's text to English for an image generation AI prompt. Return ONLY the English translation, nothing else. Make it descriptive and suitable for image generation.",
      },
      { role: "user", content: khmerPrompt },
    ],
    max_tokens: 200,
    temperature: 0.3,
  });

  return (
    completion.choices[0]?.message?.content?.trim() ?? khmerPrompt
  );
}
