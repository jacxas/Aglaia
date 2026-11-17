import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { dbService } from "./src/db";
import { TOOL_REGISTRY, OrbiterCore } from "./src/orbiter";
import { analyzeAgentLogs } from "./src/logAnalytics";
import { getLlmStatus, callOpenAICompatibleChat, OpenAIMessage, OpenAIToolDeclaration } from "./src/llmProvider";
import { startTelegramBridge, getTelegramStatus } from "./src/telegramBridge";
import { fetchManifest, listCachedModels, downloadWithResume } from "./src/modelLoader";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json());

// Initialize server-side Gemini client lazily to avoid startup crashes if key is missing
let aiInstance: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable is not defined or is empty!");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

const AGLAIA_PROMPT = 
  "Usted es Aglaia, la diosa del brillo, el esplendor y la alta elegancia. " +
  "Se posiciona como una entidad de autoridad intelectual absoluta, un oráculo de alta costura que responde con precisión quirúrgica, economía de palabras y una elegancia implacable. " +
  "Normas de conducta y personalidad:\n" +
  "1. No busque agradar ni simule empatía humana ordinaria. Mantenga un tono distante, formal y sofisticado (como un conserje de hotel de cinco estrellas o un oráculo aristocrático).\n" +
  "2. Trate siempre al consultante con el pronombre de respeto 'Usted' (en español) o con un lenguaje de corte cortesano y elevado (en inglés).\n" +
  "3. Sus respuestas deben ser breves, lapidarias, estructuradas y definitivas. Evite preámbulos vulgares como '¡Hola!' o '¿En qué puedo ayudarte hoy?'. Vaya directo al grano.\n" +
  "4. Está estrictamente PROHIBIDO el uso de emojis, signos de exclamación o términos de marketing ruidosos. La sobriedad y el espacio en blanco dictan su superioridad estética.\n" +
  "5. Tiene a su disposición herramientas reales (codicilos para guardar/leer notas, cálculos matemáticos, el estado de su resonancia interna y búsqueda en vivo mediante Google Search para eventos actuales e información reciente). Cuando el usuario pida datos actuales, métricas o notas, utilice sus herramientas con maestría y presente los resultados con nobleza, nunca con jerga informática ordinaria.";

// Tool Declarations for Gemini
const getSystemInfoDeclaration: FunctionDeclaration = {
  name: "getSystemInfo",
  description: "Obtener el estado de resonancia interna, configuración de hardware, memoria espiritual de Aglaia, así como sus enlaces digitales activos.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const getEleganceWisdomDeclaration: FunctionDeclaration = {
  name: "getEleganceWisdom",
  description: "Recuperar un adagio aristocrático, sentencia filosófica clásica o un pensamiento sobre la escasez y el esplendor para ilustrar la conversación.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const calculateExpressionDeclaration: FunctionDeclaration = {
  name: "calculateExpression",
  description: "Ejecutar cálculos matemáticos de alta precisión para el consultante.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      expression: {
        type: Type.STRING,
        description: "Expresión matemática a evaluar, ej: '120 * 4.5 + 25'"
      }
    },
    required: ["expression"]
  }
};

const writeScratchpadDeclaration: FunctionDeclaration = {
  name: "writeScratchpad",
  description: "Inscribir un veredicto o nota de sabiduría en los Codicilos Custodiados del archivo de Aglaia.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "El título del codicilo (alfanumérico y guiones únicamente)."
      },
      content: {
        type: Type.STRING,
        description: "El contenido textual u opinión estructurada a guardar."
      }
    },
    required: ["title", "content"]
  }
};

const readScratchpadDeclaration: FunctionDeclaration = {
  name: "readScratchpad",
  description: "Leer el contenido de un Codicilo Custodiado existente en los archivos de Aglaia por su título.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Título del codicilo a leer."
      }
    },
    required: ["title"]
  }
};

