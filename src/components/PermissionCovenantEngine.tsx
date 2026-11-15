import React, { useState, useEffect } from 'react';
import { 
  Shield, Key, Lock, Unlock, AlertTriangle, AlertOctagon, CheckCircle2, 
  HelpCircle, Settings, Sliders, FileText, Check, X, ShieldAlert, Fingerprint
} from 'lucide-react';
import { OrbeMaterial } from './VisualOrbe';

interface PermissionCovenantEngineProps {
  theme: 'light' | 'dark';
  setOrbeMaterial: (material: OrbeMaterial) => void;
  onAddAuditLog: (type: 'info' | 'tool' | 'error' | 'planner', message: string) => void;
}

export interface SecurityRule {
  id: string;
  action: string;
  risk: 'low' | 'medium' | 'high' | 'critical' | 'forbidden';
  agent: string;
  policy: 'allow' | 'consent' | 'confirm_double' | 'imperative' | 'veto';
  description: string;
}

const DEFAULT_RULES: SecurityRule[] = [
  { 
    id: '1', 
    action: 'Leer archivos del Workspace', 
    risk: 'low', 
    agent: 'DesktopAgent', 
    policy: 'allow', 
    description: 'Permite leer código fuente e indexar directorios del espacio de trabajo actual.' 
  },
  { 
    id: '2', 
    action: 'Modificar código propietario', 
    risk: 'medium', 
    agent: 'CodeAgent', 
    policy: 'consent', 
    description: 'Requiere confirmación antes de guardar cambios persistentes sobre archivos locales.' 
  },
  { 
    id: '3', 
    action: 'Ejecutar comandos en Terminal (Bash/CMD)', 
    risk: 'high', 
    agent: 'DesktopAgent', 
    policy: 'consent', 
    description: 'Inspecciona y solicita autorización para scripts locales de automatización.' 
  },
  { 
    id: '4', 
    action: 'Eliminar archivos locales', 
    risk: 'high', 
    agent: 'DesktopAgent', 
    policy: 'confirm_double', 
    description: 'Reclama una confirmación de doble paso para evitar pérdidas de información.' 
  },
  { 
    id: '5', 
    action: 'Transmitir payload a API de Nube externa', 
    risk: 'critical', 
    agent: 'BrowserAgent', 
    policy: 'imperative', 
    description: 'Exige sanitización obligatoria y deslizamiento háptico para cruzar la frontera local.' 
  },
  { 
    id: '6', 
    action: 'Mover fondos financieros / Pagos reales', 
    risk: 'forbidden', 
    agent: 'SovereignWallet', 
    policy: 'veto', 
    description: 'Inhabilitado de raíz en el kernel por políticas fundamentales de la dinastía Aglaia.' 
  }
];

