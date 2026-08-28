import React, { useState, useMemo } from 'react';
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  Search,
  AlertCircle,
  AlertTriangle,
  Info,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { LogEntry, LogLevel } from '../types';
import { getStorageUsage } from '../utils/storage';

interface TelemetryDrawerProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  autoSaveTime: string | null;
  onManualSave: () => void;
}

export const TelemetryDrawer: React.FC<TelemetryDrawerProps> = ({
  logs,
  onClearLogs,
  autoSaveTime,
  onManualSave,
}) => {
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [storageUsage, setStorageUsage] = useState(getStorageUsage());

  const refreshStorage = () => {
    setStorageUsage(getStorageUsage());
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchLevel = filterLevel === 'all' || log.level === filterLevel;
      const matchSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase());
      return matchLevel && matchSearch;
    });
  }, [logs, filterLevel, searchQuery]);

  const handleCopyLogs = () => {
    const formatted = logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0B] text-slate-100 overflow-hidden font-mono">
      {/* Header with Telemetry Controls */}
      <div className="p-3 bg-[#141416] border-b border-[#2A2A2E] space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#38BDF8]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Console & Telemetry Interceptor
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLogs}
              className="p-1.5 rounded-md bg-[#1B1B1F] hover:bg-[#222226] border border-[#2A2A2E] text-slate-300 text-xs flex items-center gap-1 transition"
              title="Copy All Logs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span className="text-[11px] hidden sm:inline font-mono">COPY LOGS</span>
            </button>

            <button
              type="button"
              onClick={onClearLogs}
              className="p-1.5 rounded-md bg-[#1B1B1F] hover:bg-[#F27D26]/20 border border-[#2A2A2E] text-slate-400 hover:text-[#F27D26] text-xs flex items-center gap-1 transition"
              title="Clear Logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline font-mono">CLEAR</span>
            </button>
          </div>
        </div>

        {/* Local Storage Quota Guard */}
        <div className="p-2.5 rounded-lg bg-[#1B1B1F] border border-[#2A2A2E] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <HardDrive className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span className="text-slate-300 text-[11px]">Storage Safety Net:</span>
            <span className="text-slate-400 text-[11px]">
              {storageUsage.usedKb} KB / {storageUsage.quotaKb} KB ({storageUsage.percentUsed}%)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-16 sm:w-24 bg-[#0A0A0B] border border-[#2A2A2E] h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  storageUsage.percentUsed > 80
                    ? 'bg-[#F27D26]'
                    : storageUsage.percentUsed > 50
                    ? 'bg-amber-500'
                    : 'bg-[#22C55E]'
                }`}
                style={{ width: `${Math.min(100, storageUsage.percentUsed)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={refreshStorage}
              className="text-slate-400 hover:text-white p-0.5"
              title="Refresh Storage Usage"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Filter bar & Search */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter console & runtime logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded-md text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8]"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto no-scrollbar shrink-0">
            {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider transition ${
                  filterLevel === lvl
                    ? 'bg-[#38BDF8] text-black font-bold'
                    : 'bg-[#1B1B1F] text-slate-400 hover:text-slate-200 border border-[#2A2A2E]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log Output List */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            No telemetry records in buffer.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-2 rounded-md border leading-relaxed flex items-start gap-2 ${
                log.level === 'error'
                  ? 'bg-[#1B1B1F] border-[#F27D26]/40 text-[#F27D26]'
                  : log.level === 'warn'
                  ? 'bg-[#1B1B1F] border-amber-500/40 text-amber-200'
                  : 'bg-[#141416] border-[#2A2A2E] text-slate-300'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {log.level === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-[#F27D26]" />
                ) : log.level === 'warn' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-[#38BDF8]" />
                )}
              </div>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <span>{log.timestamp}</span>
                  <span>&bull;</span>
                  <span className="uppercase text-slate-400">{log.source}</span>
                </div>
                <div className="break-words mt-0.5">{log.message}</div>
                {log.data !== undefined && (
                  <pre className="text-[10px] opacity-75 mt-1 p-1.5 bg-[#0A0A0B] border border-[#2A2A2E] rounded overflow-x-auto">
                    {typeof log.data === 'object'
                      ? JSON.stringify(log.data, null, 2)
                      : String(log.data)}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Status Bar with Auto-Save Safety Net */}
      <div className="p-2 bg-[#141416] border-t border-[#2A2A2E] text-[11px] font-mono text-slate-400 flex items-center justify-between shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse"></span>
          Auto-Save Draft: {autoSaveTime ? `Saved at ${autoSaveTime}` : 'Active'}
        </span>

        <button
          type="button"
          onClick={onManualSave}
          className="px-2.5 py-0.5 bg-[#1B1B1F] hover:bg-[#222226] border border-[#2A2A2E] text-slate-200 rounded-md text-[10px] font-mono transition"
        >
          SAVE SNAPSHOT
        </button>
      </div>
    </div>
  );
};
