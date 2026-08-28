import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  ArrowUpRight,
  Sparkles,
  GitPullRequest,
  Code2,
  Box,
  Zap,
  Filter,
  Check,
  Copy,
  FileCode,
  Share2
} from 'lucide-react';
import { CodeChunk, ChunkType } from '../types';
import { transpileJsxToVanilla, calculateContextSavings } from '../utils/chunkingEngine';

interface ChunkingInspectorProps {
  chunks: CodeChunk[];
  fullCode: string;
  onJumpToLine: (line: number) => void;
  onSelectChunkForAgent: (chunk: CodeChunk) => void;
  onStartGistRefactor: (chunk: CodeChunk) => void;
}

export const ChunkingInspector: React.FC<ChunkingInspectorProps> = ({
  chunks,
  fullCode,
  onJumpToLine,
  onSelectChunkForAgent,
  onStartGistRefactor,
}) => {
  const [filterType, setFilterType] = useState<ChunkType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChunkForPreview, setSelectedChunkForPreview] = useState<CodeChunk | null>(null);
  const [copiedTranspiled, setCopiedTranspiled] = useState(false);

  // Compute metrics
  const totalLoc = useMemo(() => fullCode.split('\n').length, [fullCode]);
  const totalBytes = useMemo(() => new Blob([fullCode]).size, [fullCode]);
  const fullTokens = useMemo(() => Math.ceil(fullCode.length / 3.8), [fullCode]);

  // Filter chunks
  const filteredChunks = useMemo(() => {
    return chunks.filter((c) => {
      const matchesType = filterType === 'all' || c.type === filterType;
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [chunks, filterType, searchQuery]);

  // Counts by type
  const counts = useMemo(() => {
    const res = { all: chunks.length, component: 0, hook: 0, util: 0, reducer: 0, other: 0 };
    for (const c of chunks) {
      if (res[c.type] !== undefined) {
        res[c.type]++;
      }
    }
    return res;
  }, [chunks]);

  const handleCopyTranspiled = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTranspiled(true);
    setTimeout(() => setCopiedTranspiled(false), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0B] text-slate-100 overflow-hidden">
      {/* Header Metrics - Hardware Telemetry & Analysis Bar */}
      <div className="p-3 bg-[#141416] border-b border-[#2A2A2E] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#38BDF8]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              AST-Lite Chunking Inspector
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 border border-[#38BDF8]/30 px-2 py-0.5 rounded">
            {chunks.length} MODULES ISOLATED
          </span>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="p-1.5 rounded-md bg-[#1B1B1F] border border-[#2A2A2E]">
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">Total LOC</div>
            <div className="text-xs font-mono font-bold text-white">{totalLoc.toLocaleString()}</div>
          </div>
          <div className="p-1.5 rounded-md bg-[#1B1B1F] border border-[#2A2A2E]">
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">Payload Size</div>
            <div className="text-xs font-mono font-bold text-[#38BDF8]">
              {(totalBytes / 1024).toFixed(1)} KB
            </div>
          </div>
          <div className="p-1.5 rounded-md bg-[#1B1B1F] border border-[#2A2A2E]">
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">Full Tokens</div>
            <div className="text-xs font-mono font-bold text-[#F27D26]">
              {fullTokens.toLocaleString()}
            </div>
          </div>
          <div className="p-1.5 rounded-md bg-[#1B1B1F] border border-[#2A2A2E]">
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">Avg / Chunk</div>
            <div className="text-xs font-mono font-bold text-[#22C55E]">
              {chunks.length > 0 ? Math.round(fullTokens / chunks.length) : 0}
            </div>
          </div>
        </div>

        {/* Filter bar & Search */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter components, hooks, utilities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          {/* Type pills */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar shrink-0">
            {(
              [
                { id: 'all', label: 'All', count: counts.all },
                { id: 'component', label: 'Components', count: counts.component },
                { id: 'hook', label: 'Hooks', count: counts.hook },
                { id: 'util', label: 'Utils', count: counts.util },
                { id: 'reducer', label: 'Reducers', count: counts.reducer },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition border ${
                  filterType === tab.id
                    ? 'bg-[#38BDF8] text-[#0A0A0B] border-[#38BDF8] font-bold shadow-sm'
                    : 'bg-[#1B1B1F] text-slate-400 hover:text-slate-200 border-[#2A2A2E]'
                }`}
              >
                {tab.label} <span className="text-[10px] opacity-75 font-mono">({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chunk List */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-2 bg-[#0A0A0B]">
        {filteredChunks.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            No chunks match the current filter criteria.
          </div>
        ) : (
          filteredChunks.map((chunk) => {
            const savings = calculateContextSavings(fullCode, chunk.code);

            return (
              <div
                key={chunk.id}
                className="p-3 rounded-lg bg-[#141416] border border-[#2A2A2E] hover:border-[#38BDF8]/50 transition space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                          chunk.type === 'component'
                            ? 'bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/30'
                            : chunk.type === 'hook'
                            ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                            : chunk.type === 'reducer'
                            ? 'bg-[#F27D26]/10 text-[#F27D26] border border-[#F27D26]/30'
                            : 'bg-[#1B1B1F] text-slate-300 border border-[#2A2A2E]'
                        }`}
                      >
                        {chunk.type}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">{chunk.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                      <span>
                        Lines {chunk.startLine} - {chunk.endLine} ({chunk.lineCount} LOC)
                      </span>
                      <span>&bull;</span>
                      <span>{(chunk.sizeBytes / 1024).toFixed(1)} KB</span>
                      <span>&bull;</span>
                      <span className="text-[#22C55E]">~{chunk.tokenEstimate} tokens</span>
                    </div>
                  </div>

                  {/* Token savings pill */}
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-[#22C55E] font-mono font-semibold">
                      -{savings.percentSaved}%
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">LLM tokens saved</div>
                  </div>
                </div>

                {/* Scoped dependencies */}
                {chunk.dependencies.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-500 font-mono">Scoped deps:</span>
                    {chunk.dependencies.map((dep, dIdx) => (
                      <span
                        key={dIdx}
                        className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0A0A0B] text-slate-300 border border-[#2A2A2E]"
                      >
                        {dep}
                      </span>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#2A2A2E] text-xs">
                  <button
                    type="button"
                    onClick={() => onJumpToLine(chunk.startLine)}
                    className="px-2 py-1 bg-[#1B1B1F] hover:bg-[#222226] text-slate-300 border border-[#2A2A2E] rounded-md font-mono text-[11px] flex items-center gap-1 transition"
                    title="Focus chunk in Monaco Editor"
                  >
                    <ArrowUpRight className="w-3 h-3 text-[#38BDF8]" />
                    <span>Jump L{chunk.startLine}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedChunkForPreview(chunk)}
                    className="px-2 py-1 bg-[#1B1B1F] hover:bg-[#222226] text-purple-300 border border-[#2A2A2E] rounded-md font-mono text-[11px] flex items-center gap-1 transition"
                    title="Preview AST-Lite Transpiled Vanilla React.createElement format"
                  >
                    <Code2 className="w-3 h-3 text-purple-400" />
                    <span>Transpile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectChunkForAgent(chunk)}
                    className="px-2 py-1 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 rounded-md font-mono text-[11px] flex items-center gap-1 transition"
                    title="Send active chunk to Gemini 2.5 Flash without full 10k file"
                  >
                    <Sparkles className="w-3 h-3 text-[#38BDF8]" />
                    <span>Gemini Agent</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onStartGistRefactor(chunk)}
                    className="px-2 py-1 bg-[#22C55E]/10 hover:bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40 rounded-md font-mono text-[11px] flex items-center gap-1 transition"
                    title="Refactor chunk to Secret GitHub Gist"
                  >
                    <GitPullRequest className="w-3 h-3 text-[#22C55E]" />
                    <span>Gist Refactor</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* AST-Lite Transpile Modal / Drawer */}
      {selectedChunkForPreview && (
        <div className="fixed inset-0 z-50 bg-[#0A0A0B]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] bg-[#141416] border border-[#2A2A2E] rounded-xl flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-[#2A2A2E] flex items-center justify-between bg-[#1B1B1F]">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#38BDF8]" />
                <div>
                  <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                    Gist Transpiler: {selectedChunkForPreview.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Transpiles JSX to Vanilla React.createElement format for Secret GitHub Gists
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChunkForPreview(null)}
                className="p-1 rounded bg-[#141416] border border-[#2A2A2E] text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {/* Code Body */}
            <div className="flex-1 overflow-auto p-3 bg-[#0A0A0B] font-mono text-xs text-slate-200">
              {(() => {
                const transpiled = transpileJsxToVanilla(
                  selectedChunkForPreview.code,
                  selectedChunkForPreview.name
                );
                return (
                  <pre className="whitespace-pre-wrap leading-relaxed">
                    {transpiled}
                  </pre>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#2A2A2E] bg-[#141416] flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                Sandboxed format: new Function("React", code)(React)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const transpiled = transpileJsxToVanilla(
                      selectedChunkForPreview.code,
                      selectedChunkForPreview.name
                    );
                    handleCopyTranspiled(transpiled);
                  }}
                  className="px-3 py-1.5 bg-[#1B1B1F] hover:bg-[#222226] text-slate-200 border border-[#2A2A2E] rounded-md text-xs font-medium flex items-center gap-1.5 transition font-mono"
                >
                  {copiedTranspiled ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Transpiled Code</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const chunk = selectedChunkForPreview;
                    setSelectedChunkForPreview(null);
                    onStartGistRefactor(chunk);
                  }}
                  className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#22C55E]/90 text-black font-semibold rounded-md text-xs flex items-center gap-1.5 transition font-mono"
                >
                  <Share2 className="w-3.5 h-3.5 text-black" />
                  <span>Push to Secret Gist</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
