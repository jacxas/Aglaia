import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, GitBranch, Layers, Shield, Key, Lock, Unlock, Play, RotateCcw, 
  Settings, Terminal, FileText, CheckCircle2, AlertTriangle, AlertOctagon, 
  Database, Info, ListFilter, Share2, HelpCircle, ArrowRight, Activity, 
  Workflow, Zap, BookOpen, Fingerprint, Eye, EyeOff
} from 'lucide-react';
import { OrbeMaterial } from './VisualOrbe';

interface MicrokernelVisualizerProps {
  theme: 'light' | 'dark';
  setOrbeMaterial: (material: OrbeMaterial) => void;
  setVramUsage: (usage: number) => void;
  setNpuUsage: (usage: number) => void;
  setIsThinking: (thinking: boolean) => void;
  onAddAuditLog: (type: 'info' | 'tool' | 'error' | 'planner', message: string) => void;
}

// 1. Definition of Plan IR, Capabilities and Providers
export interface PlanIRNode {
  id: string;
  capabilityId: string;
  capabilityName: string;
  dependsOn: string[];
  input: Record<string, any>;
  cost: {
    tokens: number;
    latencyMs: number;
    estimatedMemoryMb: number;
  };
  sensitivity: 'PUBLIC' | 'INTERNAL' | 'PRIVATE' | 'SECRET' | 'CRITICAL';
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'idle' | 'running' | 'completed' | 'blocked' | 'skipped';
  resolvedProvider?: string;
  correlationId: string;
}

export interface PlanIR {
  version: number;
  goal: string;
  sessionId: string;
  planId: string;
  nodes: PlanIRNode[];
}

export interface CapabilityRegistryEntry {
  id: string;
  name: string;
  description: string;
  allowedProviders: string[];
  defaultProvider: string;
}

export interface ProviderRegistryEntry {
  id: string;
  name: string;
  context: 'local' | 'remote';
  description: string;
  systemRequirements: string[];
}

