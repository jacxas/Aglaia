import { AgentLog } from './types';

export type ExecutionOutcome = 'success' | 'blocked' | 'error' | 'info';

export interface AnalyzedExecutionEvent {
  id: number;
  sequence: number;
  timestamp: string;
  createdAtMs?: number;
  type: string;
  toolName: string;
  outcome: ExecutionOutcome;
  context: 'local' | 'remote' | 'blocked' | 'system';
  latencyMs: number | null;
  source?: string;
  isHeartbeat?: boolean;
  message: string;
}

export interface LatencySeriesPoint {
  seq: string;
  id: number;
  timestamp: string;
  toolName: string;
  latencyMs: number;
  outcome: ExecutionOutcome;
  rollingAvgMs: number;
}

export interface OutcomeTrendPoint {
  bucket: string;
  success: number;
  blocked: number;
  error: number;
  successRate: number;
}

export interface ToolUtilizationMetric {
  toolName: string;
  invocations: number;
  sharePct: number;
  successCount: number;
  blockedCount: number;
  errorCount: number;
  successRate: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  dominantContext: 'local' | 'remote' | 'blocked' | 'system';
}

export interface OutcomeDistributionPoint {
  name: string;
  key: 'success' | 'blocked' | 'error';
  value: number;
  pct: number;
  color: string;
}

export interface LogAnalyticsSummary {
  totalLogs: number;
  totalExecutions: number;
  successCount: number;
  blockedCount: number;
  errorCount: number;
  overallSuccessRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  uniqueToolsCount: number;
  mostUsedTool: string | null;
  slowestTool: string | null;
  latencySeries: LatencySeriesPoint[];
  outcomeTrend: OutcomeTrendPoint[];
  outcomeDistribution: OutcomeDistributionPoint[];
  toolMetrics: ToolUtilizationMetric[];
  events: AnalyzedExecutionEvent[];
}

export function parseTimeStringToMs(ts: string): number | null {
  if (!ts) return null;
  const match = ts.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const secs = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return ((hours * 60 + mins) * 60 + secs) * 1000;
}

function extractToolName(log: AgentLog): string {
  if (log.meta?.toolName) return log.meta.toolName;

  const msg = log.message;

  // Pattern: Ejecutando rito 'toolName'
  const ritoMatch = msg.match(/Ejecutando rito '([^']+)'/i);
  if (ritoMatch) return ritoMatch[1];

  // Pattern: Tool 'toolName' returned/failed
  const toolMatch = msg.match(/Tool '([^']+)'/i);
  if (toolMatch) return toolMatch[1];

  // Pattern: Ejecutando 'Tool.action'
  const orbiterMatch = msg.match(/Ejecutando '([^']+)'/);
  if (orbiterMatch) return orbiterMatch[1];

  // Pattern: Herramienta 'toolName' or Llamando manualmente a 'toolName'
  const manualMatch = msg.match(/(?:Herramienta|Llamando manualmente a|Fallo manual en herramienta) '([^']+)'/i);
  if (manualMatch) return manualMatch[1];

  // Pattern: Plan IR 'planId'
  const planIrMatch = msg.match(/Plan IR '([^']+)'/i);
  if (planIrMatch) return `PlanIR:${planIrMatch[1]}`;

  // Pattern: scratchpad 'name'
  if (/scratchpad/i.test(msg)) return 'ScratchpadVault';

  if (log.type === 'planner' || /Planificador Oracular|Consulta noble|Veredicto|Re-planificado/i.test(msg)) {
    return 'OraclePlanner';
  }
  if (/Covenant|CONSENTIMIENTO|VETO DEL KERNEL|Permisos/i.test(msg)) {
    return 'CovenantEngine';
  }
  if (log.type === 'memory' || /SQLite Ledger|Vectorizado/i.test(msg)) {
    return 'MemoryAgent';
  }
  if (log.type === 'desktop') {
    return 'DesktopAgent';
  }

  return 'SystemKernel';
}

