'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import MonacoEditor, { Monaco } from '@monaco-editor/react';
import { useCodeFlowStore, SupportedLanguage } from '../../store/useCodeFlowStore';
import { Play, Square, AlertCircle } from 'lucide-react';

type MonacoEditorType = Parameters<NonNullable<React.ComponentProps<typeof MonacoEditor>['onMount']>>[0];
type MonacoMouseEvent = Parameters<Parameters<MonacoEditorType['onMouseDown']>[0]>[0];
type ModelDeltaDecoration = Parameters<MonacoEditorType['deltaDecorations']>[1][number];

interface EditorProps {
  readOnly?: boolean;
}

export default function Editor({ readOnly = false }: EditorProps) {
  const {
    code,
    language,
    breakpoints,
    playbackState,
    editorStatus,
    executionError,
    setCode,
    setLanguage,
    toggleBreakpoint,
    runCode,
    stopExecution
  } = useCodeFlowStore();

  const editorRef = useRef<MonacoEditorType | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const currentLineDecorationIdRef = useRef<string[]>([]);
  const currentStepIndex = useCodeFlowStore((state) => state.currentStepIndex);
  const steps = useCodeFlowStore((state) => state.steps);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const languageIcons: Record<SupportedLanguage, string> = {
    python: '🐍',
    javascript: '🟨',
    java: '☕',
    c: '🔵',
    cpp: '⚙️'
  };

  const languages: Array<{ val: SupportedLanguage; label: string }> = [
    { val: 'python', label: 'Python' },
    { val: 'javascript', label: 'JavaScript' },
    { val: 'java', label: 'Java' },
    { val: 'c', label: 'C' },
    { val: 'cpp', label: 'C++' }
  ];

  function handleEditorDidMount(editor: MonacoEditorType, monaco: Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Listen to gutter click to toggle breakpoints
    editor.onMouseDown((e: MonacoMouseEvent) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS && e.target.position) {
        const line = e.target.position.lineNumber;
        toggleBreakpoint(line);
      }
    });

    // Add keyboard shortcut for Run: Ctrl/Cmd + Enter
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (playbackState === 'idle' || playbackState === 'finished') {
        runCode();
      }
    });

    updateBreakpointsDecorations();
  }

  // Update visual dots in Monaco when breakpoints array changes
  const updateBreakpointsDecorations = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const newDecorations = breakpoints.map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'editor-breakpoint-glyph',
        glyphMarginHoverMessage: { value: 'Breakpoint' }
      }
    }));

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      newDecorations
    );
  }, [breakpoints]);

  // Highlight current executing line
  const updateCurrentLineDecoration = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    let newDecorations: ModelDeltaDecoration[] = [];
    if (playbackState !== 'idle' && steps.length > 0 && currentStepIndex < steps.length) {
      const step = steps[currentStepIndex];
      const line = step.lineNumber;
      newDecorations = [
        {
          range: new monaco.Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: 'editor-active-line-highlight',
            glyphMarginClassName: 'editor-active-line-glyph'
          }
        }
      ];
    }

    currentLineDecorationIdRef.current = editor.deltaDecorations(
      currentLineDecorationIdRef.current,
      newDecorations
    );

    // Scroll to reveal active line
    if (newDecorations.length > 0) {
      editor.revealLineInCenterIfOutsideViewport(newDecorations[0].range.startLineNumber);
    }
  }, [currentStepIndex, playbackState, steps]);

  useEffect(() => {
    updateBreakpointsDecorations();
  }, [breakpoints, updateBreakpointsDecorations]);

  useEffect(() => {
    updateCurrentLineDecoration();
  }, [currentStepIndex, playbackState, steps, updateCurrentLineDecoration]);

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
  };

  const getStatusColor = () => {
    switch (editorStatus) {
      case 'running': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'finished': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700/50';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1E293B] border border-slate-700/60 rounded-xl overflow-hidden shadow-2xl relative">
      {/* Header bar with tabs and status */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/80 border-b border-slate-800">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none transition-all cursor-pointer shadow-md select-none"
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
          >
            <span>{languageIcons[language]}</span>
            <span>{languages.find(l => l.val === language)?.label}</span>
            <span className="text-[9px] text-slate-400">▼</span>
          </button>
          
          {dropdownOpen && (
            <div className="absolute left-0 mt-1.5 w-40 bg-slate-950 border border-slate-850 rounded-lg shadow-2xl py-1 z-30 animate-fade-in">
              {languages.map((lang) => (
                <button
                  key={lang.val}
                  onClick={() => {
                    handleLanguageChange(lang.val);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-slate-800 hover:text-slate-100 ${
                    language === lang.val
                      ? 'bg-blue-600/10 text-blue-400 font-bold border-l-2 border-blue-500'
                      : 'text-slate-400'
                  }`}
                  role="option"
                  aria-selected={language === lang.val}
                >
                  <span>{languageIcons[lang.val]}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {/* Status Indicator */}
          <span className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              editorStatus === 'running' ? 'bg-amber-400 animate-pulse' :
              editorStatus === 'error' ? 'bg-red-400' :
              editorStatus === 'finished' ? 'bg-green-400' : 'bg-slate-400'
            }`} />
            <span className="capitalize">{editorStatus}</span>
          </span>

          {/* Action buttons */}
          {playbackState === 'playing' || playbackState === 'paused' || playbackState === 'awaiting_input' ? (
            <button
              onClick={stopExecution}
              className="flex items-center justify-center space-x-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-red-900/20 transition-all duration-200 cursor-pointer"
              aria-label="Stop execution"
            >
              <Square size={13} fill="white" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={runCode}
              className="flex items-center justify-center space-x-1 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-blue-900/20 transition-all duration-200 cursor-pointer"
              aria-label="Run program (Ctrl+Enter)"
            >
              <Play size={13} fill="white" />
              <span>Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 min-h-[300px]">
        <MonacoEditor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language === 'c' ? 'c' : language === 'java' ? 'java' : language === 'javascript' ? 'javascript' : 'python'}
          value={code}
          onChange={(val) => setCode(val || '')}
          theme="vs-dark"
          options={{
            readOnly: readOnly || playbackState === 'playing' || playbackState === 'paused' || playbackState === 'awaiting_input',
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Fira Code, Menlo, Monaco, Consolas, monospace',
            fontLigatures: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            }
          }}
          onMount={handleEditorDidMount}
        />
      </div>

      {/* Error Panel (slides up from bottom) */}
      {executionError && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-900/95 border-t border-red-700/50 px-4 py-3 flex items-start space-x-3 transition-all duration-300 animate-slide-up shadow-[0_-8px_24px_rgba(0,0,0,0.5)] z-20">
          <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={18} />
          <div className="flex-1 text-slate-100">
            <div className="text-xs font-semibold text-red-300">
              Compilation / Syntax Error (Line {executionError.line})
            </div>
            <div className="text-sm font-mono mt-1 text-red-100 leading-snug">
              {executionError.message}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