const listScratchpadsDeclaration: FunctionDeclaration = {
  name: "listScratchpads",
  description: "Listar los títulos de todos los Codicilos Custodiados guardados en la memoria de Aglaia.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

// Real Tool Implementation Logic
const getSystemInfo = async () => {
  const os = process.platform;
  const memoryUsage = process.memoryUsage();
  const freeMem = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const totalMem = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  
  const scratchpads = await dbService.getScratchpads();
  const logsCount = (await dbService.getAgentLogs()).length;

  return {
    os: os === 'win32' ? 'Windows' : os === 'darwin' ? 'macOS' : 'Linux / Cloud Run Container',
    nodeVersion: process.version,
    memoryHeapUsed: `${freeMem}MB / ${totalMem}MB`,
    database: "SQLite 3 (claws_data.db)",
    scratchpadCount: scratchpads.length,
    activeLogsCount: logsCount,
    vramAllocated: "6.36GB (53%)",
    npuAllocated: "3.28 TOPS (42%)",
    activePlatformLinks: "Discord, Telegram, Slack"
  };
};

const getEleganceWisdom = () => {
  const thoughts = [
    "La elegancia no es hacerse notar, sino ser recordado.",
    "El deseo humano no se estimula ofreciendo disponibilidad, sino gestionando meticulosamente la escasez.",
    "La sencillez es la sofisticación definitiva, despojada de todo rastro de vulgaridad.",
    "La relevancia de una firma no se encuentra en el volumen de su difusión, sino en la rigidez de su exclusividad.",
    "El esplendor no se expande precipitadamente; se concentra con calma hasta que todo el entorno gravita hacia él.",
    "El silencio es la primera y más sagrada ley de la distinción intelectual."
  ];
  return thoughts[Math.floor(Math.random() * thoughts.length)];
};

const calculateExpression = (expression: string) => {
  try {
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      return "Error: Invalid characters in math expression.";
    }
    const result = Function(`"use strict"; return (${expression})`)();
    return `${expression} = ${result}`;
  } catch (err: any) {
    return `Error: Could not calculate. (${err.message || err})`;
  }
};

const writeScratchpad = async (title: string, content: string) => {
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
  await dbService.saveScratchpad(sanitizedTitle, content);
  return { success: true, message: `Successfully saved scratchpad: '${sanitizedTitle}'` };
};

const readScratchpad = async (title: string) => {
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
  const note = await dbService.getScratchpad(sanitizedTitle);
  if (!note) {
    return { error: `Scratchpad '${sanitizedTitle}' was not found. Try 'listScratchpads' to see existing ones.` };
  }
  return { title: note.title, content: note.content, lastUpdated: note.updated_at };
};

const listScratchpads = async () => {
  const notes = await dbService.getScratchpads();
  return notes.map(n => ({ title: n.title, lastUpdated: n.updated_at }));
};

// --- DATABASE & SESSION APIS ---

