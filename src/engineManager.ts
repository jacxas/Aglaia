import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export interface EngineStatus {
  running: boolean;
  port: number;
  baseUrl: string;
  binPath: string;
  binaryExists: boolean;
  modelPath?: string;
  loraPath?: string;
  pid?: number;
}

export class LocalEngine {
  private proc: ChildProcess | null = null;
  private port: number;
  private binPath: string;
  private currentModelPath?: string;
  private currentLoraPath?: string;

  constructor(
    port = Number(process.env.LOCAL_ENGINE_PORT || 8080),
    binaryName = process.env.LOCAL_ENGINE_BIN ||
      (process.platform === "win32" ? "llama-server.exe" : "llama-server")
  ) {
    this.port = port;
    this.binPath = path.resolve(process.cwd(), "bin", binaryName);
  }

  getStatus(): EngineStatus {
    return {
      running: Boolean(this.proc && !this.proc.killed),
      port: this.port,
      baseUrl: `http://127.0.0.1:${this.port}/v1`,
      binPath: this.binPath,
      binaryExists: fs.existsSync(this.binPath),
      modelPath: this.currentModelPath,
      loraPath: this.currentLoraPath,
      pid: this.proc?.pid,
    };
  }

  async start(modelPath: string, loraPath?: string): Promise<string> {
    if (!fs.existsSync(this.binPath)) {
      throw new Error(`Local engine binary not found at ${this.binPath}`);
    }
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found at ${modelPath}`);
    }
    if (loraPath && !fs.existsSync(loraPath)) {
      throw new Error(`LoRA file not found at ${loraPath}`);
    }

    await this.stop();

    const threads = Math.max(1, Math.floor(os.cpus().length / 2));
    const args = [
      "--model",
      modelPath,
      "--host",
      "127.0.0.1",
      "--port",
      this.port.toString(),
      "--ctx-size",
      process.env.LOCAL_ENGINE_CTX || "4096",
      "--threads",
      threads.toString(),
      "--jinja",
      "--no-webui",
      "--log-disable",
    ];

    if (loraPath) {
      args.push("--lora", loraPath);
    }

    this.currentModelPath = modelPath;
    this.currentLoraPath = loraPath;

    this.proc = spawn(this.binPath, args, {
      stdio: "ignore",
      windowsHide: true,
    });

    this.proc.on("exit", () => {
      this.proc = null;
    });

    process.once("exit", () => {
      void this.stop();
    });

    await this.waitForReady();
    return `http://127.0.0.1:${this.port}/v1`;
  }

  private async waitForReady(timeoutMs = 30_000): Promise<void> {
    const start = Date.now();
    const healthUrl = `http://127.0.0.1:${this.port}/health`;

    while (Date.now() - start < timeoutMs) {
      if (!this.proc || this.proc.killed) {
        throw new Error("Local engine process exited before becoming ready.");
      }
      try {
        const res = await fetch(healthUrl);
        if (res.ok) {
          const data: any = await res.json();
          if (data.status === "ok") return;
        }
      } catch {
        // Server still loading model into RAM
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    await this.stop();
    throw new Error("Timed out waiting for local engine to become ready.");
  }

  async stop(): Promise<void> {
    if (this.proc && !this.proc.killed) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
    this.currentModelPath = undefined;
    this.currentLoraPath = undefined;
  }
}

export const localEngine = new LocalEngine();
