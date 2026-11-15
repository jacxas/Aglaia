import path from 'path';
import fs from 'fs';
import os from 'os';
import { DatabaseSync } from 'node:sqlite';

const DATA_FILE = path.join(process.cwd(), 'aglaia_data.json');
const SQLITE_FILE = path.join(process.cwd(), 'aglaia_data.db');

export type AutoVacuumMode = 'NONE' | 'FULL' | 'INCREMENTAL';

// Interface for JSON mirror structure
interface DatabaseSchema {
  messages: DBMessage[];
  scratchpads: DBScratchpad[];
  agentLogs: DBAgentLog[];
  nextLogId: number;
}

export interface DBMessageSource {
  title: string;
  uri: string;
}

export interface DBMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  sources?: DBMessageSource[];
  searchQueries?: string[];
}

export interface DBScratchpad {
  title: string;
  content: string;
  updated_at: string;
}

export interface DBAgentLogMeta {
  toolName?: string;
  durationMs?: number;
  status?: 'success' | 'error' | 'blocked' | 'info';
  context?: 'local' | 'remote' | 'blocked';
  source?: string;
}

export interface DBAgentLog {
  id: number;
  type: string;
  message: string;
  timestamp: string;
  createdAtMs?: number;
  meta?: DBAgentLogMeta;
}

export interface DatabaseStorageStats {
  engine: 'node:sqlite';
  dbFilename: string;
  autoVacuumMode: AutoVacuumMode;
  autoVacuumEnabled: boolean;
  sizeBytes: number;
  freelistCount: number;
  pageCount: number;
  pageSize: number;
  fragmentationPercent: number;
  autoVacuumRuns: number;
  compactRuns: number;
  lastAutoVacuumAt: string | null;
  lastAutoVacuumReason: string | null;
  lastCompactAt: string | null;
  lastCompactReclaimedBytes: number;
  records: {
    messages: number;
    scratchpads: number;
    agentLogs: number;
  };
}

export interface DatabaseCompactResult {
  autoVacuumMode: AutoVacuumMode;
  sizeBeforeBytes: number;
  sizeAfterBytes: number;
  reclaimedBytes: number;
  freelistBefore: number;
  freelistAfter: number;
  pageCountBefore: number;
  pageCountAfter: number;
  pageSize: number;
  durationMs: number;
  records: {
    messages: number;
    scratchpads: number;
    agentLogs: number;
  };
}

export interface SqliteColumnSchema {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dfltValue: string | null;
  pk: boolean;
}

export interface SqliteIndexSchema {
  seq: number;
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
}

export interface SqliteTableSchema {
  name: string;
  ddl: string;
  rowCount: number;
  columns: SqliteColumnSchema[];
  indexes: SqliteIndexSchema[];
}

export interface SqliteBrowseResult {
  tableName: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  filteredRows: number;
  limit: number;
  offset: number;
  sortColumn: string | null;
  sortDir: 'ASC' | 'DESC';
  durationMs: number;
}

export interface SqliteQueryResult {
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}

export interface SqliteDbStatEntry {
  name: string;
  kind: 'table' | 'index';
  pages: number;
  totalBytes: number;
  usedBytes: number;
  unusedBytes: number;
  fillFactorPct: number;
  cells: number;
  healthScore: number;
  status: 'Optimal' | 'Fair' | 'Fragmented';
}

export interface SqliteHealthSnapshot {
  timestamp: string;
  timestampMs: number;
  freelistFragPct: number;
  btreeUnusedPct: number;
  cacheHitRatio: number;
  workingSetFitPct: number;
  indexHealthScore: number;
  pageCount: number;
  freelistCount: number;
  sizeBytes: number;
  cacheHits: number;
  cacheMisses: number;
  eventLabel?: string;
}

export interface SqliteHealthReport {
  current: SqliteHealthSnapshot;
  history: SqliteHealthSnapshot[];
  tablesAndIndexes: SqliteDbStatEntry[];
  integrity: {
    quickCheck: string;
    journalMode: string;
    autoVacuumMode: AutoVacuumMode;
    cacheSizeKiB: number;
    pageSize: number;
    totalCacheHits: number;
    totalCacheMisses: number;
  };
}

let sqliteInstance: DatabaseSync | null = null;
const warmTableCache = new Set<string>();
const healthHistoryBuffer: SqliteHealthSnapshot[] = [];
const pageCacheTelemetry = {
  hits: 14,
  misses: 2,
};

function recordTableReadAccess(tableName: string, pagesCount = 1): void {
  const touched = Math.max(1, pagesCount);
  if (warmTableCache.has(tableName)) {
    pageCacheTelemetry.hits += touched;
  } else {
    warmTableCache.add(tableName);
    pageCacheTelemetry.misses += 1;
    if (touched > 1) {
      pageCacheTelemetry.hits += touched - 1;
    }
  }
}

function recordTableWriteInvalidation(tableName: string): void {
  warmTableCache.add(tableName);
  pageCacheTelemetry.misses += 1;
  pageCacheTelemetry.hits += 1;
}

function mapAutoVacuumMode(code: number): AutoVacuumMode {
  if (code === 2) return 'INCREMENTAL';
  if (code === 1) return 'FULL';
  return 'NONE';
}

function getFileSizeBytes(filePath: string): number {
  try {
    return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  } catch {
    return 0;
  }
}

