import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  Layers,
  ListOrdered,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trash2,
  XCircle,
} from 'lucide-react';
import { OrbeMaterial } from './VisualOrbe';

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type SchedulingMode = 'manual' | 'priority';

export interface QueuedToolTask {
  id: string;
  toolName: string;
  workflowName: string;
  args: Record<string, any>;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  result?: any;
  error?: string;
}

interface TaskQueuePanelProps {
  theme: 'light' | 'dark';
  onRefreshLogs: () => Promise<void> | void;
  onRefreshScratchpads: () => Promise<void> | void;
  onRefreshDatabaseStats: () => Promise<void> | void;
  setIsThinking: (thinking: boolean) => void;
  setOrbeMaterial: (material: OrbeMaterial) => void;
}

const STORAGE_KEY = 'aglaia_task_queue_v1';

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};

const TOOL_DEFAULT_ARGS: Record<string, Record<string, any>> = {
  getSystemInfo: {},
  listScratchpads: {},
  readScratchpad: { title: 'aglaia_manifesto' },
  writeScratchpad: {
    title: 'workflow_checkpoint',
    content: 'Automated workflow checkpoint recorded via Aglaia Task Queue.',
  },
  calculateExpression: { expression: '(1024 * 12) / 6.36' },
  getEleganceWisdom: {},
  databaseStats: {},
  compactDatabase: {},
};

const AVAILABLE_TOOLS = Object.keys(TOOL_DEFAULT_ARGS);

function createDefaultWorkflowTasks(): QueuedToolTask[] {
  const nowLabel = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return [
    {
      id: 'tq-init-1',
      toolName: 'listScratchpads',
      workflowName: 'Long-Running Vault Audit',
      args: {},
      priority: 'high',
      status: 'pending',
      createdAt: nowLabel,
    },
    {
      id: 'tq-init-2',
      toolName: 'calculateExpression',
      workflowName: 'Long-Running Vault Audit',
      args: { expression: '(4096 * 10) / 1024' },
      priority: 'normal',
      status: 'pending',
      createdAt: nowLabel,
    },
    {
      id: 'tq-init-3',
      toolName: 'getSystemInfo',
      workflowName: 'Hardware Baseline Check',
      args: {},
      priority: 'low',
      status: 'pending',
      createdAt: nowLabel,
    },
    {
      id: 'tq-init-4',
      toolName: 'databaseStats',
      workflowName: 'SQLite Integrity Verification',
      args: {},
      priority: 'critical',
      status: 'pending',
      createdAt: nowLabel,
    },
  ];
}

const WORKFLOW_PRESETS: Record<
  string,
  {
    label: string;
    tasks: Array<{
      toolName: string;
      workflowName: string;
      args: Record<string, any>;
      priority: TaskPriority;
    }>;
  }
> = {
  vault_audit: {
    label: 'Vault & Memory Audit (4 steps)',
    tasks: [
      {
        toolName: 'listScratchpads',
        workflowName: 'Vault & Memory Audit',
        args: {},
        priority: 'high',
      },
      {
        toolName: 'readScratchpad',
        workflowName: 'Vault & Memory Audit',
        args: { title: 'aglaia_manifesto' },
        priority: 'normal',
      },
      {
        toolName: 'databaseStats',
        workflowName: 'Vault & Memory Audit',
        args: {},
        priority: 'critical',
      },
      {
        toolName: 'compactDatabase',
        workflowName: 'Vault & Memory Audit',
        args: {},
        priority: 'low',
      },
    ],
  },
  synthesis_pipeline: {
    label: 'Knowledge Synthesis (3 steps)',
    tasks: [
      {
        toolName: 'getEleganceWisdom',
        workflowName: 'Knowledge Synthesis',
        args: {},
        priority: 'normal',
      },
      {
        toolName: 'calculateExpression',
        workflowName: 'Knowledge Synthesis',
        args: { expression: '256 * 42 + 128' },
        priority: 'high',
      },
      {
        toolName: 'writeScratchpad',
        workflowName: 'Knowledge Synthesis',
        args: {
          title: 'synthesis_digest',
          content: 'Synthesized local hardware telemetry and quantitative metrics.',
        },
        priority: 'critical',
      },
    ],
  },
};

