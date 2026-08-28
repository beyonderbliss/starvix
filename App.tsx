import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Code2,
  Play,
  Layers,
  Sparkles,
  Share2,
  Terminal,
  Upload,
  Columns,
  Maximize2,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings,
  Bot,
} from 'lucide-react';
import {
  ActiveTab,
  CodeChunk,
  GistModule,
  LogEntry,
  AutoFixState,
  SettingsState
} from './types';
import { parseMonolithicCode, replaceChunkWithGistLoader } from './utils/chunkingEngine';
import { safeLocalStorageGet, safeLocalStorageSet } from './utils/storage';
import { DEFAULT_MONOLITHIC_APP } from './utils/monolithicSample';

// Components
import { MonacoEditor, MonacoEditorHandle } from './components/MonacoEditor';
import { SnippetBar } from './components/SnippetBar';
import { PreviewSandbox } from './components/PreviewSandbox';
import { ChunkingInspector } from './components/ChunkingInspector';
import { AgentStudio } from './components/AgentStudio';
import { GistRegistry } from './components/GistRegistry';
import { TelemetryDrawer } from './components/TelemetryDrawer';
import { UploadPanel } from './components/UploadPanel';
import { EditorCopilot } from './components/EditorCopilot';

const INITIAL_GIST_MODULES: GistModule[] = [
  {
    id: 'gist_init_1',
    name: 'StatCard',
    url: 'https://gist.github.com/starvix-core/statcard',
    rawUrl: 'https://gist.githubusercontent.com/starvix-core/statcard/raw/StatCard.js',
    createdAt: 'Initial Module',
    description: 'Pre-registered Modular Metric Card transpiled to React.createElement',
    code: `/**
 * STARVIX Gist Module: StatCard
 * Transpiled to Vanilla React.createElement
 */
return function StatCard(props) {
  return React.createElement(
    "div",
    { className: "p-3.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 text-cyan-200" },
    React.createElement("div", { className: "flex justify-between text-xs opacity-75 mb-1" },
      React.createElement("span", null, props.title),
      React.createElement("span", null, props.icon || "⚡")
    ),
    React.createElement("div", { className: "text-xl font-bold tracking-tight text-white" }, props.value),
    props.subtitle && React.createElement("div", { className: "text-[11px] mt-1 text-cyan-400/80" }, props.subtitle)
  );
};`,
    status: 'active',
  },
  {
    id: 'gist_init_2',
    name: 'TouchDialPad',
    url: 'https://gist.github.com/starvix-core/dialpad',
    rawUrl: 'https://gist.githubusercontent.com/starvix-core/dialpad/raw/TouchDialPad.js',
    createdAt: 'Initial Module',
    description: 'Mobile low-RAM quick action touch grid component',
    code: `/**
 * STARVIX Gist Module: TouchDialPad
 */
return function TouchDialPad(props) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  return React.createElement(
    "div",
    { className: "p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2" },
    React.createElement("div", { className: "text-xs font-semibold text-slate-300" }, "Hardware Dial Controller"),
    React.createElement(
      "div",
      { className: "grid grid-cols-3 gap-1.5" },
      keys.map(k => React.createElement(
        "button",
        {
          key: k,
          className: "py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded text-xs font-mono text-slate-200 transition",
          onClick: () => props.onPress && props.onPress(k)
        },
        k
      ))
    )
  );
};`,
    status: 'active',
  },
];

