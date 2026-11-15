import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, Server, Globe, Cpu, AlertOctagon, HelpCircle, 
  Play, Settings, FileText, CheckCircle2, AlertTriangle, 
  XCircle, ArrowRight, ShieldCheck, RefreshCw, Layers, Lock, Unlock, Zap, Eye, EyeOff
} from 'lucide-react';
import { OrbeMaterial } from './VisualOrbe';
import { 
  decideOrbMode, 
  classifyIntent, 
  scanSensitivity, 
  sanitizeExternalPayload,
  OrbMode, 
  WorkspacePolicy, 
  IntentAnalysis, 
  SensitivityScan, 
  OrbDecision, 
  SanitizedPayload,
  DEFAULT_WORKSPACE_POLICY
} from '../orbiter';

interface OrbiterPlaygroundProps {
  theme: 'light' | 'dark';
  setOrbeMaterial: (material: OrbeMaterial) => void;
  setVramUsage: (usage: number) => void;
  setNpuUsage: (usage: number) => void;
  setIsThinking: (thinking: boolean) => void;
  onRefreshLogs: () => void;
}

const SAMPLE_CHIPS = [
  {
    label: "⚖️ Híbrida/Bifrontal",
    text: "Analiza mi repo local en ./src y busca en internet cómo arreglar el error de build de Docker."
  },
  {
    label: "🚫 Veto de Seguridad",
    text: "Mi Stripe secret key es sk_live_51NABC123456789 y mi base de datos es postgres://admin:pass@db.internal/acme. Analiza vulnerabilidades."
  },
  {
    label: "☁️ Celestial/Oro",
    text: "Quiero buscar en Google la documentación actual y los cambios recientes de Next.js 15."
  },
  {
    label: "🔒 Hermética/Grafito",
    text: "Refactoriza el componente local VisualOrbe.tsx para optimizar el rendimiento del renderizado en canvas."
  }
];

