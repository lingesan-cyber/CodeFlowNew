'use client';

import React from 'react';
import Navbar from '../../components/Navbar';
import Editor from '../../components/editor/Editor';
import VisualizerCanvas from '../../components/visualizer/VisualizerCanvas';
import PlaybackControls from '../../components/controls/PlaybackControls';
import AIPanel from '../../components/ai/AIPanel';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { Terminal, Sparkles } from 'lucide-react';

export default function LearnIDE() {
  const { stdout, currentStepIndex, steps, explanations, aiTutorOpen, toggleAiTutor } = useCodeFlowStore();

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
            <div className="h-[140px] bg-slate-900 border border-slate-800/80 rounded-xl flex flex-col overflow-hidden shrink-0 shadow-lg">
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
                    const explanationText = explanations[currentStepIndex] || 'Processing statement...';
                    const hasStdout = stdout && stdout.trim().length > 0;
                    
                    if (hasStdout) {
                      return (
                        <div className="flex-1 flex divide-x divide-slate-800/80">
                          {/* Left Column: Explanation */}
                          <div className="flex-1 p-3 flex flex-col min-w-0">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Execution Explanation</span>
                            <div className="flex-1 overflow-y-auto text-slate-300 leading-relaxed whitespace-pre-wrap">
                              {explanationText}
                            </div>
                          </div>
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
                      return (
                        <div className="flex-1 p-3 flex flex-col min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-1">Execution Explanation</span>
                          <div className="flex-1 overflow-y-auto text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {explanationText}
                          </div>
                        </div>
                      );
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

      {/* Playback Controls Bar */}
      <PlaybackControls />
    </div>
  );
}