function extractContext(log: AgentLog): 'local' | 'remote' | 'blocked' | 'system' {
  if (log.meta?.context) return log.meta.context;
  const msg = log.message;
  if (/\[SANTUARIO LOCAL\]|\[LOCAL\]|Local Hermética|local_only/i.test(msg)) return 'local';
  if (/\[RED CELESTIAL\]|\[REMOTE\]|Nube/i.test(msg)) return 'remote';
  if (/\[VETO|VETO:|Veto|blocked|clausurada/i.test(msg)) return 'blocked';
  return 'system';
}

export function isRoutineHeartbeatLog(log: AgentLog): boolean {
  const normalizedType = (log.type || '').toLowerCase();
  const msg = log.message || '';
  const source = (log.meta?.source || '').toLowerCase();
  const toolName = (log.meta?.toolName || '').toLowerCase();
  const status = (log.meta?.status || '').toLowerCase();

  if (normalizedType === 'error' || status === 'error' || status === 'blocked') {
    return false;
  }

  if (normalizedType === 'heartbeat' || source === 'heartbeat' || source === 'system_heartbeat' || toolName === 'systemheartbeat') {
    return true;
  }

  if (normalizedType === 'system' && !/\b(error|veto|fail|failed|blocked|alert|critical)\b/i.test(msg)) {
    return true;
  }

  return /\b(heartbeat|keep-?alive|health[\s_-]*check|routine[\s_-]*(?:sync|check|ping)|system[\s_-]*pulse|latido del sistema|pulso de rutina)\b/i.test(
    msg
  );
}

function classifyOutcome(log: AgentLog): ExecutionOutcome {
  if (log.meta?.status) return log.meta.status;

  const msg = log.message;
  if (/VETO|Veto|BLOQUEO TEMPORAL|ACCION COMPROMETIDA VETADA|blocked/i.test(msg)) {
    return 'blocked';
  }
  if (log.type === 'error' || /failed|fallo|error|exception/i.test(msg)) {
    return 'error';
  }
  if (
    log.type === 'tool' ||
    /returned:|completado|culminó exitosamente|éxito total|AUTORIZACIÓN AUTOMÁTICA|CONSENTIMIENTO HÁPTICO CONCEDIDO|Saved scratchpad|Planificador Oracular/i.test(msg)
  ) {
    return 'success';
  }
  return 'info';
}

function extractExplicitLatencyMs(log: AgentLog): number | null {
  if (typeof log.meta?.durationMs === 'number' && log.meta.durationMs >= 0) {
    return Math.round(log.meta.durationMs);
  }
  const msMatch = log.message.match(/(\d+(?:\.\d+)?)\s*ms\b/i);
  if (msMatch) {
    return Math.round(parseFloat(msMatch[1]));
  }
  return null;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedAsc.length) - 1;
  return sortedAsc[Math.max(0, Math.min(sortedAsc.length - 1, idx))];
}

/**
 * Analyzes chronological agent log history to extract latency, success rates, and tool utilization.
 * Accepts logs in any order (newest-first from API or oldest-first) and normalizes chronologically.
 */
