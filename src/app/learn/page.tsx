'use client';

import React, { useEffect, useState, useRef } from 'react';
import Navbar from '../../components/Navbar';
import Editor from '../../components/editor/Editor';
import VisualizerCanvas from '../../components/visualizer/VisualizerCanvas';
import AIPanel from '../../components/ai/AIPanel';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { Terminal, Sparkles } from 'lucide-react';
import { ExecutionStep } from '../../engine/types';

interface HistoryEntry {
  stepIndex: number;
  line: number;
  name: string;
  oldValue: string;
  newValue: string;
}

const getChangeIndicator = (name: string, newValue: string, oldValue: string) => {
  if (newValue.startsWith('0x') || newValue.startsWith('&') || oldValue.startsWith('0x')) {
    return { symbol: '🔗', color: 'text-cyan-400' };
  }
  if (name.includes('[') || name.includes('.')) {
    return { symbol: '●', color: 'text-emerald-500' };
  }
  return { symbol: '✎', color: 'text-amber-400' };
};

const getMemoryHistory = (steps: ExecutionStep[], currentIndex: number): HistoryEntry[] => {
  const history: HistoryEntry[] = [];
  
  for (let i = 1; i <= currentIndex; i++) {
    if (i >= steps.length) break;
    const prevStep = steps[i - 1];
    const currStep = steps[i];
    
    // Check variables that changed
    currStep.variables.forEach(v => {
      const prevV = prevStep.variables.find(pv => pv.name === v.name && pv.scope === v.scope);
      const oldVal = prevV ? (prevV.value === null ? 'null' : String(prevV.value)) : 'undefined';
      const newVal = v.value === null ? 'null' : String(v.value);
      if (oldVal !== newVal) {
        history.push({
          stepIndex: i,
          line: currStep.lineNumber,
          name: v.name,
          oldValue: oldVal,
          newValue: newVal
        });
      }
    });

    // Check heap objects that changed
    currStep.heap.forEach(h => {
      const prevH = prevStep.heap.find(ph => ph.id === h.id);
      if (prevH) {
        const hArr = h.value as unknown[];
        const prevArr = prevH.value as unknown[];
        if (Array.isArray(hArr) && Array.isArray(prevArr)) {
          hArr.forEach((val, idx) => {
            const oldVal = prevArr[idx];
            if (oldVal !== val) {
              history.push({
                stepIndex: i,
                line: currStep.lineNumber,
                name: `${h.id}[${idx}]`,
                oldValue: oldVal === null ? 'null' : String(oldVal),
                newValue: val === null ? 'null' : String(val)
              });
            }
          });
        } else if (typeof h.value === 'object' && typeof prevH.value === 'object' && h.value && prevH.value) {
          const currVal = h.value as Record<string, unknown>;
          const prevVal = prevH.value as Record<string, unknown>;
          Object.keys(currVal).forEach(key => {
            if (currVal[key] !== prevVal[key]) {
              history.push({
                stepIndex: i,
                line: currStep.lineNumber,
                name: `${h.id}.${key}`,
                oldValue: prevVal[key] === undefined ? 'undefined' : String(prevVal[key]),
                newValue: String(currVal[key])
              });
            }
          });
        }
      }
    });
  }

  return history.slice().reverse();
};