export default function App() {
  // Load draft from localStorage or fallback to rich sample
  const [code, setCode] = useState<string>(() => {
    return safeLocalStorageGet<string>('starvix_editor_draft', DEFAULT_MONOLITHIC_APP);
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('editor');
  const [splitView, setSplitView] = useState<boolean>(false);
  const [autoSaveTime, setAutoSaveTime] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<SettingsState>(() => ({
    geminiApiKey: safeLocalStorageGet<string>('starvix_gemini_api_key', ''),
    githubPat: safeLocalStorageGet<string>('starvix_github_pat', ''),
    autoFixEnabled: safeLocalStorageGet<boolean>('starvix_autofix_enabled', true),
    lowMemoryMode: true,
    serverGeminiAvailable: false,
    selectedModel: 'gemini-2.5-flash',
  }));

  // Gist Modules
  const [gistModules, setGistModules] = useState<GistModule[]>(() => {
    return safeLocalStorageGet<GistModule[]>('starvix_gist_modules', INITIAL_GIST_MODULES);
  });

  // Telemetry Logs
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init_1',
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: 'STARVIX Mobile Agent Studio initialized for low-RAM Android runtime.',
      source: 'runtime',
    },
    {
      id: 'init_2',
      timestamp: new Date().toLocaleTimeString(),
      level: 'success',
      message: 'AST-Lite Chunking Engine & Virtual Sandbox ready.',
      source: 'runtime',
    },
  ]);

  // Auto-Fix Engine State
  const [autoFixState, setAutoFixState] = useState<AutoFixState>({
    status: 'idle',
  });
  const [isFixing, setIsFixing] = useState(false);

  // Active isolated chunk
  const [activeChunk, setActiveChunk] = useState<CodeChunk | null>(null);

  // Ref to Monaco editor
  const editorRef = useRef<MonacoEditorHandle>(null);

  // Integrated Editor AI Copilot State
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Parse code into AST-Lite chunks
  const chunks = useMemo(() => {
    return parseMonolithicCode(code);
  }, [code]);

  // Check server health on mount
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.serverGeminiAvailable) {
          setSettings((prev) => ({ ...prev, serverGeminiAvailable: true }));
        }
      })
      .catch(() => {
        // Dev server or client fallback
      });
  }, []);

  // Auto-save safety net: Debounced persist to localStorage with quota protection
  useEffect(() => {
    const timer = setTimeout(() => {
      const success = safeLocalStorageSet('starvix_editor_draft', code);
      if (success) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setAutoSaveTime(timeStr);
      } else {
        // Disk quota alert
        setLogs((prev) => [
          {
            id: `err_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'warn',
            message: '[Storage Warning] Mobile browser disk quota near limit. Non-critical telemetry cleared.',
            source: 'runtime',
          },
          ...prev.slice(0, 50),
        ]);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [code]);

  // Persist Settings
  const handleUpdateSettings = useCallback((newSettings: Partial<SettingsState>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.geminiApiKey !== undefined) {
        safeLocalStorageSet('starvix_gemini_api_key', updated.geminiApiKey);
      }
      if (newSettings.githubPat !== undefined) {
        safeLocalStorageSet('starvix_github_pat', updated.githubPat);
      }
      if (newSettings.autoFixEnabled !== undefined) {
        safeLocalStorageSet('starvix_autofix_enabled', updated.autoFixEnabled);
      }
      return updated;
    });
  }, []);

  // Add Log Entry
  const handleAddLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newLog: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      ...entry,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 100)]);
  }, []);

  // Clear Logs
  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Manual save snapshot
  const handleManualSave = useCallback(() => {
    safeLocalStorageSet('starvix_editor_draft', code);
    const timeStr = new Date().toLocaleTimeString();
    setAutoSaveTime(timeStr);
    handleAddLog({
      level: 'success',
      message: `Manual snapshot saved to local sandbox storage at ${timeStr}.`,
      source: 'runtime',
    });
  }, [code, handleAddLog]);

  // Handle Runtime Error detected from Sandbox
  const handleSandboxError = useCallback(
    (error: { message: string; stack?: string; line?: number; column?: number }) => {
      // Find matching chunk if error has line info
      let target: CodeChunk | undefined;
      if (error.line) {
        target = chunks.find((c) => error.line! >= c.startLine && error.line! <= c.endLine);
      }

      setAutoFixState((prev) => ({
        ...prev,
        status: 'ready',
        errorDetails: error,
        targetChunk: target || activeChunk || chunks[0],
      }));

      // If auto-fix is enabled and we aren't currently prompting, trigger self-correction
      if (settings.autoFixEnabled && !isFixing) {
        // Automated prompt
        triggerGeminiSelfCorrection(error, target || activeChunk || chunks[0]);
      }
    },
    [chunks, activeChunk, settings.autoFixEnabled, isFixing]
  );

  // Gemini 2.5 Flash Self-Correction Loop
  const triggerGeminiSelfCorrection = async (
    customError?: { message: string; stack?: string },
    customTarget?: CodeChunk
  ) => {
    const targetError = customError || autoFixState.errorDetails;
    const target = customTarget || autoFixState.targetChunk || activeChunk || chunks[0];

    if (!targetError) {
      handleAddLog({
        level: 'info',
        message: 'No runtime exception to auto-fix. Running proactive code audit on active chunk.',
        source: 'agent',
      });
    }

    setIsFixing(true);
    setAutoFixState((prev) => ({ ...prev, status: 'prompting' }));

    try {
      const codeSnippet = target ? target.code : code.slice(0, 2000);
      const systemInstruction = `You are a Senior Full-Stack Systems Architect specializing in Mobile Web IDEs, Memory-Constrained Sandboxes, and LLM-Driven Code Transformation Engines.
Fix the bug in the provided React component.
- Strictly adhere to low-RAM mobile execution.
- Maintain existing props and behavior.
- Return ONLY valid working JavaScript/React code in a single code block, followed by a concise 2-sentence explanation of what was fixed.`;

      const prompt = `TARGET CHUNK (${target ? target.name : 'Component'}):\n\`\`\`javascript\n${codeSnippet}\n\`\`\`\n\nERROR CAUGHT IN VIRTUAL SANDBOX:\n${targetError ? targetError.message : 'General mobile code optimization audit'}\n${targetError?.stack ? `\nSTACK:\n${targetError.stack}` : ''}\n\nPlease self-repair this component.`;

      let responseText = '';

      // Direct Gemini 2.5 Flash call if client key provided, or backend proxy
      if (settings.geminiApiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.selectedModel}:generateContent?key=${encodeURIComponent(settings.geminiApiKey)}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.2 }
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || 'Gemini API call failed');
        }
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        // Fallback to server route
        const res = await fetch('/api/gemini/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            systemInstruction,
            model: settings.selectedModel
          })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Server Gemini call failed');
        }
        responseText = data.text || '';
      }

      // Extract code block
      const codeMatch = responseText.match(/```(?:javascript|jsx|typescript|tsx)?([\s\S]*?)```/);
      const fixedCode = codeMatch && codeMatch[1] ? codeMatch[1].trim() : responseText.trim();
      const explanation = responseText.replace(codeMatch ? codeMatch[0] : '', '').trim();

      setAutoFixState({
        status: 'ready',
        errorDetails: targetError,
        targetChunk: target,
        fixedCode,
        explanation: explanation || 'Repaired exception and restored defensive boundaries.',
      });

      handleAddLog({
        level: 'success',
        message: `Gemini 2.5 Flash completed self-correction for ${target ? target.name : 'monolith'}. Solution ready to apply.`,
        source: 'agent',
      });
    } catch (err: unknown) {
      const e = err as Error;
      setAutoFixState((prev) => ({ ...prev, status: 'failed' }));
      handleAddLog({
        level: 'error',
        message: `Auto-Fix failed: ${e.message}`,
        source: 'agent',
      });
    } finally {
      setIsFixing(false);
    }
  };

  // Apply Auto-Fix patch cleanly
  const handleApplyFix = (fixedCode: string, targetChunk?: CodeChunk) => {
    if (targetChunk) {
      // Replace only target chunk's lines in full code
      const lines = code.split('\n');
      const before = lines.slice(0, targetChunk.startLine - 1);
      const after = lines.slice(targetChunk.endLine);
      const newFullCode = [...before, fixedCode, ...after].join('\n');
      setCode(newFullCode);
    } else {
      // Direct replace
      setCode(fixedCode);
    }

    setAutoFixState({ status: 'applied' });
    handleAddLog({
      level: 'success',
      message: `Applied self-repaired code patch into Monaco Editor. Virtual sandbox re-evaluating...`,
      source: 'agent',
    });
  };

  // Jump to specific line in Monaco Editor
  const handleJumpToLine = (lineNumber: number) => {
    setActiveTab('editor');
    setTimeout(() => {
      editorRef.current?.jumpToLine(lineNumber);
    }, 100);
  };

  // Snippet Insertion
  const handleInsertSnippet = (snippet: string, offset?: number) => {
    editorRef.current?.insertText(snippet, offset);
  };

  // Direct Execution of code generated by Editor AI Copilot
  const handleApplyCopilotCode = (newCode: string, description?: string) => {
    // If activeChunk is selected and newCode looks like an isolated chunk rather than the whole app
    if (
      activeChunk &&
      !newCode.includes('export default') &&
      !newCode.includes('function App(') &&
      !newCode.includes('const App =') &&
      newCode.length < code.length * 0.7
    ) {
      const lines = code.split('\n');
      const before = lines.slice(0, activeChunk.startLine - 1);
      const after = lines.slice(activeChunk.endLine);
      const newFullCode = [...before, newCode, ...after].join('\n');
      setCode(newFullCode);
    } else {
      // Direct full-code update
      setCode(newCode);
    }

    handleAddLog({
      level: 'success',
      message: description || 'Instruksi AI Copilot berhasil dieksekusi dan diterapkan ke Editor.',
      source: 'agent',
    });
  };

  // Add Gist Module to state and persist
  const handleAddGistModule = (newMod: GistModule) => {
    const updated = [newMod, ...gistModules];
    setGistModules(updated);
    safeLocalStorageSet('starvix_gist_modules', updated);
    handleAddLog({
      level: 'success',
      message: `Registered Gist Module: ${newMod.name} (${newMod.rawUrl})`,
      source: 'gist',
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0A0A0B] text-slate-100 overflow-hidden select-none font-sans">
      {/* Top Application Header - Specialist Tool Instrument Bar */}
      <header className="h-12 bg-[#141416] border-b border-[#2A2A2E] px-3 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          {/* App Branding Icon - Calibrated Hardware Badge */}
          <div className="w-7 h-7 rounded-md bg-[#1B1B1F] border border-[#2A2A2E] flex items-center justify-center text-[#38BDF8] shadow-sm">
            <span className="font-mono font-black text-xs tracking-tighter">SX</span>
          </div>

          <div>
            <h1 className="text-xs font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
              STARVIX <span className="text-[10px] text-[#38BDF8] font-mono font-medium tracking-wide uppercase">Mobile Studio</span>
            </h1>
            <div className="text-[9px] text-[#94A3B8] font-mono flex items-center gap-1.5">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />SANDBOX ACTIVE</span>
              <span className="text-[#2A2A2E]">&bull;</span>
              <span>10K+ CHUNKING</span>
            </div>
          </div>
        </div>

        {/* Header Right Status & Controls */}
        <div className="flex items-center gap-2">
          {/* AI Chat Copilot Header Toggle */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('editor');
              setIsCopilotOpen((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition shadow-sm ${
              isCopilotOpen
                ? 'bg-[#38BDF8] text-black border-[#38BDF8] font-bold'
                : 'bg-[#1B1B1F] border-[#38BDF8]/40 text-[#38BDF8] hover:border-[#38BDF8] hover:bg-[#38BDF8]/10'
            }`}
            title="Buka AI Chat Copilot (Bahasa Sehari-hari)"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold tracking-wider">AI CHAT</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
          </button>

          {/* Chunks Indicator */}
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1B1B1F] border border-[#2A2A2E] text-slate-200 text-[11px] font-mono hover:border-[#38BDF8] transition"
            title="Isolated AST-Lite Chunks"
          >
            <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>{chunks.length} Chunks</span>
          </button>

          {/* Split Mode (for tablets/desktops) */}
          <button
            type="button"
            onClick={() => setSplitView(!splitView)}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition ${
              splitView
                ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#1B1B1F] border-[#2A2A2E] text-slate-300 hover:border-slate-500 hover:text-white'
            }`}
            title="Toggle Dual-Panel Split View"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="text-[11px]">SPLIT</span>
          </button>

          {/* Auto-Save Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0A0A0B] border border-[#2A2A2E] text-[10px] text-slate-300 font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                autoSaveTime ? 'bg-[#22C55E]' : 'bg-slate-500'
              }`}
            />
            <span className="hidden sm:inline">
              {autoSaveTime ? `SYNC ${autoSaveTime}` : 'AUTO-SYNC'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 flex overflow-hidden relative bg-[#0A0A0B]">
        {/* If Split View on wide screen, render Editor + Preview side-by-side */}
        {splitView ? (
          <div className="w-full h-full flex flex-row divide-x divide-[#2A2A2E]">
            <div className="w-1/2 h-full flex flex-col bg-[#0A0A0B] relative">
              <SnippetBar
                onInsert={handleInsertSnippet}
                onUndo={() => editorRef.current?.undo()}
                onRedo={() => editorRef.current?.redo()}
                onFormat={() => editorRef.current?.formatDocument()}
                onToggleCopilot={() => setIsCopilotOpen((prev) => !prev)}
                isCopilotOpen={isCopilotOpen}
              />
              <div className="flex-1 overflow-hidden relative">
                <MonacoEditor
                  ref={editorRef}
                  value={code}
                  onChange={setCode}
                  language="javascript"
                />
                {!isCopilotOpen && (
                  <button
                    type="button"
                    onClick={() => setIsCopilotOpen(true)}
                    className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1B1B1F]/95 hover:bg-[#222226] border border-[#38BDF8]/60 shadow-2xl backdrop-blur-md text-white font-mono text-xs font-bold transition-all active:scale-95 group"
                    title="Buka AI Chat Copilot (Bahasa Sehari-hari)"
                  >
                    <div className="w-5 h-5 rounded-md bg-[#38BDF8] flex items-center justify-center text-black shadow">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[#38BDF8] group-hover:text-white transition tracking-wider">AI CHAT</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
                    </span>
                  </button>
                )}
                <EditorCopilot
                  isOpen={isCopilotOpen}
                  onClose={() => setIsCopilotOpen(false)}
                  currentCode={code}
                  onApplyCode={handleApplyCopilotCode}
                  onInsertAtCursor={(snippet) => editorRef.current?.insertText(snippet)}
                  activeChunk={activeChunk}
                  settings={settings}
                  onAddLog={handleAddLog}
                />
              </div>
            </div>

            <div className="w-1/2 h-full flex flex-col bg-[#0A0A0B]">
              {activeTab === 'preview' ? (
                <PreviewSandbox
                  code={code}
                  onLog={handleAddLog}
                  onErrorDetected={handleSandboxError}
                  onTriggerAutoFix={() => {
                    setActiveTab('agent');
                    triggerGeminiSelfCorrection();
                  }}
                />
              ) : activeTab === 'agent' ? (
                <AgentStudio
                  autoFixState={autoFixState}
                  activeChunk={activeChunk}
                  fullCode={code}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onApplyFix={handleApplyFix}
                  onTriggerSelfCorrection={() => triggerGeminiSelfCorrection()}
                  isGenerating={isFixing}
                />
              ) : activeTab === 'registry' ? (
                <GistRegistry
                  modules={gistModules}
                  chunks={chunks}
                  fullCode={code}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddModule={handleAddGistModule}
                  onUpdateFullCode={setCode}
                />
              ) : activeTab === 'logs' ? (
                <TelemetryDrawer
                  logs={logs}
                  onClearLogs={handleClearLogs}
                  autoSaveTime={autoSaveTime}
                  onManualSave={handleManualSave}
                />
              ) : (
                <ChunkingInspector
                  chunks={chunks}
                  fullCode={code}
                  onJumpToLine={handleJumpToLine}
                  onSelectChunkForAgent={(c) => {
                    setActiveChunk(c);
                    setActiveTab('agent');
                  }}
                  onStartGistRefactor={(c) => {
                    setActiveChunk(c);
                    setActiveTab('registry');
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          /* Single Mobile View based on activeTab */
          <div className="w-full h-full flex flex-col overflow-hidden bg-[#0A0A0B]">
            {activeTab === 'editor' && (
              <div className="w-full h-full flex flex-col bg-[#0A0A0B] relative">
                <SnippetBar
                  onInsert={handleInsertSnippet}
                  onUndo={() => editorRef.current?.undo()}
                  onRedo={() => editorRef.current?.redo()}
                  onFormat={() => editorRef.current?.formatDocument()}
                  onToggleCopilot={() => setIsCopilotOpen((prev) => !prev)}
                  isCopilotOpen={isCopilotOpen}
                />
                <div className="flex-1 overflow-hidden relative">
                  <MonacoEditor
                    ref={editorRef}
                    value={code}
                    onChange={setCode}
                    language="javascript"
                  />
                  {!isCopilotOpen && (
                    <button
                      type="button"
                      onClick={() => setIsCopilotOpen(true)}
                      className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1B1B1F]/95 hover:bg-[#222226] border border-[#38BDF8]/60 shadow-2xl backdrop-blur-md text-white font-mono text-xs font-bold transition-all active:scale-95 group"
                      title="Buka AI Chat Copilot (Bahasa Sehari-hari)"
                    >
                      <div className="w-5 h-5 rounded-md bg-[#38BDF8] flex items-center justify-center text-black shadow">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[#38BDF8] group-hover:text-white transition tracking-wider">AI CHAT</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
                      </span>
                    </button>
                  )}
                  <EditorCopilot
                    isOpen={isCopilotOpen}
                    onClose={() => setIsCopilotOpen(false)}
                    currentCode={code}
                    onApplyCode={handleApplyCopilotCode}
                    onInsertAtCursor={(snippet) => editorRef.current?.insertText(snippet)}
                    activeChunk={activeChunk}
                    settings={settings}
                    onAddLog={handleAddLog}
                  />
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <PreviewSandbox
                code={code}
                onLog={handleAddLog}
                onErrorDetected={handleSandboxError}
                onTriggerAutoFix={() => {
                  setActiveTab('agent');
                  triggerGeminiSelfCorrection();
                }}
              />
            )}

            {activeTab === 'agent' && (
              <AgentStudio
                autoFixState={autoFixState}
                activeChunk={activeChunk}
                fullCode={code}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onApplyFix={handleApplyFix}
                onTriggerSelfCorrection={() => triggerGeminiSelfCorrection()}
                isGenerating={isFixing}
              />
            )}

            {activeTab === 'registry' && (
              <GistRegistry
                modules={gistModules}
                chunks={chunks}
                fullCode={code}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onAddModule={handleAddGistModule}
                onUpdateFullCode={setCode}
              />
            )}

            {activeTab === 'logs' && (
              <TelemetryDrawer
                logs={logs}
                onClearLogs={handleClearLogs}
                autoSaveTime={autoSaveTime}
                onManualSave={handleManualSave}
              />
            )}
          </div>
        )}
      </main>

      {/* Responsive Mobile Tab Navigation - Precision Hardware Tool Switcher */}
      <nav className="h-14 bg-[#141416] border-t border-[#2A2A2E] px-2 flex items-center justify-around shrink-0 z-20 safe-bottom">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-md transition ${
            activeTab === 'editor'
              ? 'text-[#38BDF8] font-semibold bg-[#1B1B1F] border border-[#2A2A2E]'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span className="text-[10px] font-mono tracking-tight uppercase">Editor</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-md relative transition ${
            activeTab === 'preview'
              ? 'text-[#38BDF8] font-semibold bg-[#1B1B1F] border border-[#2A2A2E]'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Play className="w-4 h-4" />
          <span className="text-[10px] font-mono tracking-tight uppercase">Preview</span>
          {autoFixState.errorDetails && (
            <span className="w-2 h-2 rounded-full bg-[#F27D26] absolute top-1 right-2 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('agent')}
          className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-md relative transition ${
            activeTab === 'agent'
              ? 'text-[#38BDF8] font-semibold bg-[#1B1B1F] border border-[#2A2A2E]'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] font-mono tracking-tight uppercase">Agent</span>
          {autoFixState.status === 'prompting' && (
            <span className="w-2 h-2 rounded-full bg-[#F27D26] absolute top-1 right-2 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('registry')}
          className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-md transition ${
            activeTab === 'registry'
              ? 'text-[#38BDF8] font-semibold bg-[#1B1B1F] border border-[#2A2A2E]'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span className="text-[10px] font-mono tracking-tight uppercase">Registry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-md relative transition ${
            activeTab === 'logs'
              ? 'text-[#38BDF8] font-semibold bg-[#1B1B1F] border border-[#2A2A2E]'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span className="text-[10px] font-mono tracking-tight uppercase">Logs</span>
          {logs.some((l) => l.level === 'error') && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#F27D26] absolute top-1 right-2" />
          )}
        </button>
      </nav>

      {/* Floating Action / Drawer for Quick Code Chunking & File Import */}
      {activeTab === 'editor' && (
        <div className="absolute right-3 bottom-16 z-30 flex flex-col gap-2">
          {/* Chunk Inspector Toggle Trigger - Hardware Machined Round Button */}
          <button
            type="button"
            onClick={() => {
              const drawer = document.getElementById('starvix-chunk-drawer');
              if (drawer) drawer.classList.toggle('hidden');
            }}
            className="w-10 h-10 rounded-md bg-[#1B1B1F] border border-[#2A2A2E] text-[#38BDF8] shadow-lg flex items-center justify-center hover:border-[#38BDF8] active:scale-95 transition"
            title="Inspect 10K+ Chunks"
            aria-label="Inspect 10K+ Chunks"
          >
            <Layers className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Overlay Drawer for Chunking Inspector & File Import */}
      <div
        id="starvix-chunk-drawer"
        className="hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in"
      >
        <div className="w-full max-w-md h-full bg-[#141416] border-l border-[#2A2A2E] flex flex-col shadow-2xl overflow-hidden">
          <div className="p-3 border-b border-[#2A2A2E] flex items-center justify-between bg-[#0A0A0B]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#38BDF8]" />
              <span className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider">
                AST-Lite Chunk Inspector & Upload
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const drawer = document.getElementById('starvix-chunk-drawer');
                if (drawer) drawer.classList.add('hidden');
              }}
              className="px-2 py-1 rounded bg-[#1B1B1F] border border-[#2A2A2E] text-slate-400 hover:text-white text-xs font-mono"
              aria-label="Close Chunk Inspector drawer"
            >
              ESC
            </button>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex border-b border-[#2A2A2E] bg-[#0A0A0B] text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  const chunkTab = document.getElementById('drawer-tab-chunks');
                  const uploadTab = document.getElementById('drawer-tab-upload');
                  if (chunkTab && uploadTab) {
                    chunkTab.classList.remove('hidden');
                    uploadTab.classList.add('hidden');
                  }
                }}
                className="flex-1 py-2 text-center font-medium text-[#38BDF8] border-b-2 border-[#38BDF8]"
              >
                AST Chunks ({chunks.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  const chunkTab = document.getElementById('drawer-tab-chunks');
                  const uploadTab = document.getElementById('drawer-tab-upload');
                  if (chunkTab && uploadTab) {
                    chunkTab.classList.add('hidden');
                    uploadTab.classList.remove('hidden');
                  }
                }}
                className="flex-1 py-2 text-center font-medium text-slate-400 hover:text-slate-200"
              >
                Upload / Presets
              </button>
            </div>

            <div id="drawer-tab-chunks" className="flex-1 overflow-hidden">
              <ChunkingInspector
                chunks={chunks}
                fullCode={code}
                onJumpToLine={(l) => {
                  handleJumpToLine(l);
                  document.getElementById('starvix-chunk-drawer')?.classList.add('hidden');
                }}
                onSelectChunkForAgent={(c) => {
                  setActiveChunk(c);
                  setActiveTab('agent');
                  document.getElementById('starvix-chunk-drawer')?.classList.add('hidden');
                }}
                onStartGistRefactor={(c) => {
                  setActiveChunk(c);
                  setActiveTab('registry');
                  document.getElementById('starvix-chunk-drawer')?.classList.add('hidden');
                }}
              />
            </div>

            <div id="drawer-tab-upload" className="hidden flex-1 overflow-hidden">
              <UploadPanel
                onLoadCode={(newCode) => {
                  setCode(newCode);
                  document.getElementById('starvix-chunk-drawer')?.classList.add('hidden');
                  handleAddLog({
                    level: 'success',
                    message: `Loaded code (${newCode.split('\n').length} LOC). AST chunks parsed.`,
                    source: 'runtime',
                  });
                }}
                currentCode={code}
                onResetToSample={() => {
                  setCode(DEFAULT_MONOLITHIC_APP);
                  document.getElementById('starvix-chunk-drawer')?.classList.add('hidden');
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