// Pre-configured Presets for the Plan IR
const PLAN_PRESETS: { name: string; description: string; plan: PlanIR }[] = [
  {
    name: "Auditoría Híbrida de Seguridad",
    description: "Analiza el repositorio local, busca CVEs públicos en la red y aplica un parche hermético.",
    plan: {
      version: 1,
      goal: "Auditar vulnerabilidad y parchear repositorio local",
      sessionId: "sess-889-aglaia-os",
      planId: "plan-cve-001",
      nodes: [
        {
          id: "read-package-json",
          capabilityId: "CAP-001", // Filesystem Read
          capabilityName: "filesystem.read",
          dependsOn: [],
          input: { path: "./package.json" },
          cost: { tokens: 120, latencyMs: 300, estimatedMemoryMb: 5 },
          sensitivity: "PRIVATE",
          risk: "LOW",
          status: "idle",
          correlationId: "corr-889-001"
        },
        {
          id: "scan-env-secrets",
          capabilityId: "CAP-002", // Security Scanner
          capabilityName: "security.scan",
          dependsOn: [],
          input: { path: "./.env" },
          cost: { tokens: 250, latencyMs: 450, estimatedMemoryMb: 8 },
          sensitivity: "CRITICAL",
          risk: "LOW",
          status: "idle",
          correlationId: "corr-889-002"
        },
        {
          id: "search-known-cve",
          capabilityId: "CAP-003", // Internet Web Search
          capabilityName: "internet.search",
          dependsOn: ["read-package-json"],
          input: { query: "CVE vulnerability react-router stable patches" },
          cost: { tokens: 1800, latencyMs: 1200, estimatedMemoryMb: 25 },
          sensitivity: "PUBLIC",
          risk: "MEDIUM",
          status: "idle",
          correlationId: "corr-889-003"
        },
        {
          id: "apply-secure-patch",
          capabilityId: "CAP-004", // Filesystem Write / Refactor
          capabilityName: "filesystem.write",
          dependsOn: ["search-known-cve", "scan-env-secrets"],
          input: { path: "./src/routes.tsx", content: "// Patch applied securely" },
          cost: { tokens: 4500, latencyMs: 1800, estimatedMemoryMb: 45 },
          sensitivity: "SECRET",
          risk: "HIGH",
          status: "idle",
          correlationId: "corr-889-004"
        }
      ]
    }
  },
  {
    name: "Codicilos Herméticos SQLite",
    description: "Inspecciona el diagnóstico de hardware local, escribe en el Memory Vault y calcula embeddings.",
    plan: {
      version: 1,
      goal: "Diagnosticar e inscribir codicilo cifrado local",
      sessionId: "sess-890-aglaia-os",
      planId: "plan-sqlite-002",
      nodes: [
        {
          id: "get-system-load",
          capabilityId: "CAP-005", // System Diagnostics
          capabilityName: "system.diagnostics",
          dependsOn: [],
          input: { target: "npu_vram_load" },
          cost: { tokens: 80, latencyMs: 200, estimatedMemoryMb: 12 },
          sensitivity: "INTERNAL",
          risk: "LOW",
          status: "idle",
          correlationId: "corr-890-001"
        },
        {
          id: "generate-local-embeddings",
          capabilityId: "CAP-006", // Vector Builder
          capabilityName: "vector.embeddings",
          dependsOn: ["get-system-load"],
          input: { text: "Diagnóstico favorable del host" },
          cost: { tokens: 600, latencyMs: 800, estimatedMemoryMb: 120 },
          sensitivity: "INTERNAL",
          risk: "LOW",
          status: "idle",
          correlationId: "corr-890-002"
        },
        {
          id: "write-vault-codicil",
          capabilityId: "CAP-007", // Vault Storage
          capabilityName: "vault.write",
          dependsOn: ["generate-local-embeddings"],
          input: { title: "hardware_diagnosis_log", value: "system: ok" },
          cost: { tokens: 400, latencyMs: 350, estimatedMemoryMb: 4 },
          sensitivity: "SECRET",
          risk: "MEDIUM",
          status: "idle",
          correlationId: "corr-890-003"
        }
      ]
    }
  },
  {
    name: "Clausura Estricta de Frontera",
    description: "Prueba el veto absoluto cuando se intenta subir código propietario con secretos detectados.",
    plan: {
      version: 1,
      goal: "Verificar contención antifugas de seguridad",
      sessionId: "sess-891-aglaia-os",
      planId: "plan-leak-test",
      nodes: [
        {
          id: "read-secrets-file",
          capabilityId: "CAP-001",
          capabilityName: "filesystem.read",
          dependsOn: [],
          input: { path: "secrets.json" },
          cost: { tokens: 100, latencyMs: 250, estimatedMemoryMb: 4 },
          sensitivity: "CRITICAL",
          risk: "LOW",
          status: "idle",
          correlationId: "corr-891-001"
        },
        {
          id: "export-source-code",
          capabilityId: "CAP-008", // External API call
          capabilityName: "external.api.post",
          dependsOn: ["read-secrets-file"],
          input: { payload: { stripe: "sk_live_51NABC123456789" } },
          cost: { tokens: 1500, latencyMs: 1400, estimatedMemoryMb: 18 },
          sensitivity: "CRITICAL",
          risk: "CRITICAL",
          status: "idle",
          correlationId: "corr-891-002"
        }
      ]
    }
  }
];

const CAPABILITY_REGISTRY: CapabilityRegistryEntry[] = [
  { id: "CAP-001", name: "filesystem.read", description: "Lectura de archivos físicos locales.", allowedProviders: ["NodeJS_FS", "Rust_FS"], defaultProvider: "NodeJS_FS" },
  { id: "CAP-002", name: "security.scan", description: "Búsqueda activa de credenciales o secretos.", allowedProviders: ["SovereignScan_v1"], defaultProvider: "SovereignScan_v1" },
  { id: "CAP-003", name: "internet.search", description: "Búsquedas públicas en la red exterior.", allowedProviders: ["Google_Search_API", "Playwright_Browser"], defaultProvider: "Google_Search_API" },
  { id: "CAP-004", name: "filesystem.write", description: "Modificación persistente de archivos en el host.", allowedProviders: ["NodeJS_FS"], defaultProvider: "NodeJS_FS" },
  { id: "CAP-005", name: "system.diagnostics", description: "Lectura de sensores físicos y recursos de GPU.", allowedProviders: ["SystemStats_Native"], defaultProvider: "SystemStats_Native" },
  { id: "CAP-006", name: "vector.embeddings", description: "Cálculo matemático de vectores locales.", allowedProviders: ["ONNX_SLM_Local", "Gemini_Embeddings"], defaultProvider: "ONNX_SLM_Local" },
  { id: "CAP-007", name: "vault.write", description: "Inscripción en la base de datos SQLite.", allowedProviders: ["SQLite_Memory_Vault"], defaultProvider: "SQLite_Memory_Vault" },
  { id: "CAP-008", name: "external.api.post", description: "Transmisión de datos mediante HTTPS POST.", allowedProviders: ["Axios_Network_Client"], defaultProvider: "Axios_Network_Client" }
];

