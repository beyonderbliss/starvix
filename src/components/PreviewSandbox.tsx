import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Smartphone, Tablet, Monitor, AlertCircle, Wrench, Bug, CheckCircle2 } from 'lucide-react';
import { DevicePreset, LogEntry } from '../types';

interface PreviewSandboxProps {
  code: string;
  onLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  onErrorDetected: (error: { message: string; stack?: string; line?: number; column?: number }) => void;
  onTriggerAutoFix?: () => void;
  hasAutoFixReady?: boolean;
}

export const PreviewSandbox: React.FC<PreviewSandboxProps> = ({
  code,
  onLog,
  onErrorDetected,
  onTriggerAutoFix,
  hasAutoFixReady,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<DevicePreset>('mobile');
  const [runtimeError, setRuntimeError] = useState<{ message: string; line?: number; stack?: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [sandboxedCode, setSandboxedCode] = useState(code);

  // Sync execution code
  useEffect(() => {
    setSandboxedCode(code);
  }, [code]);

  // Listen to postMessage from the sandbox
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'STARVIX_LOG') {
        onLog({
          level: data.level || 'info',
          message: data.message || '',
          data: data.payload,
          source: 'console',
        });
      } else if (data.type === 'STARVIX_ERROR') {
        const errObj = {
          message: data.message || 'Unknown sandbox runtime error',
          stack: data.stack,
          line: data.line,
          column: data.column,
        };
        setRuntimeError(errObj);
        onErrorDetected(errObj);
        onLog({
          level: 'error',
          message: `[Runtime Exception] ${data.message} (Line: ${data.line || '?'})`,
          data: data.stack,
          source: 'runtime',
        });
      } else if (data.type === 'STARVIX_READY') {
        setRuntimeError(null);
        setIsRunning(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onErrorDetected, onLog]);

  // Re-run the sandbox
  const runSandbox = () => {
    setIsRunning(true);
    setRuntimeError(null);

    // Escape and construct HTML iframe document with React 18 CDN and Error Boundary
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <script>
    // Console Telemetry Interceptor
    (function() {
      const origLog = console.log;
      const origWarn = console.warn;
      const origError = console.error;

      console.log = function(...args) {
        origLog.apply(console, args);
        try {
          window.parent.postMessage({
            type: 'STARVIX_LOG',
            level: 'info',
            message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
          }, '*');
        } catch(e) {}
      };

      console.warn = function(...args) {
        origWarn.apply(console, args);
        try {
          window.parent.postMessage({
            type: 'STARVIX_LOG',
            level: 'warn',
            message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
          }, '*');
        } catch(e) {}
      };

      console.error = function(...args) {
        origError.apply(console, args);
        try {
          window.parent.postMessage({
            type: 'STARVIX_LOG',
            level: 'error',
            message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
          }, '*');
        } catch(e) {}
      };

      window.onerror = function(message, source, lineno, colno, error) {
        window.parent.postMessage({
          type: 'STARVIX_ERROR',
          message: String(message),
          line: lineno,
          column: colno,
          stack: error ? error.stack : ''
        }, '*');
        return false;
      };

      window.onunhandledrejection = function(e) {
        window.parent.postMessage({
          type: 'STARVIX_ERROR',
          message: 'Unhandled Promise: ' + (e.reason ? e.reason.message || e.reason : 'Rejection'),
          stack: e.reason ? e.reason.stack : ''
        }, '*');
      };
    })();

    // GIST MODULE LOADER: Native mobile compatibility via fetch + new Function("React", code)(React)
    window.GIST_CACHE = {};
    window.loadGistModule = function(rawUrl) {
      return function GistComponentProxy(props) {
        const [Component, setComponent] = React.useState(null);
        const [error, setError] = React.useState(null);

        React.useEffect(() => {
          if (window.GIST_CACHE[rawUrl]) {
            setComponent(() => window.GIST_CACHE[rawUrl]);
            return;
          }

          fetch(rawUrl)
            .then(res => {
              if (!res.ok) throw new Error('HTTP ' + res.status + ' loading Gist: ' + rawUrl);
              return res.text();
            })
            .then(code => {
              try {
                // Execute in clean sandbox closure
                const factory = new Function("React", code);
                const exportedComp = factory(React);
                window.GIST_CACHE[rawUrl] = exportedComp;
                setComponent(() => exportedComp);
              } catch(evalErr) {
                setError(evalErr.message);
              }
            })
            .catch(err => {
              setError(err.message);
            });
        }, []);

        if (error) {
          return React.createElement('div', {
            className: 'p-3 bg-red-950/60 border border-red-800 text-red-300 rounded text-xs'
          }, 'Gist Module Error: ' + error);
        }

        if (!Component) {
          return React.createElement('div', {
            className: 'p-3 text-slate-400 text-xs animate-pulse font-mono'
          }, 'Loading Gist Module...');
        }

        return React.createElement(Component, props);
      };
    };
  </script>

  <!-- React Error Boundary & Transpiled Code Runner -->
  <script type="text/babel">
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }
      componentDidCatch(error, errorInfo) {
        window.parent.postMessage({
          type: 'STARVIX_ERROR',
          message: error.message,
          stack: (error.stack || '') + '\\n' + (errorInfo.componentStack || '')
        }, '*');
      }
      render() {
        if (this.state.hasError) {
          return (
            <div className="p-4 m-4 bg-red-950/80 border border-red-800 rounded-xl text-red-200 text-xs font-mono space-y-2">
              <div className="font-bold flex items-center gap-2">
                <span>⚠️ React Component Exception</span>
              </div>
              <div className="p-2 bg-black/40 rounded text-red-300 overflow-x-auto">
                {this.state.error && this.state.error.message}
              </div>
              <div className="text-[11px] text-red-400">
                Trigger Gemini Auto-Fix to automatically analyze and patch this exception.
              </div>
            </div>
          );
        }
        return this.props.children;
      }
    }

    try {
      // User Code Injection
      ${sandboxedCode.replace(/export\s+default\s+function\s+App/g, 'function App')}

      const rootElement = document.getElementById('root');
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );

      window.parent.postMessage({ type: 'STARVIX_READY' }, '*');
    } catch (err) {
      window.parent.postMessage({
        type: 'STARVIX_ERROR',
        message: err.message,
        stack: err.stack
      }, '*');
    }
  </script>
