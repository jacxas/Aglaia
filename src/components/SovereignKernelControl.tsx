import React, { useState, useEffect } from 'react';
import { 
  Shield, Database, Brain, Play, RefreshCw, Sliders, Search, 
  Cpu, History, CheckCircle2, AlertTriangle, Terminal, Plus, Sparkles, ChevronRight, HelpCircle, Lock, ShieldAlert, XCircle
} from 'lucide-react';
import { DesktopAgent, MemoryAgent, ReasonerEngine, ReasonerStep, SovereignEventBus, AglaiaEvent } from '../orbiter_kernel';
import { PermissionEngine, PendingPermissionRequest, PermissionPolicyConfig, PermissionPolicyOverrides, PolicyAction, RiskLevel } from '../PermissionEngine';

interface SovereignKernelControlProps {
  theme: 'light' | 'dark';
  setOrbeMaterial: (material: any) => void;
  setVramUsage: (usage: number) => void;
  setNpuUsage: (usage: number) => void;
  onAddAuditLog: (type: string, msg: string) => void;
}

export default function SovereignKernelControl({
  theme,
  setOrbeMaterial,
  setVramUsage,
  setNpuUsage,
  onAddAuditLog
}: SovereignKernelControlProps) {
  
  // 1. Initialize our virtual Sovereign Kernel Engines (persisted across renders)
  const [eventBus] = useState(() => new SovereignEventBus());
  const [desktopAgent] = useState(() => new DesktopAgent());
  const [memoryAgent] = useState(() => new MemoryAgent());
  const [permissionEngine] = useState(() => new PermissionEngine(eventBus));
  const [reasoner] = useState(() => new ReasonerEngine(eventBus, desktopAgent, memoryAgent, permissionEngine));
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingPermissionRequest | null>(null);
  const [policyConfig, setPolicyConfig] = useState<PermissionPolicyConfig>(() => permissionEngine.getPolicy());

  // 2. Tab selection: 'desktop' | 'memory' | 'reasoner'
  const [activeSubTab, setActiveSubTab] = useState<'desktop' | 'memory' | 'reasoner'>('reasoner');

  // 3. DesktopAgent UI States
  const [selectedToolId, setSelectedToolId] = useState<string>('desktop.terminal.execute');
  const [toolInputs, setToolInputs] = useState<Record<string, string>>({
    'desktop.fs.read': '{"filePath": "./package.json"}',
    'desktop.fs.write': '{"filePath": "./src/config.ts", "content": "export const VER = 1.0;"}',
    'desktop.terminal.execute': '{"command": "npm run test:security"}',
    'desktop.clipboard.interact': '{"action": "read"}'
  });
  const [desktopResult, setDesktopResult] = useState<any>(null);
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const [isDesktopRunning, setIsDesktopRunning] = useState(false);

  // 4. MemoryAgent UI States
  // Graph store states
  const [graphTriplets, setGraphTriplets] = useState(() => memoryAgent.getGraphStore());
  const [newSubject, setNewSubject] = useState('');
  const [newPredicate, setNewPredicate] = useState('');
  const [newObject, setNewObject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Vector store states
  const [vectorVault, setVectorVault] = useState(() => memoryAgent.getVectorVault());
  const [vectorSearchQuery, setVectorSearchQuery] = useState('seguridad de claves');
  const [vectorSearchResults, setVectorSearchResults] = useState<any[]>([]);
  const [newVectorText, setNewVectorText] = useState('');
  const [newVectorCategory, setNewVectorCategory] = useState('policy');

  // 5. Reasoner/Planner Loop UI States
  const [goal, setGoal] = useState('Build, run security audits, and verify private keys');
  const [reasonerQueue, setReasonerQueue] = useState<ReasonerStep[]>([]);
  const [reasonerHistory, setReasonerHistory] = useState<any[]>([]);
  const [reasonerLogs, setReasonerLogs] = useState<string[]>([
    '⚜️ Kernel v1 Reasoner cargado y en reposo.'
  ]);
  const [isLoopExecuting, setIsLoopExecuting] = useState(false);

  // Sync initial state and events
  useEffect(() => {
    // Generate initial plan for current default goal
    const initialPlan = reasoner.generatePlan(goal, 'sess-genesis');
    setReasonerQueue(initialPlan);

    // Subscribe to Event Bus to coordinate visual Orbe adjustments and PermissionEngine pauses
    const unsubCompleted = eventBus.subscribe('execution:step_completed', () => {
      setOrbeMaterial('opal');
      setVramUsage(53 + Math.floor(Math.random() * 8));
      setNpuUsage(60 + Math.floor(Math.random() * 15));
    });

    const unsubFailed = eventBus.subscribe('execution:step_failed', () => {
      setOrbeMaterial('bronze');
      setVramUsage(70);
      setNpuUsage(90);
    });

    const unsubPermRequested = eventBus.subscribe('permission:requested', (event: AglaiaEvent) => {
      if (event.type !== 'permission:requested') return;
      const pending = permissionEngine.getPendingRequests().find(
        (r) => r.requestId === event.payload.requestId
      ) || {
        requestId: event.payload.requestId || `req-${Date.now()}`,
        taskId: event.payload.taskId,
        stepIndex: event.payload.stepIndex,
        stepId: event.payload.stepId,
        toolName: event.payload.tool,
        toolId: event.payload.permission.split(':')[0] || 'TOOL',
        risk: event.payload.risk as RiskLevel,
        reason: event.payload.reason || 'Evaluación de riesgo medio o superior.',
        matchedSignals: event.payload.matchedSignals || [],
        inputPreview: event.payload.input || {},
        requestedAt: Date.now(),
      };
      setPendingConfirmation(pending);
      setOrbeMaterial('bronze');
      onAddAuditLog(
        'info',
        `⏸️ PermissionEngine: Pausa en SovereignEventBus para '${event.payload.tool}' (Riesgo: ${event.payload.risk.toUpperCase()}).`
      );
    });

    const unsubPermGranted = eventBus.subscribe('permission:granted', (event: AglaiaEvent) => {
      if (event.type !== 'permission:granted') return;
      setPendingConfirmation(null);
      setOrbeMaterial('opal');
      onAddAuditLog('tool', `🔓 PermissionEngine: Confirmación explícita concedida (${event.payload.requestId || 'bus'}).`);
    });

    const unsubPermDenied = eventBus.subscribe('permission:denied', (event: AglaiaEvent) => {
      if (event.type !== 'permission:denied') return;
      setPendingConfirmation(null);
      setOrbeMaterial('bronze');
      onAddAuditLog('error', `🚫 PermissionEngine: Ejecución denegada (${event.payload.reason}).`);
    });

    return () => {
      unsubCompleted();
      unsubFailed();
      unsubPermRequested();
      unsubPermGranted();
      unsubPermDenied();
    };
  }, []);

  // Update lists
  const refreshMemoryState = () => {
    setGraphTriplets([...memoryAgent.getGraphStore()]);
    setVectorVault([...memoryAgent.getVectorVault()]);
  };

  const handlePolicyToggle = (patch: PermissionPolicyOverrides) => {
    const updated = permissionEngine.updatePolicy(patch);
    setPolicyConfig(updated);
    onAddAuditLog('info', `Política de PermissionEngine actualizada: Critical=${updated.riskActions.critical.toUpperCase()}, BlockDestructive=${updated.blockDestructiveCommands}, BlockSecrets=${updated.blockOnSecretLeakage}`);
  };

  // Run a standalone Desktop Tool manually (intercepted by PermissionEngine)
  const runDesktopToolManually = async () => {
    setIsDesktopRunning(true);
    setDesktopResult(null);
    setDesktopError(null);
    setOrbeMaterial('graphite');
    setVramUsage(72);
    setNpuUsage(58);

    const tool = desktopAgent.listTools().find(t => t.name === selectedToolId);
    if (!tool) {
      setDesktopError('Herramienta no identificada.');
      setIsDesktopRunning(false);
      return;
    }

    try {
      const parsedInput = JSON.parse(toolInputs[selectedToolId] || '{}');
      onAddAuditLog('desktop', `Llamando manualmente a '${tool.name}'...`);

      const interception = await permissionEngine.interceptCall({
        taskId: 'task-manual',
        stepIndex: 0,
        stepId: `manual-${tool.id}`,
        tool,
        input: parsedInput,
      });

      if (!interception.allowed) {
        const msg = interception.denialReason || 'Ejecución denegada por PermissionEngine.';
        setDesktopError(`VETO DE PERMISOS (${interception.evaluation.effectiveRisk.toUpperCase()}): ${msg}`);
        setOrbeMaterial('bronze');
        return;
      }
      
      // Artificial slight delay for mechanical feel
      await new Promise(r => setTimeout(r, 450));
      const res = await tool.handler(parsedInput, {
        taskId: 'task-manual',
        workspacePath: './',
        isOnline: true,
        hasGpu: true,
        strictSovereignty: true
      });

      setDesktopResult(res);
      setOrbeMaterial('opal');
      onAddAuditLog('desktop', `✓ Herramienta '${tool.name}' culminó exitosamente.`);
    } catch (err: any) {
      setDesktopError(err.message);
      setOrbeMaterial('bronze');
      onAddAuditLog('error', `Fallo manual en herramienta '${tool.name}': ${err.message}`);
    } finally {
      setIsDesktopRunning(false);
      setVramUsage(53);
      setNpuUsage(42);
    }
  };

  // Memory Agent handlers
  const handleAddTriplet = () => {
    if (!newSubject.trim() || !newPredicate.trim() || !newObject.trim()) return;
    memoryAgent.writeTriplet(newSubject, newPredicate, newObject, 'user-input');
    setNewSubject('');
    setNewPredicate('');
    setNewObject('');
    refreshMemoryState();
    onAddAuditLog('memory', `Registrado triplet en SQLite Ledger: (${newSubject} -> ${newPredicate} -> ${newObject})`);
  };

  const handleAddVectorFact = () => {
    if (!newVectorText.trim()) return;
    memoryAgent.insertVectorFact(newVectorText, { category: newVectorCategory, timestamp: Date.now() });
    setNewVectorText('');
    refreshMemoryState();
    onAddAuditLog('memory', `Vectorizado hecho semántico localmente: "${newVectorText.substring(0, 40)}..."`);
  };

  const handleVectorSearch = () => {
    if (!vectorSearchQuery.trim()) return;
    const results = memoryAgent.queryVectorVault(vectorSearchQuery, 0.1);
    setVectorSearchResults(results);
  };

  // Reasoner Engine Loop handlers
  const handleGenerateNewPlan = () => {
    if (!goal.trim()) return;
    const newPlan = reasoner.generatePlan(goal, 'sess-user');
    setReasonerQueue(newPlan);
    setReasonerLogs(prev => [
      ...prev,
      `🔱 [PLANNER] Generado nuevo Plan IR para objetivo: "${goal}"`
    ]);
    onAddAuditLog('planner', `Re-planificado para objetivo: ${goal}`);
  };

  const handleRunNextReasonerStep = async () => {
    if (isLoopExecuting) return;
    setIsLoopExecuting(true);
    setOrbeMaterial('graphite');

    const context = {
      taskId: 'task-reasoner-run',
      workspacePath: './',
      isOnline: true,
      hasGpu: true,
      strictSovereignty: true
    };

    await reasoner.executeNextStep(
      context,
      (stepLogs) => {
        setReasonerLogs(prev => [...prev, ...stepLogs]);
      },
      (updatedQueue) => {
        setReasonerQueue([...updatedQueue]);
      }
    );

    // Update local reactive queues/histories
    setReasonerQueue([...reasoner.getQueue()]);
    setReasonerHistory([...reasoner.getHistory()]);
    setIsLoopExecuting(false);
  };

  const handleSimulateDestructiveCommand = () => {
    // Inject a critical risk failing command sequence to trigger the auto-healing re-planner!
    setGoal('Auditar terminal con secuencias destructivas (Simular Fallo)');
    const maliciousPlan: ReasonerStep[] = [
      {
        id: 'step-read-config',
        capabilityName: 'desktop.fs.read',
        input: { filePath: './package.json' },
        status: 'pending',
        correlationId: 'malicious-simulation'
      },
      {
        id: 'step-destructive-exec',
        capabilityName: 'desktop.terminal.execute',
        input: { command: 'rm -rf /var/db/aglaia' }, // triggers secure exception
        status: 'pending',
        correlationId: 'malicious-simulation'
      },
      {
        id: 'step-final-report',
        capabilityName: 'desktop.clipboard.interact',
        input: { action: 'write', payload: 'Audit Failed' },
        status: 'pending',
        correlationId: 'malicious-simulation'
      }
    ];

    // Force queue update
    reasoner.generatePlan('dummy', 'dummy'); // Clear internal
    // Override directly
    (reasoner as any).activeQueue = maliciousPlan;
    setReasonerQueue(maliciousPlan);
    setReasonerLogs(prev => [
      ...prev,
      '⚠️ [SIMULADOR] Inyectado Plan de Auditoría de Riesgo para disparar el re-planificador correctivo (Auto-Heal).'
    ]);
  };

  return (
    <div className={`border-2 rounded-2xl p-6 transition-all duration-350 space-y-6 ${
      theme === 'light' 
        ? 'bg-white border-zinc-200 shadow-md text-zinc-900' 
        : 'bg-zinc-950 border-yellow-950/45 text-slate-100 shadow-lg shadow-black/40'
    }`}>
      
      {/* Upper header */}
      <div className="flex items-center justify-between border-b pb-4 border-current/10 flex-wrap gap-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏛️</span>
          <div>
            <h3 className="font-bold font-display text-base tracking-wide uppercase flex items-center gap-1.5">
              Kernel Nivel 0 (L0) Sovereign Control Panel
              <span className="px-2 py-0.5 rounded text-[9px] font-mono border bg-yellow-650/10 text-yellow-500 border-yellow-500/20">
                SOVEREIGN ENGINE ACTIVE
              </span>
            </h3>
            <p className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>
              Ecosistema de Ejecución Local de Agentes, SQLite semántico y Re-planificador Correctivo
            </p>
          </div>
        </div>

        {/* Tab Selection buttons */}
        <div className="flex items-center gap-1 bg-black/10 dark:bg-black/30 p-1 rounded-xl border border-current/5 font-mono text-[11px]">
          <button
            onClick={() => setActiveSubTab('reasoner')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'reasoner'
                ? 'bg-yellow-600/10 text-yellow-500 border border-yellow-500/25 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-black/10'
            }`}
          >
            <Brain size={12} className={activeSubTab === 'reasoner' ? 'text-yellow-500' : 'text-slate-400'} />
            Reasoner Loop (Planners)
          </button>
          <button
            onClick={() => setActiveSubTab('desktop')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'desktop'
                ? 'bg-yellow-600/10 text-yellow-500 border border-yellow-500/25 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-black/10'
            }`}
          >
            <Cpu size={12} className={activeSubTab === 'desktop' ? 'text-yellow-500' : 'text-slate-400'} />
            DesktopAgent (Tools)
          </button>
          <button
            onClick={() => setActiveSubTab('memory')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'memory'
                ? 'bg-yellow-600/10 text-yellow-500 border border-yellow-500/25 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-black/10'
            }`}
          >
            <Database size={12} className={activeSubTab === 'memory' ? 'text-yellow-500' : 'text-slate-400'} />
            MemoryAgent (Vectors)
          </button>
        </div>
      </div>

      {/* Configurable Policy Guardrails Bar (PermissionEngine) */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs font-mono ${
          theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-zinc-900/40 border-zinc-800 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 shrink-0">
          <Shield size={13} className="text-yellow-600" />
          <span className="font-bold text-[11px]">Políticas de Bloqueo (PermissionEngine):</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <span className="opacity-75">Riesgo Critical:</span>
            <select
              value={policyConfig.riskActions.critical}
              onChange={(e) =>
                handlePolicyToggle({ riskActions: { critical: e.target.value as PolicyAction } })
              }
              className={`px-2 py-1 rounded border outline-none cursor-pointer ${
                theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-700 text-yellow-400'
              }`}
            >
              <option value="confirm">Confirmación Humana</option>
              <option value="block">Bloqueo Automático</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={policyConfig.blockDestructiveCommands}
              onChange={(e) => handlePolicyToggle({ blockDestructiveCommands: e.target.checked })}
              className="accent-yellow-600"
            />
            <span>Bloquear Comandos Destructivos</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={policyConfig.blockOnSecretLeakage}
              onChange={(e) => handlePolicyToggle({ blockOnSecretLeakage: e.target.checked })}
              className="accent-yellow-600"
            />
            <span>Bloquear Fuga de Secretos</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={policyConfig.strictLocalOnly}
              onChange={(e) => handlePolicyToggle({ strictLocalOnly: e.target.checked })}
              className="accent-yellow-600"
            />
            <span>Solo Local</span>
          </label>
        </div>
      </div>

      {/* Active SovereignEventBus Confirmation Pause Banner */}
      {pendingConfirmation && (
        <div
          className={`p-4 rounded-xl border-2 space-y-3 transition-all ${
            pendingConfirmation.risk === 'critical'
              ? 'border-rose-500/60 bg-rose-500/10'
              : pendingConfirmation.risk === 'high'
              ? 'border-amber-500/60 bg-amber-500/10'
              : 'border-yellow-500/50 bg-yellow-500/10'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-current/10 pb-2.5">
            <div className="flex items-center gap-2 font-mono text-xs font-bold">
              <Lock size={14} className="text-yellow-500 shrink-0" />
              <span>SovereignEventBus en Pausa: Confirmación Explícita Requerida</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border self-start sm:self-auto ${
                pendingConfirmation.risk === 'critical'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : pendingConfirmation.risk === 'high'
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                  : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
              }`}
            >
              Riesgo: {pendingConfirmation.risk.toUpperCase()}
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <p className="font-mono">
              Herramienta interceptada: <strong className="text-yellow-500">{pendingConfirmation.toolName}</strong>
              {pendingConfirmation.stepId ? ` · Paso: ${pendingConfirmation.stepId}` : ''}
            </p>
            <p className={`text-[11px] leading-relaxed ${theme === 'light' ? 'text-zinc-700' : 'text-slate-300'}`}>
              {pendingConfirmation.reason}
            </p>
            <pre
              className={`p-2 rounded border font-mono text-[10px] overflow-x-auto ${
                theme === 'light' ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-black/40 border-zinc-800 text-slate-300'
              }`}
            >
              {JSON.stringify(pendingConfirmation.inputPreview)}
            </pre>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                permissionEngine.denyPermission(
                  pendingConfirmation.requestId,
                  `Denegado manualmente por el usuario (Riesgo ${pendingConfirmation.risk.toUpperCase()}).`
                )
              }
              className="px-3.5 py-2 rounded-lg text-xs font-mono font-bold border border-rose-500/40 bg-rose-500/15 text-rose-500 hover:bg-rose-600 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <XCircle size={13} />
              Denegar (Veto)
            </button>
            <button
              type="button"
              onClick={() => permissionEngine.grantPermission(pendingConfirmation.requestId, 'operator')}
              className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 size={13} />
              Confirmar Ejecución
            </button>
          </div>
        </div>
      )}

      {/* Main content grid based on active tab */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* TAB 1: REASONER ENGINE (PLANNER) LOOP */}
        {activeSubTab === 'reasoner' && (
          <>
            {/* Left: Input goal & Visual steps queue (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 border-b pb-2 border-current/5">
                <Sliders size={13} className="text-yellow-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                  Soberanía de Planificación: Intenciones del Consultante
                </h4>
              </div>

              {/* Goal form input */}
              <div className="space-y-3 font-mono text-xs">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className={`flex-1 p-2.5 rounded-lg border outline-none ${
                      theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-100'
                    }`}
                    placeholder="Escriba un objetivo global para el planificador..."
                  />
                  <button
                    onClick={handleGenerateNewPlan}
                    className="px-4 py-2.5 bg-yellow-600/10 border border-yellow-500/35 text-yellow-500 font-bold rounded-lg hover:bg-yellow-600/20 cursor-pointer"
                  >
                    Planear
                  </button>
                </div>

                {/* Simulation trigger buttons */}
                <div className="flex gap-2 flex-wrap text-[10px]">
                  <button
                    onClick={() => {
                      setGoal('Auditar dependencias de vulnerabilidad (CVE)');
                      handleGenerateNewPlan();
                    }}
                    className={`px-2 py-1 rounded border hover:text-yellow-500 cursor-pointer ${
                      theme === 'light' ? 'bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-zinc-900 border-zinc-800 text-slate-400'
                    }`}
                  >
                    Plantilla: Auditar CVEs
                  </button>
                  <button
                    onClick={handleSimulateDestructiveCommand}
                    className="px-2 py-1 rounded border border-rose-500/25 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 flex items-center gap-1 cursor-pointer"
                  >
                    💥 Simular Comando Malicioso (Auto-Heal Trigger)
                  </button>
                </div>
              </div>

              {/* Dynamic Steps Queue */}
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase font-bold tracking-widest text-slate-500">
                  Plan IR Queue (Grafo de Razonamiento):
                </p>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {reasonerQueue.map((step, idx) => {
                    const stepStatusStyles = {
                      pending: 'border-zinc-800 bg-zinc-900/10 text-slate-400',
                      awaiting_confirmation: 'border-amber-500 bg-amber-500/10 text-amber-400 shadow-md ring-1 ring-amber-500/25',
                      executing: 'border-yellow-500 bg-yellow-500/10 text-yellow-500 shadow-md ring-1 ring-yellow-500/20 animate-pulse',
                      observed_success: 'border-emerald-500 bg-emerald-500/5 text-emerald-400',
                      observed_error: 'border-rose-500 bg-rose-500/5 text-rose-500',
                      replanned: 'border-amber-500 bg-amber-500/5 text-amber-500 line-through opacity-60'
                    }[step.status];

                    return (
                      <div key={step.id} className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all duration-300 ${stepStatusStyles}`}>
                        <div className="flex items-center justify-between border-b pb-1.5 border-current/5 font-mono text-[10.5px]">
                          <span className="font-bold flex items-center gap-1">
                            {step.id.includes('auto-heal') ? '🩹 [AUTO-HEAL]' : `PASO ${idx + 1}`} • {step.capabilityName}
                          </span>
                          <span className="text-[9px] uppercase tracking-wider">{step.status.replace('_', ' ')}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase">Inputs inmutables:</span>
                            <pre className="p-1 rounded bg-black/10 dark:bg-black/35 text-[9.5px] overflow-x-auto">
                              {JSON.stringify(step.input)}
                            </pre>
                          </div>
                          {step.observation && (
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase">Observación (Result):</span>
                              <pre className={`p-1 rounded bg-black/10 dark:bg-black/35 text-[9.5px] overflow-x-auto whitespace-pre-wrap ${
                                step.status === 'observed_error' ? 'text-rose-500 font-bold' : 'text-emerald-500'
                              }`}>
                                {step.observation}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Execution controllers */}
              <button
                onClick={handleRunNextReasonerStep}
                disabled={isLoopExecuting || !reasonerQueue.some(s => s.status === 'pending')}
                className={`w-full py-3 rounded-xl font-mono text-xs font-bold tracking-widest uppercase cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  isLoopExecuting || !reasonerQueue.some(s => s.status === 'pending')
                    ? 'bg-zinc-800 border border-zinc-700 text-zinc-550 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-yellow-750 to-amber-700 text-white hover:from-yellow-700 hover:to-amber-600 shadow-md border border-yellow-500/10'
                }`}
              >
                <Play size={12} className={isLoopExecuting ? 'animate-spin' : ''} />
                {isLoopExecuting ? 'Ejecutando Cómputo...' : 'Correr Próximo Paso del Reasoner'}
              </button>
            </div>

            {/* Right: Loop feedback logs & Dynamic explanation (5 cols) */}
            <div className="lg:col-span-5 space-y-4 font-mono">
              <div className="flex items-center gap-2 border-b pb-2 border-current/5">
                <Terminal size={13} className="text-yellow-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Bucle Cognitivo (Observation Logs)
                </h4>
              </div>

              {/* Logs terminal box */}
              <div className={`p-4 rounded-xl border h-[340px] overflow-y-auto space-y-3 shadow-inner ${
                theme === 'light' ? 'bg-zinc-950 text-zinc-300 border-zinc-200' : 'bg-black/55 text-zinc-400 border-zinc-900'
              }`}>
                {reasonerLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-1.5 items-start text-[10.5px] leading-relaxed">
                    <span className="text-yellow-600 select-none">&gt;</span>
                    <p className="whitespace-pre-wrap">{log}</p>
                  </div>
                ))}
              </div>

              {/* Didactic explanation of Planner loop */}
              <div className={`p-4 rounded-xl border space-y-2 text-[11px] ${
                theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/35 border-zinc-900'
              }`}>
                <p className="font-bold uppercase text-yellow-600 flex items-center gap-1 text-[10px]">
                  <HelpCircle size={11} /> ¿Cómo funciona el auto-healing?
                </p>
                <p className="opacity-95 leading-relaxed text-slate-400">
                  Si un comando o paso operacional falla, el motor captura la <strong>observación de error</strong>, inscribe el fallo en la memoria SQLite semántica, y **altera dinámicamente el plan restante**, inyectando pasos curativos en tiempo real sin reiniciar el proceso.
                </p>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: DESKTOP AGENT (MANUAL TOOL INTERACTION) */}
        {activeSubTab === 'desktop' && (
          <>
            {/* Left: Choose and configure tool (6 cols) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center gap-2 border-b pb-2 border-current/5">
                <Cpu size={13} className="text-yellow-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                  Llamada Manual de Herramientas (Local Sandbox)
                </h4>
              </div>

              {/* Select Tool dropdown */}
              <div className="space-y-4 font-mono text-xs">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-500 uppercase">Seleccione Herramienta Registrada:</label>
                  <select
                    value={selectedToolId}
                    onChange={(e) => setSelectedToolId(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border outline-none ${
                      theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    {desktopAgent.listTools().map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.id})</option>
                    ))}
                  </select>
                </div>

                {/* Input arguments text area */}
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-500 uppercase">Argumentos de Entrada (Strict JSON):</label>
                  <textarea
                    rows={4}
                    value={toolInputs[selectedToolId]}
                    onChange={(e) => {
                      const text = e.target.value;
                      setToolInputs(prev => ({ ...prev, [selectedToolId]: text }));
                    }}
                    className={`w-full p-2.5 rounded-lg border outline-none font-mono text-xs ${
                      theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}
                  />
                </div>

                {/* Play button */}
                <button
                  onClick={runDesktopToolManually}
                  disabled={isDesktopRunning}
                  className="w-full py-2.5 bg-yellow-650/15 border border-yellow-500/35 text-yellow-500 font-bold rounded-lg hover:bg-yellow-650/25 cursor-pointer text-xs"
                >
                  {isDesktopRunning ? 'Invocando Sandbox...' : 'Ejecutar en Sandbox'}
                </button>
              </div>
            </div>

            {/* Right: Execution outputs (6 cols) */}
            <div className="lg:col-span-6 space-y-4 font-mono">
              <div className="flex items-center gap-2 border-b pb-2 border-current/5">
                <Terminal size={13} className="text-yellow-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Salida de la Ejecución (Observation Pipeline)
                </h4>
              </div>

              {/* Terminal display */}
              <div className={`p-4 rounded-xl border h-[240px] overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner text-xs ${
                theme === 'light' ? 'bg-zinc-950 text-zinc-300 border-zinc-200' : 'bg-black/55 text-zinc-400 border-zinc-900'
              }`}>
                {desktopResult && (
                  <div className="space-y-2">
                    <p className="text-emerald-500 font-bold uppercase text-[9.5px] tracking-wider">&gt;&gt; OBSERVACIÓN EXITOSA DE LA HERRAMIENTA</p>
                    <pre className="p-2 bg-black/40 rounded text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      {JSON.stringify(desktopResult, null, 2)}
                    </pre>
                  </div>
                )}
                {desktopError && (
                  <div className="space-y-2">
                    <p className="text-rose-500 font-bold uppercase text-[9.5px] tracking-wider animate-pulse">&gt;&gt; VETO / EXCEPCIÓN DEL COVENANT</p>
                    <p className="text-rose-400 font-mono text-[11px] bg-rose-950/15 p-2 rounded border border-rose-500/25">
                      {desktopError}
                    </p>
                  </div>
                )}
                {!desktopResult && !desktopError && (
                  <span className="text-slate-500 italic">Esperando instrucción del Sandbox...</span>
                )}
              </div>

              {/* Manifest specifics of active tool */}
              {selectedToolId && (
                <div className={`p-3.5 rounded-xl border space-y-2 text-[10.5px] ${
                  theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/35 border-zinc-900'
                }`}>
                  <p className="font-bold text-slate-400">Detalles de Seguridad:</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-500">
                    <p>Dominio: <span className="text-slate-300">desktop</span></p>
                    <p>Nivel de Riesgo: <span className="text-yellow-500 font-bold">
                      {desktopAgent.listTools().find(t => t.name === selectedToolId)?.risk.toUpperCase()}
                    </span></p>
                    <p>Soberanía: <span className="text-emerald-500">Local Hermética</span></p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 3: MEMORY AGENT (SQLITE & LOCAL VECTOR VAULT) */}
        {activeSubTab === 'memory' && (
          <>
            {/* Left: SQLite Knowledge graph ledger (6 cols) */}
            <div className="lg:col-span-6 space-y-4 font-mono text-xs">
              <div className="flex items-center gap-2 border-b pb-2 border-current/5">
                <Database size={13} className="text-yellow-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Ledger SQLite Virtual (Knowledge Triplets)
                </h4>
              </div>

              {/* Insert triplet form */}
              <div className="p-3.5 rounded-xl border border-current/5 bg-black/5 dark:bg-black/25 space-y-3">
                <p className="text-[10px] uppercase font-bold text-yellow-500">Inscribir Nuevo Codicilo de Conocimiento (Sujeto, Predicado, Objeto)</p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Sujeto"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className={`p-1.5 rounded border text-[11px] outline-none ${
                      theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-100'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Predicado"
                    value={newPredicate}
                    onChange={(e) => setNewPredicate(e.target.value)}
                    className={`p-1.5 rounded border text-[11px] outline-none ${
                      theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-100'
                    }`}
                  />
                  <input
                    type="text"
                    placeholder="Objeto"
                    value={newObject}
                    onChange={(e) => setNewObject(e.target.value)}
                    className={`p-1.5 rounded border text-[11px] outline-none ${
                      theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-100'
                    }`}
                  />
                </div>
                <button
                  onClick={handleAddTriplet}
                  className="w-full py-1.5 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 font-bold rounded border border-yellow-500/25 cursor-pointer text-[10px]"
                >
                  Inscribir Relación Semántica
                </button>
              </div>

              {/* Triplets list query */}
              <div className="space-y-2">
                <div className="flex gap-2 items-center">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Ledger Registrado:</p>
                  <input
                    type="text"
                    placeholder="Filtrar por Sujeto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`p-1 rounded border text-[10px] outline-none ${
                      theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  />
                </div>

                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {memoryAgent.queryGraph(searchQuery).map((t, idx) => (
                    <div key={idx} className="p-2 rounded border border-current/5 bg-black/10 dark:bg-black/25 flex justify-between items-center text-[10.5px]">
                      <span>
                        <strong className="text-yellow-600 dark:text-yellow-500">{t.subject}</strong>
                        <span className="text-slate-500"> → {t.predicate} → </span>
                        <strong className="text-slate-300">{t.object}</strong>
                      </span>
                      <span className="text-[8.5px] text-slate-500 font-mono">Corr: {t.correlationId}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Local semantic vector space matching (6 cols) */}
            <div className="lg:col-span-6 space-y-4 font-mono text-xs">
              <div className="flex items-center gap-2 border-b pb-2 border-current/5">
                <Sparkles size={13} className="text-yellow-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Bóveda de Vectores Locales (Embeddings & Distancias Cosinas)
                </h4>
              </div>

              {/* Add Vector fact */}
              <div className="p-3.5 rounded-xl border border-current/5 bg-black/5 dark:bg-black/25 space-y-3">
                <p className="text-[10px] uppercase font-bold text-yellow-500">Indexar Nuevo Hecho Directo (Vectorización local)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escriba un hecho semántico complejo..."
                    value={newVectorText}
                    onChange={(e) => setNewVectorText(e.target.value)}
                    className={`flex-1 p-1.5 rounded border text-[11px] outline-none ${
                      theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-100'
                    }`}
                  />
                  <select
                    value={newVectorCategory}
                    onChange={(e) => setNewVectorCategory(e.target.value)}
                    className={`p-1 rounded border text-[10px] outline-none ${
                      theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-200'
                    }`}
                  >
                    <option value="policy">Policy</option>
                    <option value="hardware">Hardware</option>
                    <option value="security">Security</option>
                  </select>
                </div>
                <button
                  onClick={handleAddVectorFact}
                  className="w-full py-1.5 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 font-bold rounded border border-yellow-500/25 cursor-pointer text-[10px]"
                >
                  Generar Vector L2 y Almacenar
                </button>
              </div>

              {/* Vector Query & distance calculation results */}
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[9.5px] font-bold text-slate-500 uppercase block">Consultar similitud en espacio de embeddings local:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={vectorSearchQuery}
                      onChange={(e) => setVectorSearchQuery(e.target.value)}
                      className={`flex-1 p-2 rounded border text-xs outline-none ${
                        theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-200'
                      }`}
                      placeholder="Buscar por afinidad conceptual..."
                    />
                    <button
                      onClick={handleVectorSearch}
                      className="px-3 py-2 bg-yellow-650/15 border border-yellow-500/35 text-yellow-500 font-bold rounded-lg hover:bg-yellow-650/25 cursor-pointer text-xs flex items-center gap-1"
                    >
                      <Search size={12} /> Buscar
                    </button>
                  </div>
                </div>

                {/* Results display */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Hechos afines encontrados (Similitud Cosina):</p>
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {vectorSearchResults.length === 0 ? (
                      <span className="text-slate-500 italic text-[11px]">Haga clic en Buscar para analizar afinidad de vectores...</span>
                    ) : (
                      vectorSearchResults.map((res, idx) => (
                        <div key={idx} className="p-2.5 rounded border border-emerald-500/10 bg-emerald-500/5 text-slate-300 flex justify-between items-center gap-4 text-[10.5px]">
                          <p className="leading-relaxed">"{res.text}"</p>
                          <div className="text-right shrink-0">
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              {(res.similarity * 100).toFixed(1)}% Match
                            </span>
                            <span className="block text-[8px] text-slate-500 uppercase mt-1">Cat: {res.metadata.category}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

      </div>

    </div>
  );
}
