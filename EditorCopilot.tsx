import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Sparkles,
  Send,
  Check,
  Copy,
  Code2,
  Play,
  RotateCcw,
  Minimize2,
  Maximize2,
  X,
  CheckCircle2,
  ArrowRight,
  Terminal,
  Cpu,
  Trash2,
  AlertTriangle,
  FileCode,
  Layers,
  Wand2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { EditorChatMessage, CodeChunk, SettingsState } from '../types';

interface EditorCopilotProps {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  onApplyCode: (newCode: string, description?: string) => void;
  onInsertAtCursor?: (snippet: string) => void;
  activeChunk: CodeChunk | null;
  settings: SettingsState;
  onAddLog: (entry: { level: 'info' | 'warn' | 'error' | 'success'; message: string; source: 'agent' | 'console' | 'runtime' | 'transpiler' | 'gist' }) => void;
}

// Everyday conversational quick prompts (Bahasa sehari-hari & Indonesian/English dev instructions)
const CONVERSATIONAL_PRESETS = [
  {
    label: '✨ Tambah Dark/Light Toggle',
    prompt: 'Tolong tambahkan tombol switch tema Dark/Light mode di header beserta state pengaturannya.',
  },
  {
    label: '🚀 Tambah Counter Interaktif',
    prompt: 'Bikinin komponen counter interaktif dengan tombol tambah (+), kurang (-), dan reset dengan style yang keren.',
  },
  {
    label: '🎨 Percantik Styling & Animasi',
    prompt: 'Percantik tampilan UI ini pakai Tailwind CSS yang modern, kasih hover effects dan rounded corners yang rapi.',
  },
  {
    label: '🛡️ Perbaiki Error & Bug',
    prompt: 'Cek seluruh kode ini, temukan potensi bug atau syntax error dan perbaiki langsung kodenya.',
  },
  {
    label: '📱 Buat Form Input Baru',
    prompt: 'Tambahkan form input data sederhana (nama, catatan, status) dengan validasi dan daftar riwayat input di bawahnya.',
  },
  {
    label: '💡 Jelaskan Kode Ini',
    prompt: 'Jelaskan cara kerja kode ini secara singkat dan santai dengan bahasa sehari-hari.',
  },
];

