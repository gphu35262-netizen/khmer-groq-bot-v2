import sharp from "sharp";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Enhances a photo: reduces blemishes/noise and improves sharpness/color.
 * Returns path to a JPEG file with the enhanced image.
 */
export async function enhancePhoto(inputBuffer: Buffer): Promise<string> {
  const outPath = path.join(os.tmpdir(), `enhance_${Date.now()}.jpg`);

  await sharp(inputBuffer)
    .median(3)                                       // smooth small blemishes & noise
    .modulate({ brightness: 1.05, saturation: 1.1 }) // subtle brightness + color boost
    .sharpen({ sigma: 0.8, m1: 0.5, m2: 2.5 })      // smart edge sharpening
    .jpeg({ quality: 93 })
    .toFile(outPath);

  return outPath;
}

export async function cleanupFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {});
}
