import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  Cpu,
  ArrowRight,
  RefreshCw,
  Wrench,
  Check,
  Eye,
  EyeOff,
  Sliders,
  ShieldCheck,
  Flame,
  Zap,
  Code
} from 'lucide-react';
import { AutoFixState, CodeChunk, SettingsState } from '../types';
import { calculateContextSavings } from '../utils/chunkingEngine';

interface AgentStudioProps {
  autoFixState: AutoFixState;
  activeChunk: CodeChunk | null;
  fullCode: string;
  settings: SettingsState;
  onUpdateSettings: (newSettings: Partial<SettingsState>) => void;
  onApplyFix: (fixedCode: string, targetChunk?: CodeChunk) => void;
  onTriggerSelfCorrection: () => Promise<void>;
  isGenerating: boolean;
}

export const AgentStudio: React.FC<AgentStudioProps> = ({
  autoFixState,
  activeChunk,
  fullCode,
  settings,
  onUpdateSettings,
  onApplyFix,
  onTriggerSelfCorrection,
  isGenerating,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [transformationOutput, setTransformationOutput] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformExplanation, setTransformExplanation] = useState<string | null>(null);

  // Calculate token optimization metrics
  const targetCode = autoFixState.targetChunk ? autoFixState.targetChunk.code : activeChunk ? activeChunk.code : fullCode.slice(0, 1500);
  const tokenStats = calculateContextSavings(fullCode, targetCode);

  const handleCustomTransform = async (promptText: string) => {
    if (!promptText.trim()) return;

    setIsTransforming(true);
    setTransformationOutput(null);
    setTransformExplanation(null);

    try {
      const payloadCode = activeChunk ? activeChunk.code : fullCode;
      const systemInstruction = `You are a Senior Full-Stack Systems Architect specializing in low-RAM Mobile Web IDEs and memory-constrained React sandboxes. Refactor or transform the provided code according to the prompt. Return ONLY valid, working code inside a single javascript/typescript codeblock, followed by a brief 2-sentence explanation.`;

      const prompt = `TARGET CODE CHUNK:\n\`\`\`javascript\n${payloadCode}\n\`\`\`\n\nTASK:\n${promptText}`;

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
          throw new Error(data.error || 'Server Gemini proxy call failed');
        }
        responseText = data.text || '';
      }

      // Parse codeblock
      const codeMatch = responseText.match(/```(?:javascript|jsx|typescript|tsx)?([\s\S]*?)```/);
      if (codeMatch && codeMatch[1]) {
        setTransformationOutput(codeMatch[1].trim());
        const cleanedExp = responseText.replace(codeMatch[0], '').trim();
        setTransformExplanation(cleanedExp || 'Optimized and transformed successfully.');
      } else {
        setTransformationOutput(responseText.trim());
      }
    } catch (err: unknown) {
      const e = err as Error;
      setTransformationOutput(`// Error: ${e.message}`);
    } finally {
      setIsTransforming(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0B] text-slate-100 overflow-y-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner: Gemini 2.5 Flash Engine Status */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] flex items-center justify-center text-[#38BDF8]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                Gemini 2.5 Flash Auto-Fix Engine
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Self-Correction Loop & Context Window Optimizer for Low-RAM Sandboxes
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded bg-[#1B1B1F] text-[#38BDF8] border border-[#2A2A2E] text-[10px] font-mono">
            {settings.selectedModel}
          </span>
        </div>

        {/* API Key Configuration input */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between font-mono">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#38BDF8]" />
              API Key (Storage Encrypted):
            </span>
            <span className="text-[10px] text-slate-400 uppercase">
              {settings.geminiApiKey
                ? 'Active User Key'
                : settings.serverGeminiAvailable
                ? 'Server Key Available'
                : 'Key Needed'}
            </span>
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy... (Leave empty to use server environment key)"
                value={settings.geminiApiKey}
                onChange={(e) => onUpdateSettings({ geminiApiKey: e.target.value.trim() })}
                className="w-full pl-3 pr-10 py-1.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded-md text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8]"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <select
              value={settings.selectedModel}
              onChange={(e) => onUpdateSettings({ selectedModel: e.target.value })}
              className="px-2.5 py-1.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded-md text-xs font-mono text-slate-200 focus:outline-none"
            >
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-3.7-flash">gemini-3.7-flash</option>
            </select>
          </div>
        </div>
      </div>

      {/* Context Window Optimizer Visualizer */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Context Window Optimizer (OOM Prevention)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/30 px-2 py-0.5 rounded">
            ACTIVE HARDWARE DEFENSE
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-mono">
          On memory-constrained Android sandboxes, sending massive 10,000+ LOC files causes mobile browser heap crashes.
          STARVIX isolates only the <strong className="text-slate-200">Active Chunk + Targeted Error Stack</strong>, reducing context payload by up to <strong className="text-[#22C55E]">99%</strong>.
        </p>

        {/* Savings Gauge */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="p-2 bg-[#1B1B1F] rounded-md border border-[#2A2A2E]">
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">Full 10K Monolith</div>
            <div className="text-xs font-mono font-bold text-[#F27D26] line-through">
              ~{tokenStats.fullTokens.toLocaleString()} tokens
            </div>
            <div className="text-[9px] font-mono text-slate-500">OOM Risk: High</div>
          </div>

          <div className="p-2 bg-[#1B1B1F] rounded-md border border-[#38BDF8]/40">
            <div className="text-[9px] font-mono uppercase text-slate-400 tracking-wider">Active Chunk Only</div>
            <div className="text-xs font-mono font-bold text-[#38BDF8]">
              ~{tokenStats.chunkTokens.toLocaleString()} tokens
            </div>
            <div className="text-[9px] font-mono text-[#38BDF8]">Low-RAM Safe</div>
          </div>

          <div className="p-2 bg-[#1B1B1F] rounded-md border border-[#22C55E]/40">
            <div className="text-[9px] font-mono uppercase text-[#22C55E] tracking-wider">Payload Reduction</div>
            <div className="text-xs font-mono font-bold text-[#22C55E]">
              -{tokenStats.percentSaved}%
            </div>
            <div className="text-[9px] font-mono text-[#22C55E]">~{tokenStats.savedTokens.toLocaleString()} saved</div>
          </div>
        </div>
      </div>

      {/* Self-Correction Loop (Auto-Fix Section) */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#F27D26]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Self-Correction Loop (Auto-Fix)
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-slate-400 font-mono flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoFixEnabled}
                onChange={(e) => onUpdateSettings({ autoFixEnabled: e.target.checked })}
                className="rounded border-[#2A2A2E] bg-[#0A0A0B] text-[#38BDF8] focus:ring-0"
              />
              Auto-Prompt on Error
            </label>
          </div>
        </div>

        {autoFixState.errorDetails ? (
          <div className="p-3 rounded-lg bg-[#1B1B1F] border border-[#F27D26]/40 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#F27D26] shrink-0 mt-0.5" />
              <div className="space-y-1 overflow-hidden">
                <div className="text-xs font-semibold text-slate-100 font-mono">
                  Targeted Error Stack Captured
                </div>
                <div className="font-mono text-[11px] text-[#F27D26] break-words">
                  {autoFixState.errorDetails.message}
                </div>
                {autoFixState.errorDetails.stack && (
                  <pre className="text-[10px] text-[#F27D26]/80 overflow-x-auto max-h-20 p-2 bg-[#0A0A0B] rounded border border-[#2A2A2E]">
                    {autoFixState.errorDetails.stack}
                  </pre>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onTriggerSelfCorrection}
                disabled={isGenerating}
                className="px-3.5 py-1.5 bg-[#F27D26] hover:bg-[#F27D26]/90 text-black font-semibold font-mono text-xs rounded-md shadow flex items-center gap-1.5 disabled:opacity-50 transition"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Gemini 2.5 Flash Self-Repairing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-black" />
                    <span>TRIGGER AUTO-FIX NOW</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] text-slate-400 text-xs flex items-center justify-between font-mono">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              <span>No active runtime errors intercepted. Evaluation pipeline stable.</span>
            </div>
            <button
              type="button"
              onClick={onTriggerSelfCorrection}
              disabled={isGenerating}
              className="px-2.5 py-1 bg-[#141416] hover:bg-[#222226] text-[#38BDF8] border border-[#2A2A2E] rounded-md font-mono text-[11px] flex items-center gap-1 transition"
            >
              <Sparkles className="w-3 h-3 text-[#38BDF8]" />
              <span>Audit Chunk</span>
            </button>
          </div>
        )}

        {/* Render Auto-Fix Solution if ready */}
        {autoFixState.fixedCode && (
          <div className="p-3 rounded-lg bg-[#1B1B1F] border border-[#22C55E]/40 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#22C55E] font-mono">
                <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
                <span>Self-Correction Solution Ready</span>
              </div>
              <button
                type="button"
                onClick={() => onApplyFix(autoFixState.fixedCode!, autoFixState.targetChunk)}
                className="px-3 py-1 bg-[#22C55E] hover:bg-[#22C55E]/90 text-black font-semibold font-mono text-xs rounded-md shadow flex items-center gap-1 transition"
              >
                <Check className="w-3.5 h-3.5 text-black" />
                <span>Apply Patch to Editor</span>
              </button>
            </div>

            {autoFixState.explanation && (
              <p className="text-xs text-slate-300 italic font-mono">
                "{autoFixState.explanation}"
              </p>
            )}

            <div className="max-h-40 overflow-auto p-2 bg-[#0A0A0B] rounded border border-[#2A2A2E] font-mono text-[11px] text-slate-200">
              <pre className="whitespace-pre-wrap">{autoFixState.fixedCode}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Code Transformation & Quick Assist Presets */}
      <div className="p-3.5 rounded-xl bg-[#141416] border border-[#2A2A2E] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#38BDF8]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Autonomous Code Transformation
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Target: {activeChunk ? activeChunk.name : 'Full Monolith'}
          </span>
        </div>

        {/* Transformation Presets */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              handleCustomTransform(
                'Optimize this component for low-RAM mobile execution: memoize heavy calculations with useMemo, wrap callbacks with useCallback, and add defense checks against null properties.'
              )
            }
            disabled={isTransforming}
            className="p-2.5 text-left rounded-lg bg-[#1B1B1F] hover:bg-[#222226] border border-[#2A2A2E] text-slate-200 transition flex flex-col gap-1"
          >
            <span className="font-semibold text-[#38BDF8] font-mono">Low-RAM Optimization</span>
            <span className="text-[10px] text-slate-400">Add memoization & memory guards</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleCustomTransform(
                'Convert this component into vanilla React.createElement syntax, removing all JSX tags so it can execute via new Function("React", code)(React) in an isolated sandbox.'
              )
            }
            disabled={isTransforming}
            className="p-2.5 text-left rounded-lg bg-[#1B1B1F] hover:bg-[#222226] border border-[#2A2A2E] text-slate-200 transition flex flex-col gap-1"
          >
            <span className="font-semibold text-purple-300 font-mono">Transpile to createElement</span>
            <span className="text-[10px] text-slate-400">Convert JSX to vanilla Gist format</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleCustomTransform(
                'Wrap this component in defensive null-checks, prop validations, and safe optional chaining to prevent unhandled ReferenceErrors.'
              )
            }
            disabled={isTransforming}
            className="p-2.5 text-left rounded-lg bg-[#1B1B1F] hover:bg-[#222226] border border-[#2A2A2E] text-slate-200 transition flex flex-col gap-1"
          >
            <span className="font-semibold text-[#F27D26] font-mono">Defensive Hardening</span>
            <span className="text-[10px] text-slate-400">Add null-checks & safe fallbacks</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleCustomTransform(
                'Extract the internal state logic and effects into a clean, reusable custom hook prefixed with use...'
              )
            }
            disabled={isTransforming}
            className="p-2.5 text-left rounded-lg bg-[#1B1B1F] hover:bg-[#222226] border border-[#2A2A2E] text-slate-200 transition flex flex-col gap-1"
          >
            <span className="font-semibold text-[#22C55E] font-mono">Extract Custom Hook</span>
            <span className="text-[10px] text-slate-400">Decouple state into useHook()</span>
          </button>
        </div>

        {/* Custom Prompt Input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Custom transformation instruction for Gemini 2.5 Flash..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomTransform(customPrompt);
            }}
            className="flex-1 px-3 py-1.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded-md text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8]"
          />
          <button
            type="button"
            onClick={() => handleCustomTransform(customPrompt)}
            disabled={isTransforming || !customPrompt.trim()}
            className="px-3 py-1.5 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-black font-semibold font-mono text-xs rounded-md disabled:opacity-50 flex items-center gap-1 transition"
          >
            {isTransforming ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" /> : <ArrowRight className="w-3.5 h-3.5 text-black" />}
            <span>RUN</span>
          </button>
        </div>

        {/* Custom Transform Result */}
        {transformationOutput && (
          <div className="p-3 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#38BDF8] font-mono">
                Transformation Output ({settings.selectedModel})
              </span>
              <button
                type="button"
                onClick={() => onApplyFix(transformationOutput, activeChunk || undefined)}
                className="px-2.5 py-1 bg-[#22C55E] hover:bg-[#22C55E]/90 text-black rounded-md text-xs font-semibold font-mono flex items-center gap-1 transition"
              >
                <Check className="w-3 h-3 text-black" />
                <span>Apply to Code</span>
              </button>
            </div>
            {transformExplanation && (
              <div className="text-[11px] text-slate-300 italic font-mono">{transformExplanation}</div>
            )}
            <div className="max-h-48 overflow-auto p-2 bg-[#0A0A0B] rounded border border-[#2A2A2E] font-mono text-[11px] text-slate-200">
              <pre className="whitespace-pre-wrap">{transformationOutput}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