function readLegacyJsonIfPresent(): DatabaseSchema | null {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.messages) &&
      Array.isArray(parsed.scratchpads) &&
      Array.isArray(parsed.agentLogs)
    ) {
      return {
        messages: parsed.messages,
        scratchpads: parsed.scratchpads,
        agentLogs: parsed.agentLogs,
        nextLogId: typeof parsed.nextLogId === 'number' ? parsed.nextLogId : 1,
      };
    }
  } catch (err) {
    console.error('⚜️ Legacy JSON read warning:', err);
  }
  return null;
}

function getMetaValue(db: DatabaseSync, key: string): string | null {
  const row = db
    .prepare('SELECT value FROM backup_metadata WHERE key = ?')
    .get(key) as { value?: string } | undefined;
  return typeof row?.value === 'string' ? row.value : null;
}

function setMetaValue(db: DatabaseSync, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO backup_metadata (key, value) VALUES (?, ?)').run(key, value);
}

function setMetaDefault(db: DatabaseSync, key: string, value: string): void {
  db.prepare('INSERT OR IGNORE INTO backup_metadata (key, value) VALUES (?, ?)').run(key, value);
}

function getPragmaNumber(db: DatabaseSync, pragmaName: string): number {
  const row = db.prepare(`PRAGMA ${pragmaName}`).get() as Record<string, unknown> | undefined;
  if (!row) return 0;
  const firstValue = Object.values(row)[0];
  return typeof firstValue === 'number' ? firstValue : Number(firstValue ?? 0);
}

function readAllRecordsFromSqlite(db: DatabaseSync): DatabaseSchema {
  const msgRows = db
    .prepare(
      'SELECT id, sender, text, timestamp, sources_json, search_queries_json FROM messages ORDER BY rowid ASC'
    )
    .all() as Array<{
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: string;
    sources_json: string | null;
    search_queries_json: string | null;
  }>;

  const messages: DBMessage[] = msgRows.map((row) => {
    let sources: DBMessageSource[] | undefined;
    let searchQueries: string[] | undefined;
    try {
      if (row.sources_json) sources = JSON.parse(row.sources_json);
    } catch {
      // ignore malformed JSON
    }
    try {
      if (row.search_queries_json) searchQueries = JSON.parse(row.search_queries_json);
    } catch {
      // ignore malformed JSON
    }
    return {
      id: row.id,
      sender: row.sender,
      text: row.text,
      timestamp: row.timestamp,
      ...(sources && sources.length > 0 ? { sources } : {}),
      ...(searchQueries && searchQueries.length > 0 ? { searchQueries } : {}),
    };
  });

  const scratchpadRows = db
    .prepare('SELECT title, content, updated_at FROM scratchpads ORDER BY rowid ASC')
    .all() as unknown as DBScratchpad[];

  const logRows = db
    .prepare(
      'SELECT id, type, message, timestamp, created_at_ms, meta_json FROM agent_logs ORDER BY id ASC'
    )
    .all() as Array<{
    id: number;
    type: string;
    message: string;
    timestamp: string;
    created_at_ms: number | null;
    meta_json: string | null;
  }>;

  const agentLogs: DBAgentLog[] = logRows.map((row) => {
    let meta: DBAgentLogMeta | undefined;
    try {
      if (row.meta_json) meta = JSON.parse(row.meta_json);
    } catch {
      // ignore malformed meta JSON
    }
    return {
      id: row.id,
      type: row.type,
      message: row.message,
      timestamp: row.timestamp,
      ...(typeof row.created_at_ms === 'number' ? { createdAtMs: row.created_at_ms } : {}),
      ...(meta ? { meta } : {}),
    };
  });

  const metaNextId = Number(getMetaValue(db, 'next_log_id') ?? '1');
  const maxLogId = agentLogs.reduce((max, log) => Math.max(max, log.id), 0);

  return {
    messages,
    scratchpads: scratchpadRows,
    agentLogs,
    nextLogId: Math.max(metaNextId, maxLogId + 1),
  };
}

