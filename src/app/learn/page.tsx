'use client';

import React from 'react';
import Navbar from '../../components/Navbar';
import Editor from '../../components/editor/Editor';
import VisualizerCanvas from '../../components/visualizer/VisualizerCanvas';
import PlaybackControls from '../../components/controls/PlaybackControls';
import AIPanel from '../../components/ai/AIPanel';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { Terminal } from 'lucide-react';

export default function LearnIDE() {
  const { stdout } = useCodeFlowStore();

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
            <div className="h-[120px] bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shrink-0 shadow-lg">
              <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-850 flex items-center space-x-1.5 text-slate-400">
                <Terminal size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Stdout Console</span>
              </div>
              
              <pre className="flex-1 p-3 overflow-y-auto font-mono text-xs text-emerald-400 bg-slate-950/70 select-text leading-relaxed">
                {stdout || 'Console output will appear here when the program prints...'}
              </pre>
            </div>
            
          </div>
        </div>

        {/* Far Right Panel: AI Tutor */}
        <AIPanel />

      </main>

      {/* Playback Controls Bar */}
      <PlaybackControls />
    </div>
  );
}
