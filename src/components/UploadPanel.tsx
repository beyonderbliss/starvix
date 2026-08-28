import React, { useState, useRef } from 'react';
import {
  Upload,
  FileCode,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { DEFAULT_MONOLITHIC_APP, generate10kMonolithicCode } from '../utils/monolithicSample';

interface UploadPanelProps {
  onLoadCode: (code: string, filename?: string) => void;
  currentCode: string;
  onResetToSample: () => void;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({
  onLoadCode,
  currentCode,
  onResetToSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pastedCode, setPastedCode] = useState('');
  const [uploadedStats, setUploadedStats] = useState<{
    name: string;
    sizeKb: number;
    lines: number;
  } | null>(null);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const lines = text.split('\n').length;
        const sizeKb = Number((file.size / 1024).toFixed(1));
        setUploadedStats({ name: file.name, sizeKb, lines });
        onLoadCode(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([currentCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Starvix_Monolith.jsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLoad10kStress = () => {
    const code10k = generate10kMonolithicCode();
    onLoadCode(code10k, 'STARVIX_Ultra_Monolith_10k.jsx');
    const lines = code10k.split('\n').length;
    const sizeKb = Number((new Blob([code10k]).size / 1024).toFixed(1));
    setUploadedStats({
      name: 'STARVIX_Ultra_Monolith_10k.jsx',
      sizeKb,
      lines,
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0B] text-slate-100 overflow-y-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] shadow-lg space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] flex items-center justify-center text-[#38BDF8]">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Import & Upload Monolithic Code
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Load your 10,000+ line single-file codebase for AST-Lite chunking and Gist modularization
            </p>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 sm:p-8 rounded-xl border border-dashed cursor-pointer transition-all flex flex-col items-center justify-center text-center space-y-3 ${
          dragOver
            ? 'bg-[#1B1B1F] border-[#38BDF8]'
            : 'bg-[#141416] border-[#2A2A2E] hover:border-slate-500 hover:bg-[#1B1B1F]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".js,.jsx,.ts,.tsx,.txt"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-xl bg-[#1B1B1F] border border-[#2A2A2E] flex items-center justify-center text-[#38BDF8]">
          <FileUp className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <div className="text-xs font-bold text-white font-mono uppercase tracking-wider">
            Tap or Drop file to upload (.jsx, .js, .tsx, .ts)
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Supports massive single-file codebases up to 25MB without memory freezing
          </div>
        </div>

        {uploadedStats && (
          <div className="px-3 py-1.5 rounded-md bg-[#1B1B1F] border border-[#22C55E]/40 text-[#22C55E] text-xs font-mono flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>
              Loaded: {uploadedStats.name} ({uploadedStats.lines.toLocaleString()} LOC, {uploadedStats.sizeKb} KB)
            </span>
          </div>
        )}
      </div>

      {/* Pre-Engineered Codebase Presets */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#38BDF8]" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            Ready-Made Sandbox Codebases
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Default Mobile Monolith */}
          <div className="p-3 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-semibold text-white flex items-center justify-between font-mono">
                <span>Mobile System Core Monolith</span>
                <span className="text-[10px] font-mono text-[#38BDF8]">~450 LOC</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-mono">
                Full-featured mobile Android hardware sandbox with battery throttle, memory inspector,
                and reducer state management.
              </p>
            </div>
            <button
              type="button"
              onClick={onResetToSample}
              className="w-full mt-2 py-1.5 px-3 bg-[#141416] hover:bg-[#222226] text-[#38BDF8] border border-[#2A2A2E] rounded-md font-mono text-xs flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>LOAD MOBILE MONOLITH</span>
            </button>
          </div>

          {/* 10,000+ LOC Stress Monolith */}
          <div className="p-3 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] space-y-2 flex flex-col justify-between">
            <div>
              <div className="font-semibold text-white flex items-center justify-between font-mono">
                <span>10,000+ LOC Ultra-Monolith</span>
                <span className="text-[10px] font-mono text-[#F27D26] font-bold">10,000+ LOC</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed font-mono">
                Generates a massive 42-module enterprise mesh architecture to rigorously stress-test
                mobile AST-Lite chunking and LLM token optimization.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoad10kStress}
              className="w-full mt-2 py-1.5 px-3 bg-[#F27D26] hover:bg-[#F27D26]/90 text-black rounded-md font-semibold font-mono text-xs flex items-center justify-center gap-1.5 shadow transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-black" />
              <span>LOAD 10K+ LOC STRESS TEST</span>
            </button>
          </div>
        </div>
      </div>

      {/* Paste Raw Code Box */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] space-y-2.5">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
          Or Paste Raw Monolithic Source
        </h3>

        <textarea
          rows={4}
          value={pastedCode}
          onChange={(e) => setPastedCode(e.target.value)}
          placeholder="// Paste your raw React component or monolithic code here..."
          className="w-full p-2.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded-md text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] resize-y"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (pastedCode.trim()) {
                onLoadCode(pastedCode, 'Pasted_Monolith.jsx');
                setPastedCode('');
              }
            }}
            disabled={!pastedCode.trim()}
            className="px-3 py-1.5 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-black font-semibold font-mono text-xs rounded-md disabled:opacity-50 flex items-center gap-1 transition"
          >
            <span>IMPORT PASTED CODE</span>
            <ArrowRight className="w-3.5 h-3.5 text-black" />
          </button>
        </div>
      </div>

      {/* Export / Download Active Monolith */}
      <div className="p-3 rounded-xl bg-[#141416] border border-[#2A2A2E] flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-white font-mono uppercase tracking-wider">Export Active Workspace</div>
          <div className="text-[11px] text-slate-400 font-mono">Save current code to your device</div>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="px-3 py-1.5 bg-[#1B1B1F] hover:bg-[#222226] text-slate-200 border border-[#2A2A2E] rounded-md text-xs font-semibold font-mono flex items-center gap-1.5 transition"
        >
          <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>DOWNLOAD CODE</span>
        </button>
      </div>
    </div>
  );
};
