import Groq from 'groq-sdk';

let groqClient = null;

function getGroq() {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY is not set');
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export async function extractTextFromImage(imageBuffer) {
  const groq = getGroq();
  const base64 = imageBuffer.toString('base64');

  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
          {
            type: 'text',
            text: 'Extract ALL text visible in this image exactly as written, preserving original formatting and line breaks. Return only the extracted text — no explanation, no commentary.',
          },
        ],
      },
    ],
    max_tokens: 2048,
  });

  const result = response.choices[0]?.message?.content?.trim();
  return result && result.length > 0 ? result : 'រករឃើញ​អក្សរ​ ❌';
}
