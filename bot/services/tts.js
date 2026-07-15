import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'node:fs/promises';
import os from 'node:os';

// km-KH-SreymomNeural : female (natural, warm)
// km-KH-PisethNeural  : male
const VOICE = 'km-KH-SreymomNeural';

export async function textToSpeechFile(text) {
  const input = text.slice(0, 2000).trim();
  if (!input) throw new Error('អត្ថបទទទេ — មិនអាចបំប្លែងបានទេ');

  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const { audioFilePath } = await tts.toFile(os.tmpdir(), input);
  return audioFilePath;
}

export async function cleanupFile(filePath) {
  await fs.unlink(filePath).catch(() => {});
}