export function analyzeAgentLogs(rawLogs: AgentLog[]): LogAnalyticsSummary {
  const chronological = [...rawLogs].sort((a, b) => a.id - b.id);

  // Track start timestamps for start->finish pairs lacking explicit meta.durationMs
  const pendingStarts = new Map<string, { createdAtMs: number | null; timeMs: number | null }>();

  const events: AnalyzedExecutionEvent[] = chronological.map((log, index) => {
    const toolName = extractToolName(log);
    const outcome = classifyOutcome(log);
    const context = extractContext(log);
    let latencyMs = extractExplicitLatencyMs(log);

    const isStartEvent =
      /Ejecutando rito|Llamando manualmente a|Consulta noble recibida|Iniciado Microkernel/i.test(log.message) &&
      latencyMs === null;

    const isEndEvent =
      /returned:|failed:|culminó exitosamente|Fallo manual|Veredicto completado|culminada en éxito total/i.test(log.message);

    const key = /Consulta noble recibida|Veredicto completado/i.test(log.message)
      ? 'OracleTurn'
      : /Iniciado Microkernel|culminada en éxito total/i.test(log.message)
      ? 'MicrokernelPlan'
      : toolName;

    if (isStartEvent) {
      pendingStarts.set(key, {
        createdAtMs: log.createdAtMs ?? null,
        timeMs: parseTimeStringToMs(log.timestamp),
      });
    } else if (isEndEvent && latencyMs === null) {
      const start = pendingStarts.get(key);
      if (start) {
        if (log.createdAtMs && start.createdAtMs && log.createdAtMs >= start.createdAtMs) {
          latencyMs = Math.max(1, Math.round(log.createdAtMs - start.createdAtMs));
        } else {
          const endT = parseTimeStringToMs(log.timestamp);
          if (endT !== null && start.timeMs !== null && endT >= start.timeMs) {
            latencyMs = Math.max(1, endT - start.timeMs);
          }
        }
        pendingStarts.delete(key);
      }
    }

    return {
      id: log.id,
      sequence: index + 1,
      timestamp: log.timestamp,
      createdAtMs: log.createdAtMs,
      type: log.type,
      toolName,
      outcome,
      context,
      latencyMs,
      source: log.meta?.source,
      isHeartbeat: isRoutineHeartbeatLog(log),
      message: log.message,
    };
  });

  // Actionable execution records (exclude purely passive info/start lines unless they carry latency or explicit tool/error/veto)
  const executionEvents = events.filter(
    (e) =>
      e.outcome === 'error' ||
      e.outcome === 'blocked' ||
      e.latencyMs !== null ||
      (e.outcome === 'success' && !/Ejecutando rito|Llamando manualmente/i.test(e.message)) ||
      e.type === 'tool' ||
      e.type === 'planner' ||
      e.type === 'desktop'
  );

  // Deduplicate paired start/end tool events when counting tool invocations:
  // If we have an explicit start ("Ejecutando rito 'x'") immediately followed by its end ("Tool 'x' returned"),
  // prefer the end event that has outcome+latency for tool statistics.
  const startOnlyPattern = /^(?:Ejecutando rito|Llamando manualmente a|Consulta noble recibida)/i;
  const pairedExecutions = executionEvents.filter((ev, idx, arr) => {
    if (!startOnlyPattern.test(ev.message)) return true;
    const hasMatchingCompletion = arr.slice(idx + 1, idx + 4).some(
      (next) => next.toolName === ev.toolName && !startOnlyPattern.test(next.message)
    );
    return !hasMatchingCompletion;
  });

  const targetExecutions = pairedExecutions.length > 0 ? pairedExecutions : executionEvents;

  const successCount = targetExecutions.filter((e) => e.outcome === 'success').length;
  const blockedCount = targetExecutions.filter((e) => e.outcome === 'blocked').length;
  const errorCount = targetExecutions.filter((e) => e.outcome === 'error').length;
  const totalEvaluated = successCount + blockedCount + errorCount;
  const overallSuccessRate =
    totalEvaluated > 0 ? Math.round((successCount / totalEvaluated) * 1000) / 10 : 100;

  // Latency series & summary
  const latencyEvents = targetExecutions.filter(
    (e): e is AnalyzedExecutionEvent & { latencyMs: number } => e.latencyMs !== null
  );
  const latencies = latencyEvents.map((e) => e.latencyMs);
  const sortedLatencies = [...latencies].sort((a, b) => a - b);

  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, v) => sum + v, 0) / latencies.length)
      : 0;
  const p95LatencyMs = percentile(sortedLatencies, 95);
  const minLatencyMs = sortedLatencies.length > 0 ? sortedLatencies[0] : 0;
  const maxLatencyMs = sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0;

  let runningSum = 0;
  const latencySeries: LatencySeriesPoint[] = latencyEvents.map((ev, idx) => {
    runningSum += ev.latencyMs;
    return {
      seq: `#${idx + 1}`,
      id: ev.id,
      timestamp: ev.timestamp,
      toolName: ev.toolName,
      latencyMs: ev.latencyMs,
      outcome: ev.outcome,
      rollingAvgMs: Math.round(runningSum / (idx + 1)),
    };
  });

  // Outcome trend buckets (group executions into up to 8 chronological windows)
  const evaluatedEvents = targetExecutions.filter((e) => e.outcome !== 'info');
  const bucketCount = Math.min(8, Math.max(1, evaluatedEvents.length));
  const bucketSize = Math.max(1, Math.ceil(evaluatedEvents.length / bucketCount));
  const outcomeTrend: OutcomeTrendPoint[] = [];

  for (let i = 0; i < evaluatedEvents.length; i += bucketSize) {
    const slice = evaluatedEvents.slice(i, i + bucketSize);
    const s = slice.filter((e) => e.outcome === 'success').length;
    const b = slice.filter((e) => e.outcome === 'blocked').length;
    const er = slice.filter((e) => e.outcome === 'error').length;
    const tot = s + b + er;
    outcomeTrend.push({
      bucket: slice.length === 1 ? slice[0].timestamp : `${slice[0].timestamp.slice(0, 5)}–${slice[slice.length - 1].timestamp.slice(0, 5)}`,
      success: s,
      blocked: b,
      error: er,
      successRate: tot > 0 ? Math.round((s / tot) * 100) : 100,
    });
  }

  // Outcome distribution
  const rawOutcomeDistribution: OutcomeDistributionPoint[] = [
    {
      name: 'Success',
      key: 'success',
      value: successCount,
      pct: totalEvaluated > 0 ? Math.round((successCount / totalEvaluated) * 1000) / 10 : 0,
      color: '#16A34A',
    },
    {
      name: 'Policy Veto',
      key: 'blocked',
      value: blockedCount,
      pct: totalEvaluated > 0 ? Math.round((blockedCount / totalEvaluated) * 1000) / 10 : 0,
      color: '#D97706',
    },
    {
      name: 'Error',
      key: 'error',
      value: errorCount,
      pct: totalEvaluated > 0 ? Math.round((errorCount / totalEvaluated) * 1000) / 10 : 0,
      color: '#DC2626',
    },
  ];
  const outcomeDistribution = rawOutcomeDistribution.filter((d) => d.value > 0);

  // Per-tool utilization & performance aggregation
  const toolGroups = new Map<string, AnalyzedExecutionEvent[]>();
  for (const ev of targetExecutions) {
    const group = toolGroups.get(ev.toolName) ?? [];
    group.push(ev);
    toolGroups.set(ev.toolName, group);
  }

  const totalToolInvocations = targetExecutions.length;
  const toolMetrics: ToolUtilizationMetric[] = Array.from(toolGroups.entries())
    .map(([toolName, items]) => {
      const s = items.filter((i) => i.outcome === 'success').length;
      const b = items.filter((i) => i.outcome === 'blocked').length;
      const er = items.filter((i) => i.outcome === 'error').length;
      const denom = s + b + er;
      const itemLatencies = items
        .map((i) => i.latencyMs)
        .filter((v): v is number => v !== null)
        .sort((a, z) => a - z);

      const contextCounts = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.context] = (acc[item.context] || 0) + 1;
        return acc;
      }, {});
      const dominantContext = (Object.entries(contextCounts).sort((a, z) => z[1] - a[1])[0]?.[0] ?? 'system') as
        | 'local'
        | 'remote'
        | 'blocked'
        | 'system';

      return {
        toolName,
        invocations: items.length,
        sharePct: totalToolInvocations > 0 ? Math.round((items.length / totalToolInvocations) * 1000) / 10 : 0,
        successCount: s,
        blockedCount: b,
        errorCount: er,
        successRate: denom > 0 ? Math.round((s / denom) * 1000) / 10 : 100,
        avgLatencyMs:
          itemLatencies.length > 0
            ? Math.round(itemLatencies.reduce((sum, v) => sum + v, 0) / itemLatencies.length)
            : 0,
        minLatencyMs: itemLatencies.length > 0 ? itemLatencies[0] : 0,
        maxLatencyMs: itemLatencies.length > 0 ? itemLatencies[itemLatencies.length - 1] : 0,
        p95LatencyMs: percentile(itemLatencies, 95),
        dominantContext,
      };
    })
    .sort((a, b) => b.invocations - a.invocations);

  const mostUsedTool = toolMetrics.length > 0 ? toolMetrics[0].toolName : null;
  const withLatency = toolMetrics.filter((t) => t.avgLatencyMs > 0).sort((a, b) => b.avgLatencyMs - a.avgLatencyMs);
  const slowestTool = withLatency.length > 0 ? withLatency[0].toolName : null;

  return {
    totalLogs: rawLogs.length,
    totalExecutions: targetExecutions.length,
    successCount,
    blockedCount,
    errorCount,
    overallSuccessRate,
    avgLatencyMs,
    p95LatencyMs,
    minLatencyMs,
    maxLatencyMs,
    uniqueToolsCount: toolMetrics.length,
    mostUsedTool,
    slowestTool,
    latencySeries,
    outcomeTrend,
    outcomeDistribution,
    toolMetrics,
    events: [...events].reverse(), // Newest first for table display
  };
}
