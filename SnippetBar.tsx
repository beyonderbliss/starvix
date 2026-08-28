import React from 'react';
import { Sparkles, CornerDownLeft, Undo2, Redo2, Bot } from 'lucide-react';

interface SnippetBarProps {
  onInsert: (snippet: string, cursorOffset?: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onFormat?: () => void;
  onToggleCopilot?: () => void;
  isCopilotOpen?: boolean;
}

interface SnippetItem {
  label: string;
  code: string;
  offset?: number;
  highlight?: boolean;
}

const SNIPPETS: SnippetItem[] = [
  { label: '{ }', code: '{\n  \n}', offset: 2, highlight: true },
  { label: '=>', code: '=> ' },
  { label: '( )', code: '()', offset: 1 },
  { label: '[ ]', code: '[]', offset: 1 },
  { label: '< >', code: '<>\n  \n</>', offset: 3, highlight: true },
  { label: '" "', code: '""', offset: 1 },
  { label: "' '", code: "''", offset: 1 },
  { label: '` `', code: '``', offset: 1 },
  { label: ';', code: ';' },
  { label: '=', code: ' = ' },
  { label: 'const', code: 'const ' },
  { label: 'return', code: 'return ' },
  { label: 'useState', code: 'const [state, setState] = useState();', offset: 34 },
  { label: 'useEffect', code: 'useEffect(() => {\n  \n}, []);', offset: 18 },
  { label: 'createElement', code: 'React.createElement("", null, )', offset: 22 },
  { label: 'console.log', code: 'console.log();', offset: 12 },
];

export const SnippetBar: React.FC<SnippetBarProps> = ({
  onInsert,
  onUndo,
  onRedo,
  onFormat,
  onToggleCopilot,
  isCopilotOpen,
}) => {
  return (
    <div className="w-full bg-[#141416] border-y border-[#2A2A2E] px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x select-none shrink-0">
      {/* AI Chat Copilot Toggle Button */}
      {onToggleCopilot && (
        <button
          type="button"
          onClick={onToggleCopilot}
          className={`h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs font-mono shrink-0 transition font-bold shadow-sm ${
            isCopilotOpen
              ? 'bg-[#38BDF8] text-black border border-[#38BDF8]'
              : 'bg-[#38BDF8]/15 hover:bg-[#38BDF8]/25 text-[#38BDF8] border border-[#38BDF8]/50'
          }`}
          title="Buka AI Chat Copilot (Bahasa Sehari-hari)"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="text-[11px] tracking-wider">AI CHAT</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
        </button>
      )}

      {onToggleCopilot && <div className="h-4 w-px bg-[#2A2A2E] shrink-0 mx-0.5" />}

      {/* Quick Action Undo/Redo - Specialist Calibration Buttons */}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="h-7 px-2 flex items-center justify-center rounded-md bg-[#1B1B1F] hover:bg-[#222226] active:bg-[#2A2A2E] text-slate-300 border border-[#2A2A2E] text-xs shrink-0 transition"
          title="Undo (Ctrl+Z)"
          aria-label="Undo code edit"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
      )}

      {onRedo && (
        <button
          type="button"
          onClick={onRedo}
          className="h-7 px-2 flex items-center justify-center rounded-md bg-[#1B1B1F] hover:bg-[#222226] active:bg-[#2A2A2E] text-slate-300 border border-[#2A2A2E] text-xs shrink-0 transition"
          title="Redo (Ctrl+Y)"
          aria-label="Redo code edit"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      )}

      {onFormat && (
        <button
          type="button"
          onClick={onFormat}
          className="h-7 px-2.5 flex items-center gap-1.5 rounded-md bg-[#1B1B1F] hover:bg-[#222226] active:bg-[#2A2A2E] text-[#38BDF8] border border-[#2A2A2E] text-xs font-mono shrink-0 transition"
          title="Format Code"
        >
          <Sparkles className="w-3 h-3 text-[#38BDF8]" />
          <span className="text-[11px] uppercase tracking-wider">Format</span>
        </button>
      )}

      <div className="h-4 w-px bg-[#2A2A2E] shrink-0 mx-0.5" />

      {/* Snippet Buttons */}
      {SNIPPETS.map((s, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onInsert(s.code, s.offset)}
          className={`h-7 px-2.5 rounded-md font-mono text-xs shrink-0 active:scale-95 transition-all flex items-center justify-center ${
            s.highlight
              ? 'bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 shadow-sm'
              : 'bg-[#1B1B1F] hover:bg-[#222226] active:bg-[#2A2A2E] text-slate-200 border border-[#2A2A2E]'
          }`}
        >
          {s.label}
        </button>
      ))}

      {/* Enter/Newline helper */}
      <button
        type="button"
        onClick={() => onInsert('\n')}
        className="h-7 px-2.5 rounded-md bg-[#1B1B1F] hover:bg-[#222226] text-slate-300 border border-[#2A2A2E] text-xs font-mono shrink-0 flex items-center gap-1 active:scale-95 transition"
        title="Insert Newline"
      >
        <CornerDownLeft className="w-3 h-3 text-slate-400" />
        <span className="text-[11px]">LF</span>
      </button>
    </div>
  );
};