export default function LearnIDE() {
  const {
    stdout,
    currentStepIndex,
    steps,
    explanations,
    aiTutorOpen,
    toggleAiTutor,
    playbackState,
    speed,
    awaitingInput,
    setPlaybackState,
    setSpeed,
    stepForward,
    stepBackward,
    jumpToStart,
    jumpToEnd,
    triggerExplanationFetch
  } = useCodeFlowStore();

  const [userSelectedTab, setUserSelectedTab] = useState<'execution' | 'memory' | 'output' | null>(null);

  // Debounce ref — avoids flooding Ollama during fast auto-playback
  const explanationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Predictive prefetching on step transitions (debounced 300 ms)
  useEffect(() => {
    if (steps.length === 0) return;

    // Clear any pending debounced call from the previous render
    if (explanationDebounceRef.current) {
      clearTimeout(explanationDebounceRef.current);
    }

    // Only fire the AI fetch after the user has settled on a step for 300 ms.
    // During fast auto-playback this means only the "current" step is fetched,
    // not every intermediate step the timer skips through.
    explanationDebounceRef.current = setTimeout(() => {
      triggerExplanationFetch(currentStepIndex);
    }, 300);

    return () => {
      if (explanationDebounceRef.current) {
        clearTimeout(explanationDebounceRef.current);
      }
    };
  }, [currentStepIndex, steps.length, triggerExplanationFetch]);

  // Reset user selection when steps change (e.g. new compilation run)
  const prevStepsLengthRef = useRef(0);
  useEffect(() => {
    if (steps.length !== prevStepsLengthRef.current) {
      setUserSelectedTab(null);
    }
    prevStepsLengthRef.current = steps.length;
  }, [steps.length]);

  // Reset user selection when execution finishes
  const prevPlaybackStateRef = useRef(playbackState);
  useEffect(() => {
    if (playbackState === 'finished' && prevPlaybackStateRef.current !== 'finished') {
      setUserSelectedTab(null);
    }
    prevPlaybackStateRef.current = playbackState;
  }, [playbackState]);

  // Derive the active tab based on playbackState and userSelectedTab
  const activeTab = userSelectedTab || (playbackState === 'finished' ? 'output' : 'execution');

  // Playback timer loop
  useEffect(() => {
    if (playbackState !== 'playing' || awaitingInput) return;

    // Interval based on speed multiplier (1x = 1000ms, 2x = 500ms, etc.)
    const intervalTime = 1000 / speed;
    const timer = setInterval(() => {
      const { currentStepIndex, steps, stepForward, setPlaybackState } = useCodeFlowStore.getState();
      
      // Stop playing if we reach the end of the current trace
      if (currentStepIndex < steps.length - 1) {
        stepForward();
      } else {
        setPlaybackState('finished');
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [playbackState, speed, awaitingInput]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if user is typing in code editor or input fields
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.classList.contains('input')
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (playbackState === 'playing') {
            setPlaybackState('paused');
          } else if (playbackState === 'paused' || playbackState === 'idle' || playbackState === 'finished') {
            // Auto restart if completed
            if (playbackState === 'finished') {
              useCodeFlowStore.getState().runCode();
            } else {
              setPlaybackState('playing');
            }
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
          break;
        case 'Home':
          e.preventDefault();
          jumpToStart();
          break;
        case 'End':
          e.preventDefault();
          jumpToEnd();
          break;
        // Speeds 1-4 keys
        case 'Digit1': setSpeed(0.25); break;
        case 'Digit2': setSpeed(0.5); break;
        case 'Digit3': setSpeed(1); break;
        case 'Digit4': setSpeed(2); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackState, stepBackward, stepForward, jumpToStart, jumpToEnd, setSpeed, setPlaybackState]);

  return (
    <div className="h-screen flex flex-col bg-[#0F172A] text-slate-100 overflow-hidden">
      <Navbar />

      {/* Workspace Core Area */}
      <main className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* Editor and Canvas Panels Container */}
        <div className="flex-1 flex flex-col md:flex-row min-w-0 p-4 gap-4 overflow-hidden">
          
          {/* Left panel: Editor (40% width on large screens) */}
          <div className="flex-[4] flex flex-col min-w-0 h-full overflow-hidden">
            <Editor />
          </div>

          {/* Right panel: Visualizer & Console Layout (60% width) */}
          <div className="flex-[6] flex flex-col min-w-0 h-full gap-4 overflow-hidden">
            
            {/* Visualizer Canvas */}
            <VisualizerCanvas />
            
            {/* Bottom Console panel */}
            {(() => {
              const isRunning = steps.length > 0 && playbackState !== 'finished';
              return (
                <div className="h-[220px] bg-slate-900 border border-slate-800/80 rounded-xl flex flex-col overflow-hidden shrink-0 shadow-lg">
                  <div className="bg-slate-950 border-b border-slate-850 flex items-center justify-between px-4 py-1.5 select-none">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <Terminal size={12} className="text-slate-500" />
                      
                      {isRunning ? (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Execution Monitor
                        </span>
                      ) : (
                        /* Tabs */
                        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
                          <button
                            onClick={() => {
                              setUserSelectedTab('execution');
                            }}
                            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                              activeTab === 'execution'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            Execution
                          </button>
                          <button
                            onClick={() => {
                              setUserSelectedTab('memory');
                            }}
                            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                              activeTab === 'memory'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            Memory History ({getMemoryHistory(steps, steps.length - 1).length})
                          </button>
                          <button
                            onClick={() => {
                              setUserSelectedTab('output');
                            }}
                            className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                              activeTab === 'output'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                          >
                            Program Output
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {steps.length > 0 && (
                      <span className="text-[9px] font-mono text-slate-500 uppercase">
                        Step {currentStepIndex + 1} of {steps.length}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 flex overflow-hidden bg-slate-950/70 text-xs font-mono select-text">
                        {isRunning ? (
                          (() => {
                            const currentStep = steps[currentStepIndex];
                        const explanationObj = explanations[currentStepIndex];
                        const explanationText = explanationObj ? explanationObj.text : '';
                        const explanationSource = explanationObj ? explanationObj.source : 'engine';

                        console.log("=== UI VALUE ===");
                        console.log(explanationText);
                        console.log("================");
                        console.log("=== FINAL UI VALUE (AI Explanation - Active Execution) ===");
                        console.log(`Step ${currentStepIndex} (Line ${currentStep?.lineNumber}):`, explanationText);
                        console.log("=========================================================");
                        
                        const splitDescription = (desc: string) => {
                          if (!desc) return { title: '', detail: '' };
                          const idx = desc.indexOf(':');
                          if (idx !== -1) {
                            return {
                              title: desc.substring(0, idx).trim() + ':',
                              detail: desc.substring(idx + 1).trim()
                            };
                          }
                          return { title: desc, detail: '' };
                        };
                        
                        const descParts = currentStep ? splitDescription(currentStep.description) : { title: '', detail: '' };
                        const recentChanges = getMemoryHistory(steps, currentStepIndex);
                        
                        return (
                          <div className="flex-1 flex flex-row min-h-0 overflow-hidden divide-x divide-slate-800/80">
                            {/* Left Section (75% width, flex-[3]) */}
                            <div className="flex-[3] flex flex-col min-h-0 overflow-hidden min-w-0">
                              {/* Execution Explanation - Full Height */}
                              <div className="flex-1 overflow-y-auto p-3 pr-1 custom-scrollbar">
                                <div className="text-base font-bold text-blue-400">Line {currentStep.lineNumber}</div>
                                <div className="mt-1.5 text-xs font-semibold text-slate-300">
                                  {descParts.title}
                                </div>
                                {descParts.detail && (
                                  <div className="mt-1 text-sm font-mono text-slate-100 font-bold">
                                    {descParts.detail}
                                  </div>
                                )}
                                {explanationText && (
                                  <div className="border-t border-slate-800/80 pt-2 mt-2 text-slate-400 text-[11px] leading-relaxed">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5 select-none">
                                      {explanationSource === 'ai' ? 'AI Explanation' : 'Explanation'}
                                    </span>
                                    {explanationText}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Section (25% width, flex-[1]) */}
                            <div className="flex-[1] flex flex-col min-h-0 overflow-hidden min-w-0 bg-slate-950/20">
                              <div className="bg-slate-950 border-b border-slate-850 px-4 py-1.5 flex items-center justify-between shrink-0 select-none">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                  Recent Changes ({recentChanges.length})
                                </span>
                              </div>
                              
                              <div className="flex-1 overflow-y-auto p-3 pr-1 custom-scrollbar space-y-0.5 bg-slate-950/45">
                                {recentChanges.length === 0 ? (
                                  <div className="p-3 text-slate-500 text-[10px] font-mono select-none">
                                    No variables modified yet.
                                  </div>
                                ) : (
                                  recentChanges.map((change, idx) => {
                                    return (
                                      <div key={idx} className="flex items-center text-[13px] font-mono py-1 px-1.5 hover:bg-slate-900/40 rounded transition-colors select-text">
                                        <span className="text-slate-500 w-11 shrink-0">L{change.line}</span>
                                        <span className="text-slate-200 font-semibold w-16 truncate mr-1.5" title={change.name}>
                                          {change.name}
                                        </span>
                                        <div className="flex items-center space-x-1 text-slate-400 truncate flex-1 min-w-0">
                                          {change.oldValue !== 'undefined' && (
                                            <span className="text-red-400/85 line-through truncate max-w-[42px]" title={change.oldValue}>
                                              {change.oldValue}
                                            </span>
                                          )}
                                          {change.oldValue !== 'undefined' && <span className="text-slate-600 text-[10px]">&rarr;</span>}
                                          <span className="text-emerald-400 font-bold truncate max-w-[55px]" title={change.newValue}>
                                            {change.newValue}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : activeTab === 'execution' ? (
                      steps.length === 0 ? (
                        <div className="flex-1 p-3 text-slate-500">
                          Compile and Run code to view live statement-by-statement execution tracking...
                        </div>
                      ) : (
                        (() => {
                          const currentStep = steps[currentStepIndex];
                          const explanationObj = explanations[currentStepIndex];
                          const explanationText = explanationObj ? explanationObj.text : '';
                          const explanationSource = explanationObj ? explanationObj.source : 'engine';

                          console.log("=== UI VALUE ===");
                          console.log(explanationText);
                          console.log("================");
                          console.log("=== FINAL UI VALUE (AI Explanation - Execution Tab) ===");
                          console.log(`Step ${currentStepIndex} (Line ${currentStep?.lineNumber}):`, explanationText);
                          console.log("=====================================================");
                          
                          const splitDescription = (desc: string) => {
                            const idx = desc.indexOf(':');
                            if (idx !== -1) {
                              return {
                                title: desc.substring(0, idx).trim() + ':',
                                detail: desc.substring(idx + 1).trim()
                              };
                            }
                            return { title: desc, detail: '' };
                          };
                          
                          const descParts = splitDescription(currentStep.description);
                          
                          return (
                            <div className="flex-1 p-3 flex flex-col min-w-0">
                              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                                <div className="text-base font-bold text-blue-400">Line {currentStep.lineNumber}</div>
                                <div className="mt-2 text-xs font-semibold text-slate-300">
                                  {descParts.title}
                                </div>
                                {descParts.detail && (
                                  <div className="mt-1 text-sm font-mono text-slate-100 font-bold">
                                    {descParts.detail}
                                  </div>
                                )}
                                {explanationText && (
                                  <div className="border-t border-slate-800/80 pt-2 mt-3 text-slate-400 text-[11px] leading-relaxed">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                                      {explanationSource === 'ai' ? 'AI Explanation' : 'Explanation'}
                                    </span>
                                    {explanationText}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      )
                    ) : activeTab === 'memory' ? (
                      steps.length === 0 ? (
                        <div className="flex-1 p-3 text-slate-500">
                          Compile and Run code to see the step-by-step memory timeline...
                        </div>
                      ) : (
                        (() => {
                          const recentChanges = getMemoryHistory(steps, currentStepIndex);
                          if (recentChanges.length === 0) {
                            return (
                              <div className="flex-1 p-3 text-slate-500">
                                No variables have been modified or allocated yet.
                              </div>
                            );
                          }
                          return (
                            <div className="flex-1 p-3 flex flex-col min-w-0">
                              <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-0.5">
                                {recentChanges.map((change, idx) => {
                                  const indicator = getChangeIndicator(change.name, change.newValue, change.oldValue);
                                  return (
                                    <div key={idx} className="flex items-center text-[10.5px] font-mono py-1 px-2 hover:bg-slate-900/40 rounded transition-colors select-text">
                                      <span className="text-slate-500 w-16 shrink-0">Line {change.line}</span>
                                      <span className={`w-5 shrink-0 text-center mr-1 text-[10px] ${indicator.color}`} title={indicator.symbol === '🔗' ? 'Reference Update' : indicator.symbol === '●' ? 'Write Operation' : 'Variable Update'}>
                                        {indicator.symbol}
                                      </span>
                                      <span className="text-slate-200 font-semibold w-32 truncate mr-3" title={change.name}>
                                        {change.name}
                                      </span>
                                      <div className="flex items-center space-x-2 text-slate-400 truncate flex-1 min-w-0">
                                        {change.oldValue !== 'undefined' && (
                                          <span className="text-red-400/80 line-through truncate max-w-[80px]" title={change.oldValue}>
                                            {change.oldValue}
                                          </span>
                                        )}
                                        {change.oldValue !== 'undefined' && <span className="text-slate-600">→</span>}
                                        <span className="text-emerald-400 font-bold truncate" title={change.newValue}>
                                          {change.newValue}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()
                      )
                    ) : steps.length === 0 ? (
                      <div className="flex-1 p-3 text-slate-500">
                        Console output will appear here when the program prints...
                      </div>
                    ) : (
                      <div className="flex-1 p-3 flex flex-col min-w-0">
                        <pre className="flex-1 overflow-y-auto text-emerald-400 leading-relaxed text-xs whitespace-pre-wrap select-text pr-1 custom-scrollbar">
                          {stdout || '(No program output)'}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Far Right Panel: AI Tutor (Collapsible Drawer) */}
        <div 
          className={`transition-all duration-300 ease-in-out overflow-hidden flex shrink-0 h-full ${
            aiTutorOpen ? 'w-[360px]' : 'w-0'
          }`}
        >
          <AIPanel />
        </div>

        {/* Floating AI Mentor Tab (Visible when drawer is closed) */}
        {!aiTutorOpen && (
          <button
            onClick={toggleAiTutor}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-[#1e293b] hover:bg-[#334155] border border-r-0 border-slate-700/85 rounded-l-xl px-2.5 py-4 flex flex-col items-center gap-2 shadow-2xl z-30 group transition-all cursor-pointer hover:pl-3.5 text-blue-400 hover:text-blue-300"
            title="Open AI Mentor Drawer"
          >
            <Sparkles size={14} className="animate-pulse group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-lr] select-none text-slate-300 group-hover:text-white">
              AI Mentor
            </span>
          </button>
        )}
      </main>

    </div>
  );
}
