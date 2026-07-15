import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function generateImage(prompt) {
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&enhance=true&seed=${Date.now()}`;
  const tmpFile = path.join(os.tmpdir(), `img_${Date.now()}.jpg`);

  const response = await axios.get(imageUrl, {
    responseType: 'stream',
    timeout: 120000,
    headers: { 'User-Agent': 'TelegramBot/1.0' },
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tmpFile);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return tmpFile;
}

export function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}
