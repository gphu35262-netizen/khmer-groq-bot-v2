import QRCode from "qrcode";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Generates a QR code PNG for any text or URL.
 * Returns the path to the generated PNG file.
 */
export async function generateQRCode(text: string): Promise<string> {
  const outPath = path.join(os.tmpdir(), `qr_${Date.now()}.png`);

  await QRCode.toFile(outPath, text, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });

  return outPath;
}

export async function cleanupFile(filePath: string): Promise<void> {
  await fs.unlink(filePath).catch(() => {});
}
