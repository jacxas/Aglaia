import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, Play, CornerDownLeft, RefreshCw } from 'lucide-react';
import { TerminalLine } from '../types';

interface TerminalSetupProps {
  onCopyAllCode: () => void;
  selectedPlatform: string;
  theme?: 'dark' | 'light';
}

export default function TerminalSetup({ onCopyAllCode, selectedPlatform, theme = 'dark' }: TerminalSetupProps) {
  const [history, setHistory] = useState<TerminalLine[]>([
    { text: 'Oráculo de Aglaia v1.0.0 - Santuario Digital de Escasez y Esplendor...', type: 'system' },
    { text: 'Escriba "help" o seleccione un enlace digital para configurar el oráculo en su propio entorno.', type: 'output' },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll terminal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Handle command submission
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCommand = inputVal.trim();
    if (!cleanCommand) return;

    const newHistory = [...history, { text: `$ ${cleanCommand}`, type: 'input' as const }];
    setHistory(newHistory);
    setInputVal('');

    setTimeout(() => {
      processCommand(cleanCommand, newHistory);
    }, 150);
  };

  const processCommand = (cmd: string, currentHistory: TerminalLine[]) => {
    const args = cmd.toLowerCase().split(' ');
    const primary = args[0];

    const addLines = (lines: TerminalLine[]) => {
      setHistory([...currentHistory, ...lines]);
    };

    switch (primary) {
      case 'help':
        addLines([
          { text: 'Comandos disponibles:', type: 'system' },
          { text: '  install   - Ver guía paso a paso para el despliegue del oráculo de Aglaia', type: 'output' },
          { text: '  platforms - Listar los enlaces de integraciones activas (Discord, Telegram, Slack, WhatsApp)', type: 'output' },
          { text: '  status    - Verificar estado del espectro de resonancia local', type: 'output' },
          { text: '  aglaia     - Invocar el veredicto introductorio de Aglaia', type: 'success' },
          { text: '  clear     - Limpiar el buffer de la terminal', type: 'output' },
        ]);
        break;

      case 'clear':
        setHistory([]);
        break;

      case 'aglaia':
        addLines([
          { text: "🔱 Aglaia: \"La relevancia no está en la difusión, sino en la rigidez de su exclusividad. Copie este codicilo y proceda.\"", type: 'success' },
        ]);
        break;

      case 'platforms':
        addLines([
          { text: 'Enlaces de Comunicación de Aglaia:', type: 'system' },
          { text: '  • discord  - Enlazar bot de Discord privado al oráculo', type: 'output' },
          { text: '  • telegram - Sincronizar un canal mediante Telegraf', type: 'output' },
          { text: '  • slack    - Acoplar una aplicación SocketMode a su equipo', type: 'output' },
          { text: '  • whatsapp - Forjar un código QR para vincular su chat personal', type: 'output' },
        ]);
        break;

      case 'status':
        addLines([
          { text: 'Host de Resonancia: 127.0.0.1 (Configuración Local)', type: 'system' },
          { text: 'Memoria SQLite: Activa y Custodiada', type: 'output' },
          { text: 'Agente Aglaia: Vinculada y Radiante', type: 'success' },
          { text: 'Enlace activo: ' + (selectedPlatform ? selectedPlatform.toUpperCase() : 'Ninguno seleccionado aún'), type: 'output' },
        ]);
        break;

      case 'install':
        addLines([
          { text: '🔑 GUÍA DE INSTALACIÓN SOBERANA:', type: 'system' },
          { text: '1. mkdir aglaia-oracle && cd aglaia-oracle', type: 'output' },
          { text: '2. Crear package.json y copiar la estructura del codicilo.', type: 'output' },
          { text: '3. Crear archivo .env e insertar su GEMINI_API_KEY.', type: 'output' },
          { text: '4. Ejecutar: npm install', type: 'output' },
          { text: '5. Ejecutar: npm start', type: 'success' },
        ]);
        break;

      default:
        // Try platform detection
        if (['discord', 'telegram', 'slack', 'whatsapp'].includes(primary)) {
          addLines([
            { text: `🔱 Preparando el script de acoplamiento para ${primary.toUpperCase()}...`, type: 'system' },
            { text: `Consulte el panel de integraciones para descargar los codicilos correspondientes.`, type: 'success' },
          ]);
        } else {
          addLines([
            { text: `error: Comando no reconocido: "${primary}". Escriba "help" para ver las opciones disponibles.`, type: 'error' },
          ]);
        }
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const commandSteps = [
    {
      title: '1. Crear Repositorio',
      cmd: 'mkdir aglaia-oracle && cd aglaia-oracle',
      desc: 'Crea un santuario físico privado en su hardware.',
    },
    {
      title: '2. Sincronizar Dependencias',
      cmd: 'npm install @google/genai dotenv discord.js telegraf @slack/bolt whatsapp-web.js qrcode-terminal',
      desc: 'Sincroniza el SDK oficial de Google y los enlaces de telecomunicación.',
    },
    {
      title: '3. Despertar el Oráculo',
      cmd: 'node index.js',
      desc: 'Despierta la presencia de Aglaia, enlazando sus hilos al mundo digital.',
    },
  ];

  return (
    <div className={`transition-all duration-350 rounded-2xl border p-5 shadow-2xl relative overflow-hidden ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-950 border-slate-800/80'}`}>
      {/* Chrome Window Header */}
      <div className={`flex items-center justify-between border-b pb-3 mb-4 ${theme === 'light' ? 'border-zinc-200 bg-white' : 'border-slate-800/60'}`}>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-red-500" />
          <div className="w-3.5 h-3.5 rounded-full bg-amber-500" />
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
          <span className={`font-mono text-xs ml-2 select-none flex items-center gap-1.5 ${theme === 'light' ? 'text-zinc-650' : 'text-slate-400'}`}>
            <Terminal size={14} className="text-yellow-600 animate-pulse" />
            soberano@oracle: ~/aglaia-sanctuary
          </span>
        </div>
        <button
          onClick={() => setHistory([{ text: 'Terminal session restarted.', type: 'system' }])}
          className="text-slate-500 hover:text-slate-350 transition-colors cursor-pointer"
          title="Clear screen"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        className={`h-[250px] overflow-y-auto font-mono text-xs mb-4 scrollbar-thin pr-2 leading-relaxed ${theme === 'light' ? 'scrollbar-thumb-zinc-300 bg-transparent text-zinc-900' : 'scrollbar-thumb-slate-800 bg-transparent text-slate-300'}`}
      >
        {history.map((line, idx) => (
          <div
            key={idx}
            className={`whitespace-pre-wrap ${
              line.type === 'input'
                ? theme === 'light' ? 'text-zinc-950 font-bold' : 'text-slate-200 font-medium'
                : line.type === 'error'
                ? theme === 'light' ? 'text-rose-600 font-semibold' : 'text-rose-400 font-semibold'
                : line.type === 'success'
                ? theme === 'light' ? 'text-emerald-600 font-semibold' : 'text-emerald-400 font-semibold'
                : line.type === 'system'
                ? theme === 'light' ? 'text-orange-605 font-bold' : 'text-orange-400 font-semibold'
                : theme === 'light' ? 'text-zinc-650' : 'text-slate-300'
            }`}
          >
            {line.text}
          </div>
        ))}
        {/* Cursor spacer */}
        <div className="h-2" />
      </div>

      {/* Terminal Input Form */}
      <form onSubmit={handleCommandSubmit} className={`flex font-mono text-xs border-t pt-3 ${theme === 'light' ? 'border-zinc-200' : 'border-slate-900'}`}>
        <span className={theme === 'light' ? 'text-amber-600 font-bold select-none mr-2' : 'text-yellow-500 font-bold select-none mr-2'}>soberano@oracle$</span>
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="escriba 'help' o ejecute 'install'..."
          className={`flex-1 bg-transparent outline-none font-mono w-full ${theme === 'light' ? 'text-zinc-900 placeholder:text-zinc-350' : 'text-slate-150 placeholder:text-slate-700'}`}
          autoFocus
        />
        <button type="submit" className="text-slate-500 hover:text-orange-500 transition-colors ml-2 cursor-pointer">
          <CornerDownLeft size={14} />
        </button>
      </form>

      {/* Dynamic Guided Setup helper buttons */}
      <div className={`border-t mt-5 pt-4 ${theme === 'light' ? 'border-zinc-200' : 'border-slate-900'}`}>
        <h3 className={`font-mono text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${theme === 'light' ? 'text-zinc-700' : 'text-slate-400'}`}>
          <Play size={12} className="text-orange-500" /> Quick-Start Commands For Your Device
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {commandSteps.map((step, idx) => (
            <div key={idx} className={`border p-3 rounded-lg flex flex-col justify-between transition-all duration-305 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 shadow-sm' : 'bg-slate-900 border-slate-850/50'}`}>
              <div>
                <span className={`text-[10px] font-mono uppercase font-bold block mb-1 ${theme === 'light' ? 'text-orange-700' : 'text-orange-400'}`}>
                  {step.title}
                </span>
                <p className={`text-[11px] font-sans mb-3 min-h-[30px] leading-snug ${theme === 'light' ? 'text-zinc-650' : 'text-slate-400'}`}>
                  {step.desc}
                </p>
              </div>
              <div className={`flex items-center justify-between gap-1.5 p-2 rounded-md border ${theme === 'light' ? 'bg-white border-zinc-250' : 'bg-slate-950 border-slate-850'}`}>
                <span className={`font-mono text-[10px] truncate max-w-[130px] select-all ${theme === 'light' ? 'text-zinc-800' : 'text-slate-300'}`}>
                  {step.cmd}
                </span>
                <button
                  onClick={() => copyToClipboard(step.cmd, idx)}
                  className={`transition-colors h-6 w-6 flex items-center justify-center rounded shrink-0 cursor-pointer ${theme === 'light' ? 'bg-zinc-100 hover:bg-zinc-205 text-zinc-500 hover:text-emerald-600' : 'bg-slate-900 hover:text-emerald-400 text-slate-400'}`}
                >
                  {copiedIndex === idx ? <Check size={12} className="text-emerald-500" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
