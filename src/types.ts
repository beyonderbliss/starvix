export type ChunkType = 'component' | 'hook' | 'util' | 'reducer' | 'other';

export interface CodeChunk {
  id: string;
  name: string;
  type: ChunkType;
  startLine: number;
  endLine: number;
  code: string;
  lineCount: number;
  sizeBytes: number;
  tokenEstimate: number;
  dependencies: string[];
  transpiledCode?: string;
  isRefactored?: boolean;
  gistUrl?: string;
}

export interface GistModule {
  id: string;
  name: string;
  url: string;
  rawUrl: string;
  createdAt: string;
  description: string;
  originalChunkId?: string;
  code: string;
  status: 'active' | 'loading' | 'error';
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  source: 'console' | 'runtime' | 'agent' | 'transpiler' | 'gist';
}

export interface AutoFixState {
  status: 'idle' | 'analyzing' | 'prompting' | 'ready' | 'applied' | 'failed';
  errorDetails?: {
    message: string;
    line?: number;
    column?: number;
    stack?: string;
  };
  targetChunk?: CodeChunk;
  fixedCode?: string;
  explanation?: string;
  tokensSaved?: number;
  fullFileTokens?: number;
  chunkTokens?: number;
}

export type ActiveTab = 'editor' | 'preview' | 'agent' | 'registry' | 'logs';

export type DevicePreset = 'mobile' | 'pixel' | 'tablet' | 'responsive';

export interface SettingsState {
  geminiApiKey: string;
  githubPat: string;
  autoFixEnabled: boolean;
  lowMemoryMode: boolean;
  serverGeminiAvailable: boolean;
  selectedModel: string;
}

export interface EditorChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  extractedCode?: string;
  codeApplied?: boolean;
  targetChunkName?: string;
  modelUsed?: string;
}

export interface CopilotState {
  isOpen: boolean;
  isMinimized: boolean;
  isGenerating: boolean;
  autoApply: boolean;
}
