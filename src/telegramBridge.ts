export interface TelegramBridgeStatus {
  enabled: boolean;
  running: boolean;
  botUsername?: string;
  lastError?: string;
}

let isRunning = false;
let botUsername: string | undefined;
let lastError: string | undefined;
let stopRequested = false;

export function getTelegramStatus(): TelegramBridgeStatus {
  return {
    enabled: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
    running: isRunning,
    botUsername,
    lastError,
  };
}

async function telegramApi(token: string, method: string, body?: Record<string, any>): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram API ${method} failed: ${data.description || res.status}`);
  }
  return data.result;
}

async function sendChunkedMessage(token: string, chatId: number, text: string): Promise<void> {
  const maxLen = 4000;
  const clean = text.trim() || "…";
  for (let i = 0; i < clean.length; i += maxLen) {
    await telegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: clean.slice(i, i + maxLen),
    });
  }
}

export interface TelegramConfirmRequest {
  id: string;
  toolName: string;
  reason: string;
  resolve: (approved: boolean) => void;
}

const pendingConfirmations = new Map<string, TelegramConfirmRequest>();

export async function sendTelegramConfirmation(
  token: string,
  chatId: number,
  toolName: string,
  reason: string
): Promise<boolean> {
  const confirmId = `cfg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      if (pendingConfirmations.has(confirmId)) {
        pendingConfirmations.delete(confirmId);
        resolve(false);
      }
    }, 60_000);

    pendingConfirmations.set(confirmId, {
      id: confirmId,
      toolName,
      reason,
      resolve: (approved: boolean) => {
        clearTimeout(timer);
        pendingConfirmations.delete(confirmId);
        resolve(approved);
      },
    });

    telegramApi(token, "sendMessage", {
      chat_id: chatId,
      text: `⚠️ Confirmación requerida para ejecutar "${toolName}":\n${reason}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Autorizar", callback_data: `approve:${confirmId}` },
            { text: "❌ Denegar", callback_data: `deny:${confirmId}` },
          ],
        ],
      },
    }).catch(() => {
      clearTimeout(timer);
      pendingConfirmations.delete(confirmId);
      resolve(false);
    });
  });
}

export function startTelegramBridge(options: {
  onMessage: (chatId: number, text: string, username?: string) => Promise<string>;
  onClear?: (chatId: number) => Promise<void>;
  getStatusText?: () => string;
}): void {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return;
  }
  if (isRunning) {
    return;
  }

  stopRequested = false;
  isRunning = true;
  lastError = undefined;

  (async () => {
    try {
      const me = await telegramApi(token, "getMe");
      botUsername = me?.username;
      console.log(`[Telegram] Bridge active as @${botUsername || "unknown"}`);
    } catch (err: any) {
      lastError = err?.message || "Failed to connect to Telegram";
      console.error("[Telegram] Startup error:", lastError);
      isRunning = false;
      return;
    }

    let offset = 0;
    while (!stopRequested) {
      try {
        const updates: any[] = await telegramApi(token, "getUpdates", {
          offset,
          timeout: 25,
          allowed_updates: ["message"],
        });

        for (const update of updates) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg?.text || !msg?.chat?.id) continue;

          const chatId: number = msg.chat.id;
          const text: string = msg.text.trim();
          const username: string | undefined = msg.from?.username || msg.from?.first_name;

          if (text === "/start") {
            await sendChunkedMessage(
              token,
              chatId,
              "A su servicio. Soy Aglaia. Formule su consulta con claridad."
            );
            continue;
          }

          if (text === "/status") {
            const statusText = options.getStatusText
              ? options.getStatusText()
              : "Sistema operativo.";
            await sendChunkedMessage(token, chatId, statusText);
            continue;
          }

          if (text === "/clear") {
            if (options.onClear) {
              await options.onClear(chatId);
            }
            await sendChunkedMessage(token, chatId, "Memoria de la sesión despejada.");
            continue;
          }

          await telegramApi(token, "sendChatAction", {
            chat_id: chatId,
            action: "typing",
          }).catch(() => {});

          try {
            const reply = await options.onMessage(chatId, text, username);
            await sendChunkedMessage(token, chatId, reply);
          } catch (err: any) {
            await sendChunkedMessage(
              token,
              chatId,
              `Se ha producido un contratiempo al procesar su solicitud: ${err?.message || "Error interno"}`
            );
          }
        }
      } catch (err: any) {
        lastError = err?.message || "Polling error";
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    isRunning = false;
  })();
}

export function stopTelegramBridge(): void {
  stopRequested = true;
}