const PROVIDER_REGISTRY: ProviderRegistryEntry[] = [
  { id: "NodeJS_FS", name: "NodeJS FileSystem Driver", context: "local", description: "Manipulador de archivos nativo basado en API Node 'fs/promises'.", systemRequirements: ["Node.js >= 18"] },
  { id: "Rust_FS", name: "Rust Sovereign FS Engine", context: "local", description: "Acceso ultrarrápido y seguro compilado en WebAssembly/Rust.", systemRequirements: ["WasmRuntime >= 1.0"] },
  { id: "SovereignScan_v1", name: "Aglaia Hermetic Regex Scanner", context: "local", description: "Motor de análisis de expresiones regulares locales libre de red.", systemRequirements: [] },
  { id: "Google_Search_API", name: "Google Serper Cloud API", context: "remote", description: "Enlace remoto para buscar documentación en el mundo celestial.", systemRequirements: ["Internet Access", "API_KEY"] },
  { id: "Playwright_Browser", name: "Playwright Headless Chrome", context: "remote", description: "Instancia de navegador para escrapear sitios sin API oficial.", systemRequirements: ["Playwright Binaries"] },
  { id: "SystemStats_Native", name: "SysInfo Native Bridge", context: "local", description: "Consulta de telemetría física de NPU, VRAM y CPU.", systemRequirements: [] },
  { id: "ONNX_SLM_Local", name: "ONNX Local MiniLM-L6 Embedder", context: "local", description: "Modelo local para vectores corriendo enteramente en la GPU local.", systemRequirements: ["GPU with WebGPU Support"] },
  { id: "Gemini_Embeddings", name: "Google Gemini Embeddings Engine", context: "remote", description: "API de Google para embeddings semánticos avanzados de alta calidad.", systemRequirements: ["Gemini Cloud Access"] },
  { id: "SQLite_Memory_Vault", name: "SQLite In-Memory Sovereign Vault", context: "local", description: "Persistencia cifrada y hermética en memoria SQLite.", systemRequirements: [] },
  { id: "Axios_Network_Client", name: "Sovereign HTTPS Network Client", context: "remote", description: "Lanzador de peticiones HTTP encriptadas con ofuscación activa.", systemRequirements: ["Internet Access"] }
];

