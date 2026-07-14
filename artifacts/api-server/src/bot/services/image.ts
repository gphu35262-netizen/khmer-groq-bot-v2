import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

/**
 * Generate image from a text prompt using Pollinations.ai (free, no API key).
 * Returns path to downloaded image file.
 */
export async function generateImage(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&model=flux&nologo=true&enhance=true&seed=${Date.now()}`;

  const tmpFile = path.join(os.tmpdir(), `img_${Date.now()}.jpg`);

  const response = await axios.get<NodeJS.ReadableStream>(imageUrl, {
    responseType: "stream",
    timeout: 120000, // image gen can be slow
    headers: {
      "User-Agent": "TelegramBot/1.0",
    },
  });

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(tmpFile);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return tmpFile;
}

export function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}
