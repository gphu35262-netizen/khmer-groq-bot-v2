import { removeBackground } from '@imgly/background-removal-node';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function removeImageBackground(inputBuffer) {
  const view = new Uint8Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.byteLength);

  const resultBlob = await removeBackground(view, {
    debug: false,
    output: { format: 'image/png', quality: 0.95 },
  });

  const arrayBuffer = await resultBlob.arrayBuffer();
  const outBuffer = Buffer.from(arrayBuffer);
  const outPath = path.join(os.tmpdir(), `removebg_${Date.now()}.png`);
  await fs.writeFile(outPath, outBuffer);
  return outPath;
}

export async function cleanupFile(filePath) {
  await fs.unlink(filePath).catch(() => {});
}
