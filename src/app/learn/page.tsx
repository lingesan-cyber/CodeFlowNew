'use client';

import React, { useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Editor from '../../components/editor/Editor';
import VisualizerCanvas from '../../components/visualizer/VisualizerCanvas';
import AIPanel from '../../components/ai/AIPanel';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { Terminal, Sparkles } from 'lucide-react';

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
    jumpToEnd
  } = useCodeFlowStore();

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
            <div className="h-[220px] bg-slate-900 border border-slate-800/80 rounded-xl flex flex-col overflow-hidden shrink-0 shadow-lg">
              <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-850 flex items-center justify-between text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <Terminal size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {steps.length === 0 ? 'Stdout Console' : (currentStepIndex < steps.length - 1 ? 'Live Execution Monitor' : 'Program Output')}
                  </span>
                </div>
                {steps.length > 0 && (
                  <span className="text-[9px] font-mono text-slate-500 uppercase">
                    Step {currentStepIndex + 1} of {steps.length}
                  </span>
                )}
              </div>
              
              <div className="flex-1 flex overflow-hidden bg-slate-950/70 text-xs font-mono select-text">
                {steps.length === 0 ? (
                  // Initial Idle State
                  <div className="flex-1 p-3 text-slate-500">
                    Console output will appear here when the program prints...
                  </div>
                ) : currentStepIndex < steps.length - 1 ? (
                  // Running / Stepping State
                  (() => {
                    const currentStep = steps[currentStepIndex];
                    const explanationText = explanations[currentStepIndex];
                    const hasStdout = stdout && stdout.trim().length > 0;
                    
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

                    const renderExplanationColumn = () => (
                      <div className="flex-1 p-3 flex flex-col min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Execution Explanation</span>
                        <div className="flex-1 overflow-y-auto">
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
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-1">AI Explanation</span>
                              {explanationText}
                            </div>
                          )}
                        </div>
                      </div>
                    );

                    if (hasStdout) {
                      return (
                        <div className="flex-1 flex divide-x divide-slate-800/80">
                          {/* Left Column: Explanation */}
                          {renderExplanationColumn()}
                          {/* Right Column: Accumulated Output */}
                          <div className="flex-1 p-3 flex flex-col min-w-0 bg-slate-950/20">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Program Output</span>
                            <pre className="flex-1 overflow-y-auto text-emerald-400 leading-relaxed whitespace-pre-wrap select-text">
                              {stdout}
                            </pre>
                          </div>
                        </div>
                      );
                    } else {
                      return renderExplanationColumn();
                    }
                  })()
                ) : (
                  // Completed State
                  <div className="flex-1 p-3 flex flex-col min-w-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Program Output</span>
                    <pre className="flex-1 overflow-y-auto text-emerald-400 leading-relaxed whitespace-pre-wrap select-text">
                      {stdout || '(No program output)'}
                    </pre>
                  </div>
                )}
              </div>
            </div>
            
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
