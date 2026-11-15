import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Play,
  RefreshCw,
  Search,
  Table as TableIcon,
  X,
} from 'lucide-react';

interface SqliteColumnSchema {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dfltValue: string | null;
  pk: boolean;
}

interface SqliteIndexSchema {
  seq: number;
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
}

interface SqliteTableSchema {
  name: string;
  ddl: string;
  rowCount: number;
  columns: SqliteColumnSchema[];
  indexes: SqliteIndexSchema[];
}

interface SqliteBrowseResult {
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

interface SqliteQueryResult {
  sql: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}

interface SqliteTableBrowserProps {
  theme: 'light' | 'dark';
  refreshTrigger?: number;
}

type BrowserViewMode = 'rows' | 'schema' | 'query';

const QUERY_PRESETS: Array<{ label: string; sql: string }> = [
  {
    label: 'Latest Agent Logs',
    sql: 'SELECT id, type, timestamp, message, meta_json FROM agent_logs ORDER BY id DESC LIMIT 25;',
  },
  {
    label: 'All Scratchpads',
    sql: 'SELECT title, length(content) AS chars, updated_at, content FROM scratchpads ORDER BY title ASC;',
  },
  {
    label: 'Tool Usage Breakdown',
    sql: "SELECT json_extract(meta_json, '$.toolName') AS tool, COUNT(*) AS calls, ROUND(AVG(json_extract(meta_json, '$.durationMs')), 1) AS avg_ms FROM agent_logs WHERE json_extract(meta_json, '$.toolName') IS NOT NULL GROUP BY tool ORDER BY calls DESC;",
  },
  {
    label: 'Raw SQLite Master',
    sql: "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name;",
  },
];

function formatCellPreview(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function tryPrettyJson(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }
  return JSON.stringify(value, null, 2);
}

export default function SqliteTableBrowser({
  theme,
  refreshTrigger = 0,
}: SqliteTableBrowserProps) {
  const [tables, setTables] = useState<SqliteTableSchema[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('agent_logs');
  const [viewMode, setViewMode] = useState<BrowserViewMode>('rows');

  // Row browsing states
  const [browseData, setBrowseData] = useState<SqliteBrowseResult | null>(null);
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(15);
  const [pageOffset, setPageOffset] = useState<number>(0);
  const [sortColumn, setSortColumn] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC' | undefined>(undefined);
  const [isLoadingRows, setIsLoadingRows] = useState<boolean>(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // Selected row inspector
  const [inspectedRow, setInspectedRow] = useState<Record<string, unknown> | null>(null);
  const [copiedDdl, setCopiedDdl] = useState<boolean>(false);

  // Custom read-only SQL query console states
  const [sqlText, setSqlText] = useState<string>(QUERY_PRESETS[0].sql);
  const [queryResult, setQueryResult] = useState<SqliteQueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isRunningQuery, setIsRunningQuery] = useState<boolean>(false);

  // Debounce search query cleanly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPageOffset(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchTablesSchema = useCallback(async () => {
    try {
      const res = await fetch('/api/database/tables');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.tables)) {
        setTables(data.tables);
        setSelectedTable((prev) =>
          data.tables.some((t: SqliteTableSchema) => t.name === prev)
            ? prev
            : data.tables[0]?.name || 'agent_logs'
        );
      }
    } catch (err) {
      console.error('Failed to load SQLite table schemas:', err);
    }
  }, []);

  const fetchTableRows = useCallback(async () => {
    if (!selectedTable) return;
    setIsLoadingRows(true);
    setRowsError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      params.set('offset', String(pageOffset));
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (sortColumn) params.set('sortColumn', sortColumn);
      if (sortDir) params.set('sortDir', sortDir);

      const res = await fetch(
        `/api/database/tables/${encodeURIComponent(selectedTable)}/rows?${params.toString()}`
      );
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to load '${selectedTable}' (HTTP ${res.status})`);
      }
      setBrowseData(payload);
    } catch (err: any) {
      setRowsError(err?.message || 'Failed to inspect SQLite table.');
    } finally {
      setIsLoadingRows(false);
    }
  }, [selectedTable, pageSize, pageOffset, debouncedSearch, sortColumn, sortDir]);

  useEffect(() => {
    fetchTablesSchema();
  }, [fetchTablesSchema, refreshTrigger]);

  useEffect(() => {
    if (viewMode === 'rows') {
      fetchTableRows();
    }
  }, [viewMode, fetchTableRows, refreshTrigger]);

  const handleSelectTable = (tableName: string) => {
    setSelectedTable(tableName);
    setPageOffset(0);
    setSortColumn(undefined);
    setSortDir(undefined);
    setInspectedRow(null);
  };

  const handleSortColumn = (col: string) => {
    const activeCol = sortColumn ?? browseData?.sortColumn;
    const activeDir = sortDir ?? browseData?.sortDir ?? 'ASC';

    if (activeCol === col) {
      setSortColumn(col);
      setSortDir(activeDir === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortColumn(col);
      setSortDir('ASC');
    }
    setPageOffset(0);
  };

  const handleExecuteQuery = async (overrideSql?: string) => {
    const targetSql = overrideSql ?? sqlText;
    if (!targetSql.trim() || isRunningQuery) return;
    setIsRunningQuery(true);
    setQueryError(null);
    setInspectedRow(null);

    try {
      const res = await fetch('/api/database/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: targetSql }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload?.error || `SQL query failed (HTTP ${res.status})`);
      }
      setQueryResult(payload);
    } catch (err: any) {
      setQueryError(err?.message || 'Failed to execute SQL query.');
      setQueryResult(null);
    } finally {
      setIsRunningQuery(false);
    }
  };

  const handleCopyDdl = (ddl: string) => {
    if (!ddl) return;
    navigator.clipboard.writeText(ddl);
    setCopiedDdl(true);
    setTimeout(() => setCopiedDdl(false), 1800);
  };

  const activeSchema = tables.find((t) => t.name === selectedTable) || null;

  const totalFiltered = browseData?.filteredRows ?? 0;
  const rangeStart = totalFiltered === 0 ? 0 : pageOffset + 1;
  const rangeEnd = Math.min(totalFiltered, pageOffset + pageSize);
  const canPrev = pageOffset > 0;
  const canNext = pageOffset + pageSize < totalFiltered;

  return (
    <section
      aria-label="SQLite Table Browser"
      className={`border rounded-xl p-5 space-y-4 transition-colors ${
        theme === 'light'
          ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
          : 'bg-slate-900/50 border-slate-800 text-slate-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-orange-500 shrink-0" />
            <h3
              className={`text-base font-bold font-display tracking-tight ${
                theme === 'light' ? 'text-zinc-900' : 'text-slate-100'
              }`}
            >
              SQLite Table Browser
            </h3>
          </div>
          <p
            className={`text-xs leading-relaxed ${
              theme === 'light' ? 'text-zinc-600' : 'text-slate-400'
            }`}
          >
            Inspect raw internal SQLite tables, column schemas, and run read-only SQL queries on agent logs and scratchpads.
          </p>
        </div>

        {/* Mode Switcher + Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`inline-flex items-center p-0.5 rounded-lg border text-xs ${
              theme === 'light'
                ? 'bg-zinc-100 border-zinc-200'
                : 'bg-slate-950 border-slate-800'
            }`}
            role="tablist"
            aria-label="SQLite Browser Mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'rows'}
              onClick={() => {
                setViewMode('rows');
                setInspectedRow(null);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                viewMode === 'rows'
                  ? theme === 'light'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-slate-800 text-orange-400'
                  : theme === 'light'
                  ? 'text-zinc-600 hover:text-zinc-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon size={12} />
              Browse Rows
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'schema'}
              onClick={() => {
                setViewMode('schema');
                setInspectedRow(null);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                viewMode === 'schema'
                  ? theme === 'light'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-slate-800 text-orange-400'
                  : theme === 'light'
                  ? 'text-zinc-600 hover:text-zinc-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 size={12} />
              Raw Schema &amp; DDL
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'query'}
              onClick={() => {
                setViewMode('query');
                setInspectedRow(null);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                viewMode === 'query'
                  ? theme === 'light'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-slate-800 text-orange-400'
                  : theme === 'light'
                  ? 'text-zinc-600 hover:text-zinc-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play size={12} />
              SQL Query
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchTablesSchema();
              if (viewMode === 'rows') fetchTableRows();
              if (viewMode === 'query' && queryResult) handleExecuteQuery();
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
              theme === 'light'
                ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
            }`}
            title="Refresh SQLite tables and rows"
          >
            <RefreshCw size={12} className={isLoadingRows ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table Selector Tabs (visible for Rows & Schema modes) */}
      {viewMode !== 'query' && (
        <div
          className={`pb-3 border-b flex items-center justify-between gap-3 flex-wrap ${
            theme === 'light' ? 'border-zinc-200' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {tables.map((tbl) => {
              const isSelected = tbl.name === selectedTable;
              return (
                <button
                  key={tbl.name}
                  type="button"
                  onClick={() => handleSelectTable(tbl.name)}
                  className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isSelected
                      ? theme === 'light'
                        ? 'bg-orange-50 border-orange-300 text-orange-800 font-semibold'
                        : 'bg-orange-950/30 border-orange-500/40 text-orange-300 font-semibold'
                      : theme === 'light'
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{tbl.name}</span>
                  <span className="tabular-nums opacity-75">({tbl.rowCount})</span>
                </button>
              );
            })}
          </div>

          {activeSchema && (
            <div
              className={`flex items-center gap-2 text-[11px] font-mono tabular-nums ${
                theme === 'light' ? 'text-zinc-500' : 'text-slate-400'
              }`}
            >
              <span>{activeSchema.columns.length} columns</span>
              <span aria-hidden="true">·</span>
              <span>{activeSchema.indexes.length} indexes</span>
              <span aria-hidden="true">·</span>
              <span>{activeSchema.rowCount} rows</span>
            </div>
          )}
        </div>
      )}

      {/* VIEW 1: BROWSE ROWS */}
      {viewMode === 'rows' && (
        <div className="space-y-3">
          {/* Search & Page Size */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                size={13}
                className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  theme === 'light' ? 'text-zinc-400' : 'text-slate-500'
                }`}
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={`Filter '${selectedTable}' across all columns...`}
                aria-label={`Search rows in ${selectedTable}`}
                className={`w-full pl-8 pr-8 py-1.5 rounded-lg border font-mono text-xs outline-none transition-colors ${
                  theme === 'light'
                    ? 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500'
                    : 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-orange-500'
                }`}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Clear table filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 opacity-65 hover:opacity-100 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label
                htmlFor="sqlite-page-size"
                className={theme === 'light' ? 'text-zinc-500' : 'text-slate-400'}
              >
                Rows/page:
              </label>
              <select
                id="sqlite-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPageOffset(0);
                }}
                className={`px-2 py-1 rounded-lg border font-mono text-xs outline-none cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white border-zinc-300 text-zinc-800'
                    : 'bg-slate-950 border-slate-800 text-slate-200'
                }`}
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {rowsError && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono ${
                theme === 'light'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-rose-950/25 border-rose-500/30 text-rose-300'
              }`}
            >
              {rowsError}
            </div>
          )}

          {/* Data Grid */}
          <div
            className={`rounded-lg border overflow-hidden ${
              theme === 'light' ? 'border-zinc-200' : 'border-slate-800'
            }`}
          >
            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead
                  className={`sticky top-0 z-10 border-b ${
                    theme === 'light'
                      ? 'bg-zinc-100 border-zinc-200 text-zinc-700'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <tr>
                    {(browseData?.columns || []).map((col) => {
                      const activeCol = sortColumn ?? browseData?.sortColumn;
                      const activeDir = sortDir ?? browseData?.sortDir;
                      const isSorted = activeCol === col;
                      return (
                        <th
                          key={col}
                          className="px-3 py-2 font-semibold whitespace-nowrap select-none"
                        >
                          <button
                            type="button"
                            onClick={() => handleSortColumn(col)}
                            className="inline-flex items-center gap-1 hover:text-orange-500 transition-colors cursor-pointer"
                          >
                            <span>{col}</span>
                            {isSorted ? (
                              activeDir === 'ASC' ? (
                                <ArrowUp size={11} className="text-orange-500" />
                              ) : (
                                <ArrowDown size={11} className="text-orange-500" />
                              )
                            ) : (
                              <ArrowUpDown size={11} className="opacity-35" />
                            )}
                          </button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    theme === 'light' ? 'divide-zinc-100' : 'divide-slate-800/70'
                  }`}
                >
                  {isLoadingRows && !browseData ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, browseData?.columns?.length || 4)}
                        className="px-3 py-8 text-center text-xs opacity-60"
                      >
                        Loading SQLite rows...
                      </td>
                    </tr>
                  ) : !browseData || browseData.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, browseData?.columns?.length || 4)}
                        className="px-3 py-8 text-center text-xs opacity-60"
                      >
                        {debouncedSearch
                          ? `No rows in '${selectedTable}' match "${debouncedSearch}".`
                          : `Table '${selectedTable}' currently contains 0 rows.`}
                      </td>
                    </tr>
                  ) : (
                    browseData.rows.map((row, rIdx) => {
                      const isInspected = inspectedRow === row;
                      return (
                        <tr
                          key={rIdx}
                          onClick={() => setInspectedRow(isInspected ? null : row)}
                          className={`cursor-pointer transition-colors ${
                            isInspected
                              ? theme === 'light'
                                ? 'bg-orange-50'
                                : 'bg-orange-950/25'
                              : theme === 'light'
                              ? 'hover:bg-zinc-50'
                              : 'hover:bg-slate-800/40'
                          }`}
                          title="Click row to inspect full column values"
                        >
                          {browseData.columns.map((col) => {
                            const val = row[col];
                            const isNull = val === null || val === undefined;
                            return (
                              <td
                                key={col}
                                className={`px-3 py-2 max-w-[260px] truncate tabular-nums ${
                                  isNull ? 'italic opacity-45' : ''
                                }`}
                              >
                                {formatCellPreview(val)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Footer */}
          <div
            className={`flex items-center justify-between gap-3 flex-wrap text-xs font-mono tabular-nums ${
              theme === 'light' ? 'text-zinc-500' : 'text-slate-400'
            }`}
          >
            <span>
              Showing {rangeStart}–{rangeEnd} of {totalFiltered} rows
              {browseData && browseData.totalRows !== browseData.filteredRows
                ? ` (filtered from ${browseData.totalRows})`
                : ''}
              {browseData ? ` · ${browseData.durationMs}ms` : ''}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setPageOffset(Math.max(0, pageOffset - pageSize))}
                className={`px-2 py-1 rounded border text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  theme === 'light'
                    ? 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                <ChevronLeft size={12} />
                Prev
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setPageOffset(pageOffset + pageSize)}
                className={`px-2 py-1 rounded border text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  theme === 'light'
                    ? 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                Next
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: RAW SCHEMA & DDL */}
      {viewMode === 'schema' && activeSchema && (
        <div className="space-y-4">
          {/* Columns Table */}
          <div
            className={`rounded-lg border overflow-hidden ${
              theme === 'light' ? 'border-zinc-200' : 'border-slate-800'
            }`}
          >
            <table className="w-full text-left border-collapse font-mono text-[11px]">
              <thead
                className={`border-b ${
                  theme === 'light'
                    ? 'bg-zinc-100 border-zinc-200 text-zinc-700'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <tr>
                  <th className="px-3 py-2 font-semibold">CID</th>
                  <th className="px-3 py-2 font-semibold">Column</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Nullable</th>
                  <th className="px-3 py-2 font-semibold">Primary Key</th>
                  <th className="px-3 py-2 font-semibold">Default</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  theme === 'light' ? 'divide-zinc-100' : 'divide-slate-800/70'
                }`}
              >
                {activeSchema.columns.map((col) => (
                  <tr key={col.cid}>
                    <td className="px-3 py-2 tabular-nums opacity-65">{col.cid}</td>
                    <td className="px-3 py-2 font-semibold text-orange-500">{col.name}</td>
                    <td className="px-3 py-2">{col.type}</td>
                    <td className="px-3 py-2">{col.notnull ? 'NOT NULL' : 'NULLABLE'}</td>
                    <td className="px-3 py-2">{col.pk ? 'PRIMARY KEY' : '—'}</td>
                    <td className="px-3 py-2 opacity-75">{col.dfltValue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Indexes */}
          {activeSchema.indexes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium opacity-75">Table Indexes (PRAGMA index_list)</p>
              <div
                className={`rounded-lg border divide-y font-mono text-[11px] ${
                  theme === 'light'
                    ? 'border-zinc-200 divide-zinc-100 bg-zinc-50'
                    : 'border-slate-800 divide-slate-800/70 bg-slate-950/60'
                }`}
              >
                {activeSchema.indexes.map((idx) => (
                  <div
                    key={idx.name}
                    className="px-3 py-2 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <span className="font-semibold">{idx.name}</span>
                    <span className="opacity-70">
                      {idx.unique ? 'UNIQUE' : 'NON-UNIQUE'} · origin: {idx.origin}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw DDL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium opacity-75">
                Raw Schema DDL (sqlite_master)
              </p>
              <button
                type="button"
                onClick={() => handleCopyDdl(activeSchema.ddl)}
                className={`px-2 py-1 rounded border text-[11px] font-mono flex items-center gap-1 cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
              >
                {copiedDdl ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                {copiedDdl ? 'Copied' : 'Copy DDL'}
              </button>
            </div>
            <pre
              className={`p-3 rounded-lg border font-mono text-[11px] leading-relaxed overflow-x-auto ${
                theme === 'light'
                  ? 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  : 'bg-black/40 border-slate-800 text-orange-200/90'
              }`}
            >
              {activeSchema.ddl}
            </pre>
          </div>
        </div>
      )}

      {/* VIEW 3: READ-ONLY SQL QUERY CONSOLE */}
      {viewMode === 'query' && (
        <div className="space-y-3">
          {/* Starter Query Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] opacity-70 mr-1">Presets:</span>
            {QUERY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setSqlText(preset.sql);
                  handleExecuteQuery(preset.sql);
                }}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  theme === 'light'
                    ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                    : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleExecuteQuery();
                }
              }}
              aria-label="Read-only SQL query editor"
              placeholder="SELECT * FROM agent_logs ORDER BY id DESC LIMIT 25;"
              className={`w-full p-3 rounded-lg border font-mono text-xs outline-none resize-y ${
                theme === 'light'
                  ? 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:border-orange-500'
                  : 'bg-black/40 border-slate-800 text-slate-100 focus:border-orange-500'
              }`}
            />

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span
                className={`text-[11px] font-mono ${
                  theme === 'light' ? 'text-zinc-500' : 'text-slate-400'
                }`}
              >
                Read-only sandbox (SELECT, WITH, PRAGMA, EXPLAIN) · Ctrl+Enter to execute
              </span>
              <button
                type="button"
                onClick={() => handleExecuteQuery()}
                disabled={isRunningQuery || !sqlText.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Play size={12} />
                {isRunningQuery ? 'Running...' : 'Run Query'}
              </button>
            </div>
          </div>

          {queryError && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono ${
                theme === 'light'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-rose-950/25 border-rose-500/30 text-rose-300'
              }`}
            >
              {queryError}
            </div>
          )}

          {queryResult && (
            <div className="space-y-2">
              <div
                className={`flex items-center justify-between text-[11px] font-mono tabular-nums ${
                  theme === 'light' ? 'text-zinc-600' : 'text-slate-400'
                }`}
              >
                <span>
                  Returned <strong>{queryResult.rowCount}</strong> rows in{' '}
                  <strong>{queryResult.durationMs}ms</strong>
                  {queryResult.truncated ? ' (capped at 250 rows)' : ''}
                </span>
              </div>

              <div
                className={`rounded-lg border overflow-hidden ${
                  theme === 'light' ? 'border-zinc-200' : 'border-slate-800'
                }`}
              >
                <div className="overflow-x-auto max-h-[280px]">
                  <table className="w-full text-left border-collapse font-mono text-[11px]">
                    <thead
                      className={`sticky top-0 border-b ${
                        theme === 'light'
                          ? 'bg-zinc-100 border-zinc-200 text-zinc-700'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <tr>
                        {queryResult.columns.map((col) => (
                          <th key={col} className="px-3 py-2 font-semibold whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${
                        theme === 'light' ? 'divide-zinc-100' : 'divide-slate-800/70'
                      }`}
                    >
                      {queryResult.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={Math.max(1, queryResult.columns.length)}
                            className="px-3 py-6 text-center opacity-60"
                          >
                            Query returned 0 rows.
                          </td>
                        </tr>
                      ) : (
                        queryResult.rows.map((row, idx) => (
                          <tr
                            key={idx}
                            onClick={() => setInspectedRow(inspectedRow === row ? null : row)}
                            className={`cursor-pointer transition-colors ${
                              inspectedRow === row
                                ? theme === 'light'
                                  ? 'bg-orange-50'
                                  : 'bg-orange-950/25'
                                : theme === 'light'
                                ? 'hover:bg-zinc-50'
                                : 'hover:bg-slate-800/40'
                            }`}
                          >
                            {queryResult.columns.map((col) => {
                              const val = row[col];
                              const isNull = val === null || val === undefined;
                              return (
                                <td
                                  key={col}
                                  className={`px-3 py-2 max-w-[260px] truncate tabular-nums ${
                                    isNull ? 'italic opacity-45' : ''
                                  }`}
                                >
                                  {formatCellPreview(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row Detail Inspector (appears when clicking any row in Browse Rows or SQL Query) */}
      {inspectedRow && viewMode !== 'schema' && (
        <div
          className={`p-3.5 rounded-lg border space-y-2 ${
            theme === 'light'
              ? 'bg-zinc-50 border-zinc-200'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-500 font-mono">
              Row Inspector
            </span>
            <button
              type="button"
              onClick={() => setInspectedRow(null)}
              className="text-xs opacity-65 hover:opacity-100 cursor-pointer flex items-center gap-1"
            >
              <X size={12} />
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
            {Object.entries(inspectedRow).map(([key, value]) => (
              <div key={key} className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase opacity-65">{key}</span>
                <pre
                  className={`p-2 rounded border font-mono text-[11px] whitespace-pre-wrap break-words ${
                    theme === 'light'
                      ? 'bg-white border-zinc-200 text-zinc-800'
                      : 'bg-black/40 border-slate-800 text-slate-200'
                  }`}
                >
                  {tryPrettyJson(value)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