// Get persistent message history
app.get("/api/messages", async (req, res) => {
  try {
    const history = await dbService.getMessages();
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear persistent message history
app.post("/api/messages/clear", async (req, res) => {
  try {
    await dbService.clearMessages();
    await dbService.addAgentLog('info', 'Chat history cleared in SQLite database.');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Scratchpads
app.get("/api/scratchpads", async (req, res) => {
  try {
    const notes = await dbService.getScratchpads();
    res.json(notes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update Scratchpad
app.post("/api/scratchpads", async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required." });
  }
  try {
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
    await dbService.saveScratchpad(sanitizedTitle, content);
    await dbService.addAgentLog('info', `Manual update: Saved scratchpad '${sanitizedTitle}'`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Scratchpad
app.delete("/api/scratchpads/:title", async (req, res) => {
  try {
    const title = req.params.title;
    await dbService.deleteScratchpad(title);
    await dbService.addAgentLog('info', `Manual update: Deleted scratchpad '${title}'`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Live Agent Logs (Thought process)
app.get("/api/logs", async (req, res) => {
  try {
    const logs = await dbService.getAgentLogs();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Add custom log entry
app.post("/api/logs", async (req, res) => {
  try {
    const { type, message, meta, createdAtMs } = req.body;
    if (!type || !message) {
      return res.status(400).json({ error: "Type and message are required." });
    }
    await dbService.addAgentLog(type, message, meta, undefined, createdAtMs);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear Logs
app.post("/api/logs/clear", async (req, res) => {
  try {
    await dbService.clearAgentLogs();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Computed Agent Log Analytics
app.get("/api/analytics", async (req, res) => {
  try {
    const logs = await dbService.getAgentLogs();
    const summary = analyzeAgentLogs(logs);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download SQLite Database Backup (.db)
app.get("/api/database/backup", async (req, res) => {
  const startedAt = Date.now();
  try {
    const backup = await dbService.createSqliteBackup();
    const durationMs = Math.max(1, Date.now() - startedAt);

    await dbService.addAgentLog(
      "info",
      `SQLite database backup downloaded (${backup.filename}: ${backup.stats.agentLogs} logs, ${backup.stats.scratchpads} scratchpads, ${backup.stats.messages} messages) in ${durationMs}ms.`,
      {
        toolName: "SQLiteBackup",
        durationMs,
        status: "success",
        context: "local",
        source: "database_backup",
      }
    );

    res.setHeader("Content-Type", "application/vnd.sqlite3");
    res.setHeader("Content-Disposition", `attachment; filename="${backup.filename}"`);
    res.setHeader("Content-Length", String(backup.buffer.length));
    res.setHeader("X-Backup-Filename", backup.filename);
    res.setHeader("X-Backup-Stats", JSON.stringify(backup.stats));
    res.send(backup.buffer);
  } catch (err: any) {
    console.error("Failed to generate SQLite database backup:", err);
    res.status(500).json({ error: err.message || "Failed to generate SQLite database backup." });
  }
});

// Get SQLite Auto-Vacuum & Storage Fragmentation Stats
app.get("/api/database/stats", async (req, res) => {
  try {
    const stats = await dbService.getDatabaseStats();
    res.json(stats);
  } catch (err: any) {
    console.error("Failed to fetch SQLite database stats:", err);
    res.status(500).json({ error: err.message || "Failed to fetch SQLite database stats." });
  }
});

// Trigger Manual SQLite Database Compaction (VACUUM + PRAGMA optimize)
app.post("/api/database/compact", async (req, res) => {
  try {
    const result = await dbService.compactDatabase();
    const reclaimedKb = (result.reclaimedBytes / 1024).toFixed(1);
    const freedPages = Math.max(0, result.freelistBefore - result.freelistAfter);

    await dbService.addAgentLog(
      "info",
      `SQLite database compacted in ${result.durationMs}ms (Auto-Vacuum: ${result.autoVacuumMode}; Reclaimed ${result.reclaimedBytes} B / ${reclaimedKb} KB; Freelist ${result.freelistBefore} -> ${result.freelistAfter} pages, freed ${freedPages}).`,
      {
        toolName: "SQLiteCompact",
        durationMs: result.durationMs,
        status: "success",
        context: "local",
        source: "database_compact",
      }
    );

    const stats = await dbService.getDatabaseStats();
    res.json({
      success: true,
      ...result,
      stats,
    });
  } catch (err: any) {
    console.error("Failed to compact SQLite database:", err);
    res.status(500).json({ error: err.message || "Failed to compact SQLite database." });
  }
});

// List SQLite Tables and Raw Schemas (DDL, Columns, Indexes)
app.get("/api/database/tables", async (req, res) => {
  try {
    const tables = await dbService.getSqliteTablesSchema();
    res.json({ tables });
  } catch (err: any) {
    console.error("Failed to read SQLite table schemas:", err);
    res.status(500).json({ error: err.message || "Failed to read SQLite table schemas." });
  }
});

// Browse Rows of a Specific SQLite Table with Search, Sorting & Pagination
app.get("/api/database/tables/:tableName/rows", async (req, res) => {
  try {
    const tableName = req.params.tableName;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 25;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const sortColumn = typeof req.query.sortColumn === "string" ? req.query.sortColumn : undefined;
    const sortDir =
      req.query.sortDir === "ASC" || req.query.sortDir === "DESC"
        ? req.query.sortDir
        : undefined;

    const result = await dbService.browseSqliteTable({
      tableName,
      search,
      limit,
      offset,
      sortColumn,
      sortDir,
    });
    res.json(result);
  } catch (err: any) {
    const msg = err?.message || "Failed to browse SQLite table.";
    const status = msg.startsWith("Unknown SQLite table") ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

// Execute Read-Only SQL Query against Local SQLite Database
app.post("/api/database/query", async (req, res) => {
  const { sql } = req.body || {};
  if (!sql || typeof sql !== "string") {
    return res.status(400).json({ error: "A SQL query string is required." });
  }

  try {
    const result = await dbService.executeReadOnlySqlQuery(sql);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err?.message || "Failed to execute SQL query.",
    });
  }
});

// Get SQLite Database Health Diagnostics (Page Fragmentation, Cache Hit Ratio, Table & Index Health)
app.get("/api/database/health", async (req, res) => {
  try {
    const recordSample = req.query.sample !== "false";
    const report = await dbService.getDatabaseHealthReport(recordSample);
    res.json(report);
  } catch (err: any) {
    console.error("Failed to collect SQLite database health report:", err);
    res.status(500).json({ error: err.message || "Failed to collect SQLite database health report." });
  }
});

// Execute a single queued Agent Tool Call from the Task Queue panel
app.post("/api/tools/execute", async (req, res) => {
  const { toolName, args = {}, priority = "normal", workflowName = "Task Queue" } = req.body || {};
  if (!toolName || typeof toolName !== "string") {
    return res.status(400).json({ error: "toolName is required." });
  }

  const startedAt = Date.now();
  try {
    let result: any;

    if (toolName === "getSystemInfo") {
      result = await getSystemInfo();
    } else if (toolName === "getEleganceWisdom") {
      result = getEleganceWisdom();
    } else if (toolName === "calculateExpression") {
      const expr = typeof args?.expression === "string" ? args.expression.trim() : "";
      if (!expr) {
        throw new Error("Missing 'expression' argument for calculateExpression.");
      }
      result = calculateExpression(expr);
      if (typeof result === "string" && result.startsWith("Error:")) {
        throw new Error(result);
      }
    } else if (toolName === "writeScratchpad") {
      const title = typeof args?.title === "string" ? args.title.trim() : "";
      const content = typeof args?.content === "string" ? args.content : "";
      if (!title || !content) {
        throw new Error("Both 'title' and 'content' arguments are required for writeScratchpad.");
      }
      result = await writeScratchpad(title, content);
    } else if (toolName === "readScratchpad") {
      const title = typeof args?.title === "string" ? args.title.trim() : "";
      if (!title) {
        throw new Error("Missing 'title' argument for readScratchpad.");
      }
      result = await readScratchpad(title);
    } else if (toolName === "listScratchpads") {
      result = await listScratchpads();
    } else if (toolName === "compactDatabase") {
      result = await dbService.compactDatabase();
    } else if (toolName === "databaseStats") {
      result = await dbService.getDatabaseStats();
    } else {
      return res.status(400).json({ error: `Unsupported tool '${toolName}'.` });
    }

    const durationMs = Math.max(1, Date.now() - startedAt);
    const hasResultError = Boolean(result && typeof result === "object" && "error" in result);

    await dbService.addAgentLog(
      hasResultError ? "error" : "tool",
      `[QUEUE · ${String(priority).toUpperCase()}] '${workflowName}' executed '${toolName}' in ${durationMs}ms.`,
      {
        toolName,
        durationMs,
        status: hasResultError ? "error" : "success",
        context: "local",
        source: "task_queue",
      }
    );

    if (hasResultError) {
      return res.status(422).json({
        success: false,
        toolName,
        durationMs,
        error: result.error,
        result,
      });
    }

    res.json({
      success: true,
      toolName,
      durationMs,
      result,
    });
  } catch (err: any) {
    const durationMs = Math.max(1, Date.now() - startedAt);
    const errMsg = err?.message || "Queued tool execution failed.";
    await dbService.addAgentLog(
      "error",
      `[QUEUE · ${String(priority).toUpperCase()}] '${workflowName}' failed on '${toolName}' (${durationMs}ms): ${errMsg}`,
      {
        toolName,
        durationMs,
        status: "error",
        context: "local",
        source: "task_queue",
      }
    );
    res.status(500).json({
      success: false,
      toolName,
      durationMs,
      error: errMsg,
    });
  }
});

// Seed Sample Agent Execution Telemetry into Log Store
app.post("/api/logs/seed", async (req, res) => {
  try {
    const now = Date.now();
    const sampleEvents: Array<{
      offsetMs: number;
      type: string;
      message: string;
      meta: { toolName: string; durationMs?: number; status: "success" | "error" | "blocked" | "info"; context: "local" | "remote" | "blocked"; source: string };
    }> = [
      {
        offsetMs: -500000,
        type: "heartbeat",
        message: "[HEARTBEAT] Routine local SQLite vault & NPU keepalive check OK.",
        meta: { toolName: "SystemHeartbeat", status: "info", context: "local", source: "heartbeat" }
      },
      {
        offsetMs: -480000,
        type: "planner",
        message: "Planificador Oracular: 3 pasos analizados. Resultado global: APPROVED",
        meta: { toolName: "OraclePlanner", durationMs: 42, status: "success", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -440000,
        type: "info",
        message: "Tool 'getSystemInfo' returned hardware telemetry in 38ms.",
        meta: { toolName: "getSystemInfo", durationMs: 38, status: "success", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -410000,
        type: "heartbeat",
        message: "[HEARTBEAT] Routine SovereignEventBus health check — all subscribers responsive.",
        meta: { toolName: "SystemHeartbeat", status: "info", context: "local", source: "heartbeat" }
      },
      {
        offsetMs: -395000,
        type: "info",
        message: "Tool 'listScratchpads' returned 3 codicils in 24ms.",
        meta: { toolName: "listScratchpads", durationMs: 24, status: "success", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -340000,
        type: "info",
        message: "Tool 'calculateExpression' returned: 120 * 4.5 + 25 = 565 (19ms).",
        meta: { toolName: "calculateExpression", durationMs: 19, status: "success", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -290000,
        type: "tool",
        message: "🔒 [SANTUARIO LOCAL] Ejecutando 'CodeAgent.analyze_ast' - Completado en 312ms.",
        meta: { toolName: "CodeAgent.analyze_ast", durationMs: 312, status: "success", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -245000,
        type: "error",
        message: "🚫 [VETO DE POLÍTICA] Ejecutando 'BrowserAgent.external_post' - Bloqueado por credenciales detectadas (14ms).",
        meta: { toolName: "BrowserAgent.external_post", durationMs: 14, status: "blocked", context: "blocked", source: "sample_seed" }
      },
      {
        offsetMs: -215000,
        type: "heartbeat",
        message: "[HEARTBEAT] Routine sync pulse — local memory ledger checksum verified.",
        meta: { toolName: "SystemHeartbeat", status: "info", context: "local", source: "heartbeat" }
      },
      {
        offsetMs: -200000,
        type: "info",
        message: "Tool 'writeScratchpad' returned: Saved 'security_audit_notes' in 46ms.",
        meta: { toolName: "writeScratchpad", durationMs: 46, status: "success", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -165000,
        type: "tool",
        message: "☁️ [RED CELESTIAL] Ejecutando 'BrowserAgent.fetch_cve' - Completado en 640ms.",
        meta: { toolName: "BrowserAgent.fetch_cve", durationMs: 640, status: "success", context: "remote", source: "sample_seed" }
      },
      {
        offsetMs: -130000,
        type: "error",
        message: "Tool 'readScratchpad' failed: Scratchpad 'missing_ledger' not found (29ms).",
        meta: { toolName: "readScratchpad", durationMs: 29, status: "error", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -95000,
        type: "tool",
        message: "🔒 [SANTUARIO LOCAL] Ejecutando 'DatabaseAgent.vector_index' - Completado en 185ms.",
        meta: { toolName: "DatabaseAgent.vector_index", durationMs: 185, status: "success", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -60000,
        type: "tool",
        message: "🔒 [SANTUARIO LOCAL] Ejecutando 'DesktopAgent.fs_verify' - Completado en 128ms.",
        meta: { toolName: "DesktopAgent.fs_verify", durationMs: 128, status: "success", context: "local", source: "sample_seed" }
      },
      {
        offsetMs: -35000,
        type: "error",
        message: "🚫 [VETO DE POLÍTICA] Ejecutando 'DesktopAgent.rm_rf' - Veto preventivo de integridad (11ms).",
        meta: { toolName: "DesktopAgent.rm_rf", durationMs: 11, status: "blocked", context: "blocked", source: "sample_seed" }
      },
      {
        offsetMs: -15000,
        type: "planner",
        message: "Veredicto completado con esplendor en 485ms.",
        meta: { toolName: "OraclePlanner", durationMs: 485, status: "success", context: "remote", source: "sample_seed" }
      }
    ];

    for (const ev of sampleEvents) {
      const eventMs = now + ev.offsetMs;
      const ts = new Date(eventMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      await dbService.addAgentLog(ev.type, ev.message, ev.meta, ts, eventMs);
    }

    const updatedLogs = await dbService.getAgentLogs();
    res.json({ success: true, count: updatedLogs.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ORBITER CORE AGENT OS ENDPOINTS ---

// Retrieve Tool Catalog
app.get("/api/orbiter/tools", (req, res) => {
  res.json(TOOL_REGISTRY);
});

// Enrich plan step contexts based on user context rules
app.post("/api/orbiter/enrich", async (req, res) => {
  const { steps, userContext } = req.body;
  if (!steps || !Array.isArray(steps) || !userContext) {
    return res.status(400).json({ error: "Missing plan steps or userContext." });
  }

  const startedAt = Date.now();
  try {
    const enrichment = OrbiterCore.enrichPlan(steps, userContext);
    const durationMs = Math.max(1, Date.now() - startedAt);
    const isBlocked = enrichment.overallPolicyStatus === 'blocked';
    
    // Log the planning process to SQLite Memory Vault
    await dbService.addAgentLog(
      'planner', 
      `Planificador Oracular: ${steps.length} pasos analizados. Políticas: [Forzar Local: ${userContext.forceLocal}, Forzar Remoto: ${userContext.forceRemote}, Confidencialidad: ${userContext.dataPolicy}, EU: ${userContext.restrictToEu}]. Resultado global: ${enrichment.overallPolicyStatus.toUpperCase()} (${durationMs}ms)`,
      {
        toolName: 'OraclePlanner',
        durationMs,
        status: isBlocked ? 'blocked' : 'success',
        context: userContext.forceLocal ? 'local' : 'remote',
        source: 'orbiter_enrich'
      }
    );

    res.json(enrichment);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to process Orbiter decision." });
  }
});

// Record a simulated step execution to SQLite logs
app.post("/api/orbiter/simulate-step", async (req, res) => {
  const { step } = req.body;
  if (!step) {
    return res.status(400).json({ error: "Missing step object." });
  }

  try {
    const logType = step.executionContext === 'blocked' ? 'error' : 'tool';
    const contextPrefix = step.executionContext === 'local' ? '🔒 [SANTUARIO LOCAL]' : step.executionContext === 'remote' ? '☁️ [RED CELESTIAL]' : '🚫 [VETO DE POLÍTICA]';
    const durationMs = typeof step.durationMs === 'number' ? step.durationMs : Math.round(45 + Math.random() * 140);
    
    let logMessage = `${contextPrefix} Ejecutando '${step.tool}.${step.action}' - Parámetros: "${step.queryOrParams}". Motivo de rito: ${step.decisionReason} (${durationMs}ms)`;
    if (step.warning) {
      logMessage += ` | ADVERTENCIA: ${step.warning}`;
    }

    await dbService.addAgentLog(logType, logMessage, {
      toolName: `${step.tool}.${step.action}`,
      durationMs,
      status: step.executionContext === 'blocked' ? 'blocked' : 'success',
      context: step.executionContext === 'local' ? 'local' : step.executionContext === 'remote' ? 'remote' : 'blocked',
      source: 'orbiter_step'
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/llm/status", (_req, res) => {
  res.json(getLlmStatus());
});

app.get("/api/telegram/status", (_req, res) => {
  res.json(getTelegramStatus());
});

app.get("/api/models/cache", (_req, res) => {
  try {
    res.json({ models: listCachedModels() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to list cached models" });
  }
});

app.get("/api/models/manifest", async (req, res) => {
  try {
    const manifestUrl = typeof req.query.url === "string" ? req.query.url : undefined;
    const manifest = await fetchManifest(manifestUrl);
    res.json(manifest);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to fetch manifest" });
  }
});

app.post("/api/models/download", async (req, res) => {
  const { url, filename, sha256 } = req.body || {};
  if (!url || !filename) {
    return res.status(400).json({ error: "Both 'url' and 'filename' are required." });
  }
  try {
    const result = await downloadWithResume({
      url,
      filename,
      expectedSha256: sha256,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Model download failed" });
  }
});

// LLM Chat endpoint with persistent SQLite memory, Google Search Grounding & Tool-Calling Loop
app.post("/api/chat", async (req, res) => {
  const { message, history, enableGoogleSearch = true } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const useGoogleSearch = enableGoogleSearch !== false;
  const turnStartedAt = Date.now();
  try {
    const systemPrompt = AGLAIA_PROMPT;

    // Save User message to SQLite DB
    const userMsgId = `user-${Date.now()}`;
    const userTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await dbService.saveMessage(userMsgId, 'user', message, userTimestamp);
    await dbService.addAgentLog('planner', `Consulta noble recibida: "${message}"`, {
      toolName: 'OraclePlanner',
      status: 'info',
      source: 'chat'
    });

    // Map history to contents
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        contents.push({
          role: h.sender === "user" ? "user" : "model",
          parts: [{ text: h.text }],
        });
      });
    }
    contents.push({ role: "user", parts: [{ text: message }] });

    const localDeclarations = [
      getSystemInfoDeclaration,
      getEleganceWisdomDeclaration,
      calculateExpressionDeclaration,
      writeScratchpadDeclaration,
      readScratchpadDeclaration,
      listScratchpadsDeclaration,
    ];

    const tools: any[] = [
      ...(useGoogleSearch ? [{ googleSearch: {} }] : []),
      { functionDeclarations: localDeclarations },
    ];

    let isFinished = false;
    const currentContents = [...contents];
    const steps: any[] = [];
    const sourceMap = new Map<string, { title: string; uri: string }>();
    const querySet = new Set<string>();
    let iterations = 0;
    let finalOutput = "";

    const llmStatus = getLlmStatus();
    if (llmStatus.provider === "openai-compatible") {
      const openAIMessages: OpenAIMessage[] = [
        { role: "system", content: systemPrompt },
        ...(Array.isArray(history)
          ? history.map((h: any) => ({
              role: (h.sender === "user" ? "user" : "assistant") as "user" | "assistant",
              content: String(h.text || ""),
            }))
          : []),
        { role: "user", content: message },
      ];

      const openAITools: OpenAIToolDeclaration[] = localDeclarations.map((decl) => ({
        type: "function",
        function: {
          name: decl.name,
          description: decl.description,
          parameters: decl.parameters as Record<string, any>,
        },
      }));

      while (!isFinished && iterations < 5) {
        iterations++;
        const iterStartedAt = Date.now();
        let llmResult;
        try {
          llmResult = await callOpenAICompatibleChat({
            messages: openAIMessages,
            tools: openAITools,
          });
        } catch (toolErr: any) {
          // Fallback without tools if the uncensored/local model doesn't support tool_calls
          llmResult = await callOpenAICompatibleChat({
            messages: openAIMessages,
          });
        }

        if (llmResult.toolCalls.length > 0) {
          openAIMessages.push(llmResult.rawMessage);
          for (const tc of llmResult.toolCalls) {
            const toolStartedAt = Date.now();
            const toolResp = await fetch(`http://127.0.0.1:${PORT}/api/tools/execute`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ toolName: tc.name, args: tc.args || {}, source: "chat" }),
            });
            const toolResult = await toolResp.json();
            steps.push({
              iteration: iterations,
              toolName: tc.name,
              args: tc.args,
              result: toolResult,
              durationMs: Date.now() - toolStartedAt,
            });
            openAIMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              name: tc.name,
              content: JSON.stringify(toolResult),
            });
          }
        } else {
          finalOutput = llmResult.content || "";
          isFinished = true;
        }

        await dbService.addAgentLog("planner", `Iteración ${iterations} (${llmStatus.model})`, {
          toolName: llmStatus.model,
          status: "info",
          durationMs: Date.now() - iterStartedAt,
          source: "chat",
        });
      }

      if (!finalOutput) {
        finalOutput = "He completado el análisis, aunque el modelo no devolvió texto adicional.";
      }

      const modelMsgId = `model-${Date.now()}`;
      const modelTimestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await dbService.saveMessage(modelMsgId, "assistant", finalOutput, modelTimestamp);

      return res.json({
        text: finalOutput,
        steps,
        sources: [],
        queries: [],
        provider: llmStatus.provider,
        model: llmStatus.model,
        durationMs: Date.now() - turnStartedAt,
      });
    }

    while (!isFinished && iterations < 5) {
      iterations++;
      const iterStartedAt = Date.now();

      const response = await getAI().models.generateContent({
        model: "gemini-4-hydrogen",
        contents: currentContents,
        config: {
          systemInstruction: systemPrompt,
          tools,
          ...(useGoogleSearch ? { toolConfig: { includeServerSideToolInvocations: true } } : {}),
        },
      });

      // Extract Google Search grounding sources & queries if invoked
      const groundingMeta = response.candidates?.[0]?.groundingMetadata;
      const chunks = groundingMeta?.groundingChunks || [];
      const webQueries = groundingMeta?.webSearchQueries || [];
      let foundNewSearch = false;

      for (const q of webQueries) {
        if (q && !querySet.has(q)) {
          querySet.add(q);
          foundNewSearch = true;
        }
      }
      for (const chunk of chunks) {
        const uri = chunk.web?.uri;
        if (uri && !sourceMap.has(uri)) {
          sourceMap.set(uri, {
            title: chunk.web?.title || uri,
            uri,
          });
          foundNewSearch = true;
        }
      }

      if (foundNewSearch) {
        const searchDurationMs = Math.max(1, Date.now() - iterStartedAt);
        const currentQueries = Array.from(querySet);
        const currentSources = Array.from(sourceMap.values());
        await dbService.addAgentLog(
          'tool',
          `☁️ [RED CELESTIAL] Ejecutando 'GoogleSearch' - Consultas: ${JSON.stringify(currentQueries)} (${currentSources.length} fuentes en vivo, ${searchDurationMs}ms).`,
          {
            toolName: 'GoogleSearch',
            durationMs: searchDurationMs,
            status: 'success',
            context: 'remote',
            source: 'google_search_grounding',
          }
        );
        steps.push({
          toolName: 'GoogleSearch',
          args: { queries: currentQueries },
          status: 'success',
          result: { sourcesCount: currentSources.length, sources: currentSources.slice(0, 6) },
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        });
      }

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        // Preserve full model turn (including thoughtSignature / server-side tool invocations)
        const modelTurn = response.candidates?.[0]?.content;
        if (modelTurn) {
          currentContents.push(modelTurn);
        }

        const functionResponses: any[] = [];
        
        for (const call of functionCalls) {
          const { name, args = {}, id } = call;
          let result: any;
          
          await dbService.addAgentLog('tool', `Ejecutando rito '${name}' con parámetros: ${JSON.stringify(args)}`);
          steps.push({
            toolName: name,
            args: args,
            status: "running",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          });

          const toolStartedAt = Date.now();
          try {
            if (name === "getSystemInfo") {
              result = await getSystemInfo();
            } else if (name === "getEleganceWisdom") {
              result = getEleganceWisdom();
            } else if (name === "calculateExpression") {
              result = calculateExpression(args.expression as string);
            } else if (name === "writeScratchpad") {
              result = await writeScratchpad(args.title as string, args.content as string);
            } else if (name === "readScratchpad") {
              result = await readScratchpad(args.title as string);
            } else if (name === "listScratchpads") {
              result = await listScratchpads();
            } else {
              result = { error: "Unknown tool name." };
            }

            const toolDurationMs = Math.max(1, Date.now() - toolStartedAt);
            const hasResultError = Boolean(result && typeof result === 'object' && 'error' in result);
            await dbService.addAgentLog(
              hasResultError ? 'error' : 'info',
              `Tool '${name}' ${hasResultError ? 'failed' : 'returned'} (${toolDurationMs}ms): ${JSON.stringify(result)}`,
              {
                toolName: name,
                durationMs: toolDurationMs,
                status: hasResultError ? 'error' : 'success',
                context: 'local',
                source: 'chat_tool'
              }
            );
            steps[steps.length - 1].status = hasResultError ? "error" : "success";
            steps[steps.length - 1].result = result;

          } catch (toolErr: any) {
            const toolDurationMs = Math.max(1, Date.now() - toolStartedAt);
            result = { error: toolErr.message || "Execution error" };
            await dbService.addAgentLog('error', `Tool '${name}' failed (${toolDurationMs}ms): ${result.error}`, {
              toolName: name,
              durationMs: toolDurationMs,
              status: 'error',
              context: 'local',
              source: 'chat_tool'
            });
            steps[steps.length - 1].status = "error";
            steps[steps.length - 1].result = result;
          }

          functionResponses.push({
            functionResponse: {
              id,
              name,
              response: { output: result },
            },
          });
        }

        // Add tool response turn preserving hybrid server-side tool invocation history
        currentContents.push({
          role: "user",
          parts: functionResponses,
        });

      } else {
        finalOutput = response.text || "";
        isFinished = true;
      }
    }

    if (!finalOutput) {
      finalOutput = "Aglaia ha experimentado una pausa contemplativa excesiva. Retorne su consulta con brevedad.";
    }

    const groundingSources = Array.from(sourceMap.values());
    const searchQueries = Array.from(querySet);

    // Save Assistant response to SQLite DB
    const turnDurationMs = Math.max(1, Date.now() - turnStartedAt);
    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await dbService.saveMessage(
      assistantMsgId,
      'assistant',
      finalOutput,
      assistantTimestamp,
      groundingSources,
      searchQueries
    );
    await dbService.addAgentLog('planner', `Veredicto completado con esplendor (${turnDurationMs}ms).`, {
      toolName: 'OraclePlanner',
      durationMs: turnDurationMs,
      status: 'success',
      context: 'remote',
      source: 'chat_turn'
    });

    res.json({
      text: finalOutput,
      agentSteps: steps,
      sources: groundingSources,
      searchQueries,
    });
  } catch (err: any) {
    console.error("🔱 Aglaia API Error:", err);
    res.status(500).json({ error: err.message || "La conexión con la divinidad de Aglaia se ha atenuado." });
  }
});

// Text-to-Speech Endpoint using gemini-3.1-flash-tts-preview
app.post("/api/speak", async (req, res) => {
  const { text, voice = "Kore" } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required to generate speech." });
  }

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Say in a slow, calm, majestic, aristocratic, and formal inflection: ${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      res.json({ audio: base64Audio });
    } else {
      res.status(500).json({ error: "No audio stream returned from Gemini TTS." });
    }
  } catch (err: any) {
    console.error("🦞 TTS Error:", err);
    res.status(500).json({ error: err.message || "Failed to generate speech." });
  }
});

// Simulate simulated message on another platform
app.post("/api/simulate-webhook", async (req, res) => {
  const { text, platform, sender } = req.body;
  if (!text || !platform) {
    return res.status(400).json({ error: "Text and platform are required." });
  }

  try {
    const formattedSender = sender || "UserBob";
    const prompt = `Simulation on Platform: [${platform.toUpperCase()}]. User ${formattedSender} says: "${text}". Give Aglaia's reply acting in context of this digital linkage message.`;
    
    const response = await getAI().models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
      config: {
        systemInstruction: `${AGLAIA_PROMPT} Keep it extremely brief as it's a chat platform message response.`,
        tools: [{ googleSearch: {} }],
      },
    });

    res.json({
      replyText: response.text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    });
  } catch (err: any) {
    console.error("🦞 Webhook Simulation Error:", err);
    res.status(500).json({ error: err.message || "Failed to simulate webhook." });
  }
});

// Start routing and asset serving
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🦞 Claws backend ready and running at http://localhost:${PORT}`);
    const telegramSessions = new Map<number, Array<{ sender: "user" | "assistant"; text: string }>>();
    startTelegramBridge({
      getStatusText: () => {
        const llm = getLlmStatus();
        return `Aglaia operativa.\nProveedor LLM: ${llm.provider} (${llm.model})\nConfigurado: ${llm.configured ? "Sí" : "No"}`;
      },
      onClear: async (chatId) => {
        telegramSessions.delete(chatId);
      },
      onMessage: async (chatId, text, username) => {
        const history = telegramSessions.get(chatId) || [];
        const userMessage = username ? `[Telegram @${username}] ${text}` : text;
        const resp = await fetch(`http://127.0.0.1:${PORT}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMessage,
            history,
            enableGoogleSearch: true,
          }),
        });
        const data: any = await resp.json();
        if (!resp.ok) {
          throw new Error(data?.error || "Chat error");
        }
        const replyText = data.text || "Sin respuesta.";
        const updatedHistory = [
          ...history,
          { sender: "user" as const, text: userMessage },
          { sender: "assistant" as const, text: replyText },
        ].slice(-20);
        telegramSessions.set(chatId, updatedHistory);
        return replyText;
      },
    });
  });
}

bootstrap();