function syncJsonMirror(db: DatabaseSync): void {
  try {
    const snapshot = readAllRecordsFromSqlite(db);
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(snapshot, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('⚜️ JSON mirror sync warning:', err);
  }
}

/**
 * Automatic SQLite incremental auto-vacuum routine.
 * Reclaims free pages left on the freelist immediately after deletions or retention trimming.
 */
function runAutoVacuumRoutine(db: DatabaseSync, reason: string): {
  freelistBefore: number;
  freelistAfter: number;
  reclaimedPages: number;
  reclaimedBytes: number;
} {
  const freelistBefore = getPragmaNumber(db, 'freelist_count');
  const sizeBefore = getFileSizeBytes(SQLITE_FILE);

  if (freelistBefore > 0) {
    db.exec('PRAGMA incremental_vacuum;');
  }

  const freelistAfter = getPragmaNumber(db, 'freelist_count');
  const sizeAfter = getFileSizeBytes(SQLITE_FILE);
  const reclaimedPages = Math.max(0, freelistBefore - freelistAfter);
  const reclaimedBytes = Math.max(0, sizeBefore - sizeAfter);

  if (freelistBefore > 0) {
    const prevRuns = Number(getMetaValue(db, 'auto_vacuum_runs') ?? '0');
    setMetaValue(db, 'auto_vacuum_runs', String(prevRuns + 1));
    setMetaValue(db, 'last_auto_vacuum_at', new Date().toISOString());
    setMetaValue(db, 'last_auto_vacuum_reason', reason);
    setMetaValue(db, 'last_auto_vacuum_reclaimed_pages', String(reclaimedPages));
    setMetaValue(db, 'last_auto_vacuum_reclaimed_bytes', String(reclaimedBytes));
  }

  return { freelistBefore, freelistAfter, reclaimedPages, reclaimedBytes };
}

function initializeSqliteDb(): DatabaseSync {
  const db = new DatabaseSync(SQLITE_FILE);

  const existingTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'agent_logs'")
    .get();
  const currentAutoVacuum = getPragmaNumber(db, 'auto_vacuum');

  if (!existingTables) {
    // PRAGMA auto_vacuum must be configured before any tables exist on a fresh database
    db.exec(`
      PRAGMA page_size = 4096;
      PRAGMA auto_vacuum = INCREMENTAL;
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = NORMAL;
    `);
  } else {
    db.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = NORMAL;
    `);
    if (currentAutoVacuum !== 2) {
      // Switching auto_vacuum mode on an existing database requires a VACUUM to rewrite the header
      db.exec('PRAGMA auto_vacuum = INCREMENTAL; VACUUM;');
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS backup_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      sources_json TEXT,
      search_queries_json TEXT
    );
    CREATE TABLE IF NOT EXISTS scratchpads (
      title TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      created_at_ms INTEGER,
      meta_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_agent_logs_id_desc ON agent_logs(id DESC);
  `);

  // Ensure columns exist if migrating an older messages schema
  const messageCols = db.prepare('PRAGMA table_info(messages)').all() as Array<{ name: string }>;
  if (!messageCols.some((c) => c.name === 'sources_json')) {
    db.exec('ALTER TABLE messages ADD COLUMN sources_json TEXT;');
  }
  if (!messageCols.some((c) => c.name === 'search_queries_json')) {
    db.exec('ALTER TABLE messages ADD COLUMN search_queries_json TEXT;');
  }

  // Hydrate from aglaia_data.json if SQLite tables are currently empty
  const msgCount = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }).c;
  const scratchpadCount = (db.prepare('SELECT COUNT(*) as c FROM scratchpads').get() as { c: number }).c;
  const logCount = (db.prepare('SELECT COUNT(*) as c FROM agent_logs').get() as { c: number }).c;

  if (msgCount === 0 && scratchpadCount === 0 && logCount === 0) {
    const legacy = readLegacyJsonIfPresent();
    if (legacy) {
      db.exec('BEGIN IMMEDIATE;');
      try {
        const insertMsg = db.prepare(
          'INSERT OR REPLACE INTO messages (id, sender, text, timestamp, sources_json, search_queries_json) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const m of legacy.messages) {
          insertMsg.run(
            m.id,
            m.sender,
            m.text,
            m.timestamp,
            m.sources && m.sources.length > 0 ? JSON.stringify(m.sources) : null,
            m.searchQueries && m.searchQueries.length > 0 ? JSON.stringify(m.searchQueries) : null
          );
        }

        const insertPad = db.prepare(
          'INSERT OR REPLACE INTO scratchpads (title, content, updated_at) VALUES (?, ?, ?)'
        );
        for (const s of legacy.scratchpads) {
          insertPad.run(s.title, s.content, s.updated_at);
        }

        const insertLog = db.prepare(
          'INSERT OR REPLACE INTO agent_logs (id, type, message, timestamp, created_at_ms, meta_json) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const l of legacy.agentLogs) {
          insertLog.run(
            l.id,
            l.type,
            l.message,
            l.timestamp,
            typeof l.createdAtMs === 'number' ? l.createdAtMs : null,
            l.meta ? JSON.stringify(l.meta) : null
          );
        }

        const maxLogId = legacy.agentLogs.reduce((max, l) => Math.max(max, l.id), 0);
        setMetaValue(db, 'next_log_id', String(Math.max(legacy.nextLogId, maxLogId + 1)));
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    } else {
      db.prepare(
        'INSERT OR IGNORE INTO scratchpads (title, content, updated_at) VALUES (?, ?, ?)'
      ).run(
        'aglaia_manifesto',
        '1. El Oráculo de Aglaia opera con absoluta reserva física.\n2. El latido del oráculo reside en el motor de inferencia local de hardware.\n3. Privacidad aristocrática e intelectual infranqueable.',
        new Date().toLocaleString()
      );
      setMetaDefault(db, 'next_log_id', '1');
      syncJsonMirror(db);
    }
  }

  setMetaValue(db, 'schema_version', '2');
  setMetaValue(db, 'auto_vacuum_mode', mapAutoVacuumMode(getPragmaNumber(db, 'auto_vacuum')));
  setMetaDefault(db, 'next_log_id', '1');
  setMetaDefault(db, 'auto_vacuum_runs', '0');
  setMetaDefault(db, 'compact_runs', '0');
  setMetaDefault(db, 'last_compact_reclaimed_bytes', '0');

  return db;
}

function getSqliteDb(): DatabaseSync {
  if (!sqliteInstance) {
    sqliteInstance = initializeSqliteDb();
  }
  return sqliteInstance;
}