export const EditorCopilot: React.FC<EditorCopilotProps> = ({
  isOpen,
  onClose,
  currentCode,
  onApplyCode,
  onInsertAtCursor,
  activeChunk,
  settings,
  onAddLog,
}) => {
  const [messages, setMessages] = useState<EditorChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content:
        'Halo! Saya **STARVIX AI Copilot**, asisten cerdas yang terintegrasi langsung di dalam editor Anda.\n\nKetik instruksi Anda dalam **bahasa sehari-hari** (misalnya: *"tolong tambahin tombol tema"*, *"bikinin form input"*, *"benerin error ini"*), dan saya siap langsung membuatkan kodenya serta menerapkannya langsung ke editor!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeDiffId, setActiveDiffId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Extract clean code block from AI response
  const extractCodeFromMarkdown = (text: string): string | null => {
    // Look for ```javascript, ```jsx, ```tsx, ```ts or simple ```
    const codeBlockRegex = /```(?:javascript|jsx|tsx|ts|js)?\s*([\s\S]*?)```/i;
    const match = text.match(codeBlockRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
    return null;
  };

  // Submit instruction to AI
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isGenerating) return;

    setErrorMsg(null);
    setInputPrompt('');

    const userMessage: EditorChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      targetChunkName: activeChunk?.name,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsGenerating(true);

    try {
      // Prepare payload for server-side /api/gemini/chat
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          currentCode,
          activeChunkName: activeChunk?.name,
          activeChunkCode: activeChunk?.code,
          model: settings.selectedModel || 'gemini-2.5-flash',
          apiKey: settings.geminiApiKey || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal berkomunikasi dengan AI Copilot.');
      }

      const replyText = data.text || 'Maaf, tidak ada respon yang diterima.';
      const extractedCode = extractCodeFromMarkdown(replyText);

      const assistantMessage: EditorChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        extractedCode: extractedCode || undefined,
        modelUsed: data.modelUsed,
        codeApplied: false,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      onAddLog({
        level: 'success',
        message: `[AI Copilot] Instruksi diproses (${extractedCode ? 'Kode Dihasilkan' : 'Penjelasan'}).`,
        source: 'agent',
      });

      // If Auto-Apply is turned on and code was produced, apply immediately!
      if (autoApply && extractedCode) {
        handleApplyToEditor(assistantMessage.id, extractedCode);
      }
    } catch (err: unknown) {
      const e = err as Error;
      console.error('Copilot request failed:', e);
      setErrorMsg(e.message || 'Terjadi kesalahan saat memproses permintaan.');

      const errorMessage: EditorChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Waduh, terjadi kendala saat memproses instruksi:**\n\n${e.message}\n\n*Tips: Pastikan koneksi internet stabil atau periksa Gemini API Key di menu Pengaturan.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, errorMessage]);

      onAddLog({
        level: 'error',
        message: `[AI Copilot Error] ${e.message}`,
        source: 'agent',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Direct Execution: Apply generated code to the editor
  const handleApplyToEditor = (messageId: string, codeToApply: string) => {
    try {
      onApplyCode(codeToApply, 'Diterapkan dari AI Copilot Editor');

      // Update message state to show applied badge
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, codeApplied: true } : m))
      );

      onAddLog({
        level: 'success',
        message: `[AI Execution] Kode dari AI Copilot berhasil diterapkan ke Editor (${codeToApply.split('\n').length} baris).`,
        source: 'agent',
      });
    } catch (err: unknown) {
      const e = err as Error;
      onAddLog({
        level: 'error',
        message: `[AI Execution Error] Gagal menerapkan kode: ${e.message}`,
        source: 'agent',
      });
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (id: string, codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Clear chat history
  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content: 'Riwayat percakapan telah dibersihkan. Siap menerima instruksi baru!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <motion.aside
      id="starvix-editor-copilot"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`absolute top-0 right-0 z-30 h-full flex flex-col bg-[#141416] border-l border-[#2A2A2E] shadow-2xl transition-all duration-200 ${
        isExpanded ? 'w-full md:w-[650px]' : 'w-full sm:w-[420px] md:w-[460px]'
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1B1B1F] border-b border-[#2A2A2E] select-none">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#38BDF8]/15 border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8]">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                AI Editor Copilot
              </h2>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]"></span>
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span>Siap Eksekusi Bahasa Sehari-hari</span>
              <span className="text-[#2A2A2E]">•</span>
              <span className="text-[#38BDF8]">
                {settings.selectedModel || 'gemini-2.5-flash'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Clear History Button */}
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-md hover:bg-[#222226] text-slate-400 hover:text-slate-200 text-xs transition"
            title="Bersihkan Percakapan"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Expand/Collapse Width */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden md:flex p-1.5 rounded-md hover:bg-[#222226] text-slate-400 hover:text-slate-200 text-xs transition"
            title={isExpanded ? 'Persempit Panel' : 'Perlebar Panel'}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close Copilot Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#222226] text-slate-400 hover:text-red-400 text-xs transition"
            title="Tutup AI Copilot"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Context Awareness & Execution Bar */}
      <div className="px-3 py-1.5 bg-[#0A0A0B] border-b border-[#2A2A2E] flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-[240px]">
          <FileCode className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          <span className="truncate">
            Target: <span className="text-white">{activeChunk ? activeChunk.name : 'Seluruh File Editor'}</span>
          </span>
          {activeChunk && (
            <span className="text-[10px] text-[#38BDF8] bg-[#1B1B1F] px-1 py-0.2 rounded border border-[#2A2A2E]">
              L{activeChunk.startLine}-{activeChunk.endLine}
            </span>
          )}
        </div>

        {/* Auto-Apply Toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none hover:text-white">
          <input
            type="checkbox"
            checked={autoApply}
            onChange={(e) => setAutoApply(e.target.checked)}
            className="w-3.5 h-3.5 rounded bg-[#141416] border-[#2A2A2E] text-[#38BDF8] focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <span className="text-[10px] uppercase font-bold text-slate-400">
            Auto-Terapkan
          </span>
        </label>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 bg-[#0A0A0B]/50">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const code = message.extractedCode;

          return (
            <div
              key={message.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
            >
              {/* Message Meta */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 px-1">
                {isUser ? (
                  <>
                    <span>Anda</span>
                    <span>•</span>
                    <span>{message.timestamp}</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-3 h-3 text-[#38BDF8]" />
                    <span className="text-[#38BDF8] font-bold">STARVIX AI</span>
                    <span>•</span>
                    <span>{message.timestamp}</span>
                    {message.modelUsed && (
                      <span className="text-slate-400">({message.modelUsed})</span>
                    )}
                  </>
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={`p-3 rounded-xl max-w-[92%] sm:max-w-[85%] text-xs leading-relaxed transition-all ${
                  isUser
                    ? 'bg-[#1B1B1F] text-slate-100 border border-[#38BDF8]/30 shadow-md'
                    : 'bg-[#141416] text-slate-200 border border-[#2A2A2E] shadow-lg'
                }`}
              >
                {/* Message Text Content */}
                <div className="whitespace-pre-wrap font-sans text-xs break-words">
                  {message.content.split('```')[0]}
                </div>

                {/* If code block was generated by AI */}
                {code && (
                  <div className="mt-3 rounded-lg bg-[#0A0A0B] border border-[#2A2A2E] overflow-hidden">
                    {/* Code Bar Header */}
                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#1B1B1F] border-b border-[#2A2A2E]">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-300">
                        <Code2 className="w-3 h-3 text-[#38BDF8]" />
                        <span>Kode Hasil Instruksi ({code.split('\n').length} baris)</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(message.id, code)}
                          className="px-2 py-1 bg-[#141416] hover:bg-[#222226] border border-[#2A2A2E] rounded text-[10px] font-mono text-slate-300 flex items-center gap-1 transition"
                          title="Salin Kode"
                        >
                          {copiedId === message.id ? (
                            <>
                              <Check className="w-3 h-3 text-[#22C55E]" />
                              <span className="text-[#22C55E]">Disalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>Salin</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveDiffId(activeDiffId === message.id ? null : message.id)
                          }
                          className="px-2 py-1 bg-[#141416] hover:bg-[#222226] border border-[#2A2A2E] rounded text-[10px] font-mono text-slate-300 flex items-center gap-1 transition"
                        >
                          {activeDiffId === message.id ? (
                            <ChevronUp className="w-3 h-3 text-[#38BDF8]" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-[#38BDF8]" />
                          )}
                          <span>Preview</span>
                        </button>
                      </div>
                    </div>

                    {/* Code Preview Drawer / Expand */}
                    <div
                      className={`p-2.5 text-[11px] font-mono text-slate-200 overflow-x-auto bg-[#0A0A0B] ${
                        activeDiffId === message.id ? 'max-h-80' : 'max-h-36'
                      } overflow-y-auto`}
                    >
                      <pre className="text-slate-300 font-mono leading-relaxed">
                        <code>{code}</code>
                      </pre>
                    </div>

                    {/* Direct Execution Action Buttons */}
                    <div className="p-2 bg-[#141416] border-t border-[#2A2A2E] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {message.codeApplied ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] text-[10px] font-mono font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>SUDAH DITERAPKAN KE EDITOR</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Siap langsung diterapkan
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onInsertAtCursor && (
                          <button
                            type="button"
                            onClick={() => onInsertAtCursor(code)}
                            className="px-2.5 py-1.5 bg-[#1B1B1F] hover:bg-[#222226] border border-[#2A2A2E] text-slate-200 rounded text-[11px] font-mono font-medium flex items-center gap-1 transition"
                            title="Sisipkan di posisi kursor aktif"
                          >
                            <Terminal className="w-3 h-3 text-slate-400" />
                            <span>Sisipkan di Kursor</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleApplyToEditor(message.id, code)}
                          className="px-3 py-1.5 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-black rounded text-[11px] font-mono font-bold flex items-center gap-1.5 shadow transition active:scale-95"
                        >
                          <Play className="w-3 h-3 fill-black text-black" />
                          <span>TERAPKAN KE EDITOR</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isGenerating && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-md bg-[#38BDF8]/20 border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8] shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="p-3 rounded-xl bg-[#141416] border border-[#2A2A2E] text-slate-300 text-xs font-mono flex items-center gap-2 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-[#38BDF8] animate-spin" />
              <span>Memproses instruksi & meracik kode...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Quick Chips in Everyday Language */}
      <div className="px-3 py-2 bg-[#1B1B1F] border-t border-[#2A2A2E] space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1">
            <Wand2 className="w-3 h-3 text-[#38BDF8]" />
            <span>Instruksi Bahasa Sehari-hari (Sekali Tap):</span>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {CONVERSATIONAL_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(preset.prompt)}
              disabled={isGenerating}
              className="px-2.5 py-1 rounded-md bg-[#141416] hover:bg-[#222226] border border-[#2A2A2E] text-slate-300 hover:text-[#38BDF8] text-[11px] font-mono whitespace-nowrap transition disabled:opacity-50 shrink-0"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="px-3 py-1.5 bg-[#F27D26]/10 border-t border-[#F27D26]/40 text-[#F27D26] text-[11px] font-mono flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Chat Input Bay */}
      <div className="p-3 bg-[#141416] border-t border-[#2A2A2E]">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Tulis instruksi dalam bahasa sehari-hari... (Contoh: 'Tolong tambahkan tombol dark mode di header' atau 'Perbaiki error pada state')"
            disabled={isGenerating}
            className="flex-1 p-2.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] resize-none disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isGenerating}
            className="px-3.5 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-black font-mono font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 transition shadow active:scale-95 shrink-0"
            title="Kirim Instruksi (Enter)"
          >
            <Send className="w-4 h-4 text-black" />
            <span className="text-[10px]">KIRIM</span>
          </button>
        </div>

        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 font-mono px-0.5">
          <span>Tekan Enter untuk kirim, Shift+Enter untuk baris baru</span>
          <span>Editor Context Ready</span>
        </div>
      </div>
    </motion.aside>
  );
};
