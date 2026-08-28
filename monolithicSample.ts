/**
 * Sample Monolithic React Application
 * Designed specifically for Mobile Android IDE testing, chunking, and Gist refactoring.
 */
export const DEFAULT_MONOLITHIC_APP = `import React, { useState, useEffect, useReducer, useCallback } from 'react';

// --- UTILITY FUNCTIONS ---
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function calculateThrottleRatio(activeTasks, memoryLoadPercent) {
  const base = 1.0;
  if (memoryLoadPercent > 80) return (base * 0.4).toFixed(2);
  if (memoryLoadPercent > 60) return (base * 0.7).toFixed(2);
  if (activeTasks > 5) return (base * 0.85).toFixed(2);
  return base.toFixed(2);
}

function getBatteryHealthLabel(level) {
  if (level > 0.75) return 'Optimal (Green)';
  if (level > 0.35) return 'Moderate (Amber)';
  return 'Low Power (Red Alert)';
}

// --- STATE REDUCER ---
const initialSystemState = {
  activeTasks: 4,
  lowRamMode: true,
  turboMode: false,
  activeTab: 'overview',
  alertMessage: null
};

function systemReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_LOW_RAM':
      return { ...state, lowRamMode: !state.lowRamMode };
    case 'TOGGLE_TURBO':
      return { ...state, turboMode: !state.turboMode, activeTasks: !state.turboMode ? 8 : 4 };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'KILL_TASK':
      return { ...state, activeTasks: Math.max(0, state.activeTasks - 1), alertMessage: 'Process killed successfully' };
    case 'DISMISS_ALERT':
      return { ...state, alertMessage: null };
    default:
      return state;
  }
}

// --- CUSTOM HOOKS ---
function useMobileSensors() {
  const [sensors, setSensors] = useState({
    batteryLevel: 0.82,
    isCharging: false,
    estimatedRamMb: 384,
    freeRamMb: 128,
    fps: 58,
    online: true
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setSensors(prev => ({
        ...prev,
        fps: Math.floor(54 + Math.random() * 6),
        estimatedRamMb: Math.floor(370 + Math.random() * 30),
        freeRamMb: Math.floor(115 + Math.random() * 25)
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return sensors;
}

// --- SUB-COMPONENTS (CANDIDATES FOR GIST REFACTORING) ---
function StatCard({ title, value, subtitle, icon, highlight }) {
  return (
    <div className={"p-3.5 rounded-xl border transition-all " + (highlight ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-200" : "bg-slate-900/60 border-slate-800 text-slate-300")}>
      <div className="flex items-center justify-between text-xs opacity-75 mb-1">
        <span>{title}</span>
        <span>{icon}</span>
      </div>
      <div className="text-xl font-bold tracking-tight text-white">{value}</div>
      {subtitle && <div className="text-[11px] mt-1 text-slate-400">{subtitle}</div>}
    </div>
  );
}

function BatteryOptimizer({ batteryLevel, lowRamMode, onToggle }) {
  const percent = Math.round(batteryLevel * 100);
  return (
    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-sm font-semibold text-white">Battery Throttle Guard</div>
          <div className="text-xs text-slate-400">Mobile CPU Thermal Management</div>
        </div>
        <span className="text-sm font-mono font-bold text-emerald-400">{percent}%</span>
      </div>
      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
        <div 
          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
          style={{ width: percent + "%" }}
        />
      </div>
      <div className="flex justify-between items-center pt-1 text-xs">
        <span className="text-slate-400">Low RAM Background Throttling:</span>
        <button
          onClick={onToggle}
          className={"px-3 py-1 rounded-md font-medium text-xs transition " + (lowRamMode ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400")}
        >
          {lowRamMode ? "Active" : "Disabled"}
        </button>
      </div>
    </div>
  );
}

function MemoryInspector({ usedMb, freeMb, totalMb = 512, onClean }) {
  const usedRatio = Math.round((usedMb / totalMb) * 100);
  return (
    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-white">JVM Sandbox RAM Usage</span>
        <span className="text-xs font-mono text-cyan-400">{usedMb}MB / {totalMb}MB ({usedRatio}%)</span>
      </div>
      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
        <div 
          className={"h-full rounded-full transition-all duration-500 " + (usedRatio > 80 ? "bg-rose-500" : usedRatio > 65 ? "bg-amber-500" : "bg-cyan-500")}
          style={{ width: usedRatio + "%" }}
        />
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-slate-400">Free Heap: <strong className="text-slate-200">{freeMb} MB</strong></span>
        <button
          onClick={onClean}
          className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/40 rounded text-xs transition"
        >
          Flush Garbage Collector
        </button>
      </div>
    </div>
  );
}

function ProcessKillSwitch({ taskCount, onKill, turboMode, onToggleTurbo }) {
  return (
    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-white">Active Worker Threads</span>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">{taskCount} tasks</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          onClick={onKill}
          disabled={taskCount === 0}
          className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 rounded font-medium disabled:opacity-40 transition"
        >
          Terminate Idle Process
        </button>
        <button
          onClick={onToggleTurbo}
          className={"w-full py-2 border rounded font-medium transition " + (turboMode ? "bg-amber-600 text-white border-amber-500" : "bg-slate-800 text-slate-300 border-slate-700")}
        >
          {turboMode ? "Turbo Mode ON" : "Normal Clock"}
        </button>
      </div>
    </div>
  );
}

// --- ROOT APPLICATION COMPONENT ---
export default function App() {
  const [state, dispatch] = useReducer(systemReducer, initialSystemState);
  const sensors = useMobileSensors();

  const handleCleanMemory = useCallback(() => {
    dispatch({ type: 'DISMISS_ALERT' });
    alert('GC triggered: Freed ~32MB sandbox memory.');
  }, []);

  const throttle = calculateThrottleRatio(state.activeTasks, Math.round((sensors.estimatedRamMb / 512) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-sans max-w-md mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            STARVIX System Core
          </h1>
          <p className="text-xs text-slate-400">Mobile Node runtime on Android Sandbox</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold text-cyan-400">{sensors.fps} FPS</span>
          <div className="text-[10px] text-slate-500">60Hz Native</div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard
          title="Memory Pressure"
          value={sensors.estimatedRamMb + " MB"}
          subtitle="Limit: 512 MB"
          icon="⚡"
          highlight={sensors.estimatedRamMb > 400}
        />
        <StatCard
          title="CPU Throttle"
          value={throttle + "x"}
          subtitle={state.turboMode ? "High Perf" : "Battery Saver"}
          icon="🔋"
          highlight={state.turboMode}
        />
      </div>

      {/* Interactive Sub-Modules */}
      <BatteryOptimizer
        batteryLevel={sensors.batteryLevel}
        lowRamMode={state.lowRamMode}
        onToggle={() => dispatch({ type: 'TOGGLE_LOW_RAM' })}
      />

      <MemoryInspector
        usedMb={sensors.estimatedRamMb}
        freeMb={sensors.freeRamMb}
        onClean={handleCleanMemory}
      />

      <ProcessKillSwitch
        taskCount={state.activeTasks}
        onKill={() => dispatch({ type: 'KILL_TASK' })}
        turboMode={state.turboMode}
        onToggleTurbo={() => dispatch({ type: 'TOGGLE_TURBO' })}
      />

      {/* Footer Status */}
      <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">
        Status: <span className="text-emerald-400 font-semibold">Active Sandbox</span> &bull; {getBatteryHealthLabel(sensors.batteryLevel)}
      </div>
    </div>
  );
}
`;

