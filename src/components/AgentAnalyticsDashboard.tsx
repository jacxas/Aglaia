import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  CheckCircle2,
  Download,
  Filter,
  Loader2,
  Milestone,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AgentLog } from '../types';
import { analyzeAgentLogs, ExecutionOutcome } from '../logAnalytics';
import AgentLogTimeline from './AgentLogTimeline';

interface AgentAnalyticsDashboardProps {
  logs: AgentLog[];
  theme: 'light' | 'dark';
  onRefreshLogs: () => Promise<void>;
  onClearLogs: () => Promise<void>;
  onSeedSampleLogs: () => Promise<void>;
  onNavigateToConsole: () => void;
}

type CategoryFilter = 'all' | 'tool' | 'planner' | 'issues';

export default function AgentAnalyticsDashboard({
  logs,
  theme,
  onRefreshLogs,
  onClearLogs,
  onSeedSampleLogs,
  onNavigateToConsole,
}: AgentAnalyticsDashboardProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [selectedTool, setSelectedTool] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [logDisplayMode, setLogDisplayMode] = useState<'timeline' | 'table'>('table');
  const [isBusy, setIsBusy] = useState<'refresh' | 'seed' | 'clear' | null>(null);

  const isLight = theme === 'light';

  // Full tool list derived from unfiltered logs so the dropdown stays stable
  const allToolNames = useMemo(() => {
    const base = analyzeAgentLogs(logs);
    return base.toolMetrics.map((t) => t.toolName);
  }, [logs]);

  // Filtered logs passed into the analyzer
  const filteredRawLogs = useMemo(() => {
    return logs.filter((log) => {
      if (categoryFilter === 'tool' && log.type !== 'tool' && log.type !== 'desktop' && !/Tool '/i.test(log.message)) {
        return false;
      }
      if (categoryFilter === 'planner' && log.type !== 'planner') {
        return false;
      }
      if (
        categoryFilter === 'issues' &&
        log.type !== 'error' &&
        !/VETO|failed|fallo|error|blocked/i.test(log.message)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesMsg = log.message.toLowerCase().includes(q);
        const matchesTool = (log.meta?.toolName || '').toLowerCase().includes(q);
        const matchesType = log.type.toLowerCase().includes(q);
        if (!matchesMsg && !matchesTool && !matchesType) return false;
      }
      return true;
    });
  }, [logs, categoryFilter, searchQuery]);

  const toolFilteredRawLogs = useMemo(() => {
    if (selectedTool === 'all') return filteredRawLogs;
    return filteredRawLogs.filter((l) => {
      const parsed = analyzeAgentLogs([l]);
      return parsed.events[0]?.toolName === selectedTool;
    });
  }, [filteredRawLogs, selectedTool]);

  const analytics = useMemo(() => {
    return analyzeAgentLogs(toolFilteredRawLogs);
  }, [toolFilteredRawLogs]);

  const handleRefresh = async () => {
    setIsBusy('refresh');
    try {
      await onRefreshLogs();
    } finally {
      setIsBusy(null);
    }
  };

  const handleSeed = async () => {
    setIsBusy('seed');
    try {
      await onSeedSampleLogs();
    } finally {
      setIsBusy(null);
    }
  };

  const handleClear = async () => {
    setIsBusy('clear');
    try {
      await onClearLogs();
      setSelectedTool('all');
      setCategoryFilter('all');
      setSearchQuery('');
    } finally {
      setIsBusy(null);
    }
  };

  const handleExportAnalytics = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      filters: { categoryFilter, selectedTool, searchQuery },
      summary: {
        totalLogs: analytics.totalLogs,
        totalExecutions: analytics.totalExecutions,
        overallSuccessRate: analytics.overallSuccessRate,
        avgLatencyMs: analytics.avgLatencyMs,
        p95LatencyMs: analytics.p95LatencyMs,
        minLatencyMs: analytics.minLatencyMs,
        maxLatencyMs: analytics.maxLatencyMs,
        uniqueToolsCount: analytics.uniqueToolsCount,
        mostUsedTool: analytics.mostUsedTool,
        slowestTool: analytics.slowestTool,
      },
      toolMetrics: analytics.toolMetrics,
      latencySeries: analytics.latencySeries,
      outcomeDistribution: analytics.outcomeDistribution,
      events: analytics.events,
    };
    const uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', uri);
    link.setAttribute('download', `aglaia_analytics_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    link.click();
  };

  // Surface tokens adhering to single-elevation hairline aesthetic
  const surfaceClass = isLight
    ? 'bg-white border border-zinc-200 text-zinc-900'
    : 'bg-zinc-950 border border-zinc-800/90 text-slate-100';

  const subtleDivider = isLight ? 'border-zinc-200' : 'border-zinc-800/80';
  const mutedText = isLight ? 'text-zinc-500' : 'text-slate-400';
  const gridStroke = isLight ? '#e4e4e7' : '#27272a';
  const axisTickColor = isLight ? '#71717a' : '#94a3b8';

  const tooltipStyle = {
    backgroundColor: isLight ? '#ffffff' : '#09090b',
    borderColor: isLight ? '#e4e4e7' : '#27272a',
    borderRadius: '8px',
    fontSize: '11px',
    color: isLight ? '#09090b' : '#f8fafc',
    fontFamily: 'JetBrains Mono, monospace',
  };

  const renderOutcomeLabel = (outcome: ExecutionOutcome) => {
    if (outcome === 'success') {
      return (
        <span className={`inline-flex items-center gap-1 font-medium ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
          <CheckCircle2 size={12} />
          Success
        </span>
      );
    }
    if (outcome === 'blocked') {
      return (
        <span className={`inline-flex items-center gap-1 font-medium ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
          <ShieldAlert size={12} />
          Policy Veto
        </span>
      );
    }
    if (outcome === 'error') {
      return (
        <span className={`inline-flex items-center gap-1 font-medium ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
          <XCircle size={12} />
          Error
        </span>
      );
    }
    return <span className={mutedText}>Info</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Top Toolbar Header */}
      <div className={`${surfaceClass} rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-yellow-600 shrink-0" />
            <h2 className="text-xl font-display font-bold tracking-tight" style={{ textWrap: 'balance' }}>
              Agent Execution Analytics
            </h2>
          </div>
          <p className={`text-xs ${mutedText} flex flex-wrap items-center gap-2 font-mono tabular-nums`}>
            <span>{logs.length} total log entries</span>
            <span aria-hidden="true">·</span>
            <span>{analytics.totalExecutions} analyzed executions</span>
            <span aria-hidden="true">·</span>
            <span>{analytics.uniqueToolsCount} active tools</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isBusy !== null}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-50 ${
              isLight
                ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-slate-200'
            }`}
          >
            {isBusy === 'refresh' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refresh
          </button>

          <button
            onClick={handleSeed}
            disabled={isBusy !== null}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-50 ${
              isLight
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                : 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/25 text-yellow-400'
            }`}
          >
            {isBusy === 'seed' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Load Sample Trace
          </button>

          <button
            onClick={handleExportAnalytics}
            disabled={analytics.totalLogs === 0}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              isLight
                ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-slate-200'
            }`}
          >
            <Download size={13} />
            Export Analytics
          </button>

          <button
            onClick={handleClear}
            disabled={isBusy !== null || logs.length === 0}
            className={`px-3 py-2 rounded-lg text-xs font-medium border border-rose-500/25 bg-rose-500/10 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              isLight ? 'text-rose-700' : 'text-rose-400'
            }`}
          >
            {isBusy === 'clear' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Clear Logs
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className={`${surfaceClass} rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3`}>
        {/* Segmented Category Filter */}
        <div
          className={`inline-flex items-center gap-1 p-1 rounded-lg border ${
            isLight ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-zinc-800'
          }`}
        >
          {(
            [
              { id: 'all', label: 'All Events' },
              { id: 'tool', label: 'Tool Calls' },
              { id: 'planner', label: 'Planner' },
              { id: 'issues', label: 'Errors & Vetoes' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                categoryFilter === tab.id
                  ? isLight
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-zinc-800 text-yellow-400'
                  : isLight
                  ? 'text-zinc-600 hover:text-zinc-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tool Selector & Text Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 md:max-w-lg justify-end">
          <div className="flex items-center gap-1.5">
            <Filter size={13} className={mutedText} />
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              aria-label="Filter by tool"
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono outline-none cursor-pointer ${
                isLight
                  ? 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  : 'bg-zinc-900 border-zinc-800 text-slate-200'
              }`}
            >
              <option value="all">All Tools ({allToolNames.length})</option>
              {allToolNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${mutedText}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search log messages or tools..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none transition-colors ${
                isLight
                  ? 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-yellow-600'
                  : 'bg-zinc-900 border-zinc-800 text-slate-100 focus:border-yellow-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Empty State */}
      {logs.length === 0 ? (
        <div className={`${surfaceClass} rounded-xl p-12 text-center space-y-4`}>
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto text-yellow-600">
            <Activity size={22} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-display font-bold">No agent execution logs recorded yet</h3>
            <p className={`text-xs leading-relaxed ${mutedText}`}>
              Interact with Aglaia in the Oracle Console, run an Orbiter policy check, or load a sample execution trace to visualize latency percentiles, success rates, and tool utilization.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={handleSeed}
              disabled={isBusy !== null}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-yellow-600 hover:bg-yellow-500 text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {isBusy === 'seed' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Load Sample Trace
            </button>
            <button
              onClick={onNavigateToConsole}
              className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isLight
                  ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-slate-200'
              }`}
            >
              Return to Console
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 4-Column KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Total Executions */}
            <div className={`${surfaceClass} rounded-xl p-5 space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${mutedText}`}>Total Executions</span>
                <Activity size={14} className="text-yellow-600" />
              </div>
              <p className="text-2xl font-mono font-semibold tabular-nums tracking-tight">
                {analytics.totalExecutions}
              </p>
              <p className={`text-xs font-mono tabular-nums ${mutedText}`}>
                {analytics.successCount} ok · {analytics.blockedCount} veto · {analytics.errorCount} err
              </p>
            </div>

            {/* KPI 2: Success Rate */}
            <div className={`${surfaceClass} rounded-xl p-5 space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${mutedText}`}>Success Rate</span>
                <CheckCircle2
                  size={14}
                  className={
                    analytics.overallSuccessRate >= 85
                      ? 'text-emerald-500'
                      : analytics.overallSuccessRate >= 60
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }
                />
              </div>
              <p className="text-2xl font-mono font-semibold tabular-nums tracking-tight">
                {analytics.overallSuccessRate.toFixed(1)}%
              </p>
              <p className={`text-xs font-mono tabular-nums ${mutedText}`}>
                {analytics.blockedCount + analytics.errorCount === 0
                  ? 'Zero faults detected'
                  : `${analytics.blockedCount} policy vetoes · ${analytics.errorCount} runtime errors`}
              </p>
            </div>

            {/* KPI 3: Execution Latency */}
            <div className={`${surfaceClass} rounded-xl p-5 space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${mutedText}`}>Average Latency</span>
                <Clock size={14} className="text-sky-500" />
              </div>
              <p className="text-2xl font-mono font-semibold tabular-nums tracking-tight">
                {analytics.avgLatencyMs} <span className="text-sm font-normal">ms</span>
              </p>
              <p className={`text-xs font-mono tabular-nums ${mutedText}`}>
                P95 {analytics.p95LatencyMs}ms · Range {analytics.minLatencyMs}–{analytics.maxLatencyMs}ms
              </p>
            </div>

            {/* KPI 4: Tool Utilization */}
            <div className={`${surfaceClass} rounded-xl p-5 space-y-2`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${mutedText}`}>Tool Utilization</span>
                <Wrench size={14} className="text-orange-500" />
              </div>
              <p className="text-2xl font-mono font-semibold tabular-nums tracking-tight">
                {analytics.uniqueToolsCount} <span className="text-sm font-normal">tools</span>
              </p>
              <p className={`text-xs font-mono truncate ${mutedText}`} title={analytics.mostUsedTool || 'None'}>
                Top: {analytics.mostUsedTool || 'None'}
                {analytics.slowestTool ? ` · Slowest: ${analytics.slowestTool}` : ''}
              </p>
            </div>
          </div>

          {/* Primary Charts Grid: Latency Timeline + Outcome Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Chart 1: Execution Latency Trend & P95 Threshold (8 cols) */}
            <div className={`${surfaceClass} rounded-xl p-5 lg:col-span-8 flex flex-col justify-between space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Execution Latency Timeline</h3>
                  <p className={`text-xs ${mutedText} font-mono tabular-nums`}>
                    Per-call duration (ms) · Rolling average · P95 threshold ({analytics.p95LatencyMs}ms)
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-amber-500 inline-block" />
                    Latency
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-sky-500 inline-block" />
                    Rolling Avg
                  </span>
                </div>
              </div>

              {analytics.latencySeries.length === 0 ? (
                <div className={`h-[260px] flex items-center justify-center text-xs font-mono ${mutedText}`}>
                  No timed execution events match the active filters.
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={analytics.latencySeries} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="aglaiaLatencyFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d97706" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis
                        dataKey="seq"
                        stroke={axisTickColor}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke={axisTickColor}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}ms`}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const item = payload[0].payload;
                          return (
                            <div
                              style={tooltipStyle}
                              className="p-2.5 border shadow-md space-y-1 min-w-[180px]"
                            >
                              <div className="font-semibold text-yellow-500">{item.toolName}</div>
                              <div className="text-[10px] opacity-75">
                                {item.seq} · {item.timestamp}
                              </div>
                              <div className="flex justify-between gap-4 pt-1 border-t border-current/10 tabular-nums">
                                <span>Duration:</span>
                                <span className="font-bold">{item.latencyMs} ms</span>
                              </div>
                              <div className="flex justify-between gap-4 tabular-nums">
                                <span>Rolling Avg:</span>
                                <span>{item.rollingAvgMs} ms</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span>Outcome:</span>
                                <span className="uppercase">{item.outcome}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      {analytics.p95LatencyMs > 0 && (
                        <ReferenceLine
                          y={analytics.p95LatencyMs}
                          stroke="#dc2626"
                          strokeDasharray="4 4"
                          label={{
                            value: `P95 (${analytics.p95LatencyMs}ms)`,
                            fill: '#dc2626',
                            fontSize: 9,
                            position: 'insideTopRight',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        />
                      )}
                      {analytics.avgLatencyMs > 0 && (
                        <ReferenceLine
                          y={analytics.avgLatencyMs}
                          stroke="#0ea5e9"
                          strokeDasharray="2 4"
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="latencyMs"
                        stroke="#d97706"
                        strokeWidth={2}
                        fill="url(#aglaiaLatencyFill)"
                        activeDot={{ r: 4, fill: '#d97706', strokeWidth: 0 }}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="rollingAvgMs"
                        stroke="#0ea5e9"
                        strokeWidth={1.75}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 2: Outcome & Success Rate Distribution Donut (4 cols) */}
            <div className={`${surfaceClass} rounded-xl p-5 lg:col-span-4 flex flex-col justify-between space-y-4`}>
              <div>
                <h3 className="text-sm font-semibold">Outcome Distribution</h3>
                <p className={`text-xs ${mutedText} font-mono tabular-nums`}>
                  Success vs. Policy Vetoes vs. Errors
                </p>
              </div>

              {analytics.outcomeDistribution.length === 0 ? (
                <div className={`h-[200px] flex items-center justify-center text-xs font-mono ${mutedText}`}>
                  No evaluated outcomes.
                </div>
              ) : (
                <div className="h-[190px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.outcomeDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={3}
                        isAnimationActive={false}
                      >
                        {analytics.outcomeDistribution.map((entry) => (
                          <Cell key={entry.key} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: any, name: any) => [`${value} runs`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-mono font-bold tabular-nums">
                      {analytics.overallSuccessRate.toFixed(0)}%
                    </span>
                    <span className={`text-[10px] font-mono ${mutedText}`}>Success</span>
                  </div>
                </div>
              )}

              {/* Clean unboxed legend rows */}
              <div className={`pt-3 border-t ${subtleDivider} space-y-1.5 text-xs font-mono tabular-nums`}>
                {[
                  { label: 'Success', count: analytics.successCount, color: 'bg-emerald-600' },
                  { label: 'Policy Veto', count: analytics.blockedCount, color: 'bg-amber-600' },
                  { label: 'Runtime Error', count: analytics.errorCount, color: 'bg-rose-600' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-xs ${row.color}`} />
                      <span>{row.label}</span>
                    </span>
                    <span className="font-semibold">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Secondary Charts Grid: Tool Utilization + Tool Latency vs Reliability + Outcome Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Chart 3: Tool Utilization Stacked Bar Chart (6 cols) */}
            <div className={`${surfaceClass} rounded-xl p-5 lg:col-span-6 space-y-4`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Tool Utilization by Outcome</h3>
                  <p className={`text-xs ${mutedText} font-mono`}>
                    Invocation volume stacked by Success, Veto, and Error
                  </p>
                </div>
              </div>

              {analytics.toolMetrics.length === 0 ? (
                <div className={`h-[260px] flex items-center justify-center text-xs font-mono ${mutedText}`}>
                  No tool invocations recorded.
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.toolMetrics.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 5, right: 16, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                      <XAxis type="number" stroke={axisTickColor} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="toolName"
                        width={130}
                        stroke={axisTickColor}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val: string) => (val.length > 18 ? val.slice(0, 17) + '…' : val)}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="successCount" name="Success" stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="blockedCount" name="Policy Veto" stackId="a" fill="#D97706" isAnimationActive={false} />
                      <Bar dataKey="errorCount" name="Error" stackId="a" fill="#DC2626" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 4: Tool Average Latency vs Success Rate Composed Chart (6 cols) */}
            <div className={`${surfaceClass} rounded-xl p-5 lg:col-span-6 space-y-4`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Tool Latency vs. Reliability</h3>
                  <p className={`text-xs ${mutedText} font-mono`}>
                    Avg duration (ms, bars) vs. Success rate (%, line)
                  </p>
                </div>
              </div>

              {analytics.toolMetrics.length === 0 ? (
                <div className={`h-[260px] flex items-center justify-center text-xs font-mono ${mutedText}`}>
                  No tool performance metrics available.
                </div>
              ) : (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={analytics.toolMetrics.slice(0, 8)}
                      margin={{ top: 10, right: 8, left: -12, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis
                        dataKey="toolName"
                        stroke={axisTickColor}
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-18}
                        textAnchor="end"
                        tickFormatter={(val: string) => (val.length > 13 ? val.slice(0, 12) + '…' : val)}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke={axisTickColor}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}ms`}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        stroke={axisTickColor}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar
                        yAxisId="left"
                        dataKey="avgLatencyMs"
                        name="Avg Latency (ms)"
                        fill="#eab308"
                        radius={[4, 4, 0, 0]}
                        barSize={24}
                        isAnimationActive={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="successRate"
                        name="Success Rate (%)"
                        stroke="#16A34A"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#16A34A' }}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Windowed Success Rate Trend */}
          {analytics.outcomeTrend.length > 1 && (
            <div className={`${surfaceClass} rounded-xl p-5 space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Success Rate Over Execution Windows</h3>
                  <p className={`text-xs ${mutedText} font-mono`}>
                    Chronological execution reliability (%) across log windows
                  </p>
                </div>
              </div>
              <div className="h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analytics.outcomeTrend} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                    <XAxis dataKey="bucket" stroke={axisTickColor} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis
                      yAxisId="left"
                      stroke={axisTickColor}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      stroke={axisTickColor}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar yAxisId="left" dataKey="success" name="Success" stackId="w" fill="#16A34A" isAnimationActive={false} />
                    <Bar yAxisId="left" dataKey="blocked" name="Policy Veto" stackId="w" fill="#D97706" isAnimationActive={false} />
                    <Bar yAxisId="left" dataKey="error" name="Error" stackId="w" fill="#DC2626" isAnimationActive={false} />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="successRate"
                      name="Success Rate (%)"
                      stroke="#eab308"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#eab308' }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tool Utilization Matrix Table */}
          <div className={`${surfaceClass} rounded-xl overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${subtleDivider} flex items-center justify-between gap-4`}>
              <div>
                <h3 className="text-sm font-semibold">Tool Performance & Utilization Matrix</h3>
                <p className={`text-xs ${mutedText} font-mono`}>
                  Click any tool row to filter dashboard metrics to that tool
                </p>
              </div>
              {selectedTool !== 'all' && (
                <button
                  onClick={() => setSelectedTool('all')}
                  className="text-xs font-medium text-yellow-600 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  Reset Tool Filter
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className={`border-b ${subtleDivider} ${mutedText} font-mono text-[11px]`}>
                    <th className="text-left font-medium px-5 py-3">Tool / Capability</th>
                    <th className="text-left font-medium px-4 py-3">Context</th>
                    <th className="text-right font-medium px-4 py-3">Calls</th>
                    <th className="text-right font-medium px-4 py-3">Share</th>
                    <th className="text-right font-medium px-4 py-3">Success Rate</th>
                    <th className="text-right font-medium px-4 py-3">Avg Latency</th>
                    <th className="text-right font-medium px-4 py-3">P95 Latency</th>
                    <th className="text-right font-medium px-5 py-3">Peak</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {analytics.toolMetrics.map((tool) => {
                    const isSelected = selectedTool === tool.toolName;
                    return (
                      <tr
                        key={tool.toolName}
                        onClick={() => setSelectedTool(isSelected ? 'all' : tool.toolName)}
                        className={`border-b last:border-b-0 ${subtleDivider} cursor-pointer transition-colors ${
                          isSelected
                            ? isLight
                              ? 'bg-amber-50'
                              : 'bg-yellow-500/10'
                            : isLight
                            ? 'hover:bg-zinc-50'
                            : 'hover:bg-zinc-900/60'
                        }`}
                      >
                        <td className="px-5 py-2.5 font-medium">{tool.toolName}</td>
                        <td className={`px-4 py-2.5 capitalize ${mutedText}`}>{tool.dominantContext}</td>
                        <td className="px-4 py-2.5 text-right">{tool.invocations}</td>
                        <td className={`px-4 py-2.5 text-right ${mutedText}`}>{tool.sharePct.toFixed(1)}%</td>
                        <td
                          className={`px-4 py-2.5 text-right font-semibold ${
                            tool.successRate >= 85
                              ? isLight ? 'text-emerald-700' : 'text-emerald-400'
                              : tool.successRate >= 60
                              ? isLight ? 'text-amber-700' : 'text-amber-400'
                              : isLight ? 'text-rose-700' : 'text-rose-400'
                          }`}
                        >
                          {tool.successRate.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-right">{tool.avgLatencyMs > 0 ? `${tool.avgLatencyMs}ms` : '—'}</td>
                        <td className="px-4 py-2.5 text-right">{tool.p95LatencyMs > 0 ? `${tool.p95LatencyMs}ms` : '—'}</td>
                        <td className={`px-5 py-2.5 text-right ${mutedText}`}>
                          {tool.maxLatencyMs > 0 ? `${tool.maxLatencyMs}ms` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Analyzed Execution Log Trace Ledger / Vertical Timeline */}
          <div className={`${surfaceClass} rounded-xl overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${subtleDivider} flex flex-wrap items-center justify-between gap-4`}>
              <div>
                <h3 className="text-sm font-semibold">Analyzed Execution Log Trace</h3>
                <p className={`text-xs ${mutedText} font-mono tabular-nums`}>
                  Showing {analytics.events.length} parsed events
                </p>
              </div>
              <div
                className={`inline-flex items-center gap-1 p-1 rounded-lg border ${
                  isLight ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setLogDisplayMode('table')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    logDisplayMode === 'table'
                      ? isLight
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'bg-zinc-800 text-yellow-400'
                      : isLight
                      ? 'text-zinc-600 hover:text-zinc-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Ledger Table
                </button>
                <button
                  type="button"
                  onClick={() => setLogDisplayMode('timeline')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    logDisplayMode === 'timeline'
                      ? isLight
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'bg-zinc-800 text-yellow-400'
                      : isLight
                      ? 'text-zinc-600 hover:text-zinc-900'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Milestone size={12} />
                  Vertical Timeline
                </button>
              </div>
            </div>

            {logDisplayMode === 'timeline' ? (
              <div className="p-4">
                <AgentLogTimeline logs={toolFilteredRawLogs} theme={theme} embedded />
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className={`sticky top-0 ${isLight ? 'bg-white' : 'bg-zinc-950'}`}>
                    <tr className={`border-b ${subtleDivider} ${mutedText} font-mono text-[11px]`}>
                      <th className="text-left font-medium px-5 py-2.5">Time</th>
                      <th className="text-left font-medium px-4 py-2.5">Tool</th>
                      <th className="text-left font-medium px-4 py-2.5">Outcome</th>
                      <th className="text-right font-medium px-4 py-2.5">Latency</th>
                      <th className="text-left font-medium px-5 py-2.5">Log Entry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.events.map((ev) => (
                      <tr
                        key={ev.id}
                        className={`border-b last:border-b-0 ${subtleDivider} ${
                          isLight ? 'hover:bg-zinc-50' : 'hover:bg-zinc-900/50'
                        }`}
                      >
                        <td className={`px-5 py-2.5 font-mono tabular-nums whitespace-nowrap ${mutedText}`}>
                          {ev.timestamp}
                        </td>
                        <td className="px-4 py-2.5 font-mono whitespace-nowrap font-medium">{ev.toolName}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{renderOutcomeLabel(ev.outcome)}</td>
                        <td className="px-4 py-2.5 font-mono tabular-nums text-right whitespace-nowrap">
                          {ev.latencyMs !== null ? `${ev.latencyMs}ms` : '—'}
                        </td>
                        <td className={`px-5 py-2.5 max-w-xl truncate ${mutedText}`} title={ev.message}>
                          {ev.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
