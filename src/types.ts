export type Platform = 'discord' | 'telegram' | 'slack' | 'whatsapp';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  audioUrl?: string;
  isGeneratingAudio?: boolean;
  sources?: GroundingSource[];
  searchQueries?: string[];
}

export interface Integration {
  id: Platform;
  name: string;
  icon: string;
  status: 'inactive' | 'configuring' | 'active';
  description: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  secretLabel?: string;
  secretPlaceholder?: string;
  helpLink: string;
  config: {
    token: string;
    secret?: string;
    botName: string;
  };
}

export interface SimulatedMessage {
  id: string;
  platform: Platform;
  sender: string;
  text: string;
  replyText: string;
  replyTimestamp: string;
  timestamp: string;
}

export interface TerminalLine {
  text: string;
  type: 'input' | 'output' | 'error' | 'success' | 'system';
}

export interface AgentLogMeta {
  toolName?: string;
  durationMs?: number;
  status?: 'success' | 'error' | 'blocked' | 'info';
  context?: 'local' | 'remote' | 'blocked';
  source?: string;
}

export interface AgentLog {
  id: number;
  type: string;
  message: string;
  timestamp: string;
  createdAtMs?: number;
  meta?: AgentLogMeta;
}

