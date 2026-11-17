import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface ModelAdapterEntry {
  url: string;
  sha256?: string;
  sizeBytes?: number;
  description?: string;
}

export interface ModelManifest {
  version: string;
  base_model?: ModelAdapterEntry;
  adapters: Record<string, ModelAdapterEntry>;
}

export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  status: "downloading" | "verifying" | "completed" | "cached" | "error";
  filePath?: string;
  error?: string;
}

export function getModelsDir(): string {
  const dir = process.env.MODELS_DIR
    ? path.resolve(process.env.MODELS_DIR)
    : path.join(process.cwd(), "models");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

export async function fetchManifest(manifestUrl?: string): Promise<ModelManifest> {
  const url = manifestUrl || process.env.MODEL_MANIFEST_URL;
  if (!url) {
    throw new Error("MODEL_MANIFEST_URL is not configured and no manifestUrl was provided.");
  }

  const headers: Record<string, string> = {};
  if (process.env.HF_TOKEN && url.includes("huggingface.co")) {
    headers["Authorization"] = `Bearer ${process.env.HF_TOKEN}`;
  }

  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch manifest (${res.status}): ${res.statusText}`);
  }
  return (await res.json()) as ModelManifest;
}

export function listCachedModels(): Array<{ name: string; sizeBytes: number; path: string }> {
  const dir = getModelsDir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && !e.name.endsWith(".part"))
    .map((e) => {
      const fullPath = path.join(dir, e.name);
      const stat = fs.statSync(fullPath);
      return { name: e.name, sizeBytes: stat.size, path: fullPath };
    });
}

export async function downloadWithResume(params: {
  url: string;
  filename: string;
  expectedSha256?: string;
  chunkSizeBytes?: number;
  onProgress?: (p: DownloadProgress) => void;
}): Promise<{ filePath: string; cached: boolean; sha256: string }> {
  const {
    url,
    filename,
    expectedSha256,
    chunkSizeBytes = 1024 * 1024, // 1 MB chunks
    onProgress,
  } = params;

  const safeName = path.basename(filename);
  const destPath = path.join(getModelsDir(), safeName);
  const partPath = `${destPath}.part`;

  // 1. Check if already cached and valid
  if (fs.existsSync(destPath)) {
    const existingHash = await computeFileSha256(destPath);
    if (!expectedSha256 || existingHash.toLowerCase() === expectedSha256.toLowerCase()) {
      onProgress?.({
        downloadedBytes: fs.statSync(destPath).size,
        totalBytes: fs.statSync(destPath).size,
        percent: 100,
        status: "cached",
        filePath: destPath,
      });
      return { filePath: destPath, cached: true, sha256: existingHash };
    }
    // Hash mismatch: remove corrupted file
    fs.unlinkSync(destPath);
  }

  const authHeaders: Record<string, string> = {};
  if (process.env.HF_TOKEN && url.includes("huggingface.co")) {
    authHeaders["Authorization"] = `Bearer ${process.env.HF_TOKEN}`;
  }

  // 2. Probe total size with HEAD
  let totalBytes: number | null = null;
  let supportsRange = false;
  try {
    const headRes = await fetch(url, { method: "HEAD", headers: authHeaders, redirect: "follow" });
    const len = headRes.headers.get("content-length");
    if (len) totalBytes = Number(len);
    supportsRange = headRes.headers.get("accept-ranges") === "bytes";
  } catch {
    // Fallback to single-stream GET if HEAD fails
  }

  let downloadedBytes = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;

  if (supportsRange && totalBytes && totalBytes > 0) {
    // Chunked Range download with resume
    while (downloadedBytes < totalBytes) {
      const end = Math.min(downloadedBytes + chunkSizeBytes - 1, totalBytes - 1);
      const res = await fetch(url, {
        headers: {
          ...authHeaders,
          Range: `bytes=${downloadedBytes}-${end}`,
        },
        redirect: "follow",
      });

      if (!res.ok && res.status !== 206) {
        throw new Error(`Chunk download failed (${res.status}): ${res.statusText}`);
      }

      const buf = Buffer.from(await res.arrayBuffer());
      fs.appendFileSync(partPath, buf);
      downloadedBytes += buf.length;

      onProgress?.({
        downloadedBytes,
        totalBytes,
        percent: Math.round((downloadedBytes / totalBytes) * 100),
        status: "downloading",
      });
    }
  } else {
    // Single-stream fallback
    const res = await fetch(url, { headers: authHeaders, redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Download failed (${res.status}): ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(partPath, buf);
    downloadedBytes = buf.length;
    totalBytes = buf.length;
    onProgress?.({
      downloadedBytes,
      totalBytes,
      percent: 100,
      status: "downloading",
    });
  }

  // 3. Verify SHA-256
  onProgress?.({
    downloadedBytes,
    totalBytes,
    percent: 100,
    status: "verifying",
  });

  const actualHash = await computeFileSha256(partPath);
  if (expectedSha256 && actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
    fs.unlinkSync(partPath);
    throw new Error(`SHA-256 mismatch: expected ${expectedSha256}, got ${actualHash}`);
  }

  fs.renameSync(partPath, destPath);
  onProgress?.({
    downloadedBytes,
    totalBytes,
    percent: 100,
    status: "completed",
    filePath: destPath,
  });

  return { filePath: destPath, cached: false, sha256: actualHash };
}