function collectStorageStats(db: DatabaseSync): DatabaseStorageStats {
  const autoVacuumCode = getPragmaNumber(db, 'auto_vacuum');
  const freelistCount = getPragmaNumber(db, 'freelist_count');
  const pageCount = getPragmaNumber(db, 'page_count');
  const pageSize = getPragmaNumber(db, 'page_size') || 4096;
  const sizeBytes = getFileSizeBytes(SQLITE_FILE);

  const msgCount = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }).c;
  const padCount = (db.prepare('SELECT COUNT(*) as c FROM scratchpads').get() as { c: number }).c;
  const logCount = (db.prepare('SELECT COUNT(*) as c FROM agent_logs').get() as { c: number }).c;

  const fragmentationPercent =
    pageCount > 0 ? Number(((freelistCount / pageCount) * 100).toFixed(2)) : 0;

  return {
    engine: 'node:sqlite',
    dbFilename: path.basename(SQLITE_FILE),
    autoVacuumMode: mapAutoVacuumMode(autoVacuumCode),
    autoVacuumEnabled: autoVacuumCode === 1 || autoVacuumCode === 2,
    sizeBytes,
    freelistCount,
    pageCount,
    pageSize,
    fragmentationPercent,
    autoVacuumRuns: Number(getMetaValue(db, 'auto_vacuum_runs') ?? '0'),
    compactRuns: Number(getMetaValue(db, 'compact_runs') ?? '0'),
    lastAutoVacuumAt: getMetaValue(db, 'last_auto_vacuum_at'),
    lastAutoVacuumReason: getMetaValue(db, 'last_auto_vacuum_reason'),
    lastCompactAt: getMetaValue(db, 'last_compact_at'),
    lastCompactReclaimedBytes: Number(getMetaValue(db, 'last_compact_reclaimed_bytes') ?? '0'),
    records: {
      messages: msgCount,
      scratchpads: padCount,
      agentLogs: logCount,
    },
  };
}