</body>
</html>`;

    if (iframeRef.current) {
      iframeRef.current.srcdoc = html;
    }
  };

  useEffect(() => {
    runSandbox();
  }, [sandboxedCode]);

  // Inject a deliberate test bug so users can experience Auto-Fix immediately
  const handleInjectBug = () => {
    const buggyCode = sandboxedCode.replace(
      'function App() {',
      'function App() {\n  // [INJECTED TEST BUG]: Uncaught ReferenceError\n  const crash = uninitializedMobileModule.calculate();\n'
    );
    setSandboxedCode(buggyCode);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0A0A0B] overflow-hidden">
      {/* Top Toolbar - Precision Instrument Bar */}
      <div className="h-10 px-3 bg-[#141416] border-b border-[#2A2A2E] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider">Sandbox Preview</span>
          {runtimeError ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#F27D26]/10 border border-[#F27D26]/40 text-[#F27D26] text-[10px] font-mono font-medium">
              <AlertCircle className="w-3 h-3 text-[#F27D26]" /> ERROR INTERCEPTED
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#22C55E]/10 border border-[#22C55E]/40 text-[#22C55E] text-[10px] font-mono font-medium">
              <CheckCircle2 className="w-3 h-3 text-[#22C55E]" /> VIRTUAL VM READY
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Inject Test Bug Button */}
          <button
            type="button"
            onClick={handleInjectBug}
            className="px-2 py-1 bg-[#1B1B1F] hover:bg-[#222226] text-[#F27D26] border border-[#2A2A2E] rounded text-[11px] font-mono flex items-center gap-1.5 transition active:scale-95"
            title="Inject deliberate bug to test Gemini Self-Correction Loop"
          >
            <Bug className="w-3 h-3 text-[#F27D26]" />
            <span className="hidden sm:inline">TEST EXCEPTION</span>
          </button>

          {/* Device Presets */}
          <div className="flex items-center bg-[#1B1B1F] rounded p-0.5 border border-[#2A2A2E] text-slate-300">
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={`p-1 rounded ${device === 'mobile' ? 'bg-[#38BDF8] text-[#0A0A0B]' : 'hover:text-white'}`}
              title="Android Mobile (360x780)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice('tablet')}
              className={`p-1 rounded ${device === 'tablet' ? 'bg-[#38BDF8] text-[#0A0A0B]' : 'hover:text-white'}`}
              title="Tablet View (768px)"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDevice('responsive')}
              className={`p-1 rounded ${device === 'responsive' ? 'bg-[#38BDF8] text-[#0A0A0B]' : 'hover:text-white'}`}
              title="Full Responsive"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={runSandbox}
            disabled={isRunning}
            className="p-1.5 rounded bg-[#1B1B1F] hover:bg-[#222226] text-slate-200 border border-[#2A2A2E] text-xs transition"
            title="Re-run Virtual Sandbox"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin text-[#38BDF8]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Action Banner (Self-Correction Loop trigger) */}
      {runtimeError && (
        <div className="bg-[#141416] border-b border-[#F27D26]/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-[#F27D26] shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-semibold text-slate-100 font-mono flex items-center gap-1.5">
                <span className="text-[#F27D26] uppercase">EXCEPTION:</span> Runtime Error Intercepted
              </div>
              <div className="font-mono text-[11px] text-[#F27D26] line-clamp-2 mt-0.5">
                {runtimeError.message}
              </div>
            </div>
          </div>
          {onTriggerAutoFix && (
            <button
              type="button"
              onClick={onTriggerAutoFix}
              className="px-3 py-1.5 bg-[#F27D26] hover:bg-[#F27D26]/90 text-black font-semibold text-xs font-mono rounded shadow-sm flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition"
            >
              <Wrench className="w-3.5 h-3.5 text-black" />
              <span>TRIGGER GEMINI AUTO-FIX</span>
            </button>
          )}
        </div>
      )}

      {/* Frame Container */}
      <div className="flex-1 overflow-auto bg-[#0A0A0B] flex items-center justify-center p-2 sm:p-4">
        <div
          className={`h-full transition-all duration-300 flex flex-col bg-[#141416] border border-[#2A2A2E] shadow-2xl overflow-hidden ${
            device === 'mobile'
              ? 'w-full max-w-[380px] rounded-2xl border-[4px] border-[#2A2A2E] ring-1 ring-[#38BDF8]/20'
              : device === 'tablet'
              ? 'w-full max-w-[768px] rounded-xl'
              : 'w-full rounded-none border-none'
          }`}
        >
          {/* Mobile phone notch/speaker bezel if in mobile view */}
          {device === 'mobile' && (
            <div className="h-5 w-full bg-[#141416] border-b border-[#2A2A2E] flex items-center justify-center shrink-0">
              <div className="w-16 h-1 bg-[#2A2A2E] rounded-full" />
            </div>
          )}

          <iframe
            ref={iframeRef}
            title="STARVIX Sandbox Runner"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            className="w-full flex-1 border-0 bg-[#0A0A0B]"
          />

          {/* Mobile bottom pill indicator */}
          {device === 'mobile' && (
            <div className="h-4 w-full bg-[#141416] border-t border-[#2A2A2E] flex items-center justify-center shrink-0">
              <div className="w-20 h-1 bg-[#2A2A2E] rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
