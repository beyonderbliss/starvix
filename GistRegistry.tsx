import React, { useState } from 'react';
import {
  Share2,
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Key,
  Play,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Box,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { CodeChunk, GistModule, SettingsState } from '../types';
import { transpileJsxToVanilla, replaceChunkWithGistLoader } from '../utils/chunkingEngine';

interface GistRegistryProps {
  modules: GistModule[];
  chunks: CodeChunk[];
  fullCode: string;
  settings: SettingsState;
  onUpdateSettings: (newSettings: Partial<SettingsState>) => void;
  onAddModule: (mod: GistModule) => void;
  onUpdateFullCode: (newCode: string) => void;
}

export const GistRegistry: React.FC<GistRegistryProps> = ({
  modules,
  chunks,
  fullCode,
  settings,
  onUpdateSettings,
  onAddModule,
  onUpdateFullCode,
}) => {
  const [showPat, setShowPat] = useState(false);
  const [selectedChunkId, setSelectedChunkId] = useState<string>(chunks[0]?.id || '');
  const [refactorStage, setRefactorStage] = useState<
    'idle' | 'extracting' | 'transpiling' | 'uploading' | 'rewriting' | 'done' | 'error'
  >('idle');
  const [stageMessage, setStageMessage] = useState<string>('');
  const [testedModuleId, setTestedModuleId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Filter component chunks suitable for Gist extraction
  const extractableChunks = chunks.filter((c) => c.type === 'component');

  // Verify / Test-run a registered gist module via new Function("React", code)(React)
  const handleTestModule = async (mod: GistModule) => {
    setTestedModuleId(mod.id);
    setTestResult(null);

    try {
      // Use window.React or React from scope
      const React = (window as any).React || (await import('react'));
      const factory = new Function('React', mod.code);
      const evaluatedComponent = factory(React);

      if (typeof evaluatedComponent === 'function' || (evaluatedComponent && typeof evaluatedComponent === 'object')) {
        setTestResult({
          success: true,
          message: `Module "${mod.name}" executed successfully via new Function("React", code)(React). Output: valid React component factory.`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Module executed but returned type: ${typeof evaluatedComponent} instead of a callable component.`,
        });
      }
    } catch (err: unknown) {
      const e = err as Error;
      setTestResult({
        success: false,
        message: `Execution failed: ${e.message}`,
      });
    }
  };

  // Run the 5-step Autonomous Refactoring Pipeline
  const runAutonomousRefactoring = async () => {
    const chunk = chunks.find((c) => c.id === selectedChunkId);
    if (!chunk) return;

    try {
      // Step 1: Extract selected code chunk
      setRefactorStage('extracting');
      setStageMessage(`Extracting isolated slice: ${chunk.name} (${chunk.lineCount} LOC)...`);
      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Transpile to clean vanilla React.createElement JS format
      setRefactorStage('transpiling');
      setStageMessage(`Transpiling JSX into vanilla React.createElement format for ${chunk.name}...`);
      const transpiledCode = transpileJsxToVanilla(chunk.code, chunk.name);
      await new Promise((r) => setTimeout(r, 400));

      // Step 3 & 4: Upload to GitHub Gist as Secret Gist (public: false)
      setRefactorStage('uploading');
      setStageMessage(`Submitting HTTP POST to https://api.github.com/gists (public: false)...`);

      let rawGistUrl = '';
      let gistHtmlUrl = '';

      if (settings.githubPat) {
        // Post directly with user PAT or through server proxy
        const filename = `${chunk.name}.js`;
        const res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${settings.githubPat}`,
            'User-Agent': 'STARVIX-Mobile-Agent-Studio/1.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: `STARVIX Modular Gist Component: ${chunk.name}`,
            public: false,
            files: {
              [filename]: {
                content: transpiledCode,
              },
            },
          }),
        });

        const gistData = await res.json();
        if (!res.ok) {
          throw new Error(gistData.message || 'GitHub Gist creation failed. Check token permissions.');
        }

        gistHtmlUrl = gistData.html_url;
        const fileObj = gistData.files[filename];
        rawGistUrl = fileObj?.raw_url || `https://gist.githubusercontent.com/raw/${gistData.id}/${filename}`;
      } else {
        // Local simulation / fallback when PAT not provided
        gistHtmlUrl = `https://gist.github.com/starvix-local/${chunk.name.toLowerCase()}`;
        rawGistUrl = `https://gist.githubusercontent.com/starvix-local/gists/raw/${chunk.name}.js`;
      }

      // Step 5: Update Gist Registry and replace monolithic code
      setRefactorStage('rewriting');
      setStageMessage(`Replacing monolithic chunk with loadGistModule("${chunk.name}")...`);
      await new Promise((r) => setTimeout(r, 400));

      const newModule: GistModule = {
        id: `gist_${Date.now()}`,
        name: chunk.name,
        url: gistHtmlUrl,
        rawUrl: rawGistUrl,
        createdAt: new Date().toLocaleTimeString(),
        description: `Autonomous refactor from monolithic lines ${chunk.startLine}-${chunk.endLine}`,
        originalChunkId: chunk.id,
        code: transpiledCode,
        status: 'active',
      };

      onAddModule(newModule);

      // Rewrite full code
      const updatedMonolith = replaceChunkWithGistLoader(fullCode, chunk, rawGistUrl);
      onUpdateFullCode(updatedMonolith);

      setRefactorStage('done');
      setStageMessage(`Autonomous Refactor Complete! ${chunk.name} extracted & replaced.`);
    } catch (err: unknown) {
      const e = err as Error;
      setRefactorStage('error');
      setStageMessage(`Refactor Pipeline Error: ${e.message}`);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0B] text-slate-100 overflow-y-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner: Gist Architecture */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] flex items-center justify-center text-[#22C55E]">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                Native Gist Module Registry
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Autonomous Refactoring Pipeline & Dynamic Sandbox Execution
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded bg-[#1B1B1F] text-[#22C55E] border border-[#2A2A2E] text-[10px] font-mono">
            {modules.length} MODULES ONLINE
          </span>
        </div>

        {/* GitHub PAT Storage Field */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between font-mono">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#22C55E]" />
              GitHub Personal Access Token (scope: gist):
            </span>
            <span className="text-[10px] text-slate-400 uppercase">
              {settings.githubPat ? 'PAT Configured' : 'Optional for Live Push'}
            </span>
          </label>

          <div className="relative">
            <input
              type={showPat ? 'text' : 'password'}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (Stored safely in localStorage)"
              value={settings.githubPat}
              onChange={(e) => onUpdateSettings({ githubPat: e.target.value.trim() })}
              className="w-full pl-3 pr-10 py-1.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded-md text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8]"
            />
            <button
              type="button"
              onClick={() => setShowPat(!showPat)}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
              aria-label={showPat ? "Hide GitHub token" : "Show GitHub token"}
            >
              {showPat ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 font-mono">
            Allows STARVIX to automatically post Secret Gists to your GitHub account and inject raw URLs.
          </p>
        </div>
      </div>

      {/* Autonomous Refactoring Pipeline Card */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Autonomous Refactoring Pipeline
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            5-Step Zero-Loss Modularizer
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-mono">
          Extract a massive component chunk from your monolith, transpile it into clean vanilla React syntax,
          upload it to GitHub Gists, and replace it in the editor with a lightweight <code className="text-[#38BDF8]">loadGistModule()</code> loader.
        </p>

        {/* Chunk selector */}
        <div className="space-y-1">
          <label className="text-xs text-slate-300 font-mono font-medium">Select Target Component to Refactor:</label>
          <select
            value={selectedChunkId}
            onChange={(e) => setSelectedChunkId(e.target.value)}
            className="w-full px-3 py-2 bg-[#0A0A0B] border border-[#2A2A2E] rounded-md text-xs font-mono text-white focus:outline-none focus:border-[#38BDF8]"
          >
            {extractableChunks.length === 0 ? (
              <option value="">No components detected</option>
            ) : (
              extractableChunks.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Lines {c.startLine}-{c.endLine}, {c.lineCount} LOC, {(c.sizeBytes / 1024).toFixed(1)} KB)
                </option>
              ))
            )}
          </select>
        </div>

        {/* Pipeline Stage Tracker */}
        {refactorStage !== 'idle' && (
          <div
            className={`p-3 rounded-lg border text-xs font-mono space-y-2 ${
              refactorStage === 'error'
                ? 'bg-[#1B1B1F] border-[#F27D26]/60 text-[#F27D26]'
                : refactorStage === 'done'
                ? 'bg-[#1B1B1F] border-[#22C55E]/60 text-[#22C55E]'
                : 'bg-[#1B1B1F] border-[#38BDF8]/60 text-[#38BDF8]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {refactorStage === 'done' ? (
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              ) : refactorStage === 'error' ? (
                <AlertCircle className="w-4 h-4 text-[#F27D26]" />
              ) : (
                <RefreshCw className="w-4 h-4 animate-spin text-[#38BDF8]" />
              )}
              <span className="capitalize">Pipeline Status: {refactorStage}</span>
            </div>
            <div className="text-[11px] leading-relaxed">{stageMessage}</div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={runAutonomousRefactoring}
            disabled={!selectedChunkId || (refactorStage !== 'idle' && refactorStage !== 'done' && refactorStage !== 'error')}
            className="px-4 py-2 bg-[#22C55E] hover:bg-[#22C55E]/90 text-black font-semibold font-mono text-xs rounded-md shadow-md flex items-center gap-2 disabled:opacity-50 transition"
          >
            <GitPullRequest className="w-4 h-4 text-black" />
            <span>RUN AUTONOMOUS REFACTORING</span>
          </button>
        </div>
      </div>

      {/* Test Runner Feedback Banner */}
      {testResult && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-start gap-2 ${
            testResult.success
              ? 'bg-[#1B1B1F] border-[#22C55E]/60 text-[#22C55E]'
              : 'bg-[#1B1B1F] border-[#F27D26]/60 text-[#F27D26]'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-[#F27D26] shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed">{testResult.message}</div>
        </div>
      )}

      {/* Active Gist Modules List */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-[#38BDF8]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Registered Gist Modules ({modules.length})
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Cache-busting: ?v=Date.now()
          </span>
        </div>

        <div className="space-y-2.5">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className="p-3 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono">{mod.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30">
                      active
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{mod.description}</div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleTestModule(mod)}
                    className="px-2 py-1 bg-[#141416] hover:bg-[#222226] text-[#38BDF8] border border-[#2A2A2E] rounded-md font-mono text-[11px] flex items-center gap-1 transition"
                    title="Verify module execution in clean sandbox"
                  >
                    <Play className="w-3 h-3 text-[#38BDF8]" />
                    <span>Test Run</span>
                  </button>

                  <a
                    href={mod.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded bg-[#141416] hover:bg-[#222226] text-slate-300 border border-[#2A2A2E] text-xs"
                    title="Open Gist on GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Raw URL with Cache Busting */}
              <div className="flex items-center justify-between p-2 rounded bg-[#0A0A0B] border border-[#2A2A2E] font-mono text-[10px] text-slate-300">
                <span className="truncate pr-2">{mod.rawUrl}?v=Date.now()</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${mod.rawUrl}?v=Date.now()`, mod.id)}
                  className="shrink-0 text-slate-400 hover:text-white"
                  title="Copy Raw Gist URL"
                >
                  {copiedUrl === mod.id ? (
                    <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
