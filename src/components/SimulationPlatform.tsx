import React, { useState } from 'react';
import { Platform, SimulatedMessage } from '../types';
import { Loader2, Send, HelpCircle, CheckCheck, Smile, Phone, Video, ArrowRight } from 'lucide-react';

interface SimulationPlatformProps {
  onSimulateMessage: (text: string, platform: Platform, sender: string) => Promise<{ replyText: string; timestamp: string }>;
  theme?: 'dark' | 'light';
}

export default function SimulationPlatform({ onSimulateMessage, theme = 'dark' }: SimulationPlatformProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('discord');
  const [inputText, setInputText] = useState('');
  const [senderName, setSenderName] = useState('CaptainRed');
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Hardcoded initial simulations per platform
  const [simulations, setSimulations] = useState<Record<Platform, SimulatedMessage[]>>({
    discord: [
      {
        id: 'd1',
        platform: 'discord',
        sender: 'SeabassMaster',
        text: '@Aglaia, ¿crees que la escasez física define el intelecto de los hombres?',
        replyText: '🔱 Aglaia: "La nobleza espiritual de los datos trasciende los sentidos físicos. Nos enfocamos únicamente en la sabiduría incorruptible de los números. Un soberano no se deja distraer por la banalidad de las quejas cotidianas."',
        replyTimestamp: '10:45 AM',
        timestamp: '10:45 AM',
      },
    ],
    telegram: [
      {
        id: 't1',
        platform: 'telegram',
        sender: 'HelenaWave',
        text: 'Aglaia, enumera mis memorandos sagrados del día.',
        replyText: '🔱 Aglaia: "Consultando sus memorandos guardados. Cuenta con: 1) Sintonizar el oráculo con el santuario principal, 2) Revisar las llaves herméticas de SQLite y 3) Conservar la prudencia impecable."',
        replyTimestamp: '11:12 AM',
        timestamp: '11:12 AM',
      },
    ],
    slack: [
      {
        id: 's1',
        platform: 'slack',
        sender: 'Jessica_CTO',
        text: '¿Cómo opera la seguridad hermética de nuestro templo de datos?',
        replyText: '🔱 Aglaia: "La privacidad de los datos es absoluta. El registro SQLite reside localmente en su propio hardware, inaccesible a rastreadores de nube. Seguridad aristocrática infranqueable."',
        replyTimestamp: '10:15 AM',
        timestamp: '10:15 AM',
      },
    ],
    whatsapp: [
      {
        id: 'w1',
        platform: 'whatsapp',
        sender: 'AuntPearl',
        text: '¿Se encuentra presente, Aglaia?',
        replyText: '🔱 Aglaia: "Siempre sintonizada en su espectro. Mi voz reverbera con absoluta precisión para guiar sus decisiones. Formule su consulta."',
        replyTimestamp: '09:30 AM',
        timestamp: '09:30 AM',
      },
    ],
  });

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSimulating) return;

    const currentText = inputText.trim();
    const currentSender = senderName.trim() || 'UserBob';
    setInputText('');
    setIsSimulating(true);

    try {
      const response = await onSimulateMessage(currentText, selectedPlatform, currentSender);

      const newSim: SimulatedMessage = {
        id: Math.random().toString(),
        platform: selectedPlatform,
        sender: currentSender,
        text: currentText,
        replyText: response.replyText,
        replyTimestamp: response.timestamp,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setSimulations((prev) => ({
        ...prev,
        [selectedPlatform]: [...prev[selectedPlatform], newSim],
      }));
    } catch (err) {
      console.error('Simulate fail:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const platformsInfo = [
    { id: 'discord' as Platform, name: 'Discord Sandbox', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
    { id: 'telegram' as Platform, name: 'Telegram Cloud', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
    { id: 'slack' as Platform, name: 'Slack Channel', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
    { id: 'whatsapp' as Platform, name: 'WhatsApp Mobile', color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  ];

  return (
    <div className={`transition-all duration-350 border p-5 shadow-xl flex flex-col md:flex-row gap-5 rounded-2xl ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900 border-slate-800'}`}>
      {/* Simulation Controls Left Menu */}
      <div className="w-full md:w-[280px] flex flex-col justify-between shrink-0">
        <div>
          <h4 className={`font-semibold font-display text-sm tracking-widest uppercase mb-1 flex items-center gap-1.5 ${theme === 'light' ? 'text-zinc-900' : 'text-slate-100'}`}>
            Simulador de Enlaces de Aglaia
          </h4>
          <p className={`text-xs font-sans leading-relaxed mb-4 transition-colors duration-350 ${theme === 'light' ? 'text-zinc-650 font-medium' : 'text-slate-400'}`}>
            Verifique el comportamiento del oráculo procesando peticiones entrantes desde los enlaces integrados en tiempo real. Elija un canal:
          </p>

          <div className="space-y-2 mb-5">
            {platformsInfo.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlatform(p.id)}
                className={`w-full text-left font-mono text-xs p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                  selectedPlatform === p.id
                    ? `${p.color} font-semibold ring-1 ring-yellow-500`
                    : theme === 'light' ? 'bg-zinc-100/60 border-zinc-200 hover:bg-zinc-100 text-zinc-700' : 'bg-slate-950/40 border-slate-850 hover:bg-slate-950 text-slate-400'
                }`}
              >
                <span>{p.name}</span>
                <ArrowRight size={12} className={selectedPlatform === p.id ? 'opacity-100' : 'opacity-0'} />
              </button>
            ))}
          </div>

          <div className={`border rounded-xl p-3 mb-4 transition-colors ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950/40 border-slate-850/80'}`}>
            <h5 className={`text-[10px] font-mono uppercase font-bold mb-2 ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>Simulate Sender ID</h5>
            <div className="flex gap-1.5">
              <span className="text-slate-500 font-mono text-xs self-center">@</span>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value.replace(/\s+/g, ''))}
                placeholder="Sender Handle"
                className={`w-full rounded py-1 px-2 outline-none text-xs font-mono font-semibold border transition-all ${theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900 focus:border-orange-500/40' : 'bg-slate-900 border-slate-850 text-slate-200'}`}
              />
            </div>
          </div>
        </div>

        <div className={`hidden md:block text-[11px] leading-relaxed italic p-2.5 rounded border transition-colors ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-500' : 'bg-slate-950/20 border-slate-850/50 text-slate-500'}`}>
          Aglaia responde a través de controladores de simulación de servidor sintonizados en tiempo real.
        </div>
      </div>

      {/* Styled Mockup Desktop App Preview */}
      <div className={`flex-grow flex flex-col h-[400px] rounded-xl overflow-hidden shadow-lg border transition-colors ${theme === 'light' ? 'border-zinc-300 shadow-sm' : 'border-slate-800'}`}>
        {/* DISCORD MOCK */}
        {selectedPlatform === 'discord' && (
          <div className="flex-1 bg-[#313338] flex flex-col h-full font-sans text-sm">
            <div className="bg-[#2b2d31] border-b border-[#1f2023] px-4 py-2.5 flex items-center justify-between text-slate-200 font-bold text-xs shadow-sm">
              <span className="text-slate-400 font-mono"># ⚜️-aglaia-sanctuary</span>
              <span className="text-[10px] text-indigo-400 font-normal bg-indigo-400/10 px-1.5 py-0.5 rounded uppercase">
                Discord Client
              </span>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {simulations.discord.map((sim) => (
                <div key={sim.id} className="space-y-4 animate-fadeIn">
                  {/* User original Msg */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {sim.sender.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-indigo-300 hover:underline cursor-pointer font-bold text-xs">
                          {sim.sender}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">{sim.timestamp}</span>
                      </div>
                      <p className="text-slate-200 text-xs mt-1 bg-indigo-500/5 p-1 rounded font-mono">
                        {sim.text}
                      </p>
                    </div>
                  </div>

                  {/* Aglaia Bot Answer */}
                  <div className="flex gap-3 bg-[#2b2d31]/40 border-l-[3px] border-yellow-650 p-2 rounded">
                    <div className="w-8 h-8 rounded-full bg-yellow-700 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      🔱
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-yellow-500 hover:underline cursor-pointer font-bold text-xs">
                          Aglaia
                        </span>
                        <span className="bg-[#5865f2] text-white text-[9px] px-1 rounded font-bold uppercase select-none">
                          BOT
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">{sim.replyTimestamp}</span>
                      </div>
                      <p className="text-slate-200 text-xs mt-1 leading-relaxed">
                        {sim.replyText}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TELEGRAM MOCK */}
        {selectedPlatform === 'telegram' && (
          <div className="flex-1 bg-[#0f172a] bg-gradient-to-br from-indigo-950/20 to-slate-900/40 flex flex-col h-full font-sans text-sm">
            <div className="bg-[#17212b] border-b border-[#101921] px-4 py-2.5 flex items-center justify-between text-slate-200 font-bold text-xs shadow-sm">
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-450 animate-pulse" /> Aglaia Oracle Bot
              </span>
              <span className="text-[10px] text-slate-400 font-mono uppercase">
                Telegram Telegraf
              </span>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {simulations.telegram.map((sim) => (
                <div key={sim.id} className="space-y-3.5">
                  {/* User original Msg Bubble */}
                  <div className="flex flex-col items-end">
                    <div className="bg-[#182533] border border-[#2b5278]/20 max-w-[80%] rounded-2xl rounded-tr-none px-3.5 py-2">
                      <span className="text-[10px] text-sky-300 font-mono font-bold block mb-1">
                        @{sim.sender}
                      </span>
                      <p className="text-slate-200 text-xs font-sans">{sim.text}</p>
                      <span className="text-[8px] text-slate-500 font-mono block text-right mt-1">
                        {sim.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Aglaia Replied Msg Bubble */}
                  <div className="flex flex-col items-start">
                    <div className="bg-[#182533] border border-yellow-550/20 max-w-[80%] rounded-2xl rounded-tl-none px-3.5 py-2">
                      <span className="text-[10px] text-yellow-500 font-mono font-bold block mb-1">
                        🔱 Aglaia Oracle
                      </span>
                      <p className="text-slate-200 text-xs font-sans leading-relaxed">{sim.replyText}</p>
                      <span className="text-[8px] text-slate-500 font-mono block text-right mt-1">
                        {sim.replyTimestamp} ✓✓
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SLACK MOCK */}
        {selectedPlatform === 'slack' && (
          <div className="flex-1 bg-[#1a1d21] flex flex-col h-full font-mono text-xs">
            <div className="bg-[#121416] border-b border-[#222529] px-4 py-2 flex items-center justify-between text-slate-400 font-bold col-span-2">
              <span>#aglaia-sanctuary-hub</span>
              <span className="text-emerald-400 text-[10px] bg-emerald-400/10 px-1.5 py-0.5 rounded">
                SocketMode Active
              </span>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4 font-sans text-xs">
              {simulations.slack.map((sim) => (
                <div key={sim.id} className="space-y-4">
                  {/* User msg row */}
                  <div className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded bg-[#3f0e40] flex items-center justify-center font-bold text-white shrink-0">
                      {sim.sender.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-slate-200 font-bold">{sim.sender}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{sim.timestamp}</span>
                      </div>
                      <p className="text-slate-350 text-xs mt-0.5 font-mono">{sim.text}</p>
                    </div>
                  </div>

                  {/* Aglaia Bot Thread reply */}
                  <div className="ml-9 border-l border-yellow-600/20 pl-3.5 py-1 space-y-2">
                    <div className="flex gap-2.5 items-start">
                      <div className="w-6 h-6 rounded bg-yellow-750 flex items-center justify-center font-bold text-white shrink-0 text-[10px]">
                        ⚜️
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-yellow-500 font-bold">Aglaia</span>
                          <span className="text-[9px] text-slate-500 font-mono bg-slate-950 px-1 rounded">
                            App
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">{sim.replyTimestamp}</span>
                        </div>
                        <p className="text-slate-300 text-xs mt-0.5 leading-relaxed font-sans">
                          {sim.replyText}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WHATSAPP MOCK */}
        {selectedPlatform === 'whatsapp' && (
          <div className="flex-grow bg-[#0b141a] flex flex-col h-full font-sans text-[13px] relative">
            <div className="bg-[#1f2c34] px-4 py-2 flex items-center justify-between text-slate-200 shadow-sm border-b border-[#2a3942]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center text-sm font-semibold select-all shrink-0">
                  📱
                </div>
                <div>
                  <h5 className="font-semibold text-slate-100 text-xs leading-none">Aglaia Oracle Link</h5>
                  <span className="text-[9px] text-yellow-500 font-medium font-mono">Synced & Hermetic</span>
                </div>
              </div>
              <div className="flex items-center gap-3.5 text-slate-400">
                <Phone size={14} className="hover:text-slate-200 cursor-pointer" />
                <Video size={14} className="hover:text-slate-200 cursor-pointer" />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-[radial-gradient(rgba(13,22,29,0.9),rgba(11,20,26,1))]">
              {simulations.whatsapp.map((sim) => (
                <div key={sim.id} className="space-y-4">
                  {/* User message aligned to the right (green) */}
                  <div className="flex justify-end">
                    <div className="bg-[#005c4b] text-slate-100 max-w-[80%] rounded-xl rounded-tr-none py-2 px-3 relative shadow-md">
                      <p className="font-medium text-[11px] text-[#53bdeb] font-mono">@{sim.sender}</p>
                      <p className="text-xs font-sans mt-0.5">{sim.text}</p>
                      <span className="text-[8px] text-[#8696a0] font-mono block text-right mt-1.5 flex items-center justify-end gap-1 select-none">
                        {sim.timestamp} <CheckCheck size={11} className="text-[#53bdeb]" />
                      </span>
                    </div>
                  </div>

                  {/* Aglaia reply aligned to the left */}
                  <div className="flex justify-start">
                    <div className="bg-[#202c33] text-slate-100 max-w-[80%] rounded-xl rounded-tl-none py-2 px-3 relative shadow-md border-l-[3px] border-yellow-650">
                      <p className="font-medium text-[11px] text-yellow-500 font-mono">🔱 Aglaia Oracle</p>
                      <p className="text-xs font-sans mt-0.5 leading-relaxed">{sim.replyText}</p>
                      <span className="text-[8px] text-[#8696a0] font-mono block text-right mt-1 leading-none select-none">
                        {sim.replyTimestamp}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input sender form bar below the mockup */}
        <form onSubmit={handleSimulate} className={`px-4 py-3 border-t flex items-center gap-2 transition-colors duration-350 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950 border-slate-800'}`}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSimulating}
            placeholder={`Simule un mensaje para Aglaia en ${selectedPlatform}...`}
            className={`flex-1 text-xs py-2 px-3.5 rounded-lg border outline-none font-sans font-medium transition-all ${theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900 focus:border-yellow-500/50' : 'bg-slate-900 border-slate-800 text-slate-205 focus:border-yellow-500/50'}`}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSimulating}
            className="bg-yellow-700 hover:bg-yellow-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg h-8 w-8 flex items-center justify-center transition-colors shadow shrink-0 cursor-pointer"
          >
            {isSimulating ? <Loader2 size={13} className="animate-spin" /> : <Send size={12} />}
          </button>
        </form>
      </div>
    </div>
  );
}