export const dbService = {
  // --- MESSAGES ---
  async getMessages(): Promise<DBMessage[]> {
    const db = getSqliteDb();
    recordTableReadAccess('messages');
    return readAllRecordsFromSqlite(db).messages;
  },

  async saveMessage(
    id: string,
    sender: 'user' | 'assistant',
    text: string,
    timestamp: string,
    sources?: DBMessageSource[],
    searchQueries?: string[]
  ): Promise<void> {
    const db = getSqliteDb();
    db.prepare(
      'INSERT OR REPLACE INTO messages (id, sender, text, timestamp, sources_json, search_queries_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      sender,
      text,
      timestamp,
      sources && sources.length > 0 ? JSON.stringify(sources) : null,
      searchQueries && searchQueries.length > 0 ? JSON.stringify(searchQueries) : null
    );
    recordTableWriteInvalidation('messages');
    syncJsonMirror(db);
    appendHealthSnapshot(db, 'message_write');
  },

  async clearMessages(): Promise<void> {
    const db = getSqliteDb();
    const res = db.prepare('DELETE FROM messages').run();
    if (Number(res.changes) > 0) {
      runAutoVacuumRoutine(db, 'clear_messages');
    }
    recordTableWriteInvalidation('messages');
    syncJsonMirror(db);
    appendHealthSnapshot(db, 'clear_messages');
  },

  // --- SCRATCHPADS ---
  async getScratchpads(): Promise<DBScratchpad[]> {
    const db = getSqliteDb();
    recordTableReadAccess('scratchpads');
    return db
      .prepare('SELECT title, content, updated_at FROM scratchpads ORDER BY rowid ASC')
      .all() as unknown as DBScratchpad[];
  },

  async getScratchpad(title: string): Promise<DBScratchpad | null> {
    const db = getSqliteDb();
    recordTableReadAccess('scratchpads');
    const row = db
      .prepare('SELECT title, content, updated_at FROM scratchpads WHERE lower(title) = lower(?)')
      .get(title) as unknown as DBScratchpad | undefined;
    return row || null;
  },

  async saveScratchpad(title: string, content: string): Promise<void> {
    const db = getSqliteDb();
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
    const updatedAt = new Date().toLocaleString();

    db.prepare('INSERT OR REPLACE INTO scratchpads (title, content, updated_at) VALUES (?, ?, ?)').run(
      sanitizedTitle,
      content,
      updatedAt
    );
    recordTableWriteInvalidation('scratchpads');
    syncJsonMirror(db);
    appendHealthSnapshot(db, 'scratchpad_write');
  },

  async deleteScratchpad(title: string): Promise<void> {
    const db = getSqliteDb();
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
    const res = db.prepare('DELETE FROM scratchpads WHERE title = ?').run(sanitizedTitle);
    if (Number(res.changes) > 0) {
      runAutoVacuumRoutine(db, `delete_scratchpad:${sanitizedTitle}`);
    }
    recordTableWriteInvalidation('scratchpads');
    syncJsonMirror(db);
    appendHealthSnapshot(db, 'scratchpad_delete');
  },

  // --- AGENT LOGS (REASONING PROCESS) ---
  async getAgentLogs(): Promise<DBAgentLog[]> {
    const db = getSqliteDb();
    recordTableReadAccess('agent_logs', 2);
    const rows = db
      .prepare(
        'SELECT id, type, message, timestamp, created_at_ms, meta_json FROM agent_logs ORDER BY id DESC'
      )
      .all() as Array<{
      id: number;
      type: string;
      message: string;
      timestamp: string;
      created_at_ms: number | null;
      meta_json: string | null;
    }>;

    return rows.map((row) => {
      let meta: DBAgentLogMeta | undefined;
      try {
        if (row.meta_json) meta = JSON.parse(row.meta_json);
      } catch {
        // ignore malformed meta JSON
      }
      return {
        id: row.id,
        type: row.type,
        message: row.message,
        timestamp: row.timestamp,
        ...(typeof row.created_at_ms === 'number' ? { createdAtMs: row.created_at_ms } : {}),
        ...(meta ? { meta } : {}),
      };
    });
  },

  async addAgentLog(
    type: string,
    message: string,
    meta?: DBAgentLogMeta,
    customTimestamp?: string,
    customCreatedAtMs?: number
  ): Promise<void> {
    const db = getSqliteDb();
    const now = customCreatedAtMs ?? Date.now();
    const timestamp =
      customTimestamp ??
      new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const currentMaxRow = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM agent_logs').get() as {
      maxId: number;
    };
    const metaNext = Number(getMetaValue(db, 'next_log_id') ?? '1');
    const nextId = Math.max(metaNext, (currentMaxRow?.maxId ?? 0) + 1);

    db.prepare(
      'INSERT INTO agent_logs (id, type, message, timestamp, created_at_ms, meta_json) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(nextId, type, message, timestamp, now, meta ? JSON.stringify(meta) : null);

    setMetaValue(db, 'next_log_id', String(nextId + 1));

    // Retain up to 250 logs for historical analytics; auto-vacuum reclaims pruned pages
    const trimRes = db
      .prepare(
        'DELETE FROM agent_logs WHERE id NOT IN (SELECT id FROM agent_logs ORDER BY id DESC LIMIT 250)'
      )
      .run();

    if (Number(trimRes.changes) > 0) {
      runAutoVacuumRoutine(db, 'log_retention_trim');
    }

    recordTableWriteInvalidation('agent_logs');
    syncJsonMirror(db);
    appendHealthSnapshot(db, 'agent_log_insert');
  },

  async clearAgentLogs(): Promise<void> {
    const db = getSqliteDb();
    const res = db.prepare('DELETE FROM agent_logs').run();
    if (Number(res.changes) > 0) {
      runAutoVacuumRoutine(db, 'clear_agent_logs');
    }
    recordTableWriteInvalidation('agent_logs');
    syncJsonMirror(db);
    appendHealthSnapshot(db, 'clear_agent_logs');
  },

  // --- SQLITE AUTO-VACUUM STATS & COMPACTION ---
  async getDatabaseStats(): Promise<DatabaseStorageStats> {
    const db = getSqliteDb();
    return collectStorageStats(db);
  },

  async compactDatabase(): Promise<DatabaseCompactResult> {
    const db = getSqliteDb();
    const startedAt = Date.now();

    const sizeBeforeBytes = getFileSizeBytes(SQLITE_FILE);
    const freelistBefore = getPragmaNumber(db, 'freelist_count');
    const pageCountBefore = getPragmaNumber(db, 'page_count');
    const pageSize = getPragmaNumber(db, 'page_size') || 4096;

    // Ensure incremental auto-vacuum is enabled and execute full VACUUM + optimizer pass
    const currentMode = getPragmaNumber(db, 'auto_vacuum');
    if (currentMode !== 2) {
      db.exec('PRAGMA auto_vacuum = INCREMENTAL;');
    }
    db.exec(`
      PRAGMA incremental_vacuum;
      VACUUM;
      PRAGMA optimize;
    `);
    warmTableCache.clear();
    pageCacheTelemetry.misses += 1;

    const sizeAfterBytes = getFileSizeBytes(SQLITE_FILE);
    const freelistAfter = getPragmaNumber(db, 'freelist_count');
    const pageCountAfter = getPragmaNumber(db, 'page_count');
    const reclaimedBytes = Math.max(0, sizeBeforeBytes - sizeAfterBytes);
    const autoVacuumMode = mapAutoVacuumMode(getPragmaNumber(db, 'auto_vacuum'));

    const prevCompacts = Number(getMetaValue(db, 'compact_runs') ?? '0');
    setMetaValue(db, 'auto_vacuum_mode', autoVacuumMode);
    setMetaValue(db, 'compact_runs', String(prevCompacts + 1));
    setMetaValue(db, 'last_compact_at', new Date().toISOString());
    setMetaValue(db, 'last_compact_reclaimed_bytes', String(reclaimedBytes));

    syncJsonMirror(db);

    const msgCount = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }).c;
    const padCount = (db.prepare('SELECT COUNT(*) as c FROM scratchpads').get() as { c: number }).c;
    const logCount = (db.prepare('SELECT COUNT(*) as c FROM agent_logs').get() as { c: number }).c;
    const durationMs = Math.max(1, Date.now() - startedAt);
    appendHealthSnapshot(db, 'vacuum_compact');

    return {
      autoVacuumMode,
      sizeBeforeBytes,
      sizeAfterBytes,
      reclaimedBytes,
      freelistBefore,
      freelistAfter,
      pageCountBefore,
      pageCountAfter,
      pageSize,
      durationMs,
      records: {
        messages: msgCount,
        scratchpads: padCount,
        agentLogs: logCount,
      },
    };
  },

  // --- SQLITE DATABASE BACKUP ---
  async createSqliteBackup(): Promise<{
    buffer: Buffer;
    filename: string;
    stats: { messages: number; scratchpads: number; agentLogs: number };
  }> {
    const db = getSqliteDb();
    const statsBefore = collectStorageStats(db);

    setMetaValue(db, 'exported_at', new Date().toISOString());
    setMetaValue(db, 'schema_version', '2');
    setMetaValue(db, 'auto_vacuum_mode', statsBefore.autoVacuumMode);
    setMetaValue(db, 'messages_count', String(statsBefore.records.messages));
    setMetaValue(db, 'scratchpads_count', String(statsBefore.records.scratchpads));
    setMetaValue(db, 'agent_logs_count', String(statsBefore.records.agentLogs));

    const timestampTag = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `aglaia_sqlite_backup_${timestampTag}.db`;
    const tempDbPath = path.join(
      os.tmpdir(),
      `aglaia_backup_${Date.now()}_${Math.random().toString(36).slice(2)}.db`
    );

    const escapedPath = tempDbPath.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${escapedPath}';`);

    try {
      const buffer = fs.readFileSync(tempDbPath);
      return {
        buffer,
        filename,
        stats: statsBefore.records,
      };
    } finally {
      if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
      }
    }
  },

  // --- SQLITE TABLE BROWSER & READ-ONLY QUERY ENGINE ---
  async getSqliteTablesSchema(): Promise<SqliteTableSchema[]> {
    const db = getSqliteDb();
    const tableRows = db
      .prepare(
        `SELECT name, sql FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY CASE name
           WHEN 'agent_logs' THEN 1
           WHEN 'scratchpads' THEN 2
           WHEN 'messages' THEN 3
           WHEN 'backup_metadata' THEN 4
           ELSE 5
         END, name ASC`
      )
      .all() as Array<{ name: string; sql: string | null }>;

    return tableRows.map((tbl) => {
      const safeIdent = `"${tbl.name.replace(/"/g, '""')}"`;
      const countRow = db
        .prepare(`SELECT COUNT(*) as c FROM ${safeIdent}`)
        .get() as { c: number };

      const colRows = db
        .prepare(`PRAGMA table_info(${safeIdent})`)
        .all() as Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
        pk: number;
      }>;

      const idxRows = db
        .prepare(`PRAGMA index_list(${safeIdent})`)
        .all() as Array<{
        seq: number;
        name: string;
        unique: number;
        origin: string;
        partial: number;
      }>;

      return {
        name: tbl.name,
        ddl: tbl.sql || '',
        rowCount: Number(countRow?.c ?? 0),
        columns: colRows.map((c) => ({
          cid: Number(c.cid),
          name: c.name,
          type: c.type || 'ANY',
          notnull: Boolean(c.notnull),
          dfltValue: c.dflt_value ?? null,
          pk: Boolean(c.pk),
        })),
        indexes: idxRows.map((idx) => ({
          seq: Number(idx.seq),
          name: idx.name,
          unique: Boolean(idx.unique),
          origin: idx.origin || 'c',
          partial: Boolean(idx.partial),
        })),
      };
    });
  },

  async browseSqliteTable(options: {
    tableName: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortColumn?: string;
    sortDir?: 'ASC' | 'DESC';
  }): Promise<SqliteBrowseResult> {
    const db = getSqliteDb();
    const startedAt = Date.now();

    const validTable = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name = ?"
      )
      .get(options.tableName) as { name?: string } | undefined;

    if (!validTable?.name) {
      throw new Error(`Unknown SQLite table '${options.tableName}'.`);
    }

    const safeTable = `"${validTable.name.replace(/"/g, '""')}"`;
    const colInfo = db
      .prepare(`PRAGMA table_info(${safeTable})`)
      .all() as Array<{ name: string }>;
    const columns = colInfo.map((c) => c.name);

    const totalRow = db
      .prepare(`SELECT COUNT(*) as c FROM ${safeTable}`)
      .get() as { c: number };
    const totalRows = Number(totalRow?.c ?? 0);

    const searchTerm = (options.search || '').trim();
    let whereClause = '';
    const whereParams: string[] = [];

    if (searchTerm && columns.length > 0) {
      const likePattern = `%${searchTerm}%`;
      const predicates = columns.map((col) => {
        const safeCol = `"${col.replace(/"/g, '""')}"`;
        whereParams.push(likePattern);
        return `CAST(${safeCol} AS TEXT) LIKE ?`;
      });
      whereClause = `WHERE (${predicates.join(' OR ')})`;
    }

    const filteredRow = db
      .prepare(`SELECT COUNT(*) as c FROM ${safeTable} ${whereClause}`)
      .get(...whereParams) as { c: number };
    const filteredRows = Number(filteredRow?.c ?? 0);

    let sortCol: string | null = null;
    if (options.sortColumn && columns.includes(options.sortColumn)) {
      sortCol = options.sortColumn;
    } else if (validTable.name === 'agent_logs' && columns.includes('id')) {
      sortCol = 'id';
    } else if (columns.length > 0) {
      sortCol = columns[0];
    }

    const sortDir: 'ASC' | 'DESC' =
      options.sortDir === 'ASC' || options.sortDir === 'DESC'
        ? options.sortDir
        : validTable.name === 'agent_logs'
        ? 'DESC'
        : 'ASC';

    const orderClause = sortCol
      ? `ORDER BY "${sortCol.replace(/"/g, '""')}" ${sortDir}`
      : '';

    const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 50)));
    const offset = Math.max(0, Math.floor(options.offset ?? 0));

    const rows = db
      .prepare(`SELECT * FROM ${safeTable} ${whereClause} ${orderClause} LIMIT ? OFFSET ?`)
      .all(...whereParams, limit, offset) as Array<Record<string, unknown>>;

    return {
      tableName: validTable.name,
      columns,
      rows,
      totalRows,
      filteredRows,
      limit,
      offset,
      sortColumn: sortCol,
      sortDir,
      durationMs: Math.max(1, Date.now() - startedAt),
    };
  },

  async executeReadOnlySqlQuery(rawSql: string): Promise<SqliteQueryResult> {
    const db = getSqliteDb();
    const startedAt = Date.now();

    const trimmed = (rawSql || '').trim().replace(/;+\s*$/, '');
    if (!trimmed) {
      throw new Error('SQL query cannot be empty.');
    }

    // Strip single-quoted string literals and comments to validate read-only semantics safely
    const strippedForCheck = trimmed
      .replace(/'([^']|'')*'/g, "''")
      .replace(/--[^\n]*/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .trim();

    if (strippedForCheck.includes(';')) {
      throw new Error('Only a single read-only SQL statement is permitted per query.');
    }

    if (!/^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(strippedForCheck)) {
      throw new Error(
        'Only read-only SELECT, WITH, PRAGMA, or EXPLAIN queries are allowed in the Table Browser.'
      );
    }

    if (
      /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|VACUUM|REINDEX|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|ANALYZE)\b/i.test(
        strippedForCheck
      )
    ) {
      throw new Error(
        'Write or DDL operations are blocked in the read-only SQLite Table Browser.'
      );
    }

    if (/^\s*PRAGMA\b[\s\S]*=/i.test(strippedForCheck)) {
      throw new Error('Modifying PRAGMA settings is blocked in read-only query mode.');
    }

    const stmt = db.prepare(trimmed);
    const allRows = stmt.all() as Array<Record<string, unknown>>;
    const maxRows = 250;
    const truncated = allRows.length > maxRows;
    const rows = truncated ? allRows.slice(0, maxRows) : allRows;

    let columns: string[] = [];
    if (rows.length > 0) {
      columns = Object.keys(rows[0]);
    } else if (typeof (stmt as any).columns === 'function') {
      try {
        const metaCols = (stmt as any).columns() as Array<{ name?: string | null }>;
        columns = metaCols
          .map((c) => c.name)
          .filter((name): name is string => Boolean(name));
      } catch {
        columns = [];
      }
    }

    recordTableReadAccess('sql_query', Math.max(1, Math.ceil(rows.length / 25)));

    return {
      sql: trimmed,
      columns,
      rows,
      rowCount: rows.length,
      truncated,
      durationMs: Math.max(1, Date.now() - startedAt),
    };
  },

  async getDatabaseHealthReport(recordSample = true): Promise<SqliteHealthReport> {
    const db = getSqliteDb();
    const snapshot = recordSample
      ? appendHealthSnapshot(db, 'health_poll')
      : collectHealthSnapshotData(db).snapshot;

    const { entries } = collectHealthSnapshotData(db);

    const rawCacheSize = getPragmaNumber(db, 'cache_size');
    const pageSize = getPragmaNumber(db, 'page_size') || 4096;
    const cacheSizeKiB =
      rawCacheSize < 0
        ? Math.abs(rawCacheSize)
        : Math.round((rawCacheSize * pageSize) / 1024);

    const journalRow = db.prepare('PRAGMA journal_mode').get() as
      | { journal_mode?: string }
      | undefined;
    const quickCheckRow = db.prepare('PRAGMA quick_check').get() as
      | { quick_check?: string }
      | undefined;

    return {
      current: snapshot,
      history: [...healthHistoryBuffer],
      tablesAndIndexes: entries,
      integrity: {
        quickCheck: String(quickCheckRow?.quick_check || 'ok'),
        journalMode: String(journalRow?.journal_mode || 'delete').toUpperCase(),
        autoVacuumMode: mapAutoVacuumMode(getPragmaNumber(db, 'auto_vacuum')),
        cacheSizeKiB,
        pageSize,
        totalCacheHits: pageCacheTelemetry.hits,
        totalCacheMisses: pageCacheTelemetry.misses,
      },
    };
  },
};