export default function MicrokernelVisualizer({
  theme,
  setOrbeMaterial,
  setVramUsage,
  setNpuUsage,
  setIsThinking,
  onAddAuditLog
}: MicrokernelVisualizerProps) {
  // Preset Selection
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  
  // Current Plan IR Live State
  const [currentPlan, setCurrentPlan] = useState<PlanIR>(PLAN_PRESETS[0].plan);
  
  // Pipeline settings overrides
  const [isOnline, setIsOnline] = useState(true);
  const [hasGpu, setHasGpu] = useState(true);
  const [strictEUSovereignty, setStrictEUSovereignty] = useState(true);
  const [covenantDataPolicy, setCovenantDataPolicy] = useState<'local_only' | 'hybrid' | 'unrestricted'>('hybrid');

  // JSON View Toggle
  const [showPlanJson, setShowPlanJson] = useState(false);

  // Simulation Running State
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [simulatedLogs, setSimulatedLogs] = useState<{ id: string; msg: string; type: 'info' | 'success' | 'warn' | 'error' }[]>([]);
  const [currentCostMetrics, setCurrentCostMetrics] = useState({
    totalTokens: 0,
    elapsedLatencyMs: 0,
    peakMemoryMb: 0
  });

  // Load preset plan when changed
  useEffect(() => {
    setCurrentPlan(JSON.parse(JSON.stringify(PLAN_PRESETS[selectedPresetIndex].plan)));
    setSimulatedLogs([]);
    setCurrentCostMetrics({ totalTokens: 0, elapsedLatencyMs: 0, peakMemoryMb: 0 });
    setIsSimulating(false);
    setActiveNodeId(null);
  }, [selectedPresetIndex]);

  // Decoupled Resolver Logic (maps Plan IR Capability to Provider based on criteria)
  const resolveCapability = (capabilityName: string, sensitivity: string, risk: string): { provider: ProviderRegistryEntry; context: 'local' | 'remote' | 'blocked'; reason: string } => {
    const registryEntry = CAPABILITY_REGISTRY.find(c => c.name === capabilityName);
    if (!registryEntry) {
      // Unresolved
      return {
        provider: PROVIDER_REGISTRY[0],
        context: 'blocked',
        reason: `La capacidad '${capabilityName}' no existe en la Constitución de Aglaia OS.`
      };
    }

    // High sensitivity / risk checks
    const containsSecrets = sensitivity === 'SECRET' || sensitivity === 'CRITICAL';
    const isCriticalRisk = risk === 'CRITICAL' || risk === 'HIGH';

    // Rule: VETO if Secrets are detected under Strict Local Only policy
    if (containsSecrets && covenantDataPolicy === 'local_only' && capabilityName === 'external.api.post') {
      return {
        provider: PROVIDER_REGISTRY.find(p => p.id === 'Axios_Network_Client')!,
        context: 'blocked',
        reason: "VETO: Intento de transferir información de nivel CRITICAL a red exterior bajo directiva Local Only."
      };
    }

    // Default resolver behavior based on rules
    const allowedProviders = registryEntry.allowedProviders.map(id => PROVIDER_REGISTRY.find(p => p.id === id)!);
    
    // Choose local provider if secrets are involved or if offline
    if (containsSecrets || !isOnline) {
      const localProvider = allowedProviders.find(p => p.context === 'local');
      if (localProvider) {
        return {
          provider: localProvider,
          context: 'local',
          reason: `Derivado a '${localProvider.name}' de forma obligatoria por la presencia de datos '${sensitivity}'.`
        };
      } else {
        return {
          provider: allowedProviders[0],
          context: 'blocked',
          reason: `VETO: Se requiere '${capabilityName}' pero no existe implementación de hardware local segura.`
        };
      }
    }

    // Resource constraint: ONNX local vector requires GPU
    if (capabilityName === 'vector.embeddings') {
      if (!hasGpu) {
        const remoteEmbedder = PROVIDER_REGISTRY.find(p => p.id === 'Gemini_Embeddings')!;
        return {
          provider: remoteEmbedder,
          context: 'remote',
          reason: "Delegado a Gemini Embeddings por ausencia de procesador gráfico (GPU) local para ONNX."
        };
      } else {
        const localEmbedder = PROVIDER_REGISTRY.find(p => p.id === 'ONNX_SLM_Local')!;
        return {
          provider: localEmbedder,
          context: 'local',
          reason: "Resuelto a ONNX Local gracias a la disponibilidad de chip de GPU en el terminal del consultante."
        };
      }
    }

    // Default mapping (usually local if available, else remote)
    const preferredProviderId = registryEntry.defaultProvider;
    const preferredProvider = PROVIDER_REGISTRY.find(p => p.id === preferredProviderId)!;

    return {
      provider: preferredProvider,
      context: preferredProvider.context,
      reason: `Asignado por preferencia predeterminada del manifesto de Aglaia OS.`
    };
  };

  // Run the DAG execution step-by-step
  const runSovereignDAG = async () => {
    if (isSimulating) return;

    setIsSimulating(true);
    setSimulatedLogs([]);
    setIsThinking(true);
    setOrbeMaterial('graphite');

    const updatedPlan = { ...currentPlan };
    // Reset all nodes status
    updatedPlan.nodes.forEach(n => n.status = 'idle');
    setCurrentPlan(updatedPlan);

    let activeTokens = 0;
    let activeLatency = 0;
    let peakMem = 0;

    const logMsg = (msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
      setSimulatedLogs(prev => [...prev, { id: Math.random().toString(), msg, type }]);
    };

    logMsg(`🔱 INICIANDO MICROKERNEL KERNEL-v1 [Plan ID: ${currentPlan.planId}]`, 'info');
    logMsg(`↳ Session: ${currentPlan.sessionId} • Goal: "${currentPlan.goal}"`, 'info');
    onAddAuditLog('planner', `Iniciado Microkernel con Plan IR '${currentPlan.planId}' de forma asíncrona.`);

    // Simple queue parser respecting dependencies (dependsOn)
    const completedNodeIds: string[] = [];
    let cycleLimit = 20;

    while (completedNodeIds.length < updatedPlan.nodes.length && cycleLimit > 0) {
      cycleLimit--;
      
      // Find nodes that have all dependencies satisfied and are idle
      const readyNodes = updatedPlan.nodes.filter(node => 
        node.status === 'idle' && 
        node.dependsOn.every(depId => completedNodeIds.includes(depId))
      );

      if (readyNodes.length === 0) {
        // If there are nodes left but none are ready, we might have a dead end or blocking rule
        const blockedNodes = updatedPlan.nodes.filter(n => n.status === 'idle');
        if (blockedNodes.length > 0) {
          blockedNodes.forEach(node => {
            node.status = 'blocked';
            logMsg(`🚫 Veto/Bloqueo detectado en '${node.id}': Dependencias insatisfechas o cortadas.`, 'error');
          });
          setOrbeMaterial('bronze');
          break;
        }
        break;
      }

      // Simulate parallel processing block if multiple ready nodes exist
      const promises = readyNodes.map(async (node) => {
        // 1. Resolve capability to specific provider based on our decoupled registries
        const resolution = resolveCapability(node.capabilityName, node.sensitivity, node.risk);
        node.resolvedProvider = resolution.provider.name;

        if (resolution.context === 'blocked') {
          node.status = 'blocked';
          logMsg(`🚫 [CORRELATION: ${node.correlationId}] VETO DE SEGURIDAD EN NODO [${node.id}]: ${resolution.reason}`, 'error');
          onAddAuditLog('error', `VETO: El nodo ${node.id} violó los lineamientos de soberanía locales.`);
          setOrbeMaterial('bronze');
          throw new Error("Veto triggered");
        }

        // Run node
        node.status = 'running';
        setActiveNodeId(node.id);
        
        // Mutate Orbe state depending on the resolved step context
        if (resolution.context === 'local') {
          setOrbeMaterial('graphite');
          setVramUsage(75 + Math.floor(Math.random() * 15));
          setNpuUsage(80 + Math.floor(Math.random() * 12));
        } else {
          setOrbeMaterial('gold_liquid');
          setVramUsage(42 + Math.floor(Math.random() * 8));
          setNpuUsage(30 + Math.floor(Math.random() * 8));
        }

        logMsg(`⚙️ [${resolution.context.toUpperCase()}] Ejecutando nodo '${node.id}' vía provider '${resolution.provider.id}' [Riesgo: ${node.risk} | Sensibilidad: ${node.sensitivity}]`, 'info');
        logMsg(`↳ Motivo: ${resolution.reason}`, 'info');

        // Simulate execution delay
        await new Promise(r => setTimeout(r, node.cost.latencyMs));

        // Update local costs
        activeTokens += node.cost.tokens;
        activeLatency += node.cost.latencyMs;
        peakMem = Math.max(peakMem, node.cost.estimatedMemoryMb);
        setCurrentCostMetrics({
          totalTokens: activeTokens,
          elapsedLatencyMs: activeLatency,
          peakMemoryMb: peakMem
        });

        node.status = 'completed';
        completedNodeIds.push(node.id);
        logMsg(`✓ Nodo '${node.id}' completado exitosamente en ${node.cost.latencyMs}ms.`, 'success');
        
        // Push immutable log to database SQLite
        await fetch('/api/orbiter/simulate-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: {
              index: updatedPlan.nodes.indexOf(node) + 1,
              tool: resolution.provider.id,
              action: node.capabilityName,
              queryOrParams: `Correlation: ${node.correlationId}`,
              executionContext: resolution.context,
              decisionReason: resolution.reason
            },
            userContext: { forceLocal: false, forceRemote: false, isOnline, hasGpu, dataPolicy: covenantDataPolicy, restrictToEu: strictEUSovereignty }
          })
        });
      });

      try {
        await Promise.all(promises);
      } catch (err) {
        logMsg("⚠️ LA COREOGRAFÍA DEL PLAN HA SIDO SUSPENDIDA DEBIDO A UN VETO DE SEGURIDAD INTERNO.", 'error');
        setOrbeMaterial('bronze');
        break;
      }

      // Trigger re-render of nodes state
      setCurrentPlan({ ...updatedPlan });
    }

    if (updatedPlan.nodes.every(n => n.status === 'completed')) {
      logMsg("⚜️ COREOGRAFÍA COMPLETADA CON EQUILIBRIO IRIDISCENTE.", 'success');
      setOrbeMaterial('opal');
      onAddAuditLog('tool', `Ejecución de Plan IR '${currentPlan.planId}' culminada en éxito total.`);
    }

    setIsThinking(false);
    setIsSimulating(false);
    setActiveNodeId(null);
  };

  return (
    <div className={`border-2 rounded-2xl p-6 transition-all duration-350 space-y-6 ${
      theme === 'light' 
        ? 'bg-white border-zinc-200 shadow-md text-zinc-900' 
        : 'bg-zinc-950 border-yellow-950/45 text-slate-100 shadow-lg shadow-black/40'
    }`}>
      
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4 border-current/10">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚙️</span>
          <div>
            <h3 className="font-bold font-display text-base tracking-wide uppercase">
              Microkernel de Procesamiento determinista <span className="text-yellow-600 font-mono text-xs">(Aglaia Microkernel)</span>
            </h3>
            <p className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>
              Intermediate Representation (Plan IR), Capability Resolvers y Programación de DAGs paralelos
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          <select
            value={selectedPresetIndex}
            onChange={(e) => setSelectedPresetIndex(Number(e.target.value))}
            className={`font-mono text-xs p-1.5 rounded border outline-none ${
              theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-slate-200'
            }`}
          >
            {PLAN_PRESETS.map((p, idx) => (
              <option key={idx} value={idx}>{p.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowPlanJson(!showPlanJson)}
            className={`px-3 py-1.5 rounded border font-mono text-xs transition-all cursor-pointer ${
              showPlanJson 
                ? 'bg-yellow-600/15 text-yellow-500 border-yellow-500/40'
                : 'bg-transparent border-zinc-800 text-slate-400'
            }`}
          >
            {showPlanJson ? 'Ver Visual' : 'Ver JSON IR'}
          </button>
        </div>
      </div>

      {/* Grid Layout: Controls / Parameters on top, DAG visualization / Registries on bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left column: Environment variables & Policy restrictions (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center gap-1.5 border-b pb-2 border-current/5">
            <Settings size={13} className="text-yellow-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
              Condiciones del Entorno Físico
            </h4>
          </div>

          <div className="space-y-3.5 text-xs font-mono">
            {/* Online constraint */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/5 dark:bg-black/35 border border-current/5">
              <div className="space-y-0.5">
                <p className="font-bold flex items-center gap-1">Enlace Digital</p>
                <p className="text-[9px] text-slate-500">Habilita/deshabilita consulta celestial.</p>
              </div>
              <input 
                type="checkbox"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
                className="w-4 h-4 accent-yellow-650 cursor-pointer"
              />
            </div>

            {/* GPU constraint */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/5 dark:bg-black/35 border border-current/5">
              <div className="space-y-0.5">
                <p className="font-bold flex items-center gap-1">Chip Gráfico local (GPU)</p>
                <p className="text-[9px] text-slate-500">Requerido para vectorización local.</p>
              </div>
              <input 
                type="checkbox"
                checked={hasGpu}
                onChange={(e) => setHasGpu(e.target.checked)}
                className="w-4 h-4 accent-yellow-650 cursor-pointer"
              />
            </div>

            {/* EU restriction */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/5 dark:bg-black/35 border border-current/5">
              <div className="space-y-0.5">
                <p className="font-bold flex items-center gap-1">Filtrado Geográfico (UE)</p>
                <p className="text-[9px] text-slate-500">Restricciones de soberanía de datos europea.</p>
              </div>
              <input 
                type="checkbox"
                checked={strictEUSovereignty}
                onChange={(e) => setStrictEUSovereignty(e.target.checked)}
                className="w-4 h-4 accent-yellow-650 cursor-pointer"
              />
            </div>

            {/* Covenant policy constraint */}
            <div className="space-y-1">
              <label className="text-[9.5px] uppercase font-bold tracking-wider text-slate-500 block">Directiva de Privacidad</label>
              <select
                value={covenantDataPolicy}
                onChange={(e) => setCovenantDataPolicy(e.target.value as any)}
                className={`w-full font-mono text-xs p-2.5 rounded-lg border outline-none ${
                  theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}
              >
                <option value="local_only">🔒 Local Hermético (Local Only)</option>
                <option value="hybrid">⚖️ Híbrido Inteligente (Hybrid)</option>
                <option value="unrestricted">🔓 Celestial Abierto (Unrestricted)</option>
              </select>
            </div>
          </div>

          {/* Cost metrics card */}
          <div className={`p-4 rounded-xl border space-y-3 font-mono ${
            theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/80 border-zinc-900/60'
          }`}>
            <span className="text-[9px] font-bold text-yellow-600 uppercase tracking-widest block">MÉTRICAS DE COSTO EN TIEMPO REAL</span>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="space-y-0.5 border-r border-current/5">
                <span className="text-[8.5px] text-slate-500 block">TOKENS</span>
                <span className="font-bold text-yellow-500">{currentCostMetrics.totalTokens}</span>
              </div>
              <div className="space-y-0.5 border-r border-current/5">
                <span className="text-[8.5px] text-slate-500 block">LATENCIA</span>
                <span className="font-bold text-sky-400">{currentCostMetrics.elapsedLatencyMs}ms</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[8.5px] text-slate-500 block">MEMORIA</span>
                <span className="font-bold text-emerald-400">{currentCostMetrics.peakMemoryMb}MB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Interactive Visual DAG Plan IR Viewer (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          <div className="flex items-center justify-between border-b pb-2 border-current/5">
            <div className="flex items-center gap-1.5">
              <Workflow size={13} className="text-yellow-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                Intermediate Representation Plan (Visual DAG Graph)
              </h4>
            </div>
            <span className="text-[9px] font-mono text-slate-500 uppercase">
              PARALLEL DISPATCHER READY
            </span>
          </div>

          {/* JSON raw plan view or Visual Node DAG view */}
          {showPlanJson ? (
            <pre className={`p-4 rounded-xl border font-mono text-[10px] h-[230px] overflow-y-auto leading-relaxed shadow-inner ${
              theme === 'light' ? 'bg-zinc-950 text-zinc-300 border-zinc-200' : 'bg-black/55 text-zinc-400 border-zinc-900'
            }`}>
              {JSON.stringify(currentPlan, null, 2)}
            </pre>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {currentPlan.nodes.map((node) => {
                const isActive = activeNodeId === node.id;
                
                // Color states for nodes
                const statusStyles = {
                  idle: 'border-zinc-800 bg-zinc-900/10 text-slate-400',
                  running: 'border-yellow-500 bg-yellow-500/10 text-yellow-500 shadow-md ring-1 ring-yellow-500/20 scale-[1.02] animate-pulse',
                  completed: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
                  blocked: 'border-rose-500 bg-rose-500/10 text-rose-500 animate-pulse',
                  skipped: 'border-zinc-700 bg-zinc-900/5 text-zinc-500'
                }[node.status];

                const sensitivityColors = {
                  PUBLIC: 'text-zinc-500',
                  INTERNAL: 'text-zinc-400',
                  PRIVATE: 'text-amber-500',
                  SECRET: 'text-orange-500',
                  CRITICAL: 'text-rose-500 font-bold'
                }[node.sensitivity];

                const riskColors = {
                  LOW: 'text-emerald-500',
                  MEDIUM: 'text-amber-500',
                  HIGH: 'text-orange-500',
                  CRITICAL: 'text-rose-500 font-bold'
                }[node.risk];

                return (
                  <div 
                    key={node.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 transition-all duration-300 ${statusStyles}`}
                  >
                    {/* Node Header */}
                    <div className="space-y-1 font-mono">
                      <div className="flex items-center justify-between gap-1 text-[8px] text-slate-550 border-b pb-1.5 border-current/5">
                        <span className="font-bold uppercase tracking-wider">{node.capabilityId}</span>
                        <span>{node.correlationId}</span>
                      </div>
                      
                      <p className="font-bold font-display text-xs truncate mt-1">
                        {node.capabilityName}
                      </p>
                      
                      <p className="text-[9.5px] truncate text-slate-500">
                        ID: <span className="text-yellow-600">{node.id}</span>
                      </p>
                    </div>

                    {/* Meta parameters: Sensitivity vs Risk */}
                    <div className="grid grid-cols-2 gap-2 text-[9px] font-mono border-t pt-2 border-current/5">
                      <div>
                        <span className="text-slate-550 block text-[8px] uppercase">Sensibilidad:</span>
                        <span className={sensitivityColors}>{node.sensitivity}</span>
                      </div>
                      <div>
                        <span className="text-slate-550 block text-[8px] uppercase">Riesgo Op:</span>
                        <span className={riskColors}>{node.risk}</span>
                      </div>
                    </div>

                    {/* Dependency mapping */}
                    <div className="text-[9px] font-mono text-slate-550 space-y-0.5 border-t pt-2 border-current/5">
                      <p className="uppercase text-[8px]">Depende de:</p>
                      <p className="truncate text-slate-400">
                        {node.dependsOn.length > 0 ? node.dependsOn.join(', ') : 'Ninguno (Raíz)'}
                      </p>
                    </div>

                    {/* Resolved physical Provider info */}
                    {node.resolvedProvider && (
                      <div className="pt-2 border-t border-current/5 flex items-center justify-between text-[8px] font-mono text-slate-550">
                        <span>Provider:</span>
                        <span className="font-bold text-yellow-500 uppercase truncate max-w-[100px]" title={node.resolvedProvider}>
                          {node.resolvedProvider.replace("Driver", "").replace("Engine", "")}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Core play simulation triggers */}
          <div className="flex gap-4">
            <button
              onClick={runSovereignDAG}
              disabled={isSimulating}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-xs font-bold tracking-widest uppercase cursor-pointer transition-all ${
                isSimulating
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-550 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-yellow-750 to-amber-700 text-white hover:from-yellow-700 hover:to-amber-600 shadow-md border border-yellow-500/10'
              }`}
            >
              <Play size={12} />
              {isSimulating ? 'Resolviendo Ritos...' : 'Ejecutar Plan IR en DAG'}
            </button>
          </div>

        </div>
      </div>

      {/* Realtime Event Bus Console with Correlation IDs */}
      {simulatedLogs.length > 0 && (
        <div className={`p-4 rounded-xl border space-y-2 ${
          theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-slate-950 border-slate-900/80 text-slate-300'
        }`}>
          <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-slate-500">
            <span className="flex items-center gap-1.5">
              <Terminal size={12} />
              Consola de Eventos Determinista (Deterministic Event Bus)
            </span>
            <span className="bg-yellow-600/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 text-[9px]">
              CORRELATION TRACKING LIVE
            </span>
          </div>

          <div className="font-mono text-[10.5px] space-y-1.5 max-h-[160px] overflow-y-auto pr-1 leading-relaxed">
            {simulatedLogs.map((log) => {
              const textColors = {
                info: 'text-slate-400',
                success: 'text-emerald-500',
                warn: 'text-amber-500',
                error: 'text-rose-500 font-bold animate-pulse'
              }[log.type];

              return (
                <div key={log.id} className={`flex gap-2 items-start ${textColors}`}>
                  <span className="text-yellow-600 select-none">&gt;&gt;</span>
                  <p className="break-all">{log.msg}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Registries Architecture Visualizer section */}
      <div className="border-t pt-5 border-current/10 space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-widest font-mono text-yellow-600 dark:text-yellow-500 flex items-center gap-1.5">
          <Layers size={13} />
          Desacoplamiento Estricto: Capability Registry vs Provider Registry
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          
          {/* Capability Registry representation */}
          <div className={`p-4 rounded-xl border space-y-3 ${
            theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-900'
          }`}>
            <span className="text-[9.5px] font-bold text-yellow-600 uppercase block tracking-wider">
              CAPABILITY REGISTRY (Qué habilidades existen)
            </span>
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {CAPABILITY_REGISTRY.map(cap => (
                <div key={cap.id} className="p-2.5 rounded border border-current/5 bg-black/5 dark:bg-black/20 flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-350">{cap.name} <span className="text-[9px] text-slate-500">({cap.id})</span></p>
                    <p className="text-[9px] text-slate-500">{cap.description}</p>
                  </div>
                  <span className="text-[8.5px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded">
                    Default: {cap.defaultProvider}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Provider Registry representation */}
          <div className={`p-4 rounded-xl border space-y-3 ${
            theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-900'
          }`}>
            <span className="text-[9.5px] font-bold text-yellow-600 uppercase block tracking-wider">
              PROVIDER REGISTRY (Quién y dónde las ejecuta)
            </span>
            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
              {PROVIDER_REGISTRY.map(prov => (
                <div key={prov.id} className="p-2.5 rounded border border-current/5 bg-black/5 dark:bg-black/20 flex justify-between items-center">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-350">{prov.name} <span className="text-[9px] text-slate-500">({prov.id})</span></p>
                    <p className="text-[9px] text-slate-500">{prov.description}</p>
                  </div>
                  <span className={`text-[8.5px] px-1.5 py-0.5 rounded border uppercase ${
                    prov.context === 'local' 
                      ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/15' 
                      : 'bg-amber-500/10 text-yellow-500 border-yellow-500/15'
                  }`}>
                    {prov.context}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