export default function TaskQueuePanel({
  theme,
  onRefreshLogs,
  onRefreshScratchpads,
  onRefreshDatabaseStats,
  setIsThinking,
  setOrbeMaterial,
}: TaskQueuePanelProps) {
  const [tasks, setTasks] = useState<QueuedToolTask[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((t: QueuedToolTask) =>
            t.status === 'running' ? { ...t, status: 'pending' } : t
          );
        }
      }
    } catch {
      // ignore storage read issues
    }
    return createDefaultWorkflowTasks();
  });

  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>('manual');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'finished'>('all');
  const [stepDelayMs, setStepDelayMs] = useState<number>(600);
  const [isRunningQueue, setIsRunningQueue] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  // Enqueue form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newToolName, setNewToolName] = useState<string>('getSystemInfo');
  const [newWorkflowName, setNewWorkflowName] = useState<string>('Custom Agent Workflow');
  const [newPriority, setNewPriority] = useState<TaskPriority>('normal');
  const [newArgsText, setNewArgsText] = useState<string>('{}');
  const [addFormError, setAddFormError] = useState<string | null>(null);

  // Refs for safe real-time reading during async workflow runs
  const tasksRef = useRef<QueuedToolTask[]>(tasks);
  const schedulingModeRef = useRef<SchedulingMode>(schedulingMode);
  const pauseRequestedRef = useRef<boolean>(false);
  const stepDelayRef = useRef<number>(stepDelayMs);

  useEffect(() => {
    tasksRef.current = tasks;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // ignore storage quota errors
    }
  }, [tasks]);

  useEffect(() => {
    schedulingModeRef.current = schedulingMode;
  }, [schedulingMode]);

  useEffect(() => {
    stepDelayRef.current = stepDelayMs;
  }, [stepDelayMs]);

  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const runningTask = tasks.find((t) => t.status === 'running') || null;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;

  const pickNextPendingTask = (list: QueuedToolTask[], mode: SchedulingMode): QueuedToolTask | null => {
    const pending = list.filter((t) => t.status === 'pending');
    if (pending.length === 0) return null;
    if (mode === 'manual') {
      return pending[0];
    }
    return [...pending].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])[0];
  };

  const nextScheduledTask = pickNextPendingTask(tasks, schedulingMode);

  // Reordering pending tasks while preserving finished/running items' positions cleanly
  const reorderPendingTasks = (updater: (pendingList: QueuedToolTask[]) => QueuedToolTask[]) => {
    setTasks((prev) => {
      const pending = prev.filter((t) => t.status === 'pending');
      const nonPending = prev.filter((t) => t.status !== 'pending');
      const reorderedPending = updater([...pending]);
      return [...reorderedPending, ...nonPending];
    });
  };

  const handleMoveTask = (taskId: string, direction: 'up' | 'down' | 'top') => {
    reorderPendingTasks((pending) => {
      const idx = pending.findIndex((t) => t.id === taskId);
      if (idx === -1) return pending;
      if (direction === 'top' && idx > 0) {
        const [item] = pending.splice(idx, 1);
        pending.unshift(item);
      } else if (direction === 'up' && idx > 0) {
        [pending[idx - 1], pending[idx]] = [pending[idx], pending[idx - 1]];
      } else if (direction === 'down' && idx < pending.length - 1) {
        [pending[idx + 1], pending[idx]] = [pending[idx], pending[idx + 1]];
      }
      return pending;
    });
  };

  const handleDropOnTask = (targetId: string) => {
    if (!draggedTaskId || draggedTaskId === targetId) {
      setDraggedTaskId(null);
      setDragOverTaskId(null);
      return;
    }
    reorderPendingTasks((pending) => {
      const fromIdx = pending.findIndex((t) => t.id === draggedTaskId);
      const toIdx = pending.findIndex((t) => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return pending;
      const [moved] = pending.splice(fromIdx, 1);
      pending.splice(toIdx, 0, moved);
      return pending;
    });
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  const handleSortPendingByPriority = () => {
    reorderPendingTasks((pending) =>
      pending.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])
    );
  };

  const handlePriorityChange = (taskId: string, priority: TaskPriority) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId && t.status === 'pending' ? { ...t, priority } : t))
    );
  };

  const handleRemoveTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => !(t.id === taskId && t.status !== 'running')));
  };

  const handleRetryTask = (taskId: string) => {
    setTasks((prev) => {
      const target = prev.find((t) => t.id === taskId);
      if (!target) return prev;
      const resetTask: QueuedToolTask = {
        ...target,
        status: 'pending',
        error: undefined,
        result: undefined,
        durationMs: undefined,
        startedAt: undefined,
        completedAt: undefined,
      };
      const others = prev.filter((t) => t.id !== taskId);
      const pending = others.filter((t) => t.status === 'pending');
      const rest = others.filter((t) => t.status !== 'pending');
      return [...pending, resetTask, ...rest];
    });
  };

  const handleClearCompleted = () => {
    setTasks((prev) => prev.filter((t) => t.status === 'pending' || t.status === 'running'));
  };

  const handleLoadPreset = (presetKey: string) => {
    const preset = WORKFLOW_PRESETS[presetKey];
    if (!preset) return;
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const newItems: QueuedToolTask[] = preset.tasks.map((item, idx) => ({
      id: `tq-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      toolName: item.toolName,
      workflowName: item.workflowName,
      args: item.args,
      priority: item.priority,
      status: 'pending',
      createdAt: timestamp,
    }));
    setTasks((prev) => {
      const pending = prev.filter((t) => t.status === 'pending');
      const rest = prev.filter((t) => t.status !== 'pending');
      return [...pending, ...newItems, ...rest];
    });
  };

  const handleToolSelectChange = (tool: string) => {
    setNewToolName(tool);
    setNewArgsText(JSON.stringify(TOOL_DEFAULT_ARGS[tool] ?? {}, null, 2));
    setAddFormError(null);
  };

  const handleEnqueueCustomTask = (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);
    let parsedArgs: Record<string, any> = {};
    try {
      parsedArgs = newArgsText.trim() ? JSON.parse(newArgsText) : {};
      if (typeof parsedArgs !== 'object' || parsedArgs === null || Array.isArray(parsedArgs)) {
        throw new Error('Arguments must be a JSON object.');
      }
    } catch (err: any) {
      setAddFormError(err?.message || 'Invalid JSON arguments.');
      return;
    }

    const newTask: QueuedToolTask = {
      id: `tq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      toolName: newToolName,
      workflowName: newWorkflowName.trim() || 'Custom Agent Workflow',
      args: parsedArgs,
      priority: newPriority,
      status: 'pending',
      createdAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    };

    setTasks((prev) => {
      const pending = prev.filter((t) => t.status === 'pending');
      const rest = prev.filter((t) => t.status !== 'pending');
      return [...pending, newTask, ...rest];
    });
    setShowAddForm(false);
  };

  const executeSingleTask = async (task: QueuedToolTask): Promise<void> => {
    const startedAt = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: 'running', startedAt, error: undefined, result: undefined }
          : t
      )
    );
    setIsThinking(true);
    setOrbeMaterial('graphite');

    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: task.toolName,
          args: task.args,
          priority: task.priority,
          workflowName: task.workflowName,
          taskId: task.id,
        }),
      });
      const payload = await res.json();
      const completedAt = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      if (!res.ok || !payload.success) {
        setTasks((prev) => {
          const updated = prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: 'failed' as const,
                  completedAt,
                  durationMs: payload.durationMs,
                  error: payload.error || `Tool failed (HTTP ${res.status})`,
                  result: payload.result,
                }
              : t
          );
          const pending = updated.filter((t) => t.status === 'pending');
          const finished = updated.filter((t) => t.status !== 'pending');
          return [...pending, ...finished];
        });
        setOrbeMaterial('bronze');
      } else {
        setTasks((prev) => {
          const updated = prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  status: 'completed' as const,
                  completedAt,
                  durationMs: payload.durationMs,
                  result: payload.result,
                }
              : t
          );
          const pending = updated.filter((t) => t.status === 'pending');
          const finished = updated.filter((t) => t.status !== 'pending');
          return [...pending, ...finished];
        });
        setOrbeMaterial('opal');
      }

      await Promise.all([
        Promise.resolve(onRefreshLogs()),
        Promise.resolve(onRefreshScratchpads()),
        Promise.resolve(onRefreshDatabaseStats()),
      ]);
    } catch (err: any) {
      const completedAt = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: 'failed',
                completedAt,
                error: err?.message || 'Network error executing tool.',
              }
            : t
        )
      );
      setOrbeMaterial('bronze');
    } finally {
      setIsThinking(false);
    }
  };

  const handleStepNext = async () => {
    if (isRunningQueue || runningTask) return;
    const candidate = pickNextPendingTask(tasksRef.current, schedulingModeRef.current);
    if (!candidate) return;
    setIsRunningQueue(true);
    await executeSingleTask(candidate);
    setIsRunningQueue(false);
  };

  const handleRunQueue = async () => {
    if (isRunningQueue) return;
    pauseRequestedRef.current = false;
    setIsPaused(false);
    setIsRunningQueue(true);

    try {
      while (!pauseRequestedRef.current) {
        const next = pickNextPendingTask(tasksRef.current, schedulingModeRef.current);
        if (!next) break;
        await executeSingleTask(next);
        if (pauseRequestedRef.current) break;

        // Yield briefly between steps so users can inspect progress, pause, or reorder remaining steps
        const remaining = tasksRef.current.filter((t) => t.status === 'pending');
        if (remaining.length > 0 && stepDelayRef.current > 0) {
          await new Promise((resolve) => setTimeout(resolve, stepDelayRef.current));
        }
      }
    } finally {
      setIsRunningQueue(false);
      if (pauseRequestedRef.current) {
        setIsPaused(true);
      }
    }
  };

  const handlePauseQueue = () => {
    pauseRequestedRef.current = true;
    setIsPaused(true);
  };

  const visibleTasks = tasks.filter((t) => {
    if (statusFilter === 'pending') return t.status === 'pending' || t.status === 'running';
    if (statusFilter === 'finished') return t.status === 'completed' || t.status === 'failed';
    return true;
  });

  const prioritySelectClasses = (priority: TaskPriority) => {
    if (priority === 'critical') {
      return theme === 'light'
        ? 'bg-rose-50 border-rose-300 text-rose-800'
        : 'bg-rose-950/35 border-rose-500/40 text-rose-300';
    }
    if (priority === 'high') {
      return theme === 'light'
        ? 'bg-amber-50 border-amber-300 text-amber-800'
        : 'bg-amber-950/35 border-amber-500/40 text-amber-300';
    }
    if (priority === 'normal') {
      return theme === 'light'
        ? 'bg-zinc-100 border-zinc-300 text-zinc-800'
        : 'bg-slate-900 border-slate-700 text-slate-200';
    }
    return theme === 'light'
      ? 'bg-zinc-50 border-zinc-200 text-zinc-500'
      : 'bg-slate-950 border-slate-800 text-slate-400';
  };

  return (
    <section
      aria-label="Task Queue"
      className={`border rounded-xl p-5 space-y-4 transition-colors ${
        theme === 'light'
          ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
          : 'bg-slate-900/50 border-slate-800 text-slate-100'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <ListOrdered size={17} className="text-orange-500 shrink-0" />
            <h2
              className={`text-lg font-bold font-display tracking-tight ${
                theme === 'light' ? 'text-zinc-900' : 'text-slate-100'
              }`}
            >
              Task Queue
            </h2>
          </div>
          <p
            className={`text-xs leading-relaxed ${
              theme === 'light' ? 'text-zinc-600' : 'text-slate-400'
            }`}
          >
            Reorder pending agent tool calls and assign manual execution priorities for multi-step workflows.
          </p>
        </div>

        {/* Primary Execution Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isRunningQueue ? (
            <button
              type="button"
              onClick={handlePauseQueue}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Pause size={13} />
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunQueue}
              disabled={pendingTasks.length === 0}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-orange-600 hover:bg-orange-500 text-white transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Play size={13} />
              {isPaused && pendingTasks.length > 0 ? 'Resume Queue' : 'Run Queue'}
            </button>
          )}

          <button
            type="button"
            onClick={handleStepNext}
            disabled={isRunningQueue || pendingTasks.length === 0}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              theme === 'light'
                ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-800'
                : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
            title="Execute only the next queued tool call"
          >
            <SkipForward size={13} />
            Step Next
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              showAddForm
                ? 'bg-orange-600/15 border-orange-500/40 text-orange-500'
                : theme === 'light'
                ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                : 'bg-slate-950 hover:bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            <Plus size={13} />
            Enqueue Task
          </button>
        </div>
      </div>

      {/* Unboxed Queue Metadata + Scheduling Bar */}
      <div
        className={`pt-3 pb-3 border-y flex items-center justify-between gap-4 flex-wrap ${
          theme === 'light' ? 'border-zinc-200' : 'border-slate-800'
        }`}
      >
        {/* Clean unboxed summary metrics with typographic separators */}
        <div
          className={`flex items-center gap-2 text-xs font-mono tabular-nums flex-wrap ${
            theme === 'light' ? 'text-zinc-600' : 'text-slate-400'
          }`}
        >
          <span>
            <strong className={theme === 'light' ? 'text-zinc-900' : 'text-slate-100'}>
              {pendingTasks.length}
            </strong>{' '}
            pending
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="text-emerald-600 dark:text-emerald-400">{completedCount}</strong>{' '}
            completed
          </span>
          {failedCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-rose-600 dark:text-rose-400">{failedCount}</strong> failed
              </span>
            </>
          )}
          {nextScheduledTask && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[240px]">
                Next:{' '}
                <strong className="text-orange-500">{nextScheduledTask.toolName}</strong> (
                {PRIORITY_LABELS[nextScheduledTask.priority]})
              </span>
            </>
          )}
        </div>

        {/* Scheduling Policy & Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`inline-flex items-center p-0.5 rounded-lg border text-[11px] font-medium ${
              theme === 'light'
                ? 'bg-zinc-100 border-zinc-200'
                : 'bg-slate-950 border-slate-800'
            }`}
            role="group"
            aria-label="Execution scheduling order"
          >
            <button
              type="button"
              onClick={() => setSchedulingMode('manual')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                schedulingMode === 'manual'
                  ? theme === 'light'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-slate-800 text-orange-400'
                  : theme === 'light'
                  ? 'text-zinc-600 hover:text-zinc-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Execute pending tasks strictly in top-to-bottom queue order"
            >
              Manual Order
            </button>
            <button
              type="button"
              onClick={() => setSchedulingMode('priority')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                schedulingMode === 'priority'
                  ? theme === 'light'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-slate-800 text-orange-400'
                  : theme === 'light'
                  ? 'text-zinc-600 hover:text-zinc-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Execute highest manual priority tasks first, breaking ties by queue position"
            >
              Priority-First
            </button>
          </div>

          <button
            type="button"
            onClick={handleSortPendingByPriority}
            disabled={pendingTasks.length < 2}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${
              theme === 'light'
                ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
            }`}
            title="Reorder pending tasks so Critical and High priorities sit at the top"
          >
            Sort by Priority
          </button>

          <select
            aria-label="Workflow step pacing interval"
            value={stepDelayMs}
            onChange={(e) => setStepDelayMs(Number(e.target.value))}
            className={`px-2 py-1 rounded-lg border text-[11px] font-mono outline-none cursor-pointer ${
              theme === 'light'
                ? 'bg-white border-zinc-300 text-zinc-700'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
            title="Delay between consecutive tool calls so you can pause or reorder mid-workflow"
          >
            <option value={0}>Pace: Instant</option>
            <option value={600}>Pace: 600ms</option>
            <option value={1500}>Pace: 1.5s</option>
          </select>
        </div>
      </div>

      {/* Collapsible Enqueue Custom Tool Call Form */}
      {showAddForm && (
        <form
          onSubmit={handleEnqueueCustomTask}
          className={`p-4 rounded-lg border space-y-3 ${
            theme === 'light'
              ? 'bg-zinc-50 border-zinc-200'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium block opacity-80">Agent Tool</label>
              <select
                value={newToolName}
                onChange={(e) => handleToolSelectChange(e.target.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs outline-none ${
                  theme === 'light'
                    ? 'bg-white border-zinc-300 text-zinc-900'
                    : 'bg-slate-900 border-slate-700 text-slate-100'
                }`}
              >
                {AVAILABLE_TOOLS.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium block opacity-80">Workflow Label</label>
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="e.g. Nightly Maintenance"
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs outline-none ${
                  theme === 'light'
                    ? 'bg-white border-zinc-300 text-zinc-900'
                    : 'bg-slate-900 border-slate-700 text-slate-100'
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium block opacity-80">Execution Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-medium outline-none ${
                  theme === 'light'
                    ? 'bg-white border-zinc-300 text-zinc-900'
                    : 'bg-slate-900 border-slate-700 text-slate-100'
                }`}
              >
                <option value="critical">Critical (Highest)</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium block opacity-80">
              Arguments (JSON)
            </label>
            <textarea
              rows={2}
              value={newArgsText}
              onChange={(e) => setNewArgsText(e.target.value)}
              className={`w-full p-2 rounded-lg border font-mono text-xs outline-none resize-none ${
                theme === 'light'
                  ? 'bg-white border-zinc-300 text-zinc-900'
                  : 'bg-slate-900 border-slate-700 text-slate-100'
              }`}
            />
          </div>

          {addFormError && (
            <p className="text-xs text-rose-500 font-mono">{addFormError}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                theme === 'light'
                  ? 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-100'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium cursor-pointer"
            >
              Add to Queue
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs & Workflow Preset Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div
          className={`inline-flex items-center p-0.5 rounded-lg border text-xs ${
            theme === 'light'
              ? 'bg-zinc-100 border-zinc-200'
              : 'bg-slate-950 border-slate-800'
          }`}
        >
          {(['all', 'pending', 'finished'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                statusFilter === tab
                  ? theme === 'light'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-slate-800 text-slate-100'
                  : theme === 'light'
                  ? 'text-zinc-600 hover:text-zinc-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'all'
                ? `All (${tasks.length})`
                : tab === 'pending'
                ? `Pending (${pendingTasks.length + (runningTask ? 1 : 0)})`
                : `Finished (${completedCount + failedCount})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(WORKFLOW_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleLoadPreset(key)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                theme === 'light'
                  ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                  : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
              }`}
              title={`Append ${preset.label} to the pending queue`}
            >
              <Layers size={11} className="text-orange-500" />
              {preset.label}
            </button>
          ))}

          {(completedCount > 0 || failedCount > 0) && (
            <button
              type="button"
              onClick={handleClearCompleted}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                theme === 'light'
                  ? 'bg-white hover:bg-zinc-100 border-zinc-300 text-zinc-600'
                  : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Queue List */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {visibleTasks.length === 0 ? (
          <div
            className={`py-10 px-4 text-center rounded-lg border border-dashed space-y-3 ${
              theme === 'light'
                ? 'border-zinc-300 bg-zinc-50/70 text-zinc-600'
                : 'border-slate-800 bg-slate-950/40 text-slate-400'
            }`}
          >
            <p className="text-xs">
              {tasks.length === 0
                ? 'No agent tool calls are currently queued.'
                : 'No tasks match the selected status filter.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => handleLoadPreset('vault_audit')}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium cursor-pointer"
              >
                Load Audit Workflow
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white border-zinc-300 text-zinc-700'
                    : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                Enqueue Custom Task
              </button>
            </div>
          </div>
        ) : (
          visibleTasks.map((task) => {
            const pendingIdx = pendingTasks.findIndex((p) => p.id === task.id);
            const isPending = task.status === 'pending';
            const isRunning = task.status === 'running';
            const isNextToRun = nextScheduledTask?.id === task.id;
            const isExpanded = Boolean(expandedTaskIds[task.id]);
            const isDragTarget = dragOverTaskId === task.id && draggedTaskId !== task.id;

            return (
              <div
                key={task.id}
                draggable={isPending && !isRunningQueue}
                onDragStart={() => {
                  if (!isPending || isRunningQueue) return;
                  setDraggedTaskId(task.id);
                }}
                onDragOver={(e) => {
                  if (!isPending || !draggedTaskId) return;
                  e.preventDefault();
                  setDragOverTaskId(task.id);
                }}
                onDragLeave={() => {
                  if (dragOverTaskId === task.id) setDragOverTaskId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (isPending) handleDropOnTask(task.id);
                }}
                onDragEnd={() => {
                  setDraggedTaskId(null);
                  setDragOverTaskId(null);
                }}
                className={`rounded-lg border transition-colors ${
                  isDragTarget
                    ? 'border-orange-500 bg-orange-500/5'
                    : isRunning
                    ? theme === 'light'
                      ? 'border-orange-400 bg-orange-50/60'
                      : 'border-orange-500/60 bg-orange-950/20'
                    : task.status === 'failed'
                    ? theme === 'light'
                      ? 'border-rose-200 bg-rose-50/40'
                      : 'border-rose-900/50 bg-rose-950/15'
                    : theme === 'light'
                    ? 'border-zinc-200 bg-white hover:border-zinc-300'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div className="px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  {/* Left: Grip, Index, Tool & Unboxed Metadata */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {isPending ? (
                      <span
                        className={`shrink-0 ${
                          isRunningQueue ? 'opacity-30 cursor-not-allowed' : 'cursor-grab opacity-55 hover:opacity-100'
                        }`}
                        title={isRunningQueue ? 'Pause queue to drag-reorder' : 'Drag to reorder'}
                      >
                        <GripVertical size={14} />
                      </span>
                    ) : (
                      <span className="w-[14px] shrink-0 flex items-center justify-center">
                        {isRunning ? (
                          <Loader2 size={13} className="animate-spin text-orange-500" />
                        ) : task.status === 'completed' ? (
                          <CheckCircle2 size={13} className="text-emerald-500" />
                        ) : (
                          <XCircle size={13} className="text-rose-500" />
                        )}
                      </span>
                    )}

                    <span
                      className={`font-mono tabular-nums text-[11px] font-bold w-6 shrink-0 ${
                        isNextToRun
                          ? 'text-orange-500'
                          : theme === 'light'
                          ? 'text-zinc-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {isPending
                        ? String(pendingIdx + 1).padStart(2, '0')
                        : isRunning
                        ? 'RUN'
                        : '--'}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-semibold truncate">
                          {task.toolName}()
                        </span>
                        {isNextToRun && !isRunning && (
                          <span className="text-[10px] font-mono font-semibold text-orange-500 whitespace-nowrap shrink-0">
                            Next up
                          </span>
                        )}
                      </div>
                      {/* Unboxed Metadata Line */}
                      <div
                        className={`flex items-center gap-1.5 text-[11px] truncate ${
                          theme === 'light' ? 'text-zinc-500' : 'text-slate-400'
                        }`}
                      >
                        <span className="truncate">{task.workflowName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums shrink-0">
                          {task.durationMs
                            ? `${task.durationMs}ms`
                            : task.status === 'running'
                            ? 'Executing'
                            : task.status === 'completed'
                            ? 'Completed'
                            : task.status === 'failed'
                            ? 'Failed'
                            : `Queued ${task.createdAt}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Priority Selector, Reorder Controls, Expand/Remove */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPending ? (
                      <select
                        aria-label={`Execution priority for ${task.toolName}`}
                        value={task.priority}
                        onChange={(e) =>
                          handlePriorityChange(task.id, e.target.value as TaskPriority)
                        }
                        className={`px-2 py-1 rounded-md border text-[11px] font-mono font-semibold outline-none cursor-pointer ${prioritySelectClasses(
                          task.priority
                        )}`}
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="normal">Normal</option>
                        <option value="low">Low</option>
                      </select>
                    ) : (
                      <span
                        className={`text-[11px] font-mono px-1.5 ${
                          task.status === 'failed'
                            ? 'text-rose-500'
                            : task.status === 'completed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-orange-500'
                        }`}
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    )}

                    {isPending && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveTask(task.id, 'top')}
                          disabled={pendingIdx === 0}
                          aria-label={`Move ${task.toolName} to front of queue`}
                          title="Move to front"
                          className={`p-1 rounded border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            theme === 'light'
                              ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                              : 'border-slate-800 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <ArrowUpToLine size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTask(task.id, 'up')}
                          disabled={pendingIdx === 0}
                          aria-label={`Move ${task.toolName} up`}
                          title="Move up"
                          className={`p-1 rounded border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            theme === 'light'
                              ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                              : 'border-slate-800 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTask(task.id, 'down')}
                          disabled={pendingIdx === pendingTasks.length - 1}
                          aria-label={`Move ${task.toolName} down`}
                          title="Move down"
                          className={`p-1 rounded border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            theme === 'light'
                              ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                              : 'border-slate-800 hover:bg-slate-800 text-slate-300'
                          }`}
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    )}

                    {task.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryTask(task.id)}
                        aria-label={`Retry ${task.toolName}`}
                        title="Re-enqueue failed task"
                        className={`p-1 rounded border transition-colors cursor-pointer ${
                          theme === 'light'
                            ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-700'
                            : 'border-slate-800 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTaskIds((prev) => ({ ...prev, [task.id]: !prev[task.id] }))
                      }
                      aria-label={`Inspect ${task.toolName} payload`}
                      title="Inspect arguments and output"
                      className={`p-1 rounded border transition-colors cursor-pointer ${
                        theme === 'light'
                          ? 'border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                          : 'border-slate-800 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>

                    {!isRunning && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTask(task.id)}
                        aria-label={`Remove ${task.toolName} from queue`}
                        title="Remove task"
                        className={`p-1 rounded border transition-colors cursor-pointer ${
                          theme === 'light'
                            ? 'border-zinc-200 hover:bg-rose-50 hover:text-rose-600 text-zinc-500'
                            : 'border-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-500'
                        }`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expandable Payload / Result Inspector */}
                {isExpanded && (
                  <div
                    className={`px-3 pb-3 pt-2 border-t font-mono text-[11px] space-y-2 ${
                      theme === 'light'
                        ? 'border-zinc-200 bg-zinc-50 text-zinc-700'
                        : 'border-slate-800 bg-black/30 text-slate-300'
                    }`}
                  >
                    <div>
                      <span className="opacity-65 block mb-1">Arguments:</span>
                      <pre className="p-2 rounded bg-black/10 dark:bg-black/40 overflow-x-auto text-[10px]">
                        {JSON.stringify(task.args, null, 2)}
                      </pre>
                    </div>
                    {task.result !== undefined && (
                      <div>
                        <span className="text-emerald-600 dark:text-emerald-400 block mb-1">
                          Result ({task.durationMs ?? 0}ms):
                        </span>
                        <pre className="p-2 rounded bg-black/10 dark:bg-black/40 overflow-x-auto max-h-[120px] text-[10px]">
                          {typeof task.result === 'string'
                            ? task.result
                            : JSON.stringify(task.result, null, 2)}
                        </pre>
                      </div>
                    )}
                    {task.error && (
                      <p className="text-rose-500 text-[11px]">Error: {task.error}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer note on active workflow pause */}
      {isPaused && pendingTasks.length > 0 && (
        <div
          className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            theme === 'light'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-amber-950/25 border-amber-500/30 text-amber-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Clock size={13} className="shrink-0" />
            Workflow paused. Reorder remaining pending tool calls or adjust priorities, then click Resume Queue.
          </span>
        </div>
      )}
    </section>
  );
}