export default function PermissionCovenantEngine({ 
  theme, 
  setOrbeMaterial, 
  onAddAuditLog 
}: PermissionCovenantEngineProps) {
  // Covenant state
  const [isolationMode, setIsolationMode] = useState<'maximum' | 'hybrid_sovereign' | 'unrestricted'>('hybrid_sovereign');
  const [euSovereignty, setEuSovereignty] = useState(true);
  const [zeroCloudFallback, setZeroCloudFallback] = useState(true);
  
  // Rules State
  const [rules, setRules] = useState<SecurityRule[]>(DEFAULT_RULES);
  const [activeRuleId, setActiveRuleId] = useState<string>('5');
  const [editPolicy, setEditPolicy] = useState<Record<string, SecurityRule['policy']>>({
    '1': 'allow',
    '2': 'consent',
    '3': 'consent',
    '4': 'confirm_double',
    '5': 'imperative',
    '6': 'veto'
  });

  // Haptic Slider simulation state
  const [sliderVal, setSliderVal] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [activeSimulatedAction, setActiveSimulatedAction] = useState<SecurityRule | null>(null);
  const [doubleConfirmChecked, setDoubleConfirmChecked] = useState(false);

  // Covenant Signature state
  const [covenantSigned, setCovenantSigned] = useState(true);
  const [signName, setSignName] = useState('Consultante Soberano');

  const selectedRule = rules.find(r => r.id === activeRuleId) || rules[0];

  const handleUpdatePolicy = (id: string, value: SecurityRule['policy']) => {
    setEditPolicy(prev => ({ ...prev, [id]: value }));
    const updated = rules.map(r => r.id === id ? { ...r, policy: value } : r);
    setRules(updated);
    
    onAddAuditLog('info', `Permisos: Acción de seguridad [id:${id}] reconfigurada a modo de consentimiento [${value.toUpperCase()}].`);
  };

  const triggerSimulateConsent = (rule: SecurityRule) => {
    setActiveSimulatedAction(rule);
    setIsUnlocked(false);
    setSliderVal(0);
    setDoubleConfirmChecked(false);

    if (rule.policy === 'veto') {
      setOrbeMaterial('bronze');
      onAddAuditLog('error', `VETO DEL KERNEL: Intento de llamada prohibida '${rule.action}'. Solidificando Orbe en Bronce.`);
    } else if (rule.policy === 'allow') {
      setIsUnlocked(true);
      setSliderVal(100);
      onAddAuditLog('tool', `AUTORIZACIÓN AUTOMÁTICA: '${rule.action}' ejecutado bajo directiva sin fricciones.`);
    } else {
      setOrbeMaterial('bronze');
      onAddAuditLog('info', `BLOQUEO TEMPORAL: '${rule.action}' requiere autorización. Orbe en Bronce esperando rito de consentimiento.`);
    }
  };

  const handleSliderScroll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSliderVal(val);
    
    if (val >= 100) {
      if (activeSimulatedAction?.policy === 'confirm_double' && !doubleConfirmChecked) {
        setSliderVal(0);
        return;
      }
      
      setIsUnlocked(true);
      setOrbeMaterial('opal'); // Beautiful opal representing agreement harmony
      onAddAuditLog('tool', `CONSENTIMIENTO HÁPTICO CONCEDIDO: El consultante autorizó '${activeSimulatedAction?.action}'.`);
      
      // Play tactile response
      if (typeof window !== 'undefined') {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      }

      setTimeout(() => {
        setOrbeMaterial('gold_liquid');
      }, 3500);
    }
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
          <span className="text-xl">🛡️</span>
          <div>
            <h3 className="font-bold font-display text-base tracking-wide uppercase">
              Motor de Permisos y Pacto Soberano <span className="text-yellow-600 font-mono text-xs">(Covenant Engine)</span>
            </h3>
            <p className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>
              Gobernanza del Kernel, Niveles de Riesgo y Rito de Deslizamiento de Bronce
            </p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono tracking-widest uppercase border ${
          isolationMode === 'maximum' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
          isolationMode === 'hybrid_sovereign' ? 'bg-amber-500/10 text-yellow-500 border-yellow-500/20' :
          'bg-slate-500/10 text-slate-400 border-slate-500/20'
        }`}>
          {isolationMode === 'maximum' ? 'AISLAMIENTO TOTAL' : isolationMode === 'hybrid_sovereign' ? 'SOBERANÍA HÍBRIDA' : 'CONMUTACIÓN LIBRE'}
        </span>
      </div>

      {/* Main Grid: Policy & Consent on left, Sovereign Covenant Agreement on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Security Rulebook & Action Center (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-1.5 border-b pb-2 border-current/5">
            <Sliders size={13} className="text-yellow-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
              Constitución de Permisos y Niveles de Riesgo
            </h4>
          </div>

          {/* Table list of security rules */}
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {rules.map((rule) => {
              const riskColors = {
                low: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/15',
                medium: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15',
                high: 'bg-amber-500/10 text-amber-500 border-amber-500/15',
                critical: 'bg-rose-500/10 text-rose-500 border-rose-500/15',
                forbidden: 'bg-red-550/15 text-red-500 border-red-500/20 font-bold animate-pulse'
              };

              return (
                <div 
                  key={rule.id}
                  onClick={() => setActiveRuleId(rule.id)}
                  className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono cursor-pointer transition-all ${
                    activeRuleId === rule.id
                      ? 'bg-yellow-600/5 border-yellow-500/40'
                      : theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-900/25 border-slate-900'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8.5px] border uppercase ${riskColors[rule.risk]}`}>
                        {rule.risk}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">{rule.action}</span>
                    </div>
                    <p className={`text-[10px] leading-relaxed opacity-80 ${theme === 'light' ? 'text-zinc-500' : 'text-slate-400'}`}>
                      {rule.description}
                    </p>
                  </div>

                  {/* Policy selector dropdown */}
                  <div className="flex items-center gap-2">
                    <select
                      value={editPolicy[rule.id]}
                      onChange={(e) => handleUpdatePolicy(rule.id, e.target.value as any)}
                      className={`text-[10px] font-mono p-1 rounded border outline-none ${
                        theme === 'light' ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-900 border-zinc-800 text-slate-300'
                      }`}
                    >
                      <option value="allow">✅ Auto-Allow</option>
                      <option value="consent">🔱 Consentimiento</option>
                      <option value="confirm_double">⚖️ Doble Confirmación</option>
                      <option value="imperative">🔒 Deslizamiento Imperativo</option>
                      <option value="veto">🚫 Veto Absoluto</option>
                    </select>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerSimulateConsent(rule);
                      }}
                      className="px-2 py-1 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-500 border border-yellow-500/30 rounded text-[9px] uppercase tracking-wider font-bold transition-all shrink-0 cursor-pointer"
                    >
                      Probar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Simulation Console for Authorization Flow */}
          {activeSimulatedAction && (
            <div className={`p-4 rounded-xl border space-y-4 transition-all duration-350 ${
              isUnlocked 
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' 
                : activeSimulatedAction.policy === 'veto'
                  ? 'border-rose-500/30 bg-rose-500/5 text-rose-500'
                  : 'border-yellow-600/30 bg-yellow-600/5'
            }`}>
              
              <div className="flex items-center justify-between border-b pb-2 border-current/10 text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Fingerprint size={12} />
                  Ritual de Consentimiento Háptico en Curso
                </span>
                <span className={isUnlocked ? 'text-emerald-400' : activeSimulatedAction.policy === 'veto' ? 'text-rose-500' : 'text-yellow-600'}>
                  {isUnlocked ? 'SANTUARIO LIBERADO' : activeSimulatedAction.policy === 'veto' ? 'ACCION COMPROMETIDA VETADA' : 'UMBRAL SELLADO'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <p className="font-sans">
                  El Agente <strong>{activeSimulatedAction.agent}</strong> solicita ejecutar el rito:
                </p>
                <div className={`p-3 rounded-lg font-mono text-[11px] border leading-relaxed ${
                  theme === 'light' ? 'bg-zinc-100 border-zinc-200' : 'bg-black/30 border-current/10'
                }`}>
                  <span className="text-yellow-500 dark:text-yellow-600 font-bold">&gt;&gt;</span> {activeSimulatedAction.action}
                  <p className="text-[10px] text-slate-400 mt-1">Configuración actual: <strong>{activeSimulatedAction.policy.toUpperCase()}</strong></p>
                </div>
              </div>

              {/* Specific controls based on policy type */}
              {activeSimulatedAction.policy === 'veto' ? (
                <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 flex gap-2 items-start text-[11px] font-sans">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <p>
                    <strong>ORDEN INMEDIATA DE CLAUSURA:</strong> Esta acción viola las leyes primordiales de la dinastía. El orbe se ha petrificado en <strong>Bronce Oxidado</strong> y las interfaces de conexión han sido herméticamente aisladas. No hay salvoconducto posible.
                  </p>
                </div>
              ) : isUnlocked ? (
                <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex gap-2 items-start text-[11px] font-sans">
                  <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                  <p>
                    <strong>EJECUCIÓN PERMITIDA:</strong> Rito completado con total observancia y gracia. El candado local ha sido abierto y el registro de auditoría del Memory Vault ha sido debidamente firmado.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  
                  {/* Step A: Double Confirm Checkbox */}
                  {activeSimulatedAction.policy === 'confirm_double' && (
                    <label className="flex items-start gap-2.5 cursor-pointer font-mono text-[10px] select-none">
                      <input 
                        type="checkbox"
                        checked={doubleConfirmChecked}
                        onChange={(e) => setDoubleConfirmChecked(e.target.checked)}
                        className="accent-yellow-600 mt-0.5"
                      />
                      <span className="leading-tight text-slate-400">
                        Confirmo de forma irrevocable que asumo la responsabilidad por cualquier mutación, eliminación o rito lateral derivado de esta operación en mi terminal.
                      </span>
                    </label>
                  )}

                  {/* Step B: Slider Trigger */}
                  <div className="space-y-1">
                    <div className="relative flex items-center h-9 rounded-full bg-black/35 overflow-hidden border border-yellow-950/40">
                      
                      {/* Slider filled bar representation */}
                      <div 
                        className={`absolute left-0 top-0 bottom-0 transition-all duration-100 ${
                          activeSimulatedAction.policy === 'confirm_double' && !doubleConfirmChecked
                            ? 'bg-zinc-700/10'
                            : 'bg-gradient-to-r from-yellow-850/20 to-yellow-600/40'
                        }`} 
                        style={{ width: `${sliderVal}%` }}
                      />

                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold tracking-widest text-yellow-600 select-none animate-pulse pointer-events-none">
                        {activeSimulatedAction.policy === 'confirm_double' && !doubleConfirmChecked
                          ? 'SÍRVASE FIRMAR EL PASO DE ARRIBA PRIMERO'
                          : 'DESLIZAR PARA AUTORIZAR ACCIÓN'
                        }
                      </span>

                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={sliderVal}
                        onChange={handleSliderScroll}
                        disabled={activeSimulatedAction.policy === 'confirm_double' && !doubleConfirmChecked}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize disabled:cursor-not-allowed"
                      />

                      {/* Custom Physical slider handle */}
                      {sliderVal < 100 && (
                        <div 
                          className="absolute w-9 h-9 rounded-full bg-gradient-to-b from-yellow-400 to-yellow-600 shadow-md border border-yellow-300 flex items-center justify-center text-[11px] text-yellow-950 font-bold transition-all"
                          style={{ left: `calc(${sliderVal}% - ${sliderVal * 0.36}px)` }}
                        >
                          🛡️
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

        {/* Right Column: The Sovereign Covenant & Signature Manifesto (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-1.5 border-b pb-2 border-current/5">
            <FileText size={13} className="text-yellow-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
              El Pacto Soberano (Covenant)
            </h4>
          </div>

          {/* Covenant custom config */}
          <div className={`p-4 rounded-xl border space-y-4 ${
            theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'
          }`}>
            <span className="text-[9px] font-mono font-bold text-yellow-600 uppercase tracking-widest block">DIRECTIVAS SUPREMAS</span>
            
            {/* Isolation Setting */}
            <div className="space-y-2">
              <label className="text-[10.5px] font-mono text-slate-500 uppercase block font-bold">Nivel de Aislamiento Sideral</label>
              <div className="grid grid-cols-3 gap-1.5 text-[9.5px] font-mono">
                {(['maximum', 'hybrid_sovereign', 'unrestricted'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setIsolationMode(mode);
                      onAddAuditLog('info', `Covenant: Nivel de aislamiento mutado a [${mode.toUpperCase()}].`);
                    }}
                    className={`p-2 rounded border text-center transition-all cursor-pointer ${
                      isolationMode === mode
                        ? 'bg-yellow-600/15 border-yellow-500/40 text-yellow-500 font-bold'
                        : theme === 'light'
                          ? 'bg-white border-zinc-200 text-zinc-650'
                          : 'bg-zinc-900 border-zinc-850 text-slate-400'
                    }`}
                  >
                    {mode === 'maximum' ? 'MÁXIMO' : mode === 'hybrid_sovereign' ? 'HÍBRIDO' : 'ABIERTO'}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-toggles of strict sovereignty */}
            <div className="space-y-2.5 pt-1 text-[10.5px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Filtrado Geográfico (UE):</span>
                <input 
                  type="checkbox"
                  checked={euSovereignty}
                  onChange={(e) => {
                    setEuSovereignty(e.target.checked);
                    onAddAuditLog('info', `Covenant: Filtrado de Soberanía Europea [${e.target.checked ? 'ACTIVADO' : 'DESACTIVADO'}].`);
                  }}
                  className="accent-yellow-600"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Cero Fallback a Nube:</span>
                <input 
                  type="checkbox"
                  checked={zeroCloudFallback}
                  onChange={(e) => {
                    setZeroCloudFallback(e.target.checked);
                    onAddAuditLog('info', `Covenant: Fallback de nube [${e.target.checked ? 'PROHIBIDO' : 'PERMITIDO'}].`);
                  }}
                  className="accent-yellow-600"
                />
              </div>
            </div>

            {/* Digital Covenant Signature Manifesto */}
            <div className="border-t pt-4 border-current/5 space-y-3">
              <p className="font-serif text-[11px] italic leading-relaxed text-slate-650 dark:text-slate-400">
                "Bajo esta firma, el consultante consagra su terminal como santuario. Aglaia se compromete a no propagar ningún codicilo fuera del host privado sin mediar rito y háptica deliberación."
              </p>

              <div className="flex gap-2 text-[10.5px] font-mono">
                <input 
                  type="text"
                  value={signName}
                  onChange={(e) => {
                    setSignName(e.target.value);
                    setCovenantSigned(e.target.value.trim().length > 0);
                  }}
                  className={`flex-1 p-2 rounded border outline-none text-center italic ${
                    theme === 'light' ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-950 border-zinc-900 text-yellow-600'
                  }`}
                  placeholder="Escriba su rúbrica..."
                />
                <div className={`px-2.5 py-2 rounded-lg font-bold border flex items-center justify-center ${
                  covenantSigned 
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-500 border-rose-500/20 animate-pulse'
                }`}>
                  {covenantSigned ? 'SELLADO' : 'PENDIENTE'}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
