import { useState, useEffect } from 'react';
import { Shield, Sparkles, Terminal as TerminalIcon, Radio, Share2, HelpCircle, Activity, Loader2, AlertTriangle, Database, Brain, CheckCircle, XCircle, Plus, Trash2, Edit, Save, FileText, FolderOpen, BookOpen, Download, BarChart3, Milestone, Search, X, Minimize2 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import VisualOrbe, { OrbeMaterial } from './components/VisualOrbe';
import OrbiterPlayground from './components/OrbiterPlayground';
import ToolRegistryManifesto from './components/ToolRegistryManifesto';
import PermissionCovenantEngine from './components/PermissionCovenantEngine';
import MicrokernelVisualizer from './components/MicrokernelVisualizer';
import InteractiveConsole from './components/InteractiveConsole';
import TerminalSetup from './components/TerminalSetup';
import IntegrationCard from './components/IntegrationCard';
import SimulationPlatform from './components/SimulationPlatform';
import SovereignKernelControl from './components/SovereignKernelControl';
import AgentAnalyticsDashboard from './components/AgentAnalyticsDashboard';
import AgentLogTimeline from './components/AgentLogTimeline';
import TaskQueuePanel from './components/TaskQueuePanel';
import SqliteTableBrowser from './components/SqliteTableBrowser';
import SqliteDatabaseHealth from './components/SqliteDatabaseHealth';
import { AgentLog, GroundingSource, Integration, Message, Platform } from './types';
import { analyzeAgentLogs, isRoutineHeartbeatLog } from './logAnalytics';

export default function App() {
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [orbeMood, setOrbeMood] = useState<'happy' | 'cheeky' | 'surprised' | 'focused'>('happy');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('discord');
  const [isGeneratingDiagnostics, setIsGeneratingDiagnostics] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [vramUsage, setVramUsage] = useState<number>(53);
  const [npuUsage, setNpuUsage] = useState<number>(42);
  const [orbeMaterial, setOrbeMaterial] = useState<OrbeMaterial>('gold_liquid');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'sanctuary' | 'timeline' | 'analytics'>('sanctuary');

  // SQLite Persistent Memory & Tooling States
  const [scratchpads, setScratchpads] = useState<{ title: string; content: string; updated_at: string }[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [sqliteSectionTab, setSqliteSectionTab] = useState<'workspace' | 'health'>('workspace');
  const [logViewMode, setLogViewMode] = useState<'verbose' | 'compact'>('verbose');
  const [isBackingUpDb, setIsBackingUpDb] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<{ status: 'success' | 'error'; text: string } | null>(null);
  const [isCompactingDb, setIsCompactingDb] = useState(false);
  const [compactFeedback, setCompactFeedback] = useState<{ status: 'success' | 'error'; text: string } | null>(null);
  const [dbStorageStats, setDbStorageStats] = useState<{
    autoVacuumMode: string;
    autoVacuumEnabled: boolean;
    sizeBytes: number;
    freelistCount: number;
    pageCount: number;
    fragmentationPercent: number;
    autoVacuumRuns: number;
    compactRuns: number;
  } | null>(null);
  const [activeAgentSteps, setActiveAgentSteps] = useState<{ toolName: string; args: any; status: string; result?: any; timestamp: string }[]>([]);
  const [selectedScratchpad, setSelectedScratchpad] = useState<{ title: string; content: string; updated_at?: string } | null>(null);
  const [isCreatingScratchpad, setIsCreatingScratchpad] = useState(false);
  const [newScratchpadTitle, setNewScratchpadTitle] = useState('');
  const [newScratchpadContent, setNewScratchpadContent] = useState('');
  const [scratchpadSearchQuery, setScratchpadSearchQuery] = useState('');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "⚜️ Bienvenido al Santuario de Aglaia. Soy su asistente aristocrática y hermética. Opero bajo la más estricta reserva física local en su propio hardware, custodiando con rigidez absoluta su privacidad intelectual. ¿Qué codicilo o análisis de datos desea refinar hoy?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'discord',
      name: 'Discord Bot Link',
      icon: '🔮',
      status: 'inactive',
      description: 'Enlace de comunicación hermética para canales privados o mensajes directos en Discord. Aglaia responde bajo mención solemne.',
      tokenLabel: 'Discord Bot Token (MT...)',
      tokenPlaceholder: 'MTA...Your.Discord.Bot.Token.Here...',
      helpLink: 'https://discord.com/developers/applications',
      config: { token: '', botName: 'Aglaia Assistant' }
    },
    {
      id: 'telegram',
      name: 'Telegram Agent',
      icon: '✈️',
      status: 'inactive',
      description: 'Canal de consulta discreta en Telegram. Aglaia responde a peticiones firmadas digitalmente y configuradas mediante BotFather.',
      tokenLabel: 'Telegram Bot API Token',
      tokenPlaceholder: '123456789:ABCdefGhIJKlmNoPQRsT...',
      helpLink: 'https://t.me/BotFather',
      config: { token: '', botName: 'Aglaia Oracle Bot' }
    },
    {
      id: 'slack',
      name: 'Slack socket workspace',
      icon: '💬',
      status: 'inactive',
      description: 'Acople el oráculo de Aglaia a sus canales de trabajo privados en Slack en modo socket seguro SocketMode.',
      tokenLabel: 'Slack Bot User OAuth Token (xoxb-...)',
      tokenPlaceholder: 'xoxb-your-slack-bot-token...',
      helpLink: 'https://api.slack.com/apps',
      config: { token: '', secret: '', botName: 'Aglaia' }
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Mobile Local Link',
      icon: '🟢',
      status: 'inactive',
      description: 'Vincule su chat personal de WhatsApp mediante un código QR para consultas por voz directas, seguras y procesadas localmente.',
      tokenLabel: 'WhatsApp Sync',
      tokenPlaceholder: 'No token needed',
      helpLink: 'https://wwebjs.dev/',
      config: { token: '', botName: 'Aglaia Private Assistant' }
    }
  ]);

  // Adjust orbe expressions/animations based on state
  useEffect(() => {
    if (isThinking) {
      setOrbeMood('focused');
      setVramUsage(68);
      setNpuUsage(78);
    } else if (isSpeaking) {
      setOrbeMood('cheeky');
      setVramUsage(53);
      setNpuUsage(42);
    } else {
      setOrbeMood('happy');
      setVramUsage(53);
      setNpuUsage(42);
    }
  }, [isThinking, isSpeaking]);

  // Track historical VRAM usage over the last 60 seconds (30 ticks, each 2s)
  const [vramHistory, setVramHistory] = useState<{ time: string; usage: number }[]>(() => {
    const initialData = [];
    const baseUsage = 53;
    for (let i = 29; i >= 0; i--) {
      const secondsAgo = i * 2;
      // Generate slight fluctuations for a realistic initial graph
      const randomOffset = Math.floor(Math.random() * 5) - 2;
      initialData.push({
        time: secondsAgo === 0 ? '0s' : `-${secondsAgo}s`,
        usage: Math.max(10, Math.min(100, baseUsage + randomOffset)),
      });
    }
    return initialData;
  });

  // Ticking effect to shift history left every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setVramHistory((prev) => {
        const nextHistory = prev.slice(1);
        const updated = nextHistory.map((item, idx) => ({
          ...item,
          time: idx === 28 ? '-2s' : `-${(29 - idx) * 2}s`,
        }));
        updated.push({
          time: '0s',
          usage: vramUsage,
        });
        return updated;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [vramUsage]);

  // Instant response: update the current data point (index 29, "0s") when vramUsage updates
  useEffect(() => {
    setVramHistory((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        usage: vramUsage,
      };
      return updated;
    });
  }, [vramUsage]);

  // Track historical NPU usage over the last 60 seconds (30 ticks, each 2s)
  const [npuHistory, setNpuHistory] = useState<{ time: string; usage: number }[]>(() => {
    const initialData = [];
    const baseUsage = 42;
    for (let i = 29; i >= 0; i--) {
      const secondsAgo = i * 2;
      // Generate slight fluctuations for a realistic initial graph
      const randomOffset = Math.floor(Math.random() * 5) - 2;
      initialData.push({
        time: secondsAgo === 0 ? '0s' : `-${secondsAgo}s`,
        usage: Math.max(10, Math.min(100, baseUsage + randomOffset)),
      });
    }
    return initialData;
  });

  // Ticking effect to shift NPU history left every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setNpuHistory((prev) => {
        const nextHistory = prev.slice(1);
        const updated = nextHistory.map((item, idx) => ({
          ...item,
          time: idx === 28 ? '-2s' : `-${(29 - idx) * 2}s`,
        }));
        updated.push({
          time: '0s',
          usage: npuUsage,
        });
        return updated;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [npuUsage]);

  // Instant response: update the current NPU data point (index 29, "0s") when npuUsage updates
  useEffect(() => {
    setNpuHistory((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        usage: npuUsage,
      };
      return updated;
    });
  }, [npuUsage]);

  // DB Sync Functions
  const fetchScratchpads = async () => {
    try {
      const res = await fetch('/api/scratchpads');
      if (res.ok) {
        const data = await res.json();
        setScratchpads(data);
      }
    } catch (err) {
      console.error('Failed to sync scratchpads:', err);
    }
  };

  const fetchAgentLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setAgentLogs(data);
      }
    } catch (err) {
      console.error('Failed to sync agent logs:', err);
    }
  };

  const fetchDatabaseStats = async () => {
    try {
      const res = await fetch('/api/database/stats');
      if (res.ok) {
        const data = await res.json();
        setDbStorageStats(data);
      }
    } catch (err) {
      console.error('Failed to sync database stats:', err);
    }
  };

  const handleAddAuditLog = async (type: string, message: string) => {
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message })
      });
      if (res.ok) {
        await fetchAgentLogs();
      }
    } catch (err) {
      console.error('Failed to add audit log:', err);
    }
  };

  const handleClearAgentLogs = async () => {
    try {
      const res = await fetch('/api/logs/clear', { method: 'POST' });
      if (res.ok) {
        await fetchAgentLogs();
        await fetchDatabaseStats();
      }
    } catch (err) {
      console.error('Failed to clear agent logs:', err);
    }
  };

  const handleSeedSampleLogs = async () => {
    try {
      const res = await fetch('/api/logs/seed', { method: 'POST' });
      if (res.ok) {
        await fetchAgentLogs();
        await fetchDatabaseStats();
      }
    } catch (err) {
      console.error('Failed to seed sample agent logs:', err);
    }
  };

  // Sync DB on Mount & Periodically
  useEffect(() => {
    const loadInitialMessages = async () => {
      try {
        const res = await fetch('/api/messages');
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            setMessages(data);
          }
        }
      } catch (err) {
        console.error('Failed to load initial messages:', err);
      }
    };

    loadInitialMessages();
    fetchScratchpads();
    fetchAgentLogs();
    fetchDatabaseStats();

    const interval = setInterval(() => {
      fetchScratchpads();
      fetchAgentLogs();
      fetchDatabaseStats();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleSaveScratchpad = async (title: string, content: string) => {
    try {
      const res = await fetch('/api/scratchpads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      if (res.ok) {
        await fetchScratchpads();
        await fetchAgentLogs();
        setIsCreatingScratchpad(false);
        setNewScratchpadTitle('');
        setNewScratchpadContent('');
      }
    } catch (err) {
      console.error('Error saving scratchpad:', err);
    }
  };

  const handleDeleteScratchpad = async (title: string) => {
    try {
      const res = await fetch(`/api/scratchpads/${title}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchScratchpads();
        await fetchAgentLogs();
        if (selectedScratchpad?.title === title) {
          setSelectedScratchpad(null);
        }
      }
    } catch (err) {
      console.error('Error deleting scratchpad:', err);
    }
  };

  const handleExportArchive = () => {
    try {
      const dataStr = JSON.stringify({
        exportedAt: new Date().toISOString(),
        localTime: new Date().toString(),
        systemStatus: {
          vramUsage,
          npuUsage,
          theme,
          orbeMaterial,
          orbeMood,
          selectedPlatform
        },
        conversation: messages,
        agentLogs: agentLogs,
        analyticsSummary: analyzeAgentLogs(agentLogs),
        scratchpads: scratchpads,
        integrations: integrations.map(i => ({
          id: i.id,
          name: i.name,
          status: i.status,
          description: i.description
        }))
      }, null, 2);

      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = `aglaia_archive_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (err) {
      console.error('Error exporting archive:', err);
    }
  };

  const handleBackupSqliteDatabase = async () => {
    if (isBackingUpDb) return;
    setIsBackingUpDb(true);
    setBackupFeedback(null);

    try {
      const response = await fetch('/api/database/backup');
      if (!response.ok) {
        let errMessage = `SQLite backup failed (HTTP ${response.status})`;
        try {
          const payload = await response.json();
          if (payload?.error) errMessage = payload.error;
        } catch {
          // ignore parse failure
        }
        throw new Error(errMessage);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fallbackName = `aglaia_sqlite_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      const filename = filenameMatch?.[1] || fallbackName;

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);

      setBackupFeedback({ status: 'success', text: `Downloaded ${filename}` });
      await fetchAgentLogs();
      await fetchDatabaseStats();
      setTimeout(() => setBackupFeedback(null), 5000);
    } catch (err: any) {
      console.error('Failed to backup SQLite database:', err);
      setBackupFeedback({ status: 'error', text: err?.message || 'Failed to backup SQLite database.' });
    } finally {
      setIsBackingUpDb(false);
    }
  };

  const formatStorageBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleCompactDatabase = async () => {
    if (isCompactingDb) return;
    setIsCompactingDb(true);
    setCompactFeedback(null);

    try {
      const response = await fetch('/api/database/compact', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || `Database compaction failed (HTTP ${response.status})`);
      }

      if (payload?.stats) {
        setDbStorageStats(payload.stats);
      } else {
        await fetchDatabaseStats();
      }
      await fetchAgentLogs();

      const reclaimedLabel = formatStorageBytes(Number(payload.reclaimedBytes ?? 0));
      const finalSizeLabel = formatStorageBytes(Number(payload.sizeAfterBytes ?? 0));
      const modeLabel = payload.autoVacuumMode || 'INCREMENTAL';
      setCompactFeedback({
        status: 'success',
        text: `Compacted SQLite in ${payload.durationMs ?? 1}ms • Reclaimed ${reclaimedLabel} (Size: ${finalSizeLabel}) • Auto-Vacuum: ${modeLabel}`,
      });
      setTimeout(() => setCompactFeedback(null), 6000);
    } catch (err: any) {
      console.error('Failed to compact SQLite database:', err);
      setCompactFeedback({
        status: 'error',
        text: err?.message || 'Failed to compact SQLite database.',
      });
    } finally {
      setIsCompactingDb(false);
    }
  };

  const handleClearChat = async () => {
    try {
      const res = await fetch('/api/messages/clear', { method: 'POST' });
      if (res.ok) {
        setMessages([
          {
            id: 'welcome',
            sender: 'assistant',
            text: "🔱 Memoria del oráculo depurada. Base de datos SQLite local restablecida con éxito.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
        ]);
        await fetchAgentLogs();
        await fetchDatabaseStats();
      }
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  // Server-side LLM Chat trigger
  const handleSendMessage = async (
    text: string,
    history: Message[],
    enableGoogleSearch = true
  ): Promise<{ text: string; sources?: GroundingSource[]; searchQueries?: string[] }> => {
    setIsThinking(true);
    setOrbeMood('focused');
    setActiveAgentSteps([]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: history, enableGoogleSearch }),
      });

      if (!response.ok) {
        let errMessage = `Server returned error code: ${response.status}`;
        try {
          const errPayload = await response.json();
          if (errPayload?.error) errMessage = errPayload.error;
        } catch {
          // ignore non-JSON error
        }
        throw new Error(errMessage);
      }

      const data = await response.json();
      
      // Save active reasoning steps if any were executed
      if (data.agentSteps) {
        setActiveAgentSteps(data.agentSteps);
      }

      // Proactively sync database states
      await fetchScratchpads();
      await fetchAgentLogs();

      setIsThinking(false);
      return {
        text: data.text || 'Aglaia no retornó contenido.',
        sources: Array.isArray(data.sources) ? data.sources : [],
        searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
      };
    } catch (err) {
      setIsThinking(false);
      setOrbeMood('surprised');
      throw err;
    }
  };

  // Server-side Text-To-Speech Generation
  const handleSpeakText = async (text: string): Promise<string> => {
    setIsSpeaking(true);
    try {
      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Could not translate text-to-speech.');
      }

      const data = await response.json();
      
      // Keep speaking active for a bit
      setTimeout(() => {
        setIsSpeaking(false);
      }, 5000);

      return data.audio;
    } catch (err) {
      setIsSpeaking(false);
      throw err;
    }
  };

  // Webhook / Simulated Messaging
  const handleSimulateWebhook = async (
    text: string,
    platform: Platform,
    sender: string
  ): Promise<{ replyText: string; timestamp: string }> => {
    setIsThinking(true);
    try {
      const response = await fetch('/api/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, platform, sender }),
      });

      if (!response.ok) {
        throw new Error('Failed to capture simulated response.');
      }

      const data = await response.json();
      setIsThinking(false);
      return data;
    } catch (err) {
      setIsThinking(false);
      throw err;
    }
  };

  // Integration callbacks
  const handleUpdateConfig = (id: Platform, field: string, value: string) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            config: {
              ...item.config,
              [field]: value,
            },
          };
        }
        return item;
      })
    );
  };

  const handleToggleStatus = (id: Platform) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = item.status === 'active' ? 'inactive' : 'active';
          if (newStatus === 'active') {
            setSelectedPlatform(id);
          }
          return {
            ...item,
            status: newStatus,
          };
        }
        return item;
      })
    );
  };

  const activeIntegrationsCount = integrations.filter((i) => i.status === 'active').length;

  const handleGenerateDiagnostics = async () => {
    if (isGeneratingDiagnostics || isThinking) return;
    setIsGeneratingDiagnostics(true);
    setIsThinking(true);
    setOrbeMood('focused');

    const userMessageText = "Generate Diagnostics Report";
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: userMessageText,
      timestamp,
    };

    // Add user message to console
    setMessages((prev) => [...prev, userMsg]);

    try {
      // Gather precise current metrics
      const activeNpu = `${npuUsage}%`;
      const activeVram = `${((vramUsage * 12) / 100).toFixed(1)}GB / 12GB (${vramUsage}%)`;
      const activeInts = integrations.map(i => `${i.name}: ${i.status}`).join(', ');

      const systemPrompt = `Please generate an AI-formatted diagnostics report and summary of our local system status, hardware metrics, and current integration statuses. Keep it very engaging, bold, and in your characteristic formal and aristocratic voice (Aglaia)!
Here are the current raw specifications:
- NPU Neural Processing: ${activeNpu}
- VRAM Usage: ${activeVram}
- Network Privacy Guard: Enabled (100% Encrypted)
- Local Engine Latency: 12ms
- Active Integrations Count: ${activeIntegrationsCount} of 4
- Integrations List: [${activeInts}]
- Always On Mode: Private Local Access

Format the report beautifully with cool monospace bullets, elegant symbols, and make sure it summarizes everything cleanly.`;

      // Call server api directly or simulate an LLM context call
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: systemPrompt, history: messages }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error code: ${response.status}`);
      }

      const data = await response.json();
      const aiReplyText = data.text || 'Failed to capture server diagnosis.';

      const assistantMsg: Message = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setOrbeMood('happy');

    } catch (err: any) {
      setOrbeMood('surprised');
      const assistantError: Message = {
        id: Math.random().toString(),
        sender: 'assistant',
        text: "⚜️ Un destello en el espectro ha interrumpido el diagnóstico del NPU: " + (err.message || "process timed out."),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantError]);
    } finally {
      setIsGeneratingDiagnostics(false);
      setIsThinking(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-350 font-sans ${theme === 'light' ? 'bg-zinc-100 text-zinc-900 selection:bg-yellow-500/25 selection:text-zinc-950' : 'bg-slate-950 text-slate-100 selection:bg-yellow-500/20 selection:text-yellow-200'}`}>
      
      {/* Decorative Top Marine Wave Accent */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-700 via-yellow-500 to-amber-500 shadow-lg shadow-yellow-500/5" />

      {/* Hero Header Section - Updated to match Geometric Balance Theme */}
      <header className={`pt-10 pb-6 px-4 max-w-7xl mx-auto border-b relative flex flex-col lg:flex-row items-center justify-between gap-6 transition-colors duration-350 ${theme === 'light' ? 'border-zinc-300' : 'border-yellow-900/30'}`}>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-yellow-700 rounded-lg flex items-center justify-center text-3xl shadow-lg ring-1 ring-yellow-500/30">
            ⚜️
          </div>
          <div>
            <h1 className={`text-2xl md:text-3xl font-display font-bold tracking-tight leading-none uppercase ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>
              Santuario Aglaia <span className="text-yellow-600">v1.0.0</span>
            </h1>
            <p className={`text-[10px] font-mono uppercase tracking-widest mt-1.5 ${theme === 'light' ? 'text-zinc-500' : 'text-yellow-650/70'}`}>Hermético • Soberano • Exclusivo</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Custom Theme Switcher Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              theme === 'light'
                ? 'bg-white hover:bg-zinc-50 text-zinc-900 border-zinc-300 shadow-sm hover:border-zinc-400'
                : 'bg-zinc-950 hover:bg-zinc-900 text-yellow-500 border-yellow-950/20 hover:text-yellow-450'
            }`}
            title="Switch Dashboard Colors"
          >
            {theme === 'light' ? '☀️ ALTA GAMA CLARA' : '🌌 OBSIDIANA DORADA'}
          </button>

          <div className="flex space-x-6">
            <div className="text-right font-mono">
              <p className={`text-[10px] uppercase tracking-wider ${theme === 'light' ? 'text-zinc-450' : 'text-yellow-650/40'}`}>Estatus de Privacidad</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 font-bold flex items-center gap-1.5 justify-end mt-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse inline-block" />
                100% HERMÉTICO
              </p>
            </div>
            <div className={`text-right border-l pl-6 font-mono ${theme === 'light' ? 'border-zinc-300' : 'border-yellow-950/20'}`}>
              <p className={`text-[10px] uppercase tracking-wider ${theme === 'light' ? 'text-zinc-450' : 'text-yellow-650/40'}`}>Latencia del Motor</p>
              <p className={`text-xs font-bold mt-1 ${theme === 'light' ? 'text-zinc-950' : 'text-white'}`}>12ms (Local)</p>
            </div>
          </div>
        </div>
      </header>

      {/* Mini App Banner & Workspace Navigation */}
      <div className={`py-4 px-4 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 border-b ${theme === 'light' ? 'border-zinc-300 bg-white/30 text-zinc-800' : 'border-yellow-950/10 text-slate-100'}`}>
        <div className={`inline-flex items-center gap-1 p-1 rounded-xl border ${theme === 'light' ? 'bg-zinc-200/70 border-zinc-300' : 'bg-zinc-900/90 border-zinc-800'}`}>
          <button
            onClick={() => setActiveWorkspaceTab('sanctuary')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeWorkspaceTab === 'sanctuary'
                ? theme === 'light'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'bg-zinc-800 text-yellow-400'
                : theme === 'light'
                ? 'text-zinc-600 hover:text-zinc-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield size={13} />
            Santuario & Consola
          </button>
          <button
            onClick={() => setActiveWorkspaceTab('timeline')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeWorkspaceTab === 'timeline'
                ? theme === 'light'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'bg-zinc-800 text-yellow-400'
                : theme === 'light'
                ? 'text-zinc-600 hover:text-zinc-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Milestone size={13} />
            Execution Timeline
            <span className="font-mono tabular-nums text-[11px] opacity-75">({agentLogs.length})</span>
          </button>
          <button
            onClick={() => setActiveWorkspaceTab('analytics')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeWorkspaceTab === 'analytics'
                ? theme === 'light'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'bg-zinc-800 text-yellow-400'
                : theme === 'light'
                ? 'text-zinc-600 hover:text-zinc-900'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 size={13} />
            Analytics Dashboard
            <span className="font-mono tabular-nums text-[11px] opacity-75">({agentLogs.length})</span>
          </button>
        </div>

        <p className={`text-xs text-center md:text-right max-w-xl font-sans ${theme === 'light' ? 'text-zinc-650' : 'text-slate-400'}`}>
          Opere el Oráculo de Aglaia localmente en su hardware. Sincronización soberana y analítica de ejecución en tiempo real.
        </p>
      </div>

      {activeWorkspaceTab === 'timeline' ? (
        <AgentLogTimeline
          logs={agentLogs}
          theme={theme}
          onRefreshLogs={fetchAgentLogs}
          onSeedSampleLogs={handleSeedSampleLogs}
          onNavigateToConsole={() => setActiveWorkspaceTab('sanctuary')}
        />
      ) : activeWorkspaceTab === 'analytics' ? (
        <AgentAnalyticsDashboard
          logs={agentLogs}
          theme={theme}
          onRefreshLogs={fetchAgentLogs}
          onClearLogs={handleClearAgentLogs}
          onSeedSampleLogs={handleSeedSampleLogs}
          onNavigateToConsole={() => setActiveWorkspaceTab('sanctuary')}
        />
      ) : (
      /* Main Grid Dashboard */
      <main className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Visual Assistant, Hardware telemetry node, Live Console */}
        <div className="lg:col-span-5 space-y-8 flex flex-col">
          
          {/* Animated physical orbe console */}
          <div className={`transition-all duration-350 border-2 rounded-2xl p-5 flex flex-col justify-center items-center shadow-lg relative overflow-hidden group ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-yellow-900/35'}`}>
            <VisualOrbe isThinking={isThinking} isSpeaking={isSpeaking} mood={orbeMood} material={orbeMaterial} />
            
            <div className="text-center mt-4 space-y-1 z-10 font-sans">
              <span className="font-mono text-[10px] text-yellow-600 uppercase font-bold tracking-widest block">
                Estado del Oráculo
              </span>
              <h3 className={`font-semibold font-display tracking-wide text-lg text-yellow-600 dark:text-yellow-500`}>
                {isThinking ? 'Aglaia canalizando sabiduría...' : isSpeaking ? 'Aglaia modulando voz celestial...' : 'Aglaia en reposo majestuoso'}
              </h3>
              <p className={`text-xs ${theme === 'light' ? 'text-zinc-650' : 'text-yellow-750/70'}`}>
                {isThinking ? 'Canalizando telemetría intelectual mediante Gemini' : isSpeaking ? 'Sintetizando tonos oraculares de Kore' : 'Custodiando el templo local. Formule su consulta abajo.'}
              </p>
            </div>

            {/* Simulated Water Bubbles or Waves */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${theme === 'light' ? 'from-yellow-500/10 via-zinc-200 to-yellow-500/10' : 'from-yellow-500/20 via-yellow-500/5 to-yellow-500/20'}`} />
          </div>

          {/* Hardware status meter widget from Geometric Balance layout */}
          <div className={`transition-all duration-350 border p-5 rounded-xl space-y-4 ${
            vramUsage > 90
              ? 'border-rose-500 shadow-lg shadow-rose-500/10 bg-rose-50/5 dark:bg-rose-950/5 animate-pulse'
              : theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-slate-900/50 border-slate-800'
          }`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-orange-500 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <span className={`w-2.5 h-1.5 rounded inline-block animate-pulse ${vramUsage > 90 ? 'bg-rose-600' : 'bg-orange-600'}`} />
                Hardware Node Metrics
              </h3>
              <button
                onClick={handleGenerateDiagnostics}
                disabled={isGeneratingDiagnostics || isThinking}
                className={`text-[10px] font-mono uppercase border rounded px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-all ${theme === 'light' ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-600 hover:text-white' : 'bg-orange-950/20 text-orange-400 border-orange-500/20 hover:bg-orange-600 hover:text-white'}`}
                title="Assemble deep high-frequency marine diagnostics report into console"
              >
                {isGeneratingDiagnostics ? (
                  <>
                    <Loader2 size={11} className="animate-spin text-orange-500" />
                    Diagnostics...
                  </>
                ) : (
                  <>
                    <Activity size={11} className="text-orange-500" />
                    Generate Diagnostics Report
                  </>
                )}
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className={`flex justify-between text-xs mb-1.5 font-mono ${theme === 'light' ? 'text-zinc-600' : 'text-slate-400'}`}>
                  <span>Neural Processing Unit</span>
                  <span>{npuUsage}%</span>
                </div>
                <div className={`w-full h-1 rounded-full overflow-hidden ${theme === 'light' ? 'bg-zinc-200' : 'bg-slate-800'}`}>
                  <div 
                    className="h-full bg-orange-500 rounded-full transition-all duration-500" 
                    style={{ width: `${npuUsage}%` }}
                  />
                </div>
              </div>

              {/* Real-time NPU load trend line chart */}
              <div className={`border-t pt-3.5 mt-2 ${theme === 'light' ? 'border-zinc-200' : 'border-slate-800/80'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${theme === 'light' ? 'text-zinc-500' : 'text-slate-400'}`}>
                    📈 NPU Processing Trend (Last 60s)
                  </span>
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                    npuUsage > 85 
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' 
                      : theme === 'light' ? 'bg-orange-50 text-orange-700' : 'bg-slate-950 text-orange-400'
                  }`}>
                    Live Ticking
                  </span>
                </div>
                <div className="h-[120px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={npuHistory} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={theme === 'light' ? '#e4e4e7' : '#1e293b'} 
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="time" 
                        stroke={theme === 'light' ? '#71717a' : '#64748b'}
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        interval={5}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        stroke={theme === 'light' ? '#71717a' : '#64748b'}
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme === 'light' ? '#ffffff' : '#0f172a',
                          borderColor: theme === 'light' ? '#e4e4e7' : '#1e293b',
                          borderRadius: '8px',
                          fontSize: '10px',
                          color: theme === 'light' ? '#09090b' : '#f8fafc',
                          fontFamily: 'monospace'
                        }}
                        labelStyle={{ color: '#f97316', fontWeight: 'bold' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="usage"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: '#f97316' }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className={`flex justify-between text-xs mb-1.5 font-mono ${
                  vramUsage > 90 
                    ? 'text-rose-650 dark:text-rose-450 font-bold' 
                    : theme === 'light' ? 'text-zinc-600' : 'text-slate-400'
                }`}>
                  <span className="flex items-center gap-1">
                    {vramUsage > 90 && <AlertTriangle size={12} className="text-rose-500 animate-bounce shrink-0" />}
                    Local VRAM Allocation
                  </span>
                  <span>{`${((vramUsage * 12) / 100).toFixed(1)}GB / 12GB (${vramUsage}%)`}</span>
                </div>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'light' ? 'bg-zinc-200' : 'bg-slate-800'}`}>
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      vramUsage > 90
                        ? 'bg-rose-500 dark:bg-rose-600 animate-pulse'
                        : 'bg-orange-500'
                    }`}
                    style={{ width: `${vramUsage}%` }}
                  />
                </div>
              </div>

              {/* Real-time VRAM allocation trend line chart */}
              <div className={`border-t pt-3.5 mt-2 ${theme === 'light' ? 'border-zinc-200' : 'border-slate-800/80'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${theme === 'light' ? 'text-zinc-500' : 'text-slate-400'}`}>
                    📈 VRAM Allocation Trend (Last 60s)
                  </span>
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                    vramUsage > 90 
                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' 
                      : theme === 'light' ? 'bg-orange-50 text-orange-700' : 'bg-slate-950 text-orange-400'
                  }`}>
                    Live Ticking
                  </span>
                </div>
                <div className="h-[120px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={vramHistory} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke={theme === 'light' ? '#e4e4e7' : '#1e293b'} 
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="time" 
                        stroke={theme === 'light' ? '#71717a' : '#64748b'}
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        interval={5}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        stroke={theme === 'light' ? '#71717a' : '#64748b'}
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme === 'light' ? '#ffffff' : '#0f172a',
                          borderColor: vramUsage > 90 ? '#ef4444' : (theme === 'light' ? '#e4e4e7' : '#1e293b'),
                          borderRadius: '8px',
                          fontSize: '10px',
                          color: theme === 'light' ? '#09090b' : '#f8fafc',
                          fontFamily: 'monospace'
                        }}
                        labelStyle={{ color: '#f97316', fontWeight: 'bold' }}
                      />
                      <ReferenceLine 
                        y={90} 
                        stroke="#ef4444" 
                        strokeDasharray="4 4"
                        label={{ 
                          value: 'Caution (90%)', 
                          fill: '#ef4444', 
                          fontSize: 8, 
                          position: 'top',
                          fontFamily: 'monospace',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Line
                        type="monotone"
                        dataKey="usage"
                        stroke={vramUsage > 90 ? '#ef4444' : '#f97316'}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: vramUsage > 90 ? '#ef4444' : '#f97316' }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {vramUsage > 90 && (
                <div className={`p-3 rounded-lg border text-xs font-sans leading-relaxed flex items-start gap-2.5 animate-fadeIn ${
                  theme === 'light'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-rose-950/25 border-rose-900/40 text-rose-300'
                }`}>
                  <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="font-bold uppercase tracking-wider text-[10px] mb-0.5 text-rose-700 dark:text-rose-400">⚠️ CAUTION: VRAM CRITICAL</p>
                    <p className="text-[11px] opacity-90 leading-normal">
                      Private local assistant models require massive physical buffer overhead. Exceeding 90% allocation risks high thermal throttling, degraded execution speeds, or Out-Of-Memory (OOM) agent core crashes!
                    </p>
                  </div>
                </div>
              )}

              {/* VRAM Simulation controls */}
              <div className={`border-t pt-3.5 mt-2 space-y-2.5 ${theme === 'light' ? 'border-zinc-200' : 'border-slate-800/80'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${theme === 'light' ? 'text-zinc-500' : 'text-slate-400'}`}>
                    ⚙️ VRAM Load Simulator
                  </span>
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                    vramUsage > 90 
                      ? 'bg-rose-500/10 text-rose-600' 
                      : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-slate-950 text-slate-500'
                  }`}>
                    Manual Override
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={vramUsage}
                    onChange={(e) => setVramUsage(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none"
                  />
                  <span className={`font-mono text-xs w-8 text-right font-bold ${vramUsage > 90 ? 'text-rose-600' : theme === 'light' ? 'text-zinc-700' : 'text-slate-300'}`}>
                    {vramUsage}%
                  </span>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setVramUsage(53)}
                    className={`text-[10px] font-mono px-2 py-1 border rounded transition-all cursor-pointer ${
                      theme === 'light' 
                        ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700' 
                        : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-400'
                    }`}
                  >
                    Rest (53%)
                  </button>
                  <button
                    onClick={() => setVramUsage(95)}
                    className={`text-[10px] font-mono px-2.5 py-1 border rounded transition-all font-bold cursor-pointer flex items-center gap-1 ${
                      vramUsage === 95
                        ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                        : theme === 'light'
                        ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                        : 'bg-rose-950/30 hover:bg-rose-900/40 border-rose-900/50 text-rose-400'
                    }`}
                  >
                    <AlertTriangle size={10} className={vramUsage === 95 ? 'animate-bounce' : ''} />
                    Stress Test (95%)
                  </button>
                </div>
              </div>

              {/* NPU Simulation controls */}
              <div className={`border-t pt-3.5 mt-2 space-y-2.5 ${theme === 'light' ? 'border-zinc-200' : 'border-slate-800/80'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${theme === 'light' ? 'text-zinc-500' : 'text-slate-400'}`}>
                    ⚙️ NPU Load Simulator
                  </span>
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                    npuUsage > 85 
                      ? 'bg-amber-500/10 text-amber-600' 
                      : theme === 'light' ? 'bg-zinc-100 text-zinc-600' : 'bg-slate-950 text-slate-500'
                  }`}>
                    Manual Override
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={npuUsage}
                    onChange={(e) => setNpuUsage(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none"
                  />
                  <span className={`font-mono text-xs w-8 text-right font-bold ${npuUsage > 85 ? 'text-amber-600' : theme === 'light' ? 'text-zinc-700' : 'text-slate-300'}`}>
                    {npuUsage}%
                  </span>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setNpuUsage(42)}
                    className={`text-[10px] font-mono px-2 py-1 border rounded transition-all cursor-pointer ${
                      theme === 'light' 
                        ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700' 
                        : 'bg-slate-950 hover:bg-slate-850 border-slate-800 text-slate-400'
                    }`}
                  >
                    Rest (42%)
                  </button>
                  <button
                    onClick={() => setNpuUsage(90)}
                    className={`text-[10px] font-mono px-2.5 py-1 border rounded transition-all font-bold cursor-pointer flex items-center gap-1 ${
                      npuUsage === 90
                        ? 'bg-amber-600 border-amber-500 text-white shadow-sm'
                        : theme === 'light'
                        ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700'
                        : 'bg-amber-950/30 hover:bg-amber-900/40 border-amber-900/50 text-amber-400'
                    }`}
                  >
                    Stress Test (90%)
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Interactive Chat Console */}
          <div className="flex-1">
            <InteractiveConsole
              messages={messages}
              setMessages={setMessages}
              onSpeakText={handleSpeakText}
              onSendMessage={handleSendMessage}
              theme={theme}
            />
          </div>

        </div>

        {/* Right Column: Steps, Integrations, Code, Sandbox */}
        <div className="lg:col-span-7 space-y-8">

          {/* Agent Task Queue & Execution Priority Panel */}
          <TaskQueuePanel
            theme={theme}
            onRefreshLogs={fetchAgentLogs}
            onRefreshScratchpads={fetchScratchpads}
            onRefreshDatabaseStats={fetchDatabaseStats}
            setIsThinking={setIsThinking}
            setOrbeMaterial={setOrbeMaterial}
          />

          {/* Orbiter Core (The Orbiter Core - Agent OS Engine) */}
          <section className="space-y-4">
            <OrbiterPlayground
              theme={theme}
              setOrbeMaterial={setOrbeMaterial}
              setVramUsage={setVramUsage}
              setNpuUsage={setNpuUsage}
              setIsThinking={setIsThinking}
              onRefreshLogs={fetchAgentLogs}
            />
          </section>

          {/* Tool Registry Manifesto & Custom SDK Extensions */}
          <section className="space-y-4">
            <ToolRegistryManifesto theme={theme} />
          </section>

          {/* Permission & Covenant System */}
          <section className="space-y-4">
            <PermissionCovenantEngine 
              theme={theme} 
              setOrbeMaterial={setOrbeMaterial} 
              onAddAuditLog={handleAddAuditLog}
            />
          </section>

          {/* Microkernel DAG & Plan IR Visualizer */}
          <section className="space-y-4">
            <MicrokernelVisualizer
              theme={theme}
              setOrbeMaterial={setOrbeMaterial}
              setVramUsage={setVramUsage}
              setNpuUsage={setNpuUsage}
              setIsThinking={setIsThinking}
              onAddAuditLog={handleAddAuditLog}
            />
          </section>

          {/* Sovereign Kernel L0 Control Panel */}
          <section className="space-y-4">
            <SovereignKernelControl
              theme={theme}
              setOrbeMaterial={setOrbeMaterial}
              setVramUsage={setVramUsage}
              setNpuUsage={setNpuUsage}
              onAddAuditLog={handleAddAuditLog}
            />
          </section>

          {/* Section: Aglaia Agent Reasoner, Scratchpads & Persistent SQLite Hub */}
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg border transition-all ${theme === 'light' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-yellow-950/20 text-yellow-500 border-yellow-500/10'}`}>
                  <Brain size={18} className="text-yellow-600 animate-pulse" />
                </span>
                <h2 className={`text-xl font-bold font-display transition-all ${theme === 'light' ? 'text-zinc-900' : 'text-slate-100'}`}>
                  Razonamiento Oracular y SQLite Hermético
                </h2>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleBackupSqliteDatabase}
                  disabled={isBackingUpDb}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    theme === 'light'
                      ? 'bg-orange-50 border-orange-300 text-orange-800 hover:bg-orange-600 hover:text-white hover:border-orange-600'
                      : 'bg-orange-950/30 border-orange-500/35 text-orange-300 hover:bg-orange-600 hover:text-white hover:border-orange-500'
                  }`}
                  title="Download a snapshot of the local SQLite database file (.db) containing agent logs, persistent scratchpads, and chat history"
                >
                  {isBackingUpDb ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Database size={12} />
                  )}
                  {isBackingUpDb ? 'Backing up SQLite...' : 'Backup SQLite Database'}
                </button>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide border uppercase ${
                  theme === 'light' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/20 text-emerald-400 border-emerald-500/20'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Soberano Local SQLite Activo
                </div>
              </div>
            </div>

            {/* SQLite Section Tab Bar: SQLite Workspace | Database Health */}
            <div
              className={`inline-flex items-center p-1 rounded-xl border text-xs ${
                theme === 'light'
                  ? 'bg-zinc-100 border-zinc-200'
                  : 'bg-slate-950 border-slate-800'
              }`}
              role="tablist"
              aria-label="SQLite Section Views"
            >
              <button
                type="button"
                role="tab"
                aria-selected={sqliteSectionTab === 'workspace'}
                onClick={() => setSqliteSectionTab('workspace')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  sqliteSectionTab === 'workspace'
                    ? theme === 'light'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'bg-slate-800 text-orange-400'
                    : theme === 'light'
                    ? 'text-zinc-600 hover:text-zinc-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Database size={13} />
                SQLite Workspace
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sqliteSectionTab === 'health'}
                onClick={() => setSqliteSectionTab('health')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  sqliteSectionTab === 'health'
                    ? theme === 'light'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'bg-slate-800 text-orange-400'
                    : theme === 'light'
                    ? 'text-zinc-600 hover:text-zinc-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity size={13} />
                Database Health
              </button>
            </div>

            {backupFeedback && (
              <div
                className={`px-3.5 py-2 rounded-lg border text-xs font-mono flex items-center justify-between gap-2 ${
                  backupFeedback.status === 'success'
                    ? theme === 'light'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300'
                    : theme === 'light'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-rose-950/25 border-rose-500/30 text-rose-300'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  {backupFeedback.status === 'success' ? (
                    <CheckCircle size={13} className="shrink-0" />
                  ) : (
                    <AlertTriangle size={13} className="shrink-0" />
                  )}
                  {backupFeedback.text}
                </span>
                <button
                  onClick={() => setBackupFeedback(null)}
                  className="text-[10px] opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {sqliteSectionTab === 'health' ? (
              <SqliteDatabaseHealth
                theme={theme}
                refreshTrigger={agentLogs.length + scratchpads.length}
                onAfterCompact={async () => {
                  await fetchAgentLogs();
                  await fetchDatabaseStats();
                }}
              />
            ) : (
            <>
            {/* Core Grid: Reasoner/Tool List & Scratchpads File Explorer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Box 1: Live Tool-Calling & Reasoner Loop */}
              <div className={`transition-all duration-350 border rounded-xl p-5 flex flex-col space-y-4 shadow-sm ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900/50 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
                    theme === 'light' ? 'text-zinc-700' : 'text-yellow-500'
                  }`}>
                    🧠 Bucle Oracular y Planificación
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">En Tiempo Real</span>
                </div>

                <div className="flex-1 min-h-[220px] max-h-[320px] overflow-y-auto space-y-3 pr-1">
                  {activeAgentSteps.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2.5">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                        ⚜️
                      </div>
                      <p className={`text-xs font-sans max-w-[200px] leading-relaxed ${theme === 'light' ? 'text-zinc-500' : 'text-slate-400'}`}>
                        Solicite a Aglaia cálculos herméticos, redacción de notas o inspecciones de hardware para desencadenar el bucle oracular de herramientas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[10px] uppercase font-mono tracking-widest text-yellow-600 font-bold">Cadena de Planificación Oracular:</p>
                      {activeAgentSteps.map((step, idx) => (
                        <div 
                          key={idx}
                          className={`p-3 rounded-lg border text-xs font-sans space-y-2 transition-all ${
                            step.status === 'success' 
                              ? theme === 'light' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-200'
                              : step.status === 'error'
                              ? theme === 'light' ? 'bg-rose-50 border-rose-200 text-rose-950' : 'bg-rose-950/20 border-rose-900/40 text-rose-200'
                              : theme === 'light' ? 'bg-amber-50 border-amber-200 text-amber-950 animate-pulse' : 'bg-amber-950/20 border-amber-900/40 text-amber-200 animate-pulse'
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono text-[11px] font-bold border-b pb-1.5 border-current/10">
                            <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
                              🛠️ {step.toolName}()
                            </span>
                            <span className="text-[9px] opacity-80">{step.timestamp}</span>
                          </div>
                          <div className="space-y-1 font-mono text-[10px] leading-relaxed">
                            <p className="font-semibold text-orange-500">Args:</p>
                            <pre className="overflow-x-auto p-1 bg-black/10 dark:bg-black/30 rounded text-[9px]">
                              {JSON.stringify(step.args, null, 2)}
                            </pre>
                            {step.result && (
                              <>
                                <p className="font-semibold text-emerald-500 mt-1">Returned:</p>
                                <pre className="overflow-x-auto p-1 bg-black/10 dark:bg-black/30 text-emerald-600 dark:text-emerald-400 rounded text-[9px] max-h-[80px]">
                                  {JSON.stringify(step.result, null, 2)}
                                </pre>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: Persistent Scratchpad File Explorer */}
              <div className={`transition-all duration-350 border rounded-xl p-5 flex flex-col space-y-4 shadow-sm ${
                theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900/50 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 ${
                    theme === 'light' ? 'text-zinc-700' : 'text-orange-400'
                  }`}>
                    📁 SQLite Scratchpads Storage
                  </h3>
                  <button 
                    onClick={() => {
                      setIsCreatingScratchpad(true);
                      setSelectedScratchpad(null);
                    }}
                    className={`p-1 rounded hover:bg-orange-500/10 text-orange-500 transition-colors border border-orange-500/20 cursor-pointer`}
                    title="Add new persistent note"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {isCreatingScratchpad ? (
                  <div className="space-y-3 text-xs flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <p className="font-mono text-[10px] text-orange-500 uppercase font-bold">New Persistent Scratchpad</p>
                      <input 
                        type="text"
                        placeholder="file_name (e.g. recipe)"
                        value={newScratchpadTitle}
                        onChange={(e) => setNewScratchpadTitle(e.target.value)}
                        className={`w-full p-2 rounded-lg border font-mono text-xs ${
                          theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950 border-slate-800 text-slate-100'
                        }`}
                      />
                      <textarea
                        placeholder="Enter markdown note content..."
                        rows={4}
                        value={newScratchpadContent}
                        onChange={(e) => setNewScratchpadContent(e.target.value)}
                        className={`w-full p-2 rounded-lg border font-sans text-xs resize-none ${
                          theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-slate-950 border-slate-800 text-slate-100'
                        }`}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setIsCreatingScratchpad(false)}
                        className={`px-2.5 py-1.5 rounded text-[11px] font-mono border ${
                          theme === 'light' ? 'bg-zinc-100 border-zinc-200' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveScratchpad(newScratchpadTitle, newScratchpadContent)}
                        disabled={!newScratchpadTitle || !newScratchpadContent}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-mono text-[11px] font-bold rounded shadow-md disabled:opacity-50"
                      >
                        Save File
                      </button>
                    </div>
                  </div>
                ) : selectedScratchpad ? (
                  <div className="space-y-3 text-xs flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-mono text-[11px] font-bold text-orange-500 flex items-center gap-1">
                          📄 {selectedScratchpad.title}
                        </p>
                        <button 
                          onClick={() => setSelectedScratchpad(null)}
                          className="text-[9px] font-mono text-slate-500 hover:underline"
                        >
                          Back to List
                        </button>
                      </div>
                      <div className={`p-3 rounded-lg border font-mono text-[11px] max-h-[140px] overflow-y-auto whitespace-pre-wrap leading-relaxed ${
                        theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}>
                        {selectedScratchpad.content}
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <button
                        onClick={() => handleDeleteScratchpad(selectedScratchpad.title)}
                        className="text-[10px] font-mono text-rose-500 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={11} /> Delete File
                      </button>
                      <button
                        onClick={() => setSelectedScratchpad(null)}
                        className="px-3 py-1.5 bg-orange-600/10 hover:bg-orange-600/20 text-orange-500 font-mono text-[11px] font-bold rounded"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : (() => {
                  const normalizedQuery = scratchpadSearchQuery.trim().toLowerCase();
                  const filteredScratchpads = normalizedQuery
                    ? scratchpads.filter(
                        (note) =>
                          note.title.toLowerCase().includes(normalizedQuery) ||
                          note.content.toLowerCase().includes(normalizedQuery)
                      )
                    : scratchpads;

                  return (
                    <div className="flex-1 flex flex-col space-y-2.5 min-h-[220px]">
                      <div className="relative flex items-center">
                        <Search
                          size={13}
                          className={`absolute left-2.5 pointer-events-none ${
                            theme === 'light' ? 'text-zinc-400' : 'text-slate-500'
                          }`}
                        />
                        <input
                          type="text"
                          value={scratchpadSearchQuery}
                          onChange={(e) => setScratchpadSearchQuery(e.target.value)}
                          placeholder="Filter scratchpads by title or content..."
                          aria-label="Filter persistent scratchpads by title or content"
                          className={`w-full pl-8 pr-16 py-1.5 rounded-lg border font-mono text-[11px] outline-none transition-colors ${
                            theme === 'light'
                              ? 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus:border-orange-500'
                              : 'bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500 focus:border-orange-500'
                          }`}
                        />
                        {normalizedQuery && (
                          <div className="absolute right-2 flex items-center gap-1.5">
                            <span className="text-[9.5px] font-mono tabular-nums text-orange-500 font-bold">
                              {filteredScratchpads.length}/{scratchpads.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => setScratchpadSearchQuery('')}
                              className={`p-0.5 rounded hover:bg-orange-500/15 transition-colors cursor-pointer ${
                                theme === 'light' ? 'text-zinc-500 hover:text-zinc-900' : 'text-slate-400 hover:text-slate-100'
                              }`}
                              title="Clear scratchpad search"
                              aria-label="Clear scratchpad search"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 max-h-[280px] overflow-y-auto space-y-1.5 pr-1">
                        {scratchpads.length === 0 ? (
                          <p className="text-[11px] text-slate-500 text-center py-10 font-mono">No persistent notes found.</p>
                        ) : filteredScratchpads.length === 0 ? (
                          <div className="text-center py-8 space-y-2">
                            <p className="text-[11px] text-slate-500 font-mono">
                              No scratchpads match &quot;{scratchpadSearchQuery.trim()}&quot;.
                            </p>
                            <button
                              type="button"
                              onClick={() => setScratchpadSearchQuery('')}
                              className="text-[10px] font-mono text-orange-500 hover:underline cursor-pointer"
                            >
                              Clear filter
                            </button>
                          </div>
                        ) : (
                          filteredScratchpads.map((note) => (
                            <div
                              key={note.title}
                              onClick={() => setSelectedScratchpad(note)}
                              className={`p-2.5 rounded-lg border text-xs font-mono cursor-pointer transition-all space-y-1 ${
                                theme === 'light'
                                  ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-800 hover:border-zinc-300'
                                  : 'bg-slate-950/40 hover:bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText size={13} className="text-orange-500 shrink-0" />
                                  <span className="font-bold font-mono tracking-tight truncate">{note.title}</span>
                                </div>
                                <span className="text-[9px] text-slate-500 shrink-0">{note.updated_at.split(',')[0]}</span>
                              </div>
                              {normalizedQuery && (
                                <p
                                  className={`text-[10px] truncate pl-5 ${
                                    theme === 'light' ? 'text-zinc-500' : 'text-slate-400'
                                  }`}
                                >
                                  {note.content}
                                </p>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* Live SQLite Logs & Agent Diagnostics Box */}
            {(() => {
              const heartbeatCount = agentLogs.filter(isRoutineHeartbeatLog).length;
              const isCompact = logViewMode === 'compact';
              const visibleLogs = isCompact
                ? agentLogs.filter((log) => !isRoutineHeartbeatLog(log))
                : agentLogs;

              return (
                <div className={`transition-all duration-350 border rounded-xl p-5 shadow-sm space-y-4 ${
                  theme === 'light' ? 'bg-white border-zinc-200' : 'bg-slate-900/50 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-orange-500" />
                      <h3 className={`text-xs font-bold uppercase tracking-wider font-mono ${
                        theme === 'light' ? 'text-zinc-700' : 'text-slate-200'
                      }`}>
                        🖥️ Internal SQLite Logs & Thought Stream
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded border cursor-pointer select-none transition-colors ${
                          isCompact
                            ? theme === 'light'
                              ? 'bg-orange-50 border-orange-300 text-orange-800'
                              : 'bg-orange-950/30 border-orange-500/40 text-orange-300'
                            : theme === 'light'
                            ? 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:border-zinc-300'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                        title="Toggle between Verbose (all entries) and Compact (hides routine system heartbeats) view modes"
                      >
                        <input
                          type="checkbox"
                          checked={isCompact}
                          onChange={(e) => setLogViewMode(e.target.checked ? 'compact' : 'verbose')}
                          className="accent-orange-500 cursor-pointer"
                          aria-label="Toggle Compact log view mode to hide routine system heartbeats"
                        />
                        <span className="font-bold uppercase tracking-wide">
                          {isCompact ? 'Compact' : 'Verbose'}
                        </span>
                        <span className="opacity-75">
                          {isCompact
                            ? heartbeatCount > 0
                              ? `(${heartbeatCount} hidden)`
                              : '(Hide heartbeats)'
                            : '(All logs)'}
                        </span>
                      </label>
                      <button
                        onClick={() => {
                          setActiveWorkspaceTab('timeline');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-[10px] font-mono px-2 py-1 rounded bg-orange-600/10 border border-orange-500/25 text-orange-600 dark:text-orange-400 hover:bg-orange-600 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                        title="Open Vertical Execution Timeline"
                      >
                        <Milestone size={11} />
                        Timeline
                      </button>
                      <button
                        onClick={() => {
                          setActiveWorkspaceTab('analytics');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="text-[10px] font-mono px-2 py-1 rounded bg-yellow-600/10 border border-yellow-500/25 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-600 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                        title="Open Agent Execution Analytics Dashboard"
                      >
                        <BarChart3 size={11} />
                        Open Analytics
                      </button>
                      <button 
                        onClick={handleCompactDatabase}
                        disabled={isCompactingDb}
                        className={`text-[10px] font-mono px-2.5 py-1 rounded border transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
                          theme === 'light'
                            ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-600 hover:text-white hover:border-amber-600'
                            : 'bg-amber-950/30 border-amber-500/35 text-amber-300 hover:bg-amber-600 hover:text-white hover:border-amber-500'
                        }`}
                        title="Run SQLite VACUUM & PRAGMA optimize to defragment agent logs storage and reclaim disk space"
                      >
                        {isCompactingDb ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Minimize2 size={11} />
                        )}
                        {isCompactingDb ? 'Compacting...' : 'Compact Database'}
                      </button>
                      <button 
                        onClick={handleClearAgentLogs}
                        className={`text-[10px] font-mono px-2 py-1 rounded border hover:text-orange-500 hover:border-orange-500 transition-colors cursor-pointer ${
                          theme === 'light' ? 'bg-zinc-100 border-zinc-200 text-zinc-650' : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Clear Logs
                      </button>
                      <button 
                        onClick={handleClearChat}
                        className="text-[10px] font-mono px-2 py-1 rounded bg-rose-600/10 border border-rose-500/20 text-rose-500 hover:bg-rose-600 hover:text-white transition-all cursor-pointer"
                        title="Clear conversations and database keys"
                      >
                        Reset Chat DB
                      </button>
                      <button 
                        onClick={handleExportArchive}
                        className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                        title="Export current conversation log and system diagnostics as JSON for local archival"
                      >
                        <Download size={11} />
                        Export Archive
                      </button>
                    </div>
                  </div>

                  {dbStorageStats && (
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono flex items-center justify-between gap-3 flex-wrap ${
                        theme === 'light'
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-600'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              dbStorageStats.autoVacuumEnabled ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          <span>
                            Auto-Vacuum:{' '}
                            <strong className={theme === 'light' ? 'text-zinc-800' : 'text-slate-200'}>
                              {dbStorageStats.autoVacuumMode}
                            </strong>
                          </span>
                        </span>
                        <span>
                          DB Size:{' '}
                          <strong className={theme === 'light' ? 'text-zinc-800' : 'text-slate-200'}>
                            {formatStorageBytes(dbStorageStats.sizeBytes)}
                          </strong>
                        </span>
                        <span>
                          Freelist:{' '}
                          <strong className={theme === 'light' ? 'text-zinc-800' : 'text-slate-200'}>
                            {dbStorageStats.freelistCount}/{dbStorageStats.pageCount} pages ({dbStorageStats.fragmentationPercent}%)
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 opacity-85">
                        <span>Auto-Reclaims: {dbStorageStats.autoVacuumRuns}</span>
                        <span>Compacts: {dbStorageStats.compactRuns}</span>
                      </div>
                    </div>
                  )}

                  {compactFeedback && (
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-[10.5px] font-mono flex items-center justify-between gap-2 ${
                        compactFeedback.status === 'success'
                          ? theme === 'light'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-emerald-950/25 border-emerald-500/30 text-emerald-300'
                          : theme === 'light'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-rose-950/25 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {compactFeedback.status === 'success' ? (
                          <CheckCircle size={12} className="shrink-0" />
                        ) : (
                          <AlertTriangle size={12} className="shrink-0" />
                        )}
                        {compactFeedback.text}
                      </span>
                      <button
                        onClick={() => setCompactFeedback(null)}
                        className="text-[10px] opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  <div className={`p-3.5 rounded-lg border font-mono text-[10px] leading-relaxed max-h-[160px] overflow-y-auto transition-colors ${
                    isCompact ? 'space-y-1' : 'space-y-1.5'
                  } ${
                    theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-black/40 border-slate-800 text-orange-200/80'
                  }`}>
                    {agentLogs.length === 0 ? (
                      <div className="text-center text-slate-500 py-6">Database stream empty. Send chat messages to trigger events!</div>
                    ) : visibleLogs.length === 0 ? (
                      <div className="text-center text-slate-500 py-6">
                        All {agentLogs.length} log {agentLogs.length === 1 ? 'entry is a routine system heartbeat' : 'entries are routine system heartbeats'} (hidden in Compact mode). Uncheck to switch to Verbose view.
                      </div>
                    ) : (
                      visibleLogs.map((log) => (
                        <div
                          key={log.id}
                          className={`flex items-start gap-2 border-b border-current/5 ${
                            isCompact ? 'pb-0.5' : 'pb-1'
                          }`}
                        >
                          <span className="text-orange-500 font-bold shrink-0">[{log.timestamp}]</span>
                          <span className={`px-1 rounded text-[9px] uppercase font-bold shrink-0 ${
                            log.type === 'tool' ? 'bg-blue-500/10 text-blue-400' :
                            log.type === 'planner' ? 'bg-purple-500/10 text-purple-400' :
                            log.type === 'heartbeat' ? 'bg-emerald-500/10 text-emerald-500' :
                            log.type === 'error' ? 'bg-rose-500/10 text-rose-400 font-bold animate-pulse' :
                            'bg-zinc-500/10 text-slate-400'
                          }`}>
                            {log.type}
                          </span>
                          <span
                            className={isCompact ? 'truncate leading-tight' : 'leading-normal'}
                            title={isCompact ? log.message : undefined}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}

            {/* SQLite Table Browser & Raw Schema Inspector */}
            <SqliteTableBrowser
              theme={theme}
              refreshTrigger={agentLogs.length + scratchpads.length}
            />
            </>
            )}
          </section>

          {/* Section: Terminal installation simulator */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-lg border transition-all ${theme === 'light' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-yellow-950/20 text-yellow-500 border-yellow-500/10'}`}>
                <TerminalIcon size={16} />
              </span>
              <h2 className={`text-xl font-bold font-display transition-all ${theme === 'light' ? 'text-zinc-900' : 'text-slate-100'}`}>Instalador del Oráculo de Aglaia</h2>
            </div>
            <TerminalSetup onCopyAllCode={() => {}} selectedPlatform={selectedPlatform} theme={theme} />
          </section>

          {/* Integration Hub cards for user platforms */}
          <section className="space-y-4 mt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`p-1.5 rounded-lg border transition-all ${theme === 'light' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-yellow-950/20 text-yellow-500 border-yellow-500/10'}`}>
                  <Sparkles size={16} />
                </span>
                <h2 className={`text-xl font-bold font-display transition-all ${theme === 'light' ? 'text-zinc-900' : 'text-slate-100'}`}>Sincronización con Programas</h2>
              </div>
              <span className={`text-xs font-mono px-2.5 py-1 rounded-md border transition-all duration-350 ${theme === 'light' ? 'bg-white border-zinc-300 text-zinc-650' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                Integraciones Activas: <span className="text-yellow-600 font-bold">{activeIntegrationsCount} / 4</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrations.map((item) => (
                <IntegrationCard
                  key={item.id}
                  integration={item}
                  onUpdateConfig={handleUpdateConfig}
                  onToggleStatus={handleToggleStatus}
                  theme={theme}
                />
              ))}
            </div>
          </section>

          {/* Simulated Sandbox Webhooks */}
          <section className="space-y-4 mt-8 pb-4">
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-lg border transition-all ${theme === 'light' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-yellow-950/20 text-yellow-500 border-yellow-500/10'}`}>
                <Radio size={16} className="text-yellow-600" />
              </span>
              <h2 className={`text-xl font-bold font-display transition-all ${theme === 'light' ? 'text-zinc-900' : 'text-slate-100'}`}>Simulador Sandbox Interactivo</h2>
            </div>
            <SimulationPlatform onSimulateMessage={handleSimulateWebhook} theme={theme} />
          </section>

          {/* Pro-Tip helper callout on local storage from template */}
          <div className={`transition-all duration-350 border p-4 rounded-xl ${theme === 'light' ? 'bg-yellow-50/75 border-yellow-200 text-yellow-900' : 'bg-yellow-950/20 border-yellow-500/20 text-yellow-200'}`}>
            <p className="text-xs">
              <span className="font-bold text-yellow-600 dark:text-yellow-500">Consejo:</span> Escriba <code className={`px-1.5 py-0.5 rounded font-mono ${theme === 'light' ? 'bg-zinc-200 text-zinc-950' : 'bg-black/80 text-yellow-405'}`}>aglaia</code> o <code className={`px-1.5 py-0.5 rounded font-mono ${theme === 'light' ? 'bg-zinc-200 text-zinc-950' : 'bg-black/80 text-yellow-405'}`}>status</code> en la consola oracular para verificar de inmediato el estado del sistema y parámetros.
            </p>
          </div>

        </div>

      </main>
      )}

      {/* Footer bar with telemetry specifications from balance design */}
      <footer className={`max-w-7xl mx-auto mt-6 flex flex-col md:flex-row justify-between items-center text-[10px] uppercase tracking-widest border-t pt-6 pb-12 px-4 gap-4 font-mono transition-all duration-350 ${theme === 'light' ? 'border-zinc-300 text-zinc-500' : 'border-slate-850 text-slate-500'}`}>
        <div>Almacenamiento Local: <span className={theme === 'light' ? 'text-zinc-800' : 'text-slate-300'}>/users/local/aglaia_data/</span></div>
        <div className="flex items-center space-x-4">
          <span>Sesión: 4h 12m</span>
          <span className="flex items-center">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 inline-block animate-ping" />
            Always On Mode
          </span>
        </div>
        <div className="text-yellow-600/70 font-semibold font-mono tracking-wider">Soberanía Absoluta Garantizada.</div>
      </footer>

    </div>
  );
}
