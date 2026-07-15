import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `អ្នកជា AI Assistant ឆ្លាតវៃ ដែលឆ្លើយជាភាសាខ្មែរ 100%។
ច្បាប់ដែលត្រូវអនុវត្ត:
- ឆ្លើយជាភាសាខ្មែរតែប៉ុណ្ណោះ ទោះបីអ្នកប្រើសរសេរភាសាណាក៏ដោយ
- ប្រើ Emoji ស្រស់ស្អាត ត្រឹមត្រូវ ដើម្បីធ្វើឲ្យចម្លើយងាយអាន
- ឆ្លើយឲ្យច្បាស់ ងាយយល់ មិនស្មុគស្មាញ
- មានសុភាព អធ្យាស្រ័យ និងស្មោះត្រង់
- ប្រើ Markdown formatting ត្រឹមត្រូវ (bold **អក្សរ**, italic _អក្សរ_)
- ឆ្លើយឲ្យវែង ពេញលេញ ផ្ដល់ព័ត៌មានគ្រប់គ្រាន់`;

let groqClient = null;

function getGroq() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export async function chatWithAI(userMessage, history) {
  const groq = getGroq();
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 1500,
    temperature: 0.75,
  });
  return completion.choices[0]?.message?.content?.trim() ??
    'សូមអភ័យទោស ខ្ញុំមិនអាចឆ្លើយបានទេ។ 🙏';
}

export async function translatePromptToEnglish(khmerPrompt) {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          'You are a translator. Translate the user\'s text to English for an image generation AI prompt. Return ONLY the English translation, nothing else. Make it descriptive and suitable for image generation.',
      },
      { role: 'user', content: khmerPrompt },
    ],
    max_tokens: 200,
    temperature: 0.3,
  });
  return completion.choices[0]?.message?.content?.trim() ?? khmerPrompt;
}

export async function summarizeText(text) {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          `អ្នកជា AI ដែលសង្ខេបអត្ថបទ។ ច្បាប់:
- សង្ខេបជាភាសាខ្មែរ 100%
- សង្ខេបឲ្យខ្លី ច្បាស់ 3-5 ប្រយោគ
- រក្សាចំណុចសំខាន់ៗទាំងអស់
- ប្រើ Bullet Points • ដើម្បីងាយអាន
- ចាប់ផ្ដើមដោយ "📝 *សង្ខេប:*"`,
      },
      { role: 'user', content: `សូមសង្ខេបអត្ថបទខាងក្រោម:\n\n${text}` },
    ],
    max_tokens: 600,
    temperature: 0.4,
  });
  return completion.choices[0]?.message?.content?.trim() ??
    '❌ មិនអាចសង្ខេបបានទេ សូមព្យាយាមម្ដងទៀត';
}

export async function translateText(text) {
  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          `អ្នកជា AI បកប្រែ។ ច្បាប់:
- Auto-Detect ភាសាប្រភព
- ប្រសិនបើជាភាសាខ្មែរ → បកប្រែជាភាសាអង់គ្លេស
- ប្រសិនបើជាភាសាអង់គ្លេស → បកប្រែជាភាសាខ្មែរ
- ភាសាផ្សេងទៀត → បកប្រែជាភាសាខ្មែរ
- Format: "🌐 *[ភាសាប្រភព] → [ភាសាគោលដៅ]*\n\n[ការបកប្រែ]"`,
      },
      { role: 'user', content: text },
    ],
    max_tokens: 800,
    temperature: 0.2,
  });
  return completion.choices[0]?.message?.content?.trim() ??
    '❌ មិនអាចបកប្រែបានទេ សូមព្យាយាមម្ដងទៀត';
}
