import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Loader2, Code2, AlertTriangle } from 'lucide-react';

export interface MonacoEditorHandle {
  insertText: (snippet: string, cursorOffset?: number) => void;
  jumpToLine: (line: number) => void;
  formatDocument: () => void;
  undo: () => void;
  redo: () => void;
  focus: () => void;
}

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
}

declare global {
  interface Window {
    require?: any;
    monaco?: any;
  }
}

export const MonacoEditor = forwardRef<MonacoEditorHandle, MonacoEditorProps>(
  ({ value, onChange, language = 'javascript', readOnly = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const editorInstanceRef = useRef<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [useFallback, setUseFallback] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Provide methods via forwardRef
    useImperativeHandle(ref, () => ({
      insertText: (snippet: string, cursorOffset?: number) => {
        const editor = editorInstanceRef.current;
        if (editor && window.monaco) {
          const selection = editor.getSelection();
          const id = { major: 1, minor: 1 };
          const op = {
            identifier: id,
            range: selection,
            text: snippet,
            forceMoveMarkers: true,
          };
          editor.executeEdits('snippet-bar', [op]);

          if (cursorOffset !== undefined && cursorOffset > 0) {
            const startPos = selection.getStartPosition();
            editor.setPosition({
              lineNumber: startPos.lineNumber,
              column: startPos.column + cursorOffset,
            });
          }
          editor.focus();
        } else if (textareaRef.current) {
          const ta = textareaRef.current;
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const currentText = ta.value;
          const newText = currentText.substring(0, start) + snippet + currentText.substring(end);
          onChange(newText);

          setTimeout(() => {
            const newPos = start + (cursorOffset !== undefined ? cursorOffset : snippet.length);
            ta.selectionStart = newPos;
            ta.selectionEnd = newPos;
            ta.focus();
          }, 0);
        }
      },
      jumpToLine: (lineNumber: number) => {
        const editor = editorInstanceRef.current;
        if (editor && window.monaco) {
          editor.revealLineInCenter(lineNumber);
          editor.setPosition({ lineNumber, column: 1 });
          editor.focus();
        } else if (textareaRef.current) {
          const lines = value.split('\n');
          let charIndex = 0;
          for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
            charIndex += lines[i].length + 1;
          }
          textareaRef.current.selectionStart = charIndex;
          textareaRef.current.selectionEnd = charIndex;
          textareaRef.current.focus();
        }
      },
      formatDocument: () => {
        const editor = editorInstanceRef.current;
        if (editor && window.monaco) {
          editor.getAction('editor.action.formatDocument')?.run();
        }
      },
      undo: () => {
        const editor = editorInstanceRef.current;
        if (editor) {
          editor.trigger('keyboard', 'undo', null);
        }
      },
      redo: () => {
        const editor = editorInstanceRef.current;
        if (editor) {
          editor.trigger('keyboard', 'redo', null);
        }
      },
      focus: () => {
        if (editorInstanceRef.current) {
          editorInstanceRef.current.focus();
        } else if (textareaRef.current) {
          textareaRef.current.focus();
        }
      },
    }));

    // Dynamically load Monaco via CDN AMD Loader
    useEffect(() => {
      let isMounted = true;

      const initMonacoInstance = () => {
        if (!containerRef.current || !window.monaco) return;

        // Dispose previous instance if existing
        if (editorInstanceRef.current) {
          editorInstanceRef.current.dispose();
        }

        try {
          // Define Hardware / Specialist Tool dark theme
          window.monaco.editor.defineTheme('starvix-hardware', {
            base: 'vs-dark',
            inherit: true,
            rules: [
              { token: '', background: '0A0A0B', foreground: 'F8FAFC' },
              { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
              { token: 'keyword', foreground: '38BDF8' },
              { token: 'string', foreground: '22C55E' },
              { token: 'number', foreground: 'F27D26' },
              { token: 'type', foreground: '38BDF8' },
            ],
            colors: {
              'editor.background': '#0A0A0B',
              'editor.lineHighlightBackground': '#141416',
              'editorLineNumber.foreground': '#475569',
              'editorLineNumber.activeForeground': '#38BDF8',
              'editorCursor.foreground': '#38BDF8',
              'editor.selectionBackground': '#38BDF826',
              'editor.inactiveSelectionBackground': '#38BDF815',
            }
          });

          const editor = window.monaco.editor.create(containerRef.current, {
            value,
            language,
            theme: 'starvix-hardware',
            readOnly,
            fontSize: 13,
            lineNumbersMinChars: 3,
            minimap: { enabled: false }, // Memory optimization for mobile
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            fontFamily: "'Fira Code', monospace",
            renderLineHighlight: 'all',
            smoothScrolling: true,
            quickSuggestions: { other: true, comments: false, strings: false },
            padding: { top: 8, bottom: 8 },
            scrollbar: {
              verticalScrollbarSize: 6,
              horizontalScrollbarSize: 6,
            },
          });

          editor.onDidChangeModelContent(() => {
            if (isMounted) {
              const currentVal = editor.getValue();
              onChange(currentVal);
            }
          });

          editorInstanceRef.current = editor;
          setIsLoading(false);
        } catch (err: unknown) {
          console.error('Failed to create Monaco editor instance:', err);
          if (isMounted) {
            setUseFallback(true);
            setIsLoading(false);
          }
        }
      };

      if (window.monaco) {
        initMonacoInstance();
        return;
      }

      // Check if AMD loader is already present
      if (!window.require) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
        script.async = true;

        script.onload = () => {
          if (!window.require) {
            if (isMounted) {
              setUseFallback(true);
              setIsLoading(false);
            }
            return;
          }

          window.require.config({
            paths: {
              vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs',
            },
          });

          window.require(['vs/editor/editor.main'], () => {
            if (isMounted) {
              initMonacoInstance();
            }
          });
        };

        script.onerror = () => {
          if (isMounted) {
            setLoadError('CDN network unavailable. Activated mobile fallback editor.');
            setUseFallback(true);
            setIsLoading(false);
          }
        };

        document.body.appendChild(script);
      } else {
        window.require(['vs/editor/editor.main'], () => {
          if (isMounted) {
            initMonacoInstance();
          }
        });
      }

      return () => {
        isMounted = false;
        if (editorInstanceRef.current) {
          editorInstanceRef.current.dispose();
          editorInstanceRef.current = null;
        }
      };
    }, []);

    // Sync external value changes (e.g. from Auto-Fix or Sample loading)
    useEffect(() => {
      const editor = editorInstanceRef.current;
      if (editor) {
        const currentVal = editor.getValue();
        if (currentVal !== value) {
          const position = editor.getPosition();
          editor.setValue(value);
          if (position) {
            editor.setPosition(position);
          }
        }
      }
    }, [value]);

    return (
      <div className="relative w-full h-full min-h-[300px] flex-1 flex flex-col bg-[#0A0A0B] overflow-hidden">
        {/* Loading Spinner */}
        {isLoading && !useFallback && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0A0A0B]/90 backdrop-blur-sm text-slate-300 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#38BDF8]" />
            <span className="text-xs font-mono tracking-wide text-slate-300">Initializing Mobile Monaco Sandbox...</span>
          </div>
        )}

        {/* Fallback Notice Banner if offline/error */}
        {useFallback && (
          <div className="px-3 py-1.5 bg-[#1B1B1F] border-b border-[#2A2A2E] text-[#F27D26] text-xs font-mono flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#F27D26]" />
            <span>Mobile Lean Editor Active {loadError ? `(${loadError})` : ''}</span>
          </div>
        )}

        {/* Monaco Container */}
        {!useFallback ? (
          <div ref={containerRef} className="w-full h-full flex-1 bg-[#0A0A0B]" />
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            readOnly={readOnly}
            spellCheck={false}
            className="w-full h-full flex-1 p-3 bg-[#0A0A0B] text-slate-100 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#38BDF8]/50"
            placeholder="// Enter or paste your React code here..."
          />
        )}
      </div>
    );
  }
);

MonacoEditor.displayName = 'MonacoEditor';