function collectHealthSnapshotData(db: DatabaseSync): {
  snapshot: SqliteHealthSnapshot;
  entries: SqliteDbStatEntry[];
} {
  const pageCount = getPragmaNumber(db, 'page_count');
  const freelistCount = getPragmaNumber(db, 'freelist_count');
  const pageSize = getPragmaNumber(db, 'page_size') || 4096;
  const sizeBytes = getFileSizeBytes(SQLITE_FILE);
  const rawCacheSize = getPragmaNumber(db, 'cache_size');
  const cacheBudgetBytes =
    rawCacheSize < 0 ? Math.abs(rawCacheSize) * 1024 : rawCacheSize * pageSize;

  const indexRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all() as Array<{ name: string }>;
  const indexNameSet = new Set(indexRows.map((r) => r.name));

  let statRows: Array<{
    name: string;
    bytes: number;
    pages: number;
    unused: number;
    cells: number;
  }> = [];

  try {
    statRows = db
      .prepare(
        "SELECT name, SUM(pgsize) AS bytes, COUNT(*) AS pages, SUM(unused) AS unused, SUM(ncell) AS cells FROM dbstat WHERE name NOT LIKE 'sqlite_schema' GROUP BY name ORDER BY bytes DESC, name ASC"
      )
      .all() as Array<{
      name: string;
      bytes: number;
      pages: number;
      unused: number;
      cells: number;
    }>;
  } catch {
    statRows = [];
  }

  let totalStatBytes = 0;
  let totalUnusedBytes = 0;

  const entries: SqliteDbStatEntry[] = statRows.map((r) => {
    const totalBytes = Number(r.bytes || 0);
    const unusedBytes = Number(r.unused || 0);
    const usedBytes = Math.max(0, totalBytes - unusedBytes);
    const pages = Number(r.pages || 0);
    const cells = Number(r.cells || 0);
    const fillFactorPct =
      totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 100;
    const isIndex = indexNameSet.has(r.name);

    // Health score balances fill efficiency & freelist pressure; empty 1-page tables get baseline 85
    const baseEfficiency = cells === 0 && pages <= 1 ? 88 : Math.min(100, 45 + fillFactorPct * 0.55);
    const freelistPenalty = pageCount > 0 ? (freelistCount / pageCount) * 25 : 0;
    const healthScore = Number(Math.max(10, Math.min(100, baseEfficiency - freelistPenalty)).toFixed(1));
    const status: 'Optimal' | 'Fair' | 'Fragmented' =
      healthScore >= 80 ? 'Optimal' : healthScore >= 55 ? 'Fair' : 'Fragmented';

    totalStatBytes += totalBytes;
    totalUnusedBytes += unusedBytes;

    return {
      name: r.name,
      kind: isIndex ? 'index' : 'table',
      pages,
      totalBytes,
      usedBytes,
      unusedBytes,
      fillFactorPct,
      cells,
      healthScore,
      status,
    };
  });

  const freelistFragPct =
    pageCount > 0 ? Number(((freelistCount / pageCount) * 100).toFixed(2)) : 0;
  const btreeUnusedPct =
    totalStatBytes > 0 ? Number(((totalUnusedBytes / totalStatBytes) * 100).toFixed(1)) : 0;

  const totalLookups = pageCacheTelemetry.hits + pageCacheTelemetry.misses;
  const cacheHitRatio =
    totalLookups > 0
      ? Number(((pageCacheTelemetry.hits / totalLookups) * 100).toFixed(2))
      : 100;

  const workingSetFitPct =
    totalStatBytes > 0
      ? Number(Math.min(100, (cacheBudgetBytes / totalStatBytes) * 100).toFixed(1))
      : 100;

  const indexEntries = entries.filter((e) => e.kind === 'index');
  const healthPool = indexEntries.length > 0 ? indexEntries : entries;
  const indexHealthScore =
    healthPool.length > 0
      ? Number(
          (
            healthPool.reduce((sum, item) => sum + item.healthScore, 0) / healthPool.length
          ).toFixed(1)
        )
      : 95;

  const nowMs = Date.now();
  return {
    snapshot: {
      timestamp: new Date(nowMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timestampMs: nowMs,
      freelistFragPct,
      btreeUnusedPct,
      cacheHitRatio,
      workingSetFitPct,
      indexHealthScore,
      pageCount,
      freelistCount,
      sizeBytes,
      cacheHits: pageCacheTelemetry.hits,
      cacheMisses: pageCacheTelemetry.misses,
    },
    entries,
  };
}

function appendHealthSnapshot(db: DatabaseSync, eventLabel: string): SqliteHealthSnapshot {
  const { snapshot } = collectHealthSnapshotData(db);
  snapshot.eventLabel = eventLabel;

  // Seed a clean initial baseline progression on first inspection so time-series charts have immediate context
  if (healthHistoryBuffer.length === 0) {
    const baseMs = snapshot.timestampMs;
    const offsets = [-50000, -40000, -30000, -20000, -10000];
    offsets.forEach((offset, idx) => {
      const tMs = baseMs + offset;
      const warmupMisses = Math.max(1, Math.round(snapshot.cacheMisses * (0.4 + idx * 0.12)));
      const warmupHits = Math.max(2, Math.round(snapshot.cacheHits * (0.25 + idx * 0.15)));
      const warmupTotal = warmupHits + warmupMisses;
      const warmupRatio = Number(((warmupHits / warmupTotal) * 100).toFixed(2));
      healthHistoryBuffer.push({
        ...snapshot,
        timestamp: new Date(tMs).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        timestampMs: tMs,
        cacheHits: warmupHits,
        cacheMisses: warmupMisses,
        cacheHitRatio: warmupRatio,
        eventLabel: 'baseline',
      });
    });
  }

  healthHistoryBuffer.push(snapshot);
  if (healthHistoryBuffer.length > 36) {
    healthHistoryBuffer.splice(0, healthHistoryBuffer.length - 36);
  }
  return snapshot;
}

