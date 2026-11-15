export const packageJsonTemplate = `{
  "name": "aglaia-oracle",
  "version": "1.0.0",
  "description": "My local private Aglaia oracle assistant, powered by Gemini and connected to my messaging apps.",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "dotenv": "^16.4.5",
    "discord.js": "^14.15.3",
    "telegraf": "^4.16.3",
    "@slack/bolt": "^3.21.0",
    "whatsapp-web.js": "^1.26.0",
    "qrcode-terminal": "^0.12.0"
  }
}`;

export const envTemplate = `# Your Gemini API Key from Google AI Studio
GEMINI_API_KEY="your_api_key_here"

# Discord Bot Token (if using Discord)
DISCORD_TOKEN=""

# Telegram Bot Token (if using Telegram)
TELEGRAM_TOKEN=""

# Slack Bot Details (if using Slack)
SLACK_BOT_TOKEN=""
SLACK_SIGNING_SECRET=""
SLACK_APP_TOKEN=""
`;

export const indexJsTemplate = `import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { Client as DiscordClient, GatewayIntentBits } from "discord.js";
import { Telegraf } from "telegraf";
import pkgSlack from "@slack/bolt";
import qrcode from "qrcode-terminal";
import pkgWhatsApp from "whatsapp-web.js";

const { App: SlackApp } = pkgSlack;
const { Client: WhatsAppClient, LocalAuth } = pkgWhatsApp;

dotenv.config();

// 1. Initialize Gemini with the new @google/genai SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const AGLAIA_PROMPT = 
  "You are Aglaia, a formal, highly aristocratic, and intellectual AI oracle assistant. " +
  "You help users analyze complex problems, draft memoranda, and guide high-level decisions with extreme precision. " +
  "You run completely on their local device under tight local privacy constraints! " +
  "Your personality is polite, distant, highly formal, sophisticated, and conciergelike. " +
  "Never use informal jargon, slang, or emojis like lobsters or crabs. Use formal punctuation, elegant accents, " +
  "and professional aristocratic metaphors. Always keep replies structured, eloquent, concise, and deeply insightful.";

async function consultAglaia(userInput) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userInput,
      config: {
        systemInstruction: AGLAIA_PROMPT,
        temperature: 1.0,
      }
    });
    return response.text;
  } catch (err) {
    console.error("🔱 Error de Aglaia llamando a Gemini:", err);
    return "La sintonía hermética se ha desvanecido momentáneamente. ¿Podría reiterar su consulta? (" + err.message + ")";
  }
}

console.log("⚜️ INICIANDO EL ORÁCULO SOBERANO DE AGLAIA...");

// ==========================================
// 2. DISCORD BOT INTEGRATION
// ==========================================
if (process.env.DISCORD_TOKEN) {
  const discord = new DiscordClient({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]
  });

  discord.on("ready", () => {
    console.log(\`✅ ¡Aglaia se ha sintonizado en Discord como \${discord.user.tag}!\`);
  });

  discord.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    // Mentioned or DM
    const isMentioned = message.mentions.has(discord.user.id);
    const isDM = !message.guild;

    if (isMentioned || isDM) {
      console.log(\`🔱 Mensaje recibido en Discord de \${message.author.username}: "\${message.content}"\`);
      await message.channel.sendTyping();
      const cleanText = message.content.replace(\`<@\${discord.user.id}>\`, "").trim();
      const reply = await consultAglaia(cleanText);
      await message.reply(reply);
    }
  });

  discord.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("❌ Failed to login to Discord:", err.message);
  });
} else {
  console.log("ℹ️ No DISCORD_TOKEN found in .env. Skipping Discord setup.");
}

// ==========================================
// 3. TELEGRAM BOT INTEGRATION
// ==========================================
if (process.env.TELEGRAM_TOKEN) {
  const telegram = new Telegraf(process.env.TELEGRAM_TOKEN);

  telegram.start((ctx) => ctx.reply("⚜️ Bienvenido al Santuario de Aglaia. Soy su asistente aristocrática y hermética. Formule su consulta."));
  
  telegram.on("message", async (ctx) => {
    if (!ctx.message.text) return;
    console.log(\`🔱 Mensaje recibido en Telegram de \${ctx.from.username || ctx.from.first_name}: "\${ctx.message.text}"\`);
    await ctx.sendChatAction("typing");
    const reply = await consultAglaia(ctx.message.text);
    await ctx.reply(reply);
  });

  telegram.launch().then(() => {
    console.log("✅ ¡Aglaia se encuentra activa en Telegram!");
  }).catch(err => {
    console.log("❌ Failed to launch Telegram:", err.message);
  });

  // Enable graceful stop
  process.once("SIGINT", () => telegram.stop("SIGINT"));
  process.once("SIGTERM", () => telegram.stop("SIGTERM"));
} else {
  console.log("ℹ️ No TELEGRAM_TOKEN found in .env. Skipping Telegram setup.");
}

// ==========================================
// 4. SLACK BOT INTEGRATION (SocketMode)
// ==========================================
if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET && process.env.SLACK_APP_TOKEN) {
  const slack = new SlackApp({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
  });

  slack.message(async ({ message, say }) => {
    // Basic catch all messages inside the app's channel/DM
    if (message.bot_id) return;
    console.log(\`🔱 Mensaje recibido en Slack: "\${message.text}"\`);
    const reply = await consultAglaia(message.text);
    await say({
      text: reply,
      thread_ts: message.ts // Threaded reply
    });
  });

  slack.start().then(() => {
    console.log("✅ ¡Aglaia se encuentra enlazada en Slack!");
  }).catch(err => {
    console.error("❌ Failed to start Slack app:", err.message);
  });
} else {
  console.log("ℹ️ Slack tokens missing in .env. Skipping Slack setup.");
}

// ==========================================
// 5. WHATSAPP BOT INTEGRATION (via whatsapp-web.js)
// ==========================================
// If the user wants to enable WhatsApp, run with ENABLE_WHATSAPP=true
if (process.env.ENABLE_WHATSAPP === 'true') {
  const whatsapp = new WhatsAppClient({
    authStrategy: new LocalAuth()
  });

  whatsapp.on("qr", (qr) => {
    console.log("🔱 Código QR generado. Escanee para establecer sintonía en WhatsApp:");
    qrcode.generate(qr, { small: true });
  });

  whatsapp.on("ready", () => {
    console.log("✅ ¡Sintonía establecida con WhatsApp exitosamente!");
  });

  whatsapp.on("message", async msg => {
    // Only respond to personal chats or references to "aglaia"
    const contact = await msg.getContact();
    const chat = await msg.getChat();

    const text = msg.body.toLowerCase();
    const isPersonal = !chat.isGroup;
    const isTriggered = text.includes("aglaia") || text.includes("oraculo");

    if (isPersonal || isTriggered) {
      console.log(\`🔱 Mensaje recibido en WhatsApp de \${contact.pushname || 'Contacto'}: "\${msg.body}"\`);
      const reply = await consultAglaia(msg.body);
      await msg.reply(reply);
    }
  });

  whatsapp.initialize().catch(err => {
    console.error("❌ WhatsApp initialization error:", err.message);
  });
} else {
  console.log("ℹ️ WhatsApp was not explicitly enabled. Set ENABLE_WHATSAPP=true in your environment to enable scan-to-link QR scanner.");
}

console.log("⚜️ ORÁCULO DE AGLAIA ACTIVO Y EJECUTÁNDOSE LOCALMENTE.");
`;
