import googleTTS from "google-tts-api";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

const MAX_TTS_LENGTH = 800;

/**
 * Convert text to Khmer speech, return path to downloaded mp3 file.
 */
export async function textToSpeechFile(text: string): Promise<string> {
  const trimmed = text.slice(0, MAX_TTS_LENGTH);

  // Get all audio URLs (handles long text by splitting)
  const urls = googleTTS.getAllAudioUrls(trimmed, {
    lang: "km",
    slow: false,
    host: "https://translate.google.com",
    splitPunct: ",.?!;",
  });

  if (!urls.length || !urls[0]) {
    throw new Error("TTS មិនអាចបង្កើត URL បានទេ");
  }

  // Use first chunk URL
  const audioUrl = urls[0].url;
  const tmpFile = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);

  const response = await axios.get<NodeJS.ReadableStream>(audioUrl, {
    responseType: "stream",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://translate.google.com/",
    },
    timeout: 15000,
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
