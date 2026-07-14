import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs/promises";
import os from "node:os";

// Microsoft Edge Neural TTS — free, no API key, very natural sound.
// km-KH-SreymomNeural : female (warm, clear)
// km-KH-PisethNeural  : male  (deeper)
const VOICE = "km-KH-SreymomNeural";

/**
 * Convert text to a natural-sounding Khmer MP3 using Microsoft Edge Neural TTS.
 * Returns the path to the generated file (cleaned up by the caller).
 */
export async function textToSpeechFile(text: string): Promise<string> {
  // Edge TTS handles long text natively — up to ~2000 chars is safe
  const input = text.slice(0, 2000).trim();
  if (!input) throw new Error("អត្ថបទទទេ — មិនអាចបំប្លែងបានទេ");

  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  // toFile(directory, text) → writes an mp3 into the given directory
  const { audioFilePath } = await tts.toFile(os.tmpdir(), input);
  return audioFilePath;
}

export async function cleanupFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {});
}