/**
 * Generates a real 10,000+ line monolithic React application
 * to stress-test the Chunking Inspector under actual 10k+ LOC mobile conditions.
 */
export function generate10kMonolithicCode(): string {
  const parts: string[] = [];

  parts.push(`/**
 * STARVIX ULTRA-MONOLITH (10,000+ LINES STRESS CODEBASE)
 * Generated for Mobile AST-Lite Chunking Engine and Gist Modularization
 */
import React, { useState, useEffect, useReducer, useCallback, useMemo, useRef } from 'react';

// --- TOP-LEVEL COMMON UTILITIES ---
function coreMathClamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function coreGuid() {
  return 'x-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}
`);

  // Generate 40 distinct functional modules with detailed components, hooks, and reducers
  for (let m = 1; m <= 42; m++) {
    parts.push(`
// =========================================================================
// MODULE ${m}: EnterpriseServiceLayer_${m}
// =========================================================================

function useTelemetryStream_${m}(intervalMs = 1200) {
  const [data_${m}, setData_${m}] = useState({
    seq: 0,
    voltage: ${(3.2 + (m % 5) * 0.1).toFixed(2)},
    status: 'ACTIVE_NODE_${m}'
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setData_${m}(prev => ({
        seq: prev.seq + 1,
        voltage: Number((3.2 + Math.random() * 0.4).toFixed(2)),
        status: prev.seq % 2 === 0 ? 'SYNCED' : 'BUFFERING'
      }));
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return data_${m};
}

function transformMetrics_${m}(rawMetric, scaleFactor = 1.0) {
  if (!rawMetric) return 0;
  const clamped = Math.max(0, Math.min(rawMetric * scaleFactor, 10000));
  return Math.round(clamped * 100) / 100;
}

function enterpriseReducer_${m}(state, action) {
  switch (action.type) {
    case 'UPDATE_${m}':
      return { ...state, count: state.count + 1, lastUpdated: Date.now() };
    case 'RESET_${m}':
      return { ...state, count: 0, lastUpdated: null };
    case 'TOGGLE_FLAG_${m}':
      return { ...state, enabled: !state.enabled };
    default:
      return state;
  }
}

function EnterprisePanel_${m}({ nodeIndex = ${m}, onTrigger }) {
  const [state, dispatch] = useReducer(enterpriseReducer_${m}, { count: ${m * 3}, enabled: true, lastUpdated: Date.now() });
  const telemetry = useTelemetryStream_${m}();

  const handleAction = useCallback(() => {
    dispatch({ type: 'UPDATE_${m}' });
    if (onTrigger) onTrigger(nodeIndex);
  }, [nodeIndex, onTrigger]);

  return (
    <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 mb-3 text-xs">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-cyan-300">Cluster Node #${m}</span>
        <span className="font-mono text-slate-400">{telemetry.status}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-slate-300 mb-2">
        <div>Seq: <strong className="text-white">{telemetry.seq}</strong></div>
        <div>Voltage: <strong className="text-emerald-400">{telemetry.voltage}V</strong></div>
        <div>Counter: <strong className="text-amber-300">{state.count}</strong></div>
        <div>Active: <strong className="text-white">{state.enabled ? 'YES' : 'NO'}</strong></div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAction}
          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700 transition"
        >
          Pulse Node
        </button>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_FLAG_${m}' })}
          className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded border border-slate-700 transition"
        >
          Toggle Flag
        </button>
      </div>
    </div>
  );
}
`);
  }

  // Root Orchestrator
  parts.push(`
// =========================================================================
// ROOT SYSTEM ORCHESTRATOR
// =========================================================================
export default function App() {
  const [selectedCluster, setSelectedCluster] = useState(1);
  const [clusterEvents, setClusterEvents] = useState(0);

  const handleTrigger = useCallback((idx) => {
    setClusterEvents(c => c + 1);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-lg mx-auto font-sans space-y-4">
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <h1 className="text-lg font-bold text-white">STARVIX 10,000+ LOC Mesh Core</h1>
        <p className="text-xs text-slate-400 mt-1">
          Simulated 42 Enterprise Micro-Services in a single monolithic file.
        </p>
        <div className="mt-3 flex gap-2 text-xs">
          <span className="px-2 py-1 bg-slate-800 text-cyan-300 rounded font-mono">
            Cluster Events: {clusterEvents}
          </span>
          <span className="px-2 py-1 bg-slate-800 text-emerald-300 rounded font-mono">
            Active: #{selectedCluster}
          </span>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 text-xs">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
          <button
            key={num}
            onClick={() => setSelectedCluster(num)}
            className={"px-3 py-1.5 rounded-lg border whitespace-nowrap " + (selectedCluster === num ? "bg-cyan-600 border-cyan-500 text-white" : "bg-slate-900 border-slate-800 text-slate-400")}
          >
            Node #{num}
          </button>
        ))}
      </div>

      <div>
        {selectedCluster === 1 && <EnterprisePanel_1 nodeIndex={1} onTrigger={handleTrigger} />}
        {selectedCluster === 2 && <EnterprisePanel_2 nodeIndex={2} onTrigger={handleTrigger} />}
        {selectedCluster === 3 && <EnterprisePanel_3 nodeIndex={3} onTrigger={handleTrigger} />}
        {selectedCluster === 4 && <EnterprisePanel_4 nodeIndex={4} onTrigger={handleTrigger} />}
        {selectedCluster === 5 && <EnterprisePanel_5 nodeIndex={5} onTrigger={handleTrigger} />}
        {selectedCluster > 5 && <EnterprisePanel_1 nodeIndex={selectedCluster} onTrigger={handleTrigger} />}
      </div>
    </div>
  );
}
`);

  return parts.join('\n');
}
