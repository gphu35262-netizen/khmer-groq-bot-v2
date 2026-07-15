import { execFile } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

const YTDLP_PATH = path.join(os.tmpdir(), 'yt-dlp');
const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
const MAX_FILE_BYTES = 48 * 1024 * 1024; // 48 MB

let ytDlpReady = false;

async function ensureYtDlp() {
  if (ytDlpReady) return;
  if (!fs.existsSync(YTDLP_PATH)) {
    console.log('[video] Downloading yt-dlp binary...');
    const response = await axios.get(YTDLP_URL, {
      responseType: 'stream',
      maxRedirects: 10,
      timeout: 120_000,
      headers: { 'User-Agent': 'Khmer-AI-Bot/1.0' },
    });
    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(YTDLP_PATH);
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    fs.chmodSync(YTDLP_PATH, 0o755);
    console.log('[video] yt-dlp ready');
  }
  ytDlpReady = true;
}

export async function getVideoInfo(url) {
  await ensureYtDlp();
  const { stdout } = await execFileAsync(
    YTDLP_PATH,
    ['--dump-json', '--no-playlist', '--socket-timeout', '30', url],
    { timeout: 60_000 },
  );
  const info = JSON.parse(stdout);
  return {
    title: String(info.title ?? 'Unknown'),
    duration: Number(info.duration ?? 0),
    thumbnail: String(info.thumbnail ?? ''),
    uploader: String(info.uploader ?? info.channel ?? 'Unknown'),
  };
}

export async function downloadVideo(url, quality) {
  await ensureYtDlp();
  const timestamp = Date.now();
  const outputTemplate = path.join(os.tmpdir(), `vid_${timestamp}.%(ext)s`);

  const format =
    quality === '720'
      ? 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]/best'
      : 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]/worst';

  const { stdout } = await execFileAsync(
    YTDLP_PATH,
    [url, '-f', format, '-o', outputTemplate, '--no-playlist',
      '--merge-output-format', 'mp4', '--print', 'after_move:filepath',
      '--socket-timeout', '30'],
    { timeout: 300_000 },
  );

  const lines = stdout.trim().split('\n').filter(Boolean);
  let filePath = lines[lines.length - 1]?.trim() ?? '';

  if (!filePath || !fs.existsSync(filePath)) {
    const candidates = fs.readdirSync(os.tmpdir())
      .filter(f => f.startsWith(`vid_${timestamp}`) && f.endsWith('.mp4'))
      .map(f => path.join(os.tmpdir(), f));
    filePath = candidates[0] ?? '';
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('ទាញយកវីដេអូបានបរាជ័យ — ឯកសារមិនត្រូវបានបង្កើត');
  }

  const { size } = fs.statSync(filePath);
  if (size > MAX_FILE_BYTES) {
    fs.unlinkSync(filePath);
    const mb = (size / 1024 / 1024).toFixed(1);
    throw new Error(`ឯកសារធំពេក (${mb} MB)។ Telegram អនុញ្ញាតត្រឹម 48 MB។ សូមជ្រើស 360p ឬវីដេអូខ្លីជាងនេះ។`);
  }

  const info = await getVideoInfo(url).catch(() => ({ title: 'Video', duration: 0, thumbnail: '', uploader: '' }));
  return { filePath, title: info.title };
}

export function isValidVideoUrl(url) {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    return (
      host.includes('youtube.com') || host.includes('youtu.be') ||
      host.includes('facebook.com') || host.includes('fb.watch') ||
      host.includes('tiktok.com') || host.includes('vm.tiktok.com')
    );
  } catch { return false; }
}

export function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return 'N/A';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function cleanupFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore */ }
}