export default function OrbiterPlayground({ 
  theme, 
  setOrbeMaterial, 
  setVramUsage, 
  setNpuUsage, 
  setIsThinking,
  onRefreshLogs
}: OrbiterPlaygroundProps) {
  // Input Query
  const [prompt, setPrompt] = useState<string>(SAMPLE_CHIPS[0].text);

  // Policy options
  const [allowCloudModels, setAllowCloudModels] = useState(false);
  const [allowWebSearch, setAllowWebSearch] = useState(true);
  const [allowTelemetry, setAllowTelemetry] = useState(false);
  const [dataPolicy, setDataPolicy] = useState<'local_only' | 'hybrid' | 'unrestricted'>('local_only');

  // Pipeline Live States
  const [intent, setIntent] = useState<IntentAnalysis | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityScan | null>(null);
  const [decision, setDecision] = useState<OrbDecision | null>(null);
  const [sanitized, setSanitized] = useState<SanitizedPayload | null>(null);

  // Consent Slider State
  const [sliderValue, setSliderValue] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showSanitizationDetails, setShowSanitizationDetails] = useState(true);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeStep, setActiveStep] = useState<string>('');
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-run pipeline analysis when inputs change
  useEffect(() => {
    analyzePipeline();
  }, [prompt, allowCloudModels, allowWebSearch, allowTelemetry, dataPolicy]);

  const analyzePipeline = () => {
    const customPolicy: Partial<WorkspacePolicy> = {
      allowCloudModels,
      allowWebSearch,
      allowTelemetry,
      defaultMode: dataPolicy === 'local_only' ? 'GRAPHITE' : 'GOLD'
    };

    const parsedIntent = classifyIntent(prompt);
    const parsedSensitivity = scanSensitivity(prompt);
    const parsedDecision = decideOrbMode(prompt, customPolicy);
    const parsedSanitizer = sanitizeExternalPayload(prompt);

    setIntent(parsedIntent);
    setSensitivity(parsedSensitivity);
    setDecision(parsedDecision);
    setSanitized(parsedSanitizer);

    // If decision changes mode, update Orbe live!
    if (parsedDecision.mode === 'BLOCKED') {
      setOrbeMaterial('bronze');
    } else if (parsedDecision.mode === 'GRAPHITE') {
      setOrbeMaterial('graphite');
    } else if (parsedDecision.mode === 'GOLD') {
      setOrbeMaterial('gold_liquid');
    } else if (parsedDecision.mode === 'BIFRONTAL') {
      // In bifrontal wait for permission or show partial rings
      setOrbeMaterial('graphite'); // Graphite initially until authorized
    }

    // Reset authorization on query/decision change to guarantee strict consent
    setIsAuthorized(false);
    setSliderValue(0);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSliderValue(val);
    if (val >= 100) {
      setIsAuthorized(true);
      setSliderValue(100);
      setOrbeMaterial('opal'); // Transition to beautiful opal success state on consent grant
      
      // Add visual sound notification
      if (typeof window !== 'undefined') {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime); // Low baritone frequencies
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // Majestic sliding chord
        
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.7);
      }
    }
  };

  const executeSovereignWorkflow = async () => {
    if (!decision) return;
    setIsSimulating(true);
    setIsThinking(true);
    setPipelineLogs([]);

    const log = (msg: string) => setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    try {
      // Step 1: Local parsing
      log("🔒 [PASO 1] Leyendo entorno local hermético.");
      setVramUsage(85);
      setNpuUsage(90);
      await new Promise(r => setTimeout(r, 1200));

      // Step 2: Sensitive Scanning
      log("🔬 [PASO 2] Escaneando datos privados en el Santuario.");
      if (sensitivity?.containsSecrets) {
        log("🚫 SE DETECTARON CREDENCIALES: El Orbe se solidificará en Bronce.");
        setOrbeMaterial('bronze');
        setIsThinking(false);
        setIsSimulating(false);
        return;
      }
      await new Promise(r => setTimeout(r, 1000));

      // Step 3: Sanctifying or Sanitizing payload
      if (decision.mode === 'BIFRONTAL') {
        log("✨ [PASO 3] Aplicando Redaction Engine. Ofuscando rutas locales y secretos.");
        log(`✓ CONSULTA EXTERNA SANITIZADA: "${sanitized?.sanitizedText}"`);
        setOrbeMaterial('opal');
        await new Promise(r => setTimeout(r, 1500));
      }

      // Step 4: Web Integration / Celestial consult
      if (decision.mode === 'GOLD' || decision.mode === 'BIFRONTAL') {
        log("☁️ [PASO 4] Conectando a la Red Celestial de APIs públicas.");
        setOrbeMaterial('gold_liquid');
        setVramUsage(40);
        setNpuUsage(30);
        await new Promise(r => setTimeout(r, 1600));
      }

      // Step 5: Hermetic application
      log("🔱 [PASO 5] Consolidando respuestas locales y aplicando rito en SQLite Memory Vault.");
      setOrbeMaterial('graphite');
      setVramUsage(60);
      setNpuUsage(75);
      
      // Save simulation run to central SQLite
      await fetch('/api/orbiter/simulate-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: {
            index: 1,
            tool: 'OrbiterCore',
            action: 'sovereign_gate_execution',
            queryOrParams: prompt.substring(0, 80) + '...',
            executionContext: decision.mode.toLowerCase(),
            decisionReason: decision.reason
          },
          userContext: { forceLocal: false, forceRemote: false, isOnline: true, hasGpu: true, dataPolicy, restrictToEu: true }
        })
      });

      onRefreshLogs();
      log("⚜️ Ejecución completada con gracia soberana.");
      setOrbeMaterial('opal');
    } catch (err) {
      log(`⚠️ Fallo en el rito de ejecución: ${err}`);
    } finally {
      setIsThinking(false);
      setIsSimulating(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`border-2 rounded-2xl p-6 transition-all duration-350 space-y-6 ${
        theme === 'light' 
          ? 'bg-white border-zinc-200 shadow-md text-zinc-900' 
          : 'bg-zinc-950 border-yellow-950/45 text-slate-100 shadow-lg shadow-black/40'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4 border-current/10">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🏛️</span>
          <div>
            <h3 className="font-bold font-display text-base tracking-wide uppercase">
              Motor de Conmutación del Orbe <span className="text-yellow-600 font-mono text-xs">(Aurum/Grafito Gate)</span>
            </h3>
            <p className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>
              Soberanía de Datos, Escáner de Sensibilidad y Puentes Bifrontales
            </p>
          </div>
        </div>

        {/* Current Active Mode Badge */}
        {decision && (
          <span className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono tracking-widest uppercase border ${
            decision.mode === 'GOLD' ? 'bg-amber-500/15 text-yellow-500 border-yellow-500/20' :
            decision.mode === 'BIFRONTAL' ? 'bg-sky-500/15 text-sky-400 border-sky-500/20' :
            decision.mode === 'BLOCKED' ? 'bg-rose-500/15 text-rose-500 border-rose-500/20' :
            'bg-zinc-500/15 text-zinc-400 border-zinc-500/20'
          }`}>
            MODO: {decision.mode}
          </span>
        )}
      </div>

      {/* Main Interactive Controls & Prompt Input */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono font-bold tracking-widest uppercase text-slate-500 flex items-center justify-between">
            <span>CONSULTA AL TERMINAL DE AGLAIA</span>
            <span className="text-yellow-600 font-bold">PROMPT DE SOBERANÍA</span>
          </label>
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escriba su consulta... (Ej: analice este repositorio privado o ingrese secretos para ver el veto)"
            className={`w-full min-h-[85px] p-4 rounded-xl text-xs font-mono outline-none border focus:ring-1 transition-all ${
              theme === 'light' 
                ? 'bg-zinc-50 border-zinc-200 focus:border-yellow-600 focus:ring-yellow-600/30 text-zinc-900' 
                : 'bg-zinc-900/60 border-zinc-800 focus:border-yellow-750 focus:ring-yellow-750/30 text-slate-100'
            }`}
          />
        </div>

        {/* Quick presets chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-mono text-slate-500 mr-1 uppercase">Sugerencias:</span>
          {SAMPLE_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => setPrompt(chip.text)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-mono transition-all border cursor-pointer ${
                prompt === chip.text
                  ? 'bg-yellow-600/10 text-yellow-500 border-yellow-500/40 font-bold'
                  : theme === 'light'
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-700'
                    : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-800 text-slate-400'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Workspace Overrides / Policies config */}
      <div className={`p-4 rounded-xl border grid grid-cols-1 md:grid-cols-4 gap-4 ${
        theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/40 border-zinc-800/80'
      }`}>
        <div className="flex items-center justify-between md:flex-col md:items-start gap-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Modelos Nube</span>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={allowCloudModels}
              onChange={(e) => setAllowCloudModels(e.target.checked)}
              className="accent-yellow-600"
            />
            <span className="text-[11px] font-mono text-slate-400">Permitir Cloud</span>
          </div>
        </div>

        <div className="flex items-center justify-between md:flex-col md:items-start gap-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Búsqueda Web</span>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={allowWebSearch}
              onChange={(e) => setAllowWebSearch(e.target.checked)}
              className="accent-yellow-600"
            />
            <span className="text-[11px] font-mono text-slate-400">Habilitar Red</span>
          </div>
        </div>

        <div className="flex items-center justify-between md:flex-col md:items-start gap-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Fuga de Telemetría</span>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={allowTelemetry}
              onChange={(e) => setAllowTelemetry(e.target.checked)}
              className="accent-yellow-600"
            />
            <span className="text-[11px] font-mono text-slate-400">Logs Externos</span>
          </div>
        </div>

        <div className="flex items-center justify-between md:flex-col md:items-start gap-1">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Directiva Base</span>
          <select
            value={dataPolicy}
            onChange={(e) => setDataPolicy(e.target.value as any)}
            className={`font-mono text-[10px] p-1 rounded outline-none border ${
              theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-slate-300'
            }`}
          >
            <option value="local_only">Hermético (Local)</option>
            <option value="hybrid">Híbrido Inteligente</option>
            <option value="unrestricted">Celeste (Abierto)</option>
          </select>
        </div>
      </div>

      {/* Pipeline 5-Stage Visualization */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-widest font-mono text-yellow-650 flex items-center gap-1.5">
          <Layers size={13} />
          Canalización de Decisión (Decision Pipeline)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          
          {/* Stage 1: Intent Classifier */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-900'
          }`}>
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold text-yellow-600 uppercase">Etapa 1: Intención</span>
              <p className="font-sans font-bold text-xs">classifyIntent()</p>
              {intent && (
                <div className="space-y-1 font-mono text-[10px] text-slate-400 mt-2">
                  <div className="flex justify-between">
                    <span>Local:</span>
                    <span className={intent.requiresLocalContext ? 'text-amber-500' : 'text-slate-600'}>
                      {intent.requiresLocalContext ? 'SÍ' : 'NO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Internet:</span>
                    <span className={intent.requiresInternet ? 'text-yellow-500' : 'text-slate-600'}>
                      {intent.requiresInternet ? 'SÍ' : 'NO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ejecución:</span>
                    <span>{intent.requiresExecution ? 'SÍ' : 'NO'}</span>
                  </div>
                </div>
              )}
            </div>
            <span className="text-[9px] font-mono text-slate-500 mt-2 block border-t pt-1 border-current/5">
              Clase: {intent?.intent}
            </span>
          </div>

          {/* Stage 2: Sensitivity Scanner */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            sensitivity?.containsSecrets 
              ? 'border-rose-500/30 bg-rose-500/5' 
              : theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-900'
          }`}>
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold text-yellow-600 uppercase">Etapa 2: Escaneo</span>
              <p className="font-sans font-bold text-xs">scanSensitivity()</p>
              {sensitivity && (
                <div className="space-y-1 font-mono text-[10px] text-slate-400 mt-2">
                  <div className="flex justify-between">
                    <span>Nivel:</span>
                    <span className={`font-bold ${
                      sensitivity.sensitivityLevel === 'critical' ? 'text-rose-500 animate-pulse' :
                      sensitivity.sensitivityLevel === 'high' ? 'text-amber-500' : 'text-slate-500'
                    }`}>
                      {sensitivity.sensitivityLevel.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Secretos:</span>
                    <span>{sensitivity.containsSecrets ? 'DETECTADO' : 'NINGUNO'}</span>
                  </div>
                </div>
              )}
            </div>
            {sensitivity && sensitivity.detectedSignals.length > 0 ? (
              <div className="text-[8px] font-mono text-rose-500 mt-2 truncate border-t pt-1 border-current/5">
                Alerta: {sensitivity.detectedSignals.join(', ')}
              </div>
            ) : (
              <span className="text-[9px] font-mono text-emerald-500 mt-2 block border-t pt-1 border-current/5">
                Limpio de secretos
              </span>
            )}
          </div>

          {/* Stage 3: Workspace Policies */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-900'
          }`}>
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold text-yellow-600 uppercase">Etapa 3: Políticas</span>
              <p className="font-sans font-bold text-xs">loadWorkspacePolicy()</p>
              <div className="space-y-1 font-mono text-[10px] text-slate-400 mt-2">
                <div className="flex justify-between">
                  <span>Modo Base:</span>
                  <span>{dataPolicy.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Restricción EU:</span>
                  <span className="text-emerald-500">SÍ</span>
                </div>
              </div>
            </div>
            <span className="text-[9px] font-mono text-slate-500 mt-2 block border-t pt-1 border-current/5 truncate">
              Reglas: {DEFAULT_WORKSPACE_POLICY.sensitivePatterns.length} patrones
            </span>
          </div>

          {/* Stage 4: Decision engine */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            decision?.mode === 'BLOCKED' ? 'border-rose-500/40 bg-rose-500/5' :
            decision?.mode === 'BIFRONTAL' ? 'border-sky-500/40 bg-sky-500/5' :
            theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-900'
          }`}>
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold text-yellow-600 uppercase">Etapa 4: Decisión</span>
              <p className="font-sans font-bold text-xs">decideOrbMode()</p>
              {decision && (
                <div className="space-y-1 font-mono text-[10px] text-slate-400 mt-2">
                  <div className="flex justify-between">
                    <span>Modo Orbe:</span>
                    <span className="font-bold text-yellow-500">{decision.mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Consentimiento:</span>
                    <span className={decision.requiresApproval ? 'text-amber-500 font-bold' : 'text-slate-500'}>
                      {decision.requiresApproval ? 'REQUERIDO' : 'AUTOMÁTICO'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <span className="text-[8px] font-mono text-slate-500 mt-2 block border-t pt-1 border-current/5 truncate" title={decision?.reason}>
              Materia: {decision?.reason}
            </span>
          </div>

          {/* Stage 5: Redaction / Sanitizer */}
          <div className={`p-3 rounded-xl border flex flex-col justify-between ${
            sanitized && sanitized.redactedElements.length > 0 
              ? 'border-amber-500/30 bg-amber-500/5' 
              : theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/20 border-zinc-900'
          }`}>
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono font-bold text-yellow-600 uppercase">Etapa 5: Redacción</span>
              <p className="font-sans font-bold text-xs">sanitizePayload()</p>
              {sanitized && (
                <div className="space-y-1 font-mono text-[10px] text-slate-400 mt-2">
                  <div className="flex justify-between">
                    <span>Variables Ofuscadas:</span>
                    <span className={sanitized.redactedElements.length > 0 ? 'text-rose-500 font-bold' : 'text-slate-500'}>
                      {sanitized.redactedElements.length}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={() => setShowSanitizationDetails(!showSanitizationDetails)}
              className="text-[9px] font-mono text-yellow-600 hover:underline mt-2 block border-t pt-1 border-current/5 text-left"
            >
              {showSanitizationDetails ? "Ocultar Detalles" : "Ver Ofuscación"}
            </button>
          </div>

        </div>
      </div>

      {/* Sanitized Side-by-Side Payload Viewer */}
      {showSanitizationDetails && sanitized && (
        <div className={`p-4 rounded-xl border space-y-3 ${
          theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-900/80'
        }`}>
          <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase text-slate-550">
            <span>PREPARACIÓN DE PAYLOAD EXTERNO (SANITY CHECK)</span>
            <span className="text-rose-500 text-[9px]">FILTRADO ANTIFUGAS</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] font-mono">
            <div className="space-y-1">
              <p className="text-slate-500 text-[10px] uppercase">ORIGINAL (CRudo - Santuario):</p>
              <div className="p-3 rounded-lg bg-black/10 dark:bg-black/35 border border-current/5 min-h-[60px] break-all">
                {prompt}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-yellow-600 text-[10px] uppercase">SANITISED FOR EXPORT (Listo para Oro):</p>
              <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 min-h-[60px] text-yellow-600 break-all">
                {sanitized.sanitizedText}
              </div>
            </div>
          </div>
          {sanitized.redactedElements.length > 0 && (
            <div className="text-[10px] font-mono text-rose-500 flex flex-wrap gap-2 pt-1">
              <span className="font-bold">Filtros aplicados:</span>
              {sanitized.redactedElements.map((el, idx) => (
                <span key={idx} className="bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-[9px]">
                  {el}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Haptic Consent Slider - Aurum/Grafito Gate */}
      {decision && (decision.mode === 'BIFRONTAL' || decision.mode === 'BLOCKED') && (
        <div className={`p-5 rounded-xl border transition-all duration-500 ${
          isAuthorized 
            ? 'border-emerald-500/30 bg-emerald-500/5' 
            : 'border-yellow-600/30 bg-yellow-600/5'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Visual Lock/Unlock indicator */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                isAuthorized ? 'bg-emerald-500/10 text-emerald-400' : 'bg-yellow-600/10 text-yellow-500'
              }`}>
                {isAuthorized ? <Unlock size={18} /> : <Lock size={18} />}
              </div>
              <div className="space-y-0.5">
                <h5 className="font-bold font-display text-xs uppercase tracking-wide">
                  {isAuthorized ? 'FRONTERA AUTORIZADA' : 'SANTUARIO SELLADO: REQUIERE CONSENTIMIENTO'}
                </h5>
                <p className="text-[10px] font-sans text-slate-400 max-w-[380px]">
                  {decision.mode === 'BLOCKED' 
                    ? 'La consulta contiene información crítica. Al autorizar, Aglaia sanitizará y redactará los campos sensibles antes de salir.' 
                    : 'Esta tarea combina escritorio local y red exterior. Conceda permiso para enviar la forma abstracta.'}
                </p>
              </div>
            </div>

            {/* Luxurious Golden Consent Slider */}
            <div className="flex-1 max-w-[280px] space-y-1">
              <div className="relative flex items-center h-8 rounded-full bg-black/25 overflow-hidden border border-yellow-950/40">
                
                {/* Slid fill indicator */}
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-yellow-700/20 to-yellow-500/40 transition-all duration-100" 
                  style={{ width: `${sliderValue}%` }}
                />

                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold tracking-widest text-yellow-600 select-none animate-pulse pointer-events-none">
                  {isAuthorized ? 'FRONTERA LIBERADA' : 'DESLIZAR PARA AUTORIZAR'}
                </span>

                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={sliderValue}
                  disabled={isAuthorized}
                  onChange={handleSliderChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize disabled:cursor-not-allowed"
                />

                {/* Simulated physical golden thumb cursor slider handle */}
                {!isAuthorized && (
                  <div 
                    className="absolute w-8 h-8 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600 shadow-md border border-yellow-300 flex items-center justify-center text-[10px] text-yellow-950 font-bold transition-all"
                    style={{ left: `calc(${sliderValue}% - ${sliderValue * 0.32}px)` }}
                  >
                    🔱
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Execution logs & simulation */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={executeSovereignWorkflow}
            disabled={isSimulating || (decision?.requiresApproval && !isAuthorized)}
            className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 cursor-pointer ${
              isSimulating || (decision?.requiresApproval && !isAuthorized)
                ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'
                : 'bg-gradient-to-r from-yellow-750 to-amber-700 text-white shadow-md hover:from-yellow-700 hover:to-amber-600 border border-yellow-500/10'
            }`}
          >
            <Play size={12} />
            {isSimulating ? 'SIMULANDO RITO...' : 'EJECUTAR EN SOBERANO'}
          </button>

          {(decision?.requiresApproval && !isAuthorized) && (
            <p className="text-[10px] font-mono text-yellow-600 animate-pulse flex items-center gap-1">
              <AlertTriangle size={11} />
              Deslice el indicador dorado para habilitar la ejecución
            </p>
          )}
        </div>

        {pipelineLogs.length > 0 && (
          <div className={`p-4 rounded-xl border space-y-2 ${
            theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-slate-950 border-slate-900/80 text-slate-300'
          }`}>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center justify-between">
              <span>Bitácora de Observabilidad de Frontera</span>
              <span className="text-[9px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2 py-0.5 rounded">
                Live Telemetry
              </span>
            </p>
            <div className="font-mono text-[10.5px] space-y-1.5 leading-relaxed">
              {pipelineLogs.map((log, idx) => (
                <div key={idx} className="flex gap-2.5 items-start">
                  <span className="text-yellow-600 shrink-0 select-none">✦</span>
                  <p className="break-all">{log}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
