import React, { useState } from 'react';
import { Integration, Platform } from '../types';
import { Copy, Check, Eye, EyeOff, ShieldCheck, Download, ExternalLink, HelpCircle } from 'lucide-react';
import { packageJsonTemplate, envTemplate, indexJsTemplate } from '../local_code_templates';

interface IntegrationCardProps {
  key?: string;
  integration: Integration;
  onUpdateConfig: (id: Platform, field: string, value: string) => void;
  onToggleStatus: (id: Platform) => void;
  theme?: 'dark' | 'light';
}

export default function IntegrationCard({ integration, onUpdateConfig, onToggleStatus, theme = 'dark' }: IntegrationCardProps) {
  const [showToken, setShowToken] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(false);
  const [showCode, setShowCode] = useState(false);

  // Customize indexJS template or .env template inline!
  const getCustomizedEnv = () => {
    let custom = envTemplate;
    if (integration.config.token) {
      if (integration.id === 'discord') {
        custom = custom.replace('DISCORD_TOKEN=""', `DISCORD_TOKEN="${integration.config.token}"`);
      } else if (integration.id === 'telegram') {
        custom = custom.replace('TELEGRAM_TOKEN=""', `TELEGRAM_TOKEN="${integration.config.token}"`);
      } else if (integration.id === 'slack') {
        custom = custom.replace('SLACK_BOT_TOKEN=""', `SLACK_BOT_TOKEN="${integration.config.token}"`);
      }
    }
    if (integration.config.secret) {
      if (integration.id === 'slack') {
        custom = custom.replace('SLACK_SIGNING_SECRET=""', `SLACK_SIGNING_SECRET="${integration.config.secret}"`);
      }
    }
    return custom;
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyText = (text: string, type: 'env' | 'code') => {
    navigator.clipboard.writeText(text);
    if (type === 'env') {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    } else {
      setCopiedIndex(true);
      setTimeout(() => setCopiedIndex(false), 2000);
    }
  };

  return (
    <div className={`transition-all duration-350 rounded-2xl p-5 shadow-lg relative flex flex-col justify-between border ${theme === 'light' ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-slate-900 border-slate-800/80 hover:border-slate-700/80'}`}>
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`text-3xl p-2.5 rounded-xl border transition-colors duration-350 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950/60 border-slate-850'}`}>
              {integration.icon}
            </span>
            <div>
              <h4 className={`font-bold font-sans transition-colors ${theme === 'light' ? 'text-zinc-900' : 'text-slate-100'}`}>{integration.name}</h4>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider border transition-colors ${
                  integration.status === 'active'
                    ? theme === 'light' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : theme === 'light' ? 'bg-zinc-100 text-zinc-500 border-zinc-250' : 'bg-slate-950 text-slate-500 border border-slate-850'
                }`}
              >
                ● {integration.status === 'active' ? 'Configured' : 'Offline Setup'}
              </span>
            </div>
          </div>
          <button
            onClick={() => onToggleStatus(integration.id)}
            className={`text-xs font-mono py-1.5 px-3 rounded-lg border transition-all cursor-pointer ${
              integration.status === 'active'
                ? theme === 'light' ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300' : 'bg-slate-950 hover:bg-slate-850 text-orange-400 border-slate-800'
                : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-400 shadow-sm'
            }`}
          >
            {integration.status === 'active' ? 'Reset Setup' : 'Configure Integration'}
          </button>
        </div>

        <p className={`text-xs font-sans leading-relaxed mb-4 transition-colors duration-350 ${theme === 'light' ? 'text-zinc-600 font-medium' : 'text-slate-400'}`}>
          {integration.description}
        </p>

        {/* Configuration Panel */}
        {integration.status === 'active' && (
          <div className={`border rounded-xl p-4 mb-4 space-y-3.5 animate-fadeIn transition-colors duration-350 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200/85' : 'bg-slate-950/60 border-slate-850'}`}>
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`}>
              <ShieldCheck size={14} /> Local Data Safe: Input values remain strictly inside your browser
            </div>

            <div>
              <label className={`text-[10px] uppercase font-mono tracking-wider block mb-1 ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>
                Sobrenombre del Oráculo de Aglaia
              </label>
              <input
                type="text"
                value={integration.config.botName}
                onChange={(e) => onUpdateConfig(integration.id, 'botName', e.target.value)}
                className={`w-full rounded-lg py-1.5 px-3 outline-none text-xs font-semibold font-mono border transition-all ${theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900 focus:border-yellow-500/40' : 'bg-slate-900 border-slate-800 text-slate-200 focus:border-yellow-500/30'}`}
              />
            </div>

            {integration.id !== 'whatsapp' && (
              <div>
                <label className={`text-[10px] uppercase font-mono tracking-wider block mb-1 flex items-center justify-between ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>
                  <span>{integration.tokenLabel}</span>
                  <a
                    href={integration.helpLink}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="text-[10px] text-yellow-600 dark:text-yellow-500 hover:underline flex items-center gap-0.5 font-sans capitalize"
                  >
                    Guía de Instalación <ExternalLink size={10} />
                  </a>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={integration.config.token}
                      onChange={(e) => onUpdateConfig(integration.id, 'token', e.target.value)}
                      placeholder={integration.tokenPlaceholder}
                      className={`w-full rounded-lg py-1.5 pl-3 pr-9 outline-none text-xs font-semibold font-mono border transition-all ${theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900 focus:border-yellow-500/40' : 'bg-slate-900 border-slate-800 text-slate-200 focus:border-yellow-500/30'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-350 transition-colors"
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {integration.id === 'slack' && (
              <div>
                <label className={`text-[10px] uppercase font-mono tracking-wider block mb-1 flex items-center justify-between ${theme === 'light' ? 'text-zinc-500' : 'text-slate-500'}`}>
                  <span>Slack App-Level Token (xapp-...)</span>
                  <span className={`text-[9px] font-sans ${theme === 'light' ? 'text-zinc-400' : 'text-slate-600'}`}>Required for socket mode</span>
                </label>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={integration.config.secret || ''}
                  onChange={(e) => onUpdateConfig(integration.id, 'secret', e.target.value)}
                  placeholder="xapp-1-A123BC..."
                  className={`w-full rounded-lg py-1.5 px-3 outline-none text-xs font-semibold font-mono border transition-all ${theme === 'light' ? 'bg-white border-zinc-300 text-zinc-900 focus:border-yellow-500/40' : 'bg-slate-900 border-slate-800 text-slate-200 focus:border-yellow-500/30'}`}
                />
              </div>
            )}

            {integration.id === 'whatsapp' && (
              <div className={`text-xs leading-relaxed p-1 transition-colors ${theme === 'light' ? 'text-zinc-650' : 'text-slate-400'}`}>
                WhatsApp connects instantly by running the script locally and scanning the generated QR code directly in your computer's terminal. No API tokens required!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code Generation Section */}
      {integration.status === 'active' && (
        <div className={`pt-4 mt-1 space-y-2.5 border-t transition-colors ${theme === 'light' ? 'border-zinc-205' : 'border-slate-850'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium transition-colors ${theme === 'light' ? 'text-zinc-500 font-semibold' : 'text-slate-400'}`}>Export files specifically for {integration.name}:</span>
            <button
              onClick={() => setShowCode(!showCode)}
              className={`text-xs font-semibold font-mono cursor-pointer ${theme === 'light' ? 'text-yellow-750 hover:text-yellow-800 font-bold' : 'text-yellow-500 hover:text-yellow-400'}`}
            >
              {showCode ? '[Ocultar Código]' : '[Ver Código de Enlace]'}
            </button>
          </div>

          {showCode && (
            <div className="space-y-4 animate-fadeIn">
              {/* package.json download */}
              <div className={`p-3 rounded-xl border transition-colors ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950 border-slate-850/60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-[10px] font-semibold ${theme === 'light' ? 'text-yellow-750' : 'text-yellow-500'}`}>package.json</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => downloadFile('package.json', packageJsonTemplate)}
                      className={`flex items-center gap-1 text-[10px] cursor-pointer ${theme === 'light' ? 'text-zinc-500 hover:text-yellow-750 font-bold' : 'text-slate-400 hover:text-slate-100'}`}
                      title="Download file"
                    >
                      <Download size={11} /> Descargar
                    </button>
                  </div>
                </div>
                <pre className={`text-[10px] font-mono max-h-[100px] overflow-y-auto p-2 rounded border pr-1.5 transition-colors ${theme === 'light' ? 'bg-white border-zinc-250 text-zinc-850' : 'bg-slate-900/60 border-slate-850 text-slate-400'}`}>
                  {packageJsonTemplate}
                </pre>
              </div>

              {/* customized .env download */}
              <div className={`p-3 rounded-xl border transition-colors ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950 border-slate-850/60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-[10px] font-semibold ${theme === 'light' ? 'text-yellow-750' : 'text-yellow-500'}`}>.env (Configured with credentials)</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyText(getCustomizedEnv(), 'env')}
                      className={`flex items-center gap-1 text-[10px] cursor-pointer ${theme === 'light' ? 'text-zinc-500 hover:text-yellow-750 font-bold' : 'text-slate-400 hover:text-slate-100'}`}
                    >
                      {copiedEnv ? <Check size={11} className="text-emerald-505" /> : <Copy size={11} />} Copiar
                    </button>
                    <button
                      onClick={() => downloadFile('.env', getCustomizedEnv())}
                      className={`flex items-center gap-1 text-[10px] cursor-pointer ${theme === 'light' ? 'text-zinc-500 hover:text-yellow-750 font-bold' : 'text-slate-400 hover:text-slate-100'}`}
                    >
                      <Download size={11} /> Descargar
                    </button>
                  </div>
                </div>
                <pre className={`text-[10px] font-mono max-h-[120px] overflow-y-auto p-2 rounded border pr-1.5 transition-colors ${theme === 'light' ? 'bg-white border-zinc-250 text-zinc-850' : 'bg-slate-900/60 border-slate-850 text-slate-400'}`}>
                  {getCustomizedEnv()}
                </pre>
              </div>

              {/* index.js download */}
              <div className={`p-3 rounded-xl border transition-colors ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950 border-slate-850/60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-mono text-[10px] font-semibold ${theme === 'light' ? 'text-yellow-750' : 'text-yellow-500'}`}>index.js (Local runtime engine)</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyText(indexJsTemplate, 'code')}
                      className={`flex items-center gap-1 text-[10px] cursor-pointer ${theme === 'light' ? 'text-zinc-500 hover:text-yellow-750 font-bold' : 'text-slate-400 hover:text-slate-100'}`}
                    >
                      {copiedIndex ? <Check size={11} className="text-emerald-505" /> : <Copy size={11} />} Copiar
                    </button>
                    <button
                      onClick={() => downloadFile('index.js', indexJsTemplate)}
                      className={`flex items-center gap-1 text-[10px] cursor-pointer ${theme === 'light' ? 'text-zinc-500 hover:text-yellow-750 font-bold' : 'text-slate-400 hover:text-slate-100'}`}
                    >
                      <Download size={11} /> Descargar
                    </button>
                  </div>
                </div>
                <pre className={`text-[10px] font-mono max-h-[150px] overflow-y-auto p-2 rounded border pr-1.5 transition-colors ${theme === 'light' ? 'bg-white border-zinc-250 text-zinc-850' : 'bg-slate-900/60 border-slate-850 text-slate-400'}`}>
                  {indexJsTemplate}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
