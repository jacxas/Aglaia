import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
  GitCommitHorizontal,
  Loader2,
  Milestone,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Timer,
  Wrench,
  XCircle,
} from 'lucide-react';
import { AgentLog } from '../types';
import {
  AnalyzedExecutionEvent,
  analyzeAgentLogs,
  parseTimeStringToMs,
} from '../logAnalytics';

interface AgentLogTimelineProps {
  logs: AgentLog[];
  theme: 'light' | 'dark';
  onRefreshLogs?: () => Promise<void>;
  onSeedSampleLogs?: () => Promise<void>;
  onNavigateToConsole?: () => void;
  embedded?: boolean;
}

type MilestoneKind =
  | 'task_start'
  | 'task_complete'
  | 'policy_gate'
  | 'auto_heal'
  | 'long_running'
  | 'phase_checkpoint';

interface TimelineNode {
  event: AnalyzedExecutionEvent;
  chronologicalIndex: number;
  elapsedMs: number | null;
  gapFromPrevMs: number | null;
  milestoneKind: MilestoneKind | null;
  milestoneLabel: string | null;
  progressPct: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(secs >= 10 ? 1 : 2)}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = Math.round(secs % 60);
  return `${mins}m ${remSecs}s`;
}

function formatElapsedOffset(ms: number | null): string {
  if (ms === null || ms < 0) return '—';
  if (ms === 0) return '+0.0s';
  if (ms < 1000) return `+${Math.round(ms)}ms`;
  if (ms < 60_000) return `+${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const remSecs = Math.round((ms % 60_000) / 1000);
  return `+${mins}m ${remSecs.toString().padStart(2, '0')}s`;
}

function resolveEventTimeMs(ev: AnalyzedExecutionEvent): number | null {
  if (typeof ev.createdAtMs === 'number' && Number.isFinite(ev.createdAtMs)) {
    return ev.createdAtMs;
  }
  return parseTimeStringToMs(ev.timestamp);
}

function classifyMilestone(
  ev: AnalyzedExecutionEvent,
  idx: number,
  total: number,
  maxLatencyMs: number,
  gapFromPrevMs: number | null
): { kind: MilestoneKind; label: string } | null {
  const msg = ev.message || '';

  if (
    ev.outcome === 'blocked' ||
    /VETO|Policy Block|PermissionEngine|CONSENTIMIENTO|BLOQUEO/i.test(msg)
  ) {
    return { kind: 'policy_gate', label: 'Policy & Covenant Gate' };
  }

  if (/COGNITIVE HEAL|AUTO-HEAL|RE-PLANIFICADOR|Re-planificado/i.test(msg)) {
    return { kind: 'auto_heal', label: 'Cognitive Auto-Heal' };
  }

  if (
    /Veredicto completado|culminada en éxito total|SQLite database backup downloaded/i.test(msg)
  ) {
    return { kind: 'task_complete', label: 'Task Verdict Reached' };
  }

  if (
    idx === 0 ||
    /Consulta noble recibida|Iniciado Microkernel|Planificador Oracular/i.test(msg) ||
    (gapFromPrevMs !== null && gapFromPrevMs >= 45_000 && ev.type === 'planner')
  ) {
    return { kind: 'task_start', label: idx === 0 ? 'Trace Initiated' : 'Task Phase Started' };
  }

  if (
    ev.latencyMs !== null &&
    (ev.latencyMs >= 250 || (maxLatencyMs >= 180 && ev.latencyMs >= maxLatencyMs * 0.7))
  ) {
    return { kind: 'long_running', label: 'Long-Running Operation' };
  }

  if (total >= 8 && (idx === Math.floor(total / 2) || idx === total - 1)) {
    return {
      kind: 'phase_checkpoint',
      label: idx === total - 1 ? 'Latest Checkpoint' : 'Mid-Run Checkpoint',
    };
  }

  return null;
}

export default function AgentLogTimeline({
  logs,
  theme,
  onRefreshLogs,
  onSeedSampleLogs,
  onNavigateToConsole,
  embedded = false,
}: AgentLogTimelineProps) {
  const [sortDirection, setSortDirection] = useState<'chronological' | 'reverse'>('chronological');
  const [hideHeartbeats, setHideHeartbeats] = useState<boolean>(false);
  const [milestonesOnly, setMilestonesOnly] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [isBusy, setIsBusy] = useState<'refresh' | 'seed' | null>(null);

  const isLight = theme === 'light';

  const surfaceClass = isLight
    ? 'bg-white border border-zinc-200 text-zinc-900'
    : 'bg-zinc-950 border border-zinc-800/90 text-slate-100';
  const subtleDivider = isLight ? 'border-zinc-200' : 'border-zinc-800/80';
  const mutedText = isLight ? 'text-zinc-500' : 'text-slate-400';

  const {
    nodes,
    maxLatencyMs,
    cumulativeDurationMs,
    totalSpanMs,
    milestoneNodes,
    hiddenHeartbeatCount,
    timedCallCount,
  } = useMemo(() => {
    const analyzed = analyzeAgentLogs(logs);
    // analyzeAgentLogs returns newest-first in `events`; flip back to chronological order
    const chronological = [...analyzed.events].reverse();

    const filtered = hideHeartbeats
      ? chronological.filter((ev) => !ev.isHeartbeat)
      : chronological;

    const hiddenCount = chronological.length - filtered.length;

    const latencies = filtered
      .map((e) => e.latencyMs)
      .filter((v): v is number => v !== null && v >= 0);

    const maxLat = latencies.length > 0 ? Math.max(...latencies) : 0;
    const totalToolMs = latencies.reduce((sum, v) => sum + v, 0);

    const resolvedTimes = filtered.map(resolveEventTimeMs);
    const firstValidTime = resolvedTimes.find((t): t is number => t !== null) ?? null;
    const lastValidTime =
      [...resolvedTimes].reverse().find((t): t is number => t !== null) ?? null;

    const spanMs =
      firstValidTime !== null && lastValidTime !== null && lastValidTime >= firstValidTime
        ? lastValidTime - firstValidTime
        : null;

    const builtNodes: TimelineNode[] = filtered.map((ev, idx) => {
      const currTime = resolvedTimes[idx];
      const prevTime = idx > 0 ? resolvedTimes[idx - 1] : null;
      const elapsedMs =
        firstValidTime !== null && currTime !== null && currTime >= firstValidTime
          ? currTime - firstValidTime
          : null;
      const gapFromPrevMs =
        prevTime !== null && currTime !== null && currTime >= prevTime
          ? currTime - prevTime
          : null;

      const milestone = classifyMilestone(ev, idx, filtered.length, maxLat, gapFromPrevMs);
      const progressPct =
        filtered.length <= 1
          ? 100
          : Math.round((idx / (filtered.length - 1)) * 100);

      return {
        event: ev,
        chronologicalIndex: idx + 1,
        elapsedMs,
        gapFromPrevMs,
        milestoneKind: milestone?.kind ?? null,
        milestoneLabel: milestone?.label ?? null,
        progressPct,
      };
    });

    const milestones = builtNodes.filter((n) => n.milestoneKind !== null);

    return {
      nodes: builtNodes,
      maxLatencyMs: maxLat,
      cumulativeDurationMs: totalToolMs,
      totalSpanMs: spanMs,
      milestoneNodes: milestones,
      hiddenHeartbeatCount: hiddenCount,
      timedCallCount: latencies.length,
    };
  }, [logs, hideHeartbeats]);

  const displayedNodes = useMemo(() => {
    const base = milestonesOnly
      ? nodes.filter((n) => n.milestoneKind !== null)
      : nodes;
    return sortDirection === 'chronological' ? base : [...base].reverse();
  }, [nodes, milestonesOnly, sortDirection]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scrollToNode = (id: number) => {
    const el = document.getElementById(`timeline-node-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setExpandedIds((prev) => ({ ...prev, [id]: true }));
    }
  };

  const handleRefresh = async () => {
    if (!onRefreshLogs) return;
    setIsBusy('refresh');
    try {
      await onRefreshLogs();
    } finally {
      setIsBusy(null);
    }
  };

  const handleSeed = async () => {
    if (!onSeedSampleLogs) return;
    setIsBusy('seed');
    try {
      await onSeedSampleLogs();
    } finally {
      setIsBusy(null);
    }
  };

  const renderNodeMarker = (node: TimelineNode) => {
    const { event, milestoneKind } = node;

    if (milestoneKind === 'policy_gate') {
      return (
        <div className="w-7 h-7 rounded-lg rotate-45 flex items-center justify-center border-2 border-amber-500 bg-amber-500/15 text-amber-500 shadow-sm">
          <ShieldAlert size={13} className="-rotate-45" />
        </div>
      );
    }
    if (milestoneKind === 'auto_heal') {
      return (
        <div className="w-7 h-7 rounded-lg rotate-45 flex items-center justify-center border-2 border-purple-500 bg-purple-500/15 text-purple-400 shadow-sm">
          <Sparkles size={13} className="-rotate-45" />
        </div>
      );
    }
    if (milestoneKind === 'task_start' || milestoneKind === 'task_complete') {
      return (
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-sm ${
            milestoneKind === 'task_complete'
              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-500'
              : 'border-yellow-500 bg-yellow-500/15 text-yellow-500'
          }`}
        >
          <Flag size={13} />
        </div>
      );
    }
    if (milestoneKind === 'long_running') {
      return (
        <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-orange-500 bg-orange-500/15 text-orange-500 shadow-sm">
          <Timer size={13} />
        </div>
      );
    }
    if (milestoneKind === 'phase_checkpoint') {
      return (
        <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-sky-500 bg-sky-500/15 text-sky-400 shadow-sm">
          <Milestone size={13} />
        </div>
      );
    }

    if (event.outcome === 'error') {
      return (
        <div className="w-5 h-5 rounded-full flex items-center justify-center border border-rose-500 bg-rose-500/15 text-rose-500">
          <XCircle size={11} />
        </div>
      );
    }
    if (event.outcome === 'success') {
      return (
        <div className="w-5 h-5 rounded-full flex items-center justify-center border border-emerald-500/70 bg-emerald-500/15 text-emerald-500">
          <CheckCircle2 size={11} />
        </div>
      );
    }
    if (event.isHeartbeat) {
      return (
        <div className="w-4 h-4 rounded-full flex items-center justify-center border border-zinc-500/50 bg-zinc-500/10 text-zinc-400">
          <Activity size={9} />
        </div>
      );
    }

    return (
      <div className="w-5 h-5 rounded-full flex items-center justify-center border border-sky-500/60 bg-sky-500/10 text-sky-400">
        <GitCommitHorizontal size={11} />
      </div>
    );
  };

  const getDurationBarColor = (ev: AnalyzedExecutionEvent): string => {
    if (ev.outcome === 'error') return 'bg-rose-500';
    if (ev.outcome === 'blocked') return 'bg-amber-500';
    if ((ev.latencyMs ?? 0) >= 400) return 'bg-orange-500';
    if ((ev.latencyMs ?? 0) >= 150) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const outerWrapperClass = embedded
    ? 'space-y-5'
    : 'max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6 animate-fadeIn';

  return (
    <div className={outerWrapperClass}>
      {/* Header & Controls */}
      <div
        className={`${surfaceClass} rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Milestone size={18} className="text-orange-500 shrink-0" />
            <h2
              className={`${
                embedded ? 'text-base' : 'text-xl'
              } font-display font-bold tracking-tight`}
            >
              Chronological Agent Execution Timeline
            </h2>
          </div>
          <p className={`text-xs ${mutedText} font-mono tabular-nums flex flex-wrap items-center gap-2`}>
            <span>{nodes.length} events</span>
            <span aria-hidden="true">·</span>
            <span>{milestoneNodes.length} milestones</span>
            <span aria-hidden="true">·</span>
            <span>{timedCallCount} timed calls ({formatDuration(cumulativeDurationMs)} total)</span>
            {totalSpanMs !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span>Span: {formatDuration(totalSpanMs)}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setSortDirection((prev) =>
                prev === 'chronological' ? 'reverse' : 'chronological'
              )
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              isLight
                ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-slate-200'
            }`}
            title="Switch chronological ordering"
          >
            <ArrowDownUp size={12} />
            {sortDirection === 'chronological' ? 'Oldest → Newest' : 'Newest → Oldest'}
          </button>

          <label
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border cursor-pointer select-none transition-colors ${
              milestonesOnly
                ? isLight
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-yellow-500/15 border-yellow-500/35 text-yellow-300'
                : isLight
                ? 'bg-zinc-50 border-zinc-200 text-zinc-700'
                : 'bg-zinc-900 border-zinc-800 text-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={milestonesOnly}
              onChange={(e) => setMilestonesOnly(e.target.checked)}
              className="accent-orange-500 cursor-pointer"
            />
            <span>Milestones Only</span>
          </label>

          <label
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border cursor-pointer select-none transition-colors ${
              hideHeartbeats
                ? isLight
                  ? 'bg-orange-50 border-orange-300 text-orange-800'
                  : 'bg-orange-950/30 border-orange-500/35 text-orange-300'
                : isLight
                ? 'bg-zinc-50 border-zinc-200 text-zinc-700'
                : 'bg-zinc-900 border-zinc-800 text-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={hideHeartbeats}
              onChange={(e) => setHideHeartbeats(e.target.checked)}
              className="accent-orange-500 cursor-pointer"
            />
            <span>
              Hide Heartbeats
              {hideHeartbeats && hiddenHeartbeatCount > 0 ? ` (${hiddenHeartbeatCount})` : ''}
            </span>
          </label>

          {onRefreshLogs && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isBusy !== null}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                isLight
                  ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-slate-200'
              }`}
            >
              {isBusy === 'refresh' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Refresh
            </button>
          )}

          {onSeedSampleLogs && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={isBusy !== null}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                isLight
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                  : 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/25 text-yellow-400'
              }`}
            >
              {isBusy === 'seed' ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              Load Sample Trace
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {nodes.length === 0 ? (
        <div className={`${surfaceClass} rounded-xl p-10 text-center space-y-4`}>
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto text-orange-500">
            <Clock size={22} />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-display font-bold">No agent log events to map on timeline</h3>
            <p className={`text-xs leading-relaxed ${mutedText}`}>
              Run an oracle query, execute tools in the Sovereign Kernel, or load a sample multi-step trace to inspect chronological milestones and tool call durations.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            {onSeedSampleLogs && (
              <button
                type="button"
                onClick={handleSeed}
                disabled={isBusy !== null}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-yellow-600 hover:bg-yellow-500 text-white transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {isBusy === 'seed' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                Load Sample Trace
              </button>
            )}
            {onNavigateToConsole && (
              <button
                type="button"
                onClick={onNavigateToConsole}
                className={`px-4 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-slate-200'
                }`}
              >
                Return to Console
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Chronological Milestone Progress Strip */}
          {milestoneNodes.length > 0 && (
            <div className={`${surfaceClass} rounded-xl p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Flag size={12} className="text-yellow-500" />
                  Task Progress & Key Milestones
                </span>
                <span className={`text-[11px] font-mono tabular-nums ${mutedText}`}>
                  Click any milestone to jump in timeline
                </span>
              </div>

              {/* Horizontal Milestone Track */}
              <div className="relative pt-1 pb-1">
                <div
                  className={`h-1.5 w-full rounded-full overflow-hidden ${
                    isLight ? 'bg-zinc-200' : 'bg-zinc-800'
                  }`}
                >
                  <div
                    className="h-full bg-gradient-to-r from-yellow-600 via-orange-500 to-emerald-500 rounded-full"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Milestone Quick-Jump Pills */}
              <div className="flex flex-wrap gap-2">
                {milestoneNodes.map((m) => (
                  <button
                    key={m.event.id}
                    type="button"
                    onClick={() => scrollToNode(m.event.id)}
                    className={`px-2.5 py-1 rounded-md border text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                      m.milestoneKind === 'policy_gate'
                        ? isLight
                          ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                        : m.milestoneKind === 'long_running'
                        ? isLight
                          ? 'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100'
                          : 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20'
                        : m.milestoneKind === 'task_complete'
                        ? isLight
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                        : isLight
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100'
                        : 'bg-zinc-900 border-zinc-800 text-slate-200 hover:bg-zinc-800'
                    }`}
                  >
                    <span className="font-bold tabular-nums">#{m.chronologicalIndex}</span>
                    <span>{m.milestoneLabel}</span>
                    <span className="opacity-70 tabular-nums">
                      ({m.event.latencyMs !== null ? formatDuration(m.event.latencyMs) : m.event.timestamp})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vertical Timeline */}
          <div className={`${surfaceClass} rounded-xl p-5 md:p-6`}>
            {displayedNodes.length === 0 ? (
              <div className={`text-center py-8 text-xs font-mono ${mutedText}`}>
                No milestones matched the current filter. Uncheck &quot;Milestones Only&quot; to inspect all events.
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 space-y-4">
                {/* Continuous Vertical Spine */}
                <div
                  aria-hidden="true"
                  className={`absolute left-[13px] sm:left-[17px] top-3 bottom-3 w-px ${
                    isLight ? 'bg-zinc-200' : 'bg-zinc-800'
                  }`}
                />

                {displayedNodes.map((node, renderIdx) => {
                  const { event } = node;
                  const isExpanded = Boolean(expandedIds[event.id]);
                  const isMilestone = node.milestoneKind !== null;
                  const latencyPct =
                    event.latencyMs !== null && maxLatencyMs > 0
                      ? Math.max(4, Math.round((event.latencyMs / maxLatencyMs) * 100))
                      : 0;

                  const showGapDivider =
                    sortDirection === 'chronological' &&
                    renderIdx > 0 &&
                    node.gapFromPrevMs !== null &&
                    node.gapFromPrevMs >= 30_000;

                  return (
                    <React.Fragment key={event.id}>
                      {showGapDivider && (
                        <div className="relative flex items-center gap-3 py-1">
                          <div
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                              isLight
                                ? 'bg-zinc-100 border-zinc-200 text-zinc-600'
                                : 'bg-zinc-900 border-zinc-800 text-slate-400'
                            }`}
                          >
                            Elapsed interval: +{formatDuration(node.gapFromPrevMs!)}
                          </div>
                          <div className={`flex-1 border-t border-dashed ${subtleDivider}`} />
                        </div>
                      )}

                      <div
                        id={`timeline-node-${event.id}`}
                        className="relative group"
                      >
                        {/* Marker positioned cleanly on the vertical spine */}
                        <div className="absolute -left-6 sm:-left-8 top-3.5 w-7 flex items-center justify-center z-10">
                          {renderNodeMarker(node)}
                        </div>

                        {/* Event Card */}
                        <div
                          onClick={() => toggleExpand(event.id)}
                          className={`rounded-xl border p-3.5 sm:p-4 transition-all cursor-pointer ${
                            isMilestone
                              ? node.milestoneKind === 'policy_gate'
                                ? isLight
                                  ? 'bg-amber-50/50 border-amber-300/80 hover:border-amber-400'
                                  : 'bg-amber-950/15 border-amber-500/35 hover:border-amber-500/60'
                                : node.milestoneKind === 'long_running'
                                ? isLight
                                  ? 'bg-orange-50/50 border-orange-300/80 hover:border-orange-400'
                                  : 'bg-orange-950/15 border-orange-500/35 hover:border-orange-500/60'
                                : isLight
                                ? 'bg-zinc-50/80 border-zinc-300 hover:border-zinc-400'
                                : 'bg-zinc-900/65 border-zinc-700/80 hover:border-zinc-600'
                              : isLight
                              ? 'bg-white border-zinc-200 hover:border-zinc-300'
                              : 'bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-700'
                          }`}
                        >
                          {/* Top Row: Step index, tool, milestone tag, timestamp & elapsed */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="text-[11px] font-mono font-bold tabular-nums text-orange-500">
                                #{node.chronologicalIndex.toString().padStart(2, '0')}
                              </span>

                              <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold">
                                <Wrench size={11} className="opacity-70" />
                                {event.toolName}
                              </span>

                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                                  event.outcome === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : event.outcome === 'blocked'
                                    ? 'bg-amber-500/15 text-amber-500'
                                    : event.outcome === 'error'
                                    ? 'bg-rose-500/15 text-rose-500'
                                    : 'bg-zinc-500/15 text-slate-400'
                                }`}
                              >
                                {event.type}
                              </span>

                              {node.milestoneLabel && (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wide border ${
                                    node.milestoneKind === 'policy_gate'
                                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                                      : node.milestoneKind === 'long_running'
                                      ? 'bg-orange-500/15 border-orange-500/40 text-orange-500'
                                      : node.milestoneKind === 'task_complete'
                                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500'
                                      : 'bg-yellow-500/15 border-yellow-500/35 text-yellow-500'
                                  }`}
                                >
                                  Milestone · {node.milestoneLabel}
                                </span>
                              )}
                            </div>

                            <div className={`flex items-center gap-3 text-[11px] font-mono tabular-nums ${mutedText}`}>
                              <span>{event.timestamp}</span>
                              {node.elapsedMs !== null && (
                                <span className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5">
                                  {formatElapsedOffset(node.elapsedMs)}
                                </span>
                              )}
                              <span>{node.progressPct}%</span>
                              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            </div>
                          </div>

                          {/* Log Message */}
                          <p
                            className={`mt-2 text-xs leading-relaxed font-mono ${
                              isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'
                            } ${isLight ? 'text-zinc-700' : 'text-slate-300'}`}
                          >
                            {event.message}
                          </p>

                          {/* Tool Call Duration Visualization Bar */}
                          {event.latencyMs !== null && (
                            <div className="mt-3 flex items-center gap-3">
                              <div className="flex items-center gap-1 text-[10px] font-mono font-semibold tabular-nums min-w-[74px]">
                                <Clock size={11} className={mutedText} />
                                <span>{formatDuration(event.latencyMs)}</span>
                              </div>
                              <div
                                className={`flex-1 h-2 rounded-full overflow-hidden ${
                                  isLight ? 'bg-zinc-200/80' : 'bg-zinc-800'
                                }`}
                                title={`Tool call duration: ${event.latencyMs}ms (${latencyPct}% of peak ${maxLatencyMs}ms)`}
                              >
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${getDurationBarColor(
                                    event
                                  )}`}
                                  style={{ width: `${latencyPct}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-mono tabular-nums ${mutedText}`}>
                                {latencyPct}% of peak
                              </span>
                            </div>
                          )}

                          {/* Expanded Inspector Metadata */}
                          {isExpanded && (
                            <div
                              className={`mt-3 pt-3 border-t ${subtleDivider} grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] font-mono`}
                            >
                              <div>
                                <span className={`block text-[10px] uppercase ${mutedText}`}>Outcome</span>
                                <span className="font-semibold capitalize">{event.outcome}</span>
                              </div>
                              <div>
                                <span className={`block text-[10px] uppercase ${mutedText}`}>Context</span>
                                <span className="font-semibold capitalize">{event.context}</span>
                              </div>
                              <div>
                                <span className={`block text-[10px] uppercase ${mutedText}`}>Source</span>
                                <span className="font-semibold">{event.source || 'runtime'}</span>
                              </div>
                              <div>
                                <span className={`block text-[10px] uppercase ${mutedText}`}>Timeline Progress</span>
                                <span className="font-semibold tabular-nums">
                                  Step {node.chronologicalIndex}/{nodes.length} ({node.progressPct}%)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
