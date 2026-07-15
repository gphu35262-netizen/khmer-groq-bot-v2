import sharp from 'sharp';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function enhancePhoto(inputBuffer) {
  const outPath = path.join(os.tmpdir(), `enhance_${Date.now()}.jpg`);

  await sharp(inputBuffer)
    .median(3)
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .sharpen({ sigma: 0.8, m1: 0.5, m2: 2.5 })
    .jpeg({ quality: 93 })
    .toFile(outPath);

  return outPath;
}

export async function cleanupFile(filePath) {
  await fs.unlink(filePath).catch(() => {});
}
