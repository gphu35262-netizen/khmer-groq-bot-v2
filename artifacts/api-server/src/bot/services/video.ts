import YTDlpWrap from "yt-dlp-wrap";
import fs from "fs";
import path from "path";
import os from "os";

const YTDLP_BINARY = path.join(os.tmpdir(), "yt-dlp");
const MAX_FILE_SIZE = 48 * 1024 * 1024; // 48 MB Telegram limit

let ytDlp: YTDlpWrap | null = null;

async function getYtDlp(): Promise<YTDlpWrap> {
  if (ytDlp) return ytDlp;

  if (!fs.existsSync(YTDLP_BINARY)) {
    await YTDlpWrap.downloadFromGithub(YTDLP_BINARY);
    fs.chmodSync(YTDLP_BINARY, 0o755);
  }

  ytDlp = new YTDlpWrap(YTDLP_BINARY);
  return ytDlp;
}

export interface VideoInfo {
  title: string;
  duration: number;
  thumbnail: string;
  uploader: string;
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const yt = await getYtDlp();
  const info = await yt.getVideoInfo(url);
  return {
    title: (info.title as string) || "Unknown",
    duration: (info.duration as number) || 0,
    thumbnail: (info.thumbnail as string) || "",
    uploader: (info.uploader as string) || "Unknown",
  };
}

export async function downloadVideo(
  url: string,
  quality: "360" | "720",
): Promise<{ filePath: string; title: string }> {
  const yt = await getYtDlp();
  const outputTemplate = path.join(os.tmpdir(), `vid_${Date.now()}.%(ext)s`);

  const format =
    quality === "720"
      ? `bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]/best`
      : `bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]/worst`;

  let downloadedPath = "";

  await new Promise<void>((resolve, reject) => {
    const stream = yt.execStream([
      url,
      "-f",
      format,
      "-o",
      outputTemplate,
      "--no-playlist",
      "--merge-output-format",
      "mp4",
      "--socket-timeout",
      "30",
    ]);

    stream.on("ytDlpEvent", (_eventType: string, eventData: string) => {
      // Capture output path from yt-dlp progress
      if (eventData && eventData.includes("Destination:")) {
        downloadedPath = eventData.split("Destination:")[1]?.trim() ?? "";
      }
      if (eventData && eventData.includes("Merging formats into")) {
        const match = eventData.match(/"([^"]+)"/);
        if (match?.[1]) downloadedPath = match[1];
      }
    });

    stream.on("close", resolve);
    stream.on("error", reject);
  });

  // Find the downloaded file if path wasn't captured
  if (!downloadedPath || !fs.existsSync(downloadedPath)) {
    const tmpFiles = fs
      .readdirSync(os.tmpdir())
      .filter((f) => f.startsWith("vid_") && f.endsWith(".mp4"))
      .map((f) => ({ name: f, time: fs.statSync(path.join(os.tmpdir(), f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (tmpFiles.length > 0 && tmpFiles[0]) {
      downloadedPath = path.join(os.tmpdir(), tmpFiles[0].name);
    }
  }

  if (!downloadedPath || !fs.existsSync(downloadedPath)) {
    throw new Error("ទាញយកវីដេអូបានបរាជ័យ");
  }

  const stats = fs.statSync(downloadedPath);
  if (stats.size > MAX_FILE_SIZE) {
    fs.unlinkSync(downloadedPath);
    throw new Error(
      `ឯកសារធំពេក (${(stats.size / 1024 / 1024).toFixed(1)}MB). ក្ដារ Telegram អនុញ្ញាតត្រឹម 48MB។ សូមជ្រើស 360p ឬវីដេអូខ្លី។`,
    );
  }

  const info = await getVideoInfo(url).catch(() => ({ title: "Video", duration: 0, thumbnail: "", uploader: "" }));
  return { filePath: downloadedPath, title: info.title };
}

export function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

export function isValidVideoUrl(url: string): boolean {
  return (
    url.includes("youtube.com") ||
    url.includes("youtu.be") ||
    url.includes("facebook.com") ||
    url.includes("fb.watch") ||
    url.includes("tiktok.com") ||
    url.includes("vm.tiktok.com")
  );
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
