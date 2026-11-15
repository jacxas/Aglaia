import React, { useState } from 'react';
import { 
  Shield, Server, Globe, Cpu, AlertOctagon, Code, Database, 
  Terminal, ShieldCheck, Play, Plus, BookOpen, Key, Info, Zap, ChevronRight, Check, CheckCircle2
} from 'lucide-react';
import { ToolManifest, TOOL_REGISTRY } from '../orbiter';

interface ToolRegistryManifestoProps {
  theme: 'light' | 'dark';
}

const EXTENSION_TEMPLATE_TYPES = [
  { id: 'git_sync', name: 'Sincronizador Git Soberano', icon: '🔱' },
  { id: 'audit_crypto', name: 'Auditor Criptográfico', icon: '🔐' },
  { id: 'vector_builder', name: 'Indexador de Embeddings Local', icon: '📐' },
  { id: 'file_sentinel', name: 'Centinela de Cambios', icon: '👁️' }
];

export default function ToolRegistryManifesto({ theme }: ToolRegistryManifestoProps) {
  // Tool registry list state
  const [tools, setTools] = useState<ToolManifest[]>(TOOL_REGISTRY);
  const [selectedToolId, setSelectedToolId] = useState<string>(TOOL_REGISTRY[0].id);

  // Form states for the Extension SDK Constructor
  const [newToolId, setNewToolId] = useState('GitSentinelAgent');
  const [newToolName, setNewToolName] = useState('Git Sentinel Agent');
  const [newDescription, setNewDescription] = useState('Inspecciona y firma commits de manera hermética antes de subirlos a la red celestial.');
  const [preferredContext, setPreferredContext] = useState<'local' | 'remote'>('local');
  const [canRunLocal, setCanRunLocal] = useState(true);
  const [canRunRemote, setCanRunRemote] = useState(false);
  const [requiresInternet, setRequiresInternet] = useState(false);
  const [touchesConfidential, setTouchesConfidential] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['filesystem', 'workspace_read']);

  // Registration success indicator
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Active Selected Tool for inspection
  const activeTool = tools.find(t => t.id === selectedToolId) || tools[0];

  // Helper toggle permission
  const handleTogglePermission = (perm: string) => {
    if (selectedPermissions.includes(perm)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== perm));
    } else {
      setSelectedPermissions([...selectedPermissions, perm]);
    }
  };

  // Preset templates for quickly filling the SDK Constructor
  const handleApplyTemplate = (typeId: string) => {
    if (typeId === 'git_sync') {
      setNewToolId('GitSyncAgent');
      setNewToolName('Soberano Git Synchronizer');
      setNewDescription('Sincroniza commits locales con repositorios remotos asegurando que no se expongan llaves privadas ni archivos .env.');
      setPreferredContext('local');
      setCanRunLocal(true);
      setCanRunRemote(true);
      setRequiresInternet(true);
      setTouchesConfidential(true);
      setSelectedPermissions(['filesystem', 'workspace_read', 'network_access']);
    } else if (typeId === 'audit_crypto') {
      setNewToolId('CryptoAuditorAgent');
      setNewToolName('Heráldico Crypto Auditor');
      setNewDescription('Analiza firmas de código y verifica hashes de dependencias locales contrastándolas con bases de datos de vulnerabilidad.');
      setPreferredContext('local');
      setCanRunLocal(true);
      setCanRunRemote(false);
      setRequiresInternet(false);
      setTouchesConfidential(true);
      setSelectedPermissions(['code_analysis', 'workspace_read']);
    } else if (typeId === 'vector_builder') {
      setNewToolId('VectorIndexAgent');
      setNewToolName('Indexador de Codicilos Vectoriales');
      setNewDescription('Genera y almacena embeddings locales a partir de documentos de texto en la bóveda hermética de SQLite.');
      setPreferredContext('local');
      setCanRunLocal(true);
      setCanRunRemote(false);
      setRequiresInternet(false);
      setTouchesConfidential(true);
      setSelectedPermissions(['sqlite_write', 'sqlite_read', 'vector_search']);
    } else if (typeId === 'file_sentinel') {
      setNewToolId('FileSentinelAgent');
      setNewToolName('Centinela de Cambios');
      setNewDescription('Vigila pasivamente cambios en carpetas santuario locales y notifica discrepancias antes del inicio de tareas del terminal.');
      setPreferredContext('local');
      setCanRunLocal(true);
      setCanRunRemote(false);
      setRequiresInternet(false);
      setTouchesConfidential(true);
      setSelectedPermissions(['filesystem', 'workspace_read']);
    }
  };

  // Submit and register custom extension in state
  const handleRegisterExtension = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToolId.trim() || !newToolName.trim()) return;

    // Check if ID already exists
    if (tools.some(t => t.id === newToolId)) {
      alert("La herramienta con este ID ya está inscrita en el registro soberano.");
      return;
    }

    const customTool: ToolManifest = {
      id: newToolId,
      name: newToolName,
      description: newDescription,
      preferredContext,
      canRunLocal,
      canRunRemote,
      requiresInternet,
      permissions: selectedPermissions,
      touchesConfidential
    };

    setTools([...tools, customTool]);
    setSelectedToolId(customTool.id);
    setShowSuccessToast(true);

    // Auto clear notification
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 4500);
  };

  // TypeScript SDK code generator based on live parameters
  const generateSDKCode = () => {
    const permissionsArrayStr = JSON.stringify(selectedPermissions);
    return `import { AglaiaAgent, ToolManifest, ExecutionContext } from "@aglaia/os-sdk";

/**
 * Manifiesto Técnico de la Extensión Soberana
 */
export const MANIFEST: ToolManifest = {
  id: "${newToolId}",
  name: "${newToolName}",
  description: "${newDescription}",
  preferredContext: "${preferredContext}",
  canRunLocal: ${canRunLocal},
  canRunRemote: ${canRunRemote},
  requiresInternet: ${requiresInternet},
  permissions: ${permissionsArrayStr},
  touchesConfidential: ${touchesConfidential}
};

export class ${newToolId}Class extends AglaiaAgent {
  constructor() {
    super(MANIFEST);
  }

  @SovereignGate({
    redactPayload: ${touchesConfidential},
    requiresConsent: ${preferredContext === 'remote' || requiresInternet}
  })
  async execute(params: { query: string }, context: ExecutionContext) {
    const host = this.getHost();
    
    if (context === "local") {
      this.log("Iniciando ejecución hermética local...");
      return await host.executeHermeticTask(params.query);
    } else {
      this.log("Saneando parámetros antes de conmutar a la red celestial...");
      const cleanQuery = this.sanitize(params.query);
      return await host.queryCelestialGrid(cleanQuery);
    }
  }
}`;
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
          <span className="text-xl">🛠️</span>
          <div>
            <h3 className="font-bold font-display text-base tracking-wide uppercase">
              Registro de Herramientas y Manifiesto <span className="text-yellow-600 font-mono text-xs">(Tool Registry)</span>
            </h3>
            <p className={`text-[10px] font-mono uppercase tracking-wider mt-0.5 ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>
              Manifiestos Técnicos, Huellas de Seguridad y SDK de Extensibilidad
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-bold font-mono tracking-widest uppercase border bg-yellow-650/10 text-yellow-500 border-yellow-500/20">
          MANIFIESTOS DE AGENTE: {tools.length}
        </span>
      </div>

      {/* Grid Layout: Left tool list & inspection card, Right SDK tool constructor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Tool List & Detail Inspector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-1.5 border-b pb-2 border-current/5">
            <BookOpen size={13} className="text-yellow-600" />
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
              Catálogo de Agentes Registrados
            </h4>
          </div>

          {/* Quick list selector */}
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedToolId(t.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-mono transition-all flex items-center justify-between ${
                  selectedToolId === t.id
                    ? 'bg-yellow-600/10 border-yellow-500/40 text-yellow-500 font-bold'
                    : theme === 'light'
                      ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                      : 'bg-zinc-900/40 hover:bg-zinc-900 border-zinc-900 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{t.id === 'DesktopAgent' ? '🖥️' : t.id === 'BrowserAgent' ? '🌐' : t.id === 'CodeAgent' ? '💻' : t.id === 'DatabaseAgent' ? '🗄️' : '🔱'}</span>
                  <span>{t.id}</span>
                </div>
                <ChevronRight size={12} className={selectedToolId === t.id ? 'opacity-100' : 'opacity-40'} />
              </button>
            ))}
          </div>

          {/* Detailed Inspector Card */}
          {activeTool && (
            <div className={`p-4 rounded-xl border space-y-4 transition-all duration-300 ${
              theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/80 border-zinc-900/60'
            }`}>
              {/* Tool identity */}
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold text-yellow-600 uppercase tracking-widest block">FICHA TÉCNICA DEL AGENTE</span>
                <h5 className="font-bold font-display text-sm text-slate-800 dark:text-slate-100">{activeTool.name}</h5>
                <p className={`text-[11px] leading-relaxed italic ${theme === 'light' ? 'text-zinc-650' : 'text-slate-400'}`}>
                  "{activeTool.description}"
                </p>
              </div>

              {/* Specifications grid */}
              <div className="grid grid-cols-2 gap-3 text-[10.5px] font-mono border-t pt-3 border-current/5">
                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 block uppercase">Contexto de Diseño:</span>
                  <span className={`font-bold flex items-center gap-1 ${
                    activeTool.preferredContext === 'local' ? 'text-zinc-400' : 'text-yellow-500'
                  }`}>
                    {activeTool.preferredContext === 'local' ? <Server size={10} /> : <Globe size={10} />}
                    {activeTool.preferredContext.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 block uppercase">Huella Confidencial:</span>
                  <span className={`font-bold ${activeTool.touchesConfidential ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {activeTool.touchesConfidential ? '🔒 SENSITIVA' : '🔓 PÚBLICA'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 block uppercase">Canales de Cómputo:</span>
                  <div className="flex gap-1.5">
                    <span className={activeTool.canRunLocal ? 'text-emerald-500' : 'text-slate-650'}>Local</span>
                    <span className="text-slate-600">|</span>
                    <span className={activeTool.canRunRemote ? 'text-yellow-500' : 'text-slate-650'}>Remoto</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[9px] text-slate-500 block uppercase">Enlace Digital:</span>
                  <span className={activeTool.requiresInternet ? 'text-amber-500' : 'text-slate-500'}>
                    {activeTool.requiresInternet ? 'Reclama Internet' : 'Hermético'}
                  </span>
                </div>
              </div>

              {/* Permissions & Sandbox constraints */}
              <div className="space-y-2 border-t pt-3 border-current/5">
                <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  Permisos de Seguridad Reclamados (Sandbox Footprint):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeTool.permissions.map((perm, idx) => (
                    <span 
                      key={idx} 
                      className={`px-2 py-0.5 rounded text-[9.5px] font-mono border ${
                        theme === 'light'
                          ? 'bg-zinc-100 border-zinc-200 text-zinc-700'
                          : 'bg-zinc-900 border-zinc-800 text-slate-350'
                      }`}
                    >
                      🛡️ {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: SDK Extensibility Interface & Creator (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b pb-2 border-current/5">
            <div className="flex items-center gap-1.5">
              <Code size={13} className="text-yellow-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider font-mono">
                Creador de Extensiones y SDK Aglaia OS
              </h4>
            </div>
            <span className="text-[9px] font-mono bg-yellow-600/10 text-yellow-500 px-2 py-0.5 rounded uppercase">
              Sandbox SDK v1
            </span>
          </div>

          {/* Quick template selector */}
          <div className="flex flex-wrap gap-2 items-center text-[10.5px] font-mono bg-black/5 dark:bg-black/25 p-2 rounded-lg border border-current/5">
            <span className="text-slate-500 font-bold uppercase">Plantillas:</span>
            {EXTENSION_TEMPLATE_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleApplyTemplate(t.id)}
                className={`px-2 py-1 rounded transition-all border cursor-pointer ${
                  theme === 'light'
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-800'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-850 text-slate-350 hover:text-yellow-500'
                }`}
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>

          {/* Two-Column split: Form controls (Left) & Live TS Code (Right) */}
          <form onSubmit={handleRegisterExtension} className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Form Controls */}
            <div className="md:col-span-6 space-y-3.5 text-[11px] font-mono">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase block">Clave Única (ID):</label>
                <input 
                  type="text" 
                  value={newToolId}
                  onChange={(e) => setNewToolId(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className={`w-full p-2 rounded border outline-none ${
                    theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-slate-200'
                  }`}
                  placeholder="Ej: GitSentinelAgent"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase block">Nombre Descriptivo:</label>
                <input 
                  type="text" 
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  className={`w-full p-2 rounded border outline-none ${
                    theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-slate-200'
                  }`}
                  placeholder="Ej: Git Sentinel"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase block">Descripción del Vínculo:</label>
                <textarea 
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className={`w-full h-[55px] p-2 rounded border outline-none resize-none ${
                    theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-slate-200'
                  }`}
                  placeholder="Función de la extensión..."
                  required
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={canRunLocal}
                    onChange={(e) => setCanRunLocal(e.target.checked)}
                    className="accent-yellow-600"
                  />
                  <span>Permitir Local</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={canRunRemote}
                    onChange={(e) => setCanRunRemote(e.target.checked)}
                    className="accent-yellow-600"
                  />
                  <span>Permitir Remoto</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={requiresInternet}
                    onChange={(e) => setRequiresInternet(e.target.checked)}
                    className="accent-yellow-600"
                  />
                  <span>Requiere Internet</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={touchesConfidential}
                    onChange={(e) => setTouchesConfidential(e.target.checked)}
                    className="accent-yellow-600"
                  />
                  <span>Firma Privada</span>
                </label>
              </div>

              {/* Permissions selector */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase block">Permisos Reclamados:</label>
                <div className="flex flex-wrap gap-1.5 max-h-[75px] overflow-y-auto border border-current/5 p-2 rounded-lg bg-black/5 dark:bg-black/20">
                  {['filesystem', 'workspace_read', 'workspace_write', 'process_exec', 'network_access', 'code_analysis', 'sqlite_read', 'sqlite_write', 'vector_search'].map((perm) => {
                    const isSelected = selectedPermissions.includes(perm);
                    return (
                      <button
                        type="button"
                        key={perm}
                        onClick={() => handleTogglePermission(perm)}
                        className={`px-1.5 py-0.5 rounded text-[8.5px] border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-yellow-600/10 border-yellow-500/40 text-yellow-500 font-bold'
                            : 'bg-zinc-500/5 border-zinc-500/10 text-slate-500'
                        }`}
                      >
                        {perm}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-yellow-700 to-amber-600 hover:from-yellow-650 hover:to-amber-550 text-white font-bold rounded-xl shadow-md uppercase tracking-wider cursor-pointer text-xs"
              >
                Inscribir Extensión en Core
              </button>
            </div>

            {/* Generated SDK Code display */}
            <div className="md:col-span-6 space-y-2">
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest block">Código SDK Autogenerado (TS)</span>
              <pre className={`p-3 rounded-xl border font-mono text-[9px] text-yellow-650 h-[335px] overflow-y-auto whitespace-pre leading-relaxed shadow-inner ${
                theme === 'light' ? 'bg-zinc-950 text-zinc-300 border-zinc-200' : 'bg-black/55 text-zinc-400 border-zinc-900'
              }`}>
                {generateSDKCode()}
              </pre>
            </div>

          </form>
        </div>

      </div>

      {/* Registration success toast */}
      {showSuccessToast && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 flex gap-3 text-xs leading-relaxed animate-fade-in">
          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold uppercase font-mono tracking-wider">REGISTRO SOBERANO COMPLETADO</p>
            <p className="font-sans opacity-90">La herramienta <strong>{newToolId}</strong> ha sido inscrita en el Kernel de Aglaia OS. Ahora es completamente visible para el planificador oracular de decisiones del Orbiter Core.</p>
          </div>
        </div>
      )}

    </div>
  );
}
