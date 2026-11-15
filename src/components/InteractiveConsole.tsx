import React, { useState, useRef, useEffect } from 'react';
import { Send, Volume2, Sparkles, Loader2, Play, Square, Settings, Radio, Globe, ExternalLink } from 'lucide-react';
import { GroundingSource, Message } from '../types';

interface InteractiveConsoleProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onSpeakText: (text: string) => Promise<string>;
  onSendMessage: (
    text: string,
    history: Message[],
    enableGoogleSearch?: boolean
  ) => Promise<{ text: string; sources?: GroundingSource[]; searchQueries?: string[] }>;
  theme?: 'dark' | 'light';
}

export default function InteractiveConsole({ messages, setMessages, onSpeakText, onSendMessage, theme = 'dark' }: InteractiveConsoleProps) {
  const [inputText, setInputText] = useState('');
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState<string | null>(null);
  const [activeVoice, setActiveVoice] = useState('Kore');
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(45);
  const [micActivityLevel, setMicActivityLevel] = useState<number>(20);
  const [enableGoogleSearch, setEnableGoogleSearch] = useState<boolean>(true);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate ambient audio levels for the voice-to-text threshold gate
  useEffect(() => {
    let frameId: number;
    let waveTime = 0;
    
    const simulateMicLevel = () => {
      waveTime += 0.05;
      // Ambient floor dynamic noise
      const floorNoise = 12 + Math.random() * 5;
      // Periodic speaking cycle
      const speakIntensity = Math.sin(waveTime * 0.15);
      const activeVoice = speakIntensity > 0.35 ? (30 + Math.sin(waveTime * 4.4) * 22 + Math.random() * 10) : 0;
      const finalLevel = Math.max(0, Math.min(100, Math.floor(floorNoise + activeVoice)));
      setMicActivityLevel(finalLevel);
      frameId = requestAnimationFrame(simulateMicLevel);
    };
    
    frameId = requestAnimationFrame(simulateMicLevel);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Handle playing generated voice clip
  const playVoiceClip = async (messageId: string, text: string) => {
    // If already playing, stop
    if (playingAudioId === messageId && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    try {
      setIsGeneratingSpeech(messageId);
      // Clean up markdown markers or brackets for cleaner TTS
      const cleanText = text.replace(/[*_#`🦞🦀]/g, '').trim();

      const base64Audio = await onSpeakText(cleanText);
      
      // Decode base64 to blob
      const binaryString = window.atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      setPlayingAudioId(messageId);
      setIsGeneratingSpeech(null);

      audio.play();
      audio.onended = () => {
        setPlayingAudioId(null);
      };
    } catch (err) {
      console.error('🦞 TTS Playback Failed:', err);
      setIsGeneratingSpeech(null);
      setPlayingAudioId(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsSending(true);

    try {
      // Get conversation reply from server using current history and live search setting
      const reply = await onSendMessage(userMsg.text, messages, enableGoogleSearch);

      const assistantMsg: Message = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: reply.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...(reply.sources && reply.sources.length > 0 ? { sources: reply.sources } : {}),
        ...(reply.searchQueries && reply.searchQueries.length > 0 ? { searchQueries: reply.searchQueries } : {}),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Automatically play Aglaia's voice!
      setTimeout(() => {
        playVoiceClip(assistantMsg.id, assistantMsg.text);
      }, 300);

    } catch (err: any) {
      const assistantError: Message = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: "⚜️ La sintonía hermética se ha desvanecido momentáneamente: " + (err.message || "communication failed."),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantError]);
    } finally {
      setIsSending(false);
    }
  };

  const speakPreset = (presetText: string) => {
    setInputText(presetText);
  };

  const voicesList = [
    { id: 'Kore', label: 'Kore (Sacerdotisa del Sol)' },
    { id: 'Charon', label: 'Charón (Custodio del Olvido)' },
    { id: 'Puck', label: 'Puck (Eter del Viento)' },
    { id: 'Fenrir', label: 'Fenrir (Fuerza del Norte)' },
    { id: 'Zephyr', label: 'Zephyr (Brisa del Alba)' },
  ];

  return (
    <div className={`transition-all duration-350 border rounded-2xl flex flex-col h-[530px] shadow-2xl overflow-hidden ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-yellow-900/30'}`}>
      {/* Console Head */}
      <div className={`px-4 py-3 flex items-center justify-between border-b transition-colors duration-350 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-[#0a0a0c]/80 border-yellow-950/40'}`}>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 animate-ping absolute -top-0.5 -right-0.5" />
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${theme === 'light' ? 'border-zinc-300 bg-zinc-100' : 'border-yellow-650/30 bg-[#070709]'}`}>
              <span className="text-sm">🔱</span>
            </div>
          </div>
          <div>
            <h3 className={`font-semibold text-sm leading-tight flex items-center gap-1.5 font-display tracking-widest uppercase text-yellow-600 dark:text-yellow-500`}>
              Consola Oracular Aglaia
            </h3>
            <span className="text-[10px] text-yellow-600/70 font-mono flex items-center gap-1">
              <Radio size={10} className="animate-pulse text-yellow-500" /> Espectro Sintonizado • Enlace Hermético
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setEnableGoogleSearch((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-semibold transition-all cursor-pointer ${
              enableGoogleSearch
                ? theme === 'light'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-emerald-950/30 border-emerald-500/35 text-emerald-400'
                : theme === 'light'
                ? 'bg-zinc-100 border-zinc-250 text-zinc-500'
                : 'bg-black/40 border-zinc-800 text-slate-400'
            }`}
            title="Enable or disable live Google Search grounding for up-to-date answers"
          >
            <Globe size={11} />
            <span>{enableGoogleSearch ? 'Live Search: ON' : 'Live Search: OFF'}</span>
          </button>

          {/* Voice Selector */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all duration-350 ${theme === 'light' ? 'bg-zinc-100 border-zinc-250 text-zinc-800' : 'bg-black/40 border-yellow-950/20'}`}>
            <Settings size={12} className={theme === 'light' ? 'text-zinc-500' : 'text-yellow-600/50'} />
            <span className={`font-mono text-[9px] uppercase tracking-wider select-none ${theme === 'light' ? 'text-zinc-650' : 'text-yellow-650/70'}`}>
              Tono:
            </span>
            <select
              value={activeVoice}
              onChange={(e) => setActiveVoice(e.target.value)}
              className={`bg-transparent text-xs font-semibold outline-none border-none pr-1 font-mono cursor-pointer ${theme === 'light' ? 'text-yellow-700' : 'text-yellow-500'}`}
            >
              {voicesList.map((voice) => (
                <option key={voice.id} value={voice.id} className={theme === 'light' ? 'bg-white text-zinc-900' : 'bg-[#0d0d11] text-yellow-600'}>
                  {voice.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* V2T Input Sensitivity & Gate Meter */}
      <div className={`px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0 select-none border-b transition-colors duration-350 ${theme === 'light' ? 'bg-zinc-50/75 border-zinc-200 text-zinc-800' : 'bg-black/30 border-yellow-950/20 text-slate-150'}`}>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {micActivityLevel >= sensitivity ? (
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/50 absolute animate-ping" />
            ) : null}
            <span className={`w-2 h-2 rounded-full transition-colors duration-150 ${micActivityLevel >= sensitivity ? 'bg-yellow-500' : 'bg-zinc-800'}`} />
          </div>
          <span className={`font-mono text-[10px] uppercase tracking-wider flex items-center gap-1.5 font-bold ${theme === 'light' ? 'text-zinc-650' : 'text-yellow-650/70'}`}>
            Sensibilidad de Filtro:
          </span>
          <span className={`font-mono text-xs font-semibold ${theme === 'light' ? 'text-yellow-700' : 'text-yellow-500'}`}>{sensitivity}%</span>
        </div>

        <div className="flex items-center gap-3.5 flex-1 max-w-full sm:max-w-[280px]">
          {/* Slider input */}
          <input
            type="range"
            min="5"
            max="95"
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className={`flex-1 h-1 rounded-lg appearance-none cursor-pointer accent-yellow-600 hover:accent-yellow-500 focus:outline-none transition-colors ${theme === 'light' ? 'bg-zinc-300' : 'bg-yellow-950/25'}`}
            title="Adjust resonance gate filter sensitivity"
          />

          {/* Decibel signal visualizer */}
          <div className={`w-20 h-3 rounded relative overflow-hidden flex items-center border transition-all ${theme === 'light' ? 'bg-zinc-200 border-zinc-350' : 'bg-black border-yellow-950/30'}`}>
            <div 
              className="h-full bg-gradient-to-r from-yellow-700/70 to-yellow-500/70 transition-all duration-75"
              style={{ width: `${micActivityLevel}%` }}
            />
            {/* Overlay line showing threshold */}
            <div 
              className="absolute top-0 bottom-0 w-[2.5px] bg-yellow-400 z-10 shadow"
              style={{ left: `${sensitivity}%` }}
              title={`Gate Threshold: ${sensitivity}%`}
            />
          </div>

          <span className="font-mono text-[10px] w-12 text-right">
            {micActivityLevel >= sensitivity ? (
              <span className="text-yellow-600 dark:text-yellow-500 font-bold tracking-tight">ACTIVO</span>
            ) : (
              <span className="text-yellow-950/50 font-medium tracking-tight">SILENCIO</span>
            )}
          </span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin transition-colors duration-300 ${theme === 'light' ? 'bg-zinc-50/40 scrollbar-thumb-zinc-300' : 'scrollbar-thumb-yellow-950 bg-transparent'}`}>
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-1 opacity-45 mb-1">
              <span className={`text-[9px] font-mono uppercase tracking-widest ${theme === 'light' ? 'text-zinc-600' : 'text-yellow-600/60'}`}>
                {msg.sender === 'user' ? 'Consultante Sacerdote' : 'Aglaia'}
              </span>
              <span className={`text-[8px] font-mono ${theme === 'light' ? 'text-zinc-550' : 'text-yellow-750/50'}`}>• {msg.timestamp}</span>
            </div>
            <div className="flex items-end gap-2 group max-w-[85%]">
              {msg.sender === 'assistant' && (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mb-1 border ${theme === 'light' ? 'bg-yellow-50 border-yellow-200 shadow-sm' : 'bg-black border-yellow-950/20'}`}>
                  ⚜️
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed relative border transition-all ${
                  msg.sender === 'user'
                    ? 'bg-yellow-700 text-white rounded-br-none border-transparent shadow-md'
                    : theme === 'light'
                      ? 'bg-white text-zinc-900 border-zinc-250 rounded-bl-none shadow-sm'
                      : 'bg-black/40 text-yellow-100/90 font-serif tracking-wide border-yellow-950/20 rounded-bl-none'
                }`}
              >
                {msg.text}

                {msg.sender === 'assistant' && ((msg.sources && msg.sources.length > 0) || (msg.searchQueries && msg.searchQueries.length > 0)) && (
                  <div className={`mt-2.5 pt-2 border-t text-[10px] font-mono space-y-1.5 ${
                    theme === 'light' ? 'border-zinc-200 text-zinc-600' : 'border-yellow-900/30 text-slate-300'
                  }`}>
                    <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-wider font-bold text-emerald-500">
                      <Globe size={10} />
                      <span>Fuentes en Vivo (Google Search)</span>
                    </div>
                    {msg.searchQueries && msg.searchQueries.length > 0 && (
                      <p className="text-[9.5px] opacity-75">
                        Consultas: {msg.searchQueries.join(' · ')}
                      </p>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.slice(0, 6).map((src, sIdx) => (
                          <a
                            key={`${src.uri}-${sIdx}`}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border transition-colors max-w-[230px] ${
                              theme === 'light'
                                ? 'bg-zinc-50 hover:bg-emerald-50 border-zinc-200 text-zinc-700 hover:text-emerald-700'
                                : 'bg-zinc-900/80 hover:bg-emerald-950/40 border-zinc-800 text-slate-300 hover:text-emerald-300'
                            }`}
                            title={src.uri}
                          >
                            <ExternalLink size={9} className="shrink-0" />
                            <span className="truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Voice play button specifically for Aglaia responses */}
                {msg.sender === 'assistant' && (
                  <button
                    onClick={() => playVoiceClip(msg.id, msg.text)}
                    disabled={isGeneratingSpeech !== null && isGeneratingSpeech !== msg.id}
                    className={`absolute -right-9 bottom-1 transition-all rounded-full w-7 h-7 flex items-center justify-center shadow border ${theme === 'light' ? 'bg-white text-zinc-500 hover:text-yellow-700 border-zinc-300' : 'bg-black text-yellow-650 hover:text-yellow-450 border-yellow-950/40'}`}
                    title="Generate sacred speech from Aglaia"
                  >
                    {isGeneratingSpeech === msg.id ? (
                      <Loader2 size={13} className="animate-spin text-yellow-500" />
                    ) : playingAudioId === msg.id ? (
                      <Square size={10} className="fill-yellow-500 text-yellow-500" />
                    ) : (
                      <Volume2 size={13} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex items-center gap-2 text-yellow-650/60 font-serif text-xs italic tracking-wider animate-pulse">
            <Loader2 size={12} className="animate-spin text-yellow-600" />
            Aglaia medita su veredicto intelectual...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Preset Starters */}
      <div className={`px-4 py-2 border-t flex flex-wrap gap-1.5 transition-colors duration-350 ${theme === 'light' ? 'border-zinc-200 bg-zinc-50' : 'border-yellow-950/20 bg-black/40'}`}>
        <button
          onClick={() => speakPreset("Compárteme un adagio clásico sobre la escasez.")}
          className={`text-[11px] transition-all font-serif py-1 px-2.5 rounded-full flex items-center gap-1 cursor-pointer border ${theme === 'light' ? 'bg-white hover:bg-zinc-100 hover:text-yellow-700 text-zinc-700 border-zinc-300' : 'bg-black hover:bg-yellow-950/10 hover:text-yellow-450 text-yellow-600/70 border-yellow-950/30'}`}
        >
          <Sparkles size={10} className="text-yellow-500" /> Adagio Noble
        </button>
        <button
          onClick={() => speakPreset("¿Cómo permanece inalterable mi santuario de datos?")}
          className={`text-[11px] transition-all font-serif py-1 px-2.5 rounded-full flex items-center gap-1 cursor-pointer border ${theme === 'light' ? 'bg-white hover:bg-zinc-100 hover:text-yellow-700 text-zinc-700 border-zinc-300' : 'bg-black hover:bg-yellow-950/10 hover:text-yellow-450 text-yellow-600/70 border-yellow-950/30'}`}
        >
          <Sparkles size={10} className="text-yellow-500" /> Sanctum de Datos
        </button>
        <button
          onClick={() => speakPreset("¿Cuál es la naturaleza del Manifiesto Visual de los Datos?")}
          className={`text-[11px] transition-all font-serif py-1 px-2.5 rounded-full flex items-center gap-1 cursor-pointer border ${theme === 'light' ? 'bg-white hover:bg-zinc-100 hover:text-yellow-700 text-zinc-700 border-zinc-300' : 'bg-black hover:bg-yellow-950/10 hover:text-yellow-450 text-yellow-600/70 border-yellow-950/30'}`}
        >
          <Sparkles size={10} className="text-yellow-500" /> Manifiesto Visual
        </button>
        <button
          onClick={() => speakPreset("Investigue en vivo los avances más recientes en modelos locales de IA y agentes autónomos.")}
          className={`text-[11px] transition-all font-serif py-1 px-2.5 rounded-full flex items-center gap-1 cursor-pointer border ${theme === 'light' ? 'bg-white hover:bg-emerald-50 hover:text-emerald-700 text-zinc-700 border-zinc-300' : 'bg-black hover:bg-emerald-950/20 hover:text-emerald-400 text-emerald-400/80 border-emerald-900/40'}`}
        >
          <Globe size={10} className="text-emerald-500" /> Búsqueda en Vivo
        </button>
      </div>

      {/* Console Input Bar */}
      <form onSubmit={handleSend} className={`p-3 border-t flex items-center gap-2 transition-colors duration-350 ${theme === 'light' ? 'bg-zinc-100 border-zinc-200' : 'bg-black border-yellow-950/30'}`}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Consulte al oráculo..."
          disabled={isSending}
          className={`flex-1 text-sm py-2 px-4 rounded-xl border outline-none font-sans transition-all duration-200 ${theme === 'light' ? 'bg-white text-zinc-900 border-zinc-300 focus:border-yellow-500/60 placeholder:text-zinc-400' : 'bg-black text-yellow-100/80 border-yellow-950/20 focus:border-yellow-500/60 placeholder:text-yellow-800/30'}`}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="h-9 w-9 bg-yellow-700 hover:bg-yellow-600 disabled:bg-zinc-900 disabled:text-zinc-700 text-white rounded-xl flex items-center justify-center transition-colors shadow cursor-pointer"
        >
          {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>
    </div>
  );
}
