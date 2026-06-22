'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, Cpu, Layers, Sparkles, Play, RotateCcw } from 'lucide-react';

interface ExecutionStep {
  line: number;
  explanation: string;
  stack: Array<{ name: string; value: string; address?: string }>;
  heap: Array<{ address: string; type: string; value: string; highlight?: boolean }>;
  console: string;
  pointer: { fromId: string; toId: string; label?: string } | null;
}

export default function MockIDEPreview() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const steps: ExecutionStep[] = [
    {
      line: 2,
      explanation: "An array `arr` is allocated on the Heap at address #H824. A reference pointer is stored in stack memory.",
      stack: [
        { name: 'arr', value: 'pointer → #H824', address: '#S001' }
      ],
      heap: [
        { address: '#H824', type: 'Array(2)', value: '[10, 20]' }
      ],
      console: '',
      pointer: { fromId: 'stack-arr', toId: 'heap-H824', label: 'ref' }
    },
    {
      line: 3,
      explanation: "The value at index 0 (10) is read from the heap array and stored in the local stack variable `temp`.",
      stack: [
        { name: 'arr', value: 'pointer → #H824', address: '#S001' },
        { name: 'temp', value: '10', address: '#S002' }
      ],
      heap: [
        { address: '#H824', type: 'Array(2)', value: '[10, 20]', highlight: true }
      ],
      console: '',
      pointer: { fromId: 'stack-arr', toId: 'heap-H824' }
    },
    {
      line: 4,
      explanation: "The value at index 1 (20) is written into index 0 of the heap array. The array is updated to [20, 20].",
      stack: [
        { name: 'arr', value: 'pointer → #H824', address: '#S001' },
        { name: 'temp', value: '10', address: '#S002' }
      ],
      heap: [
        { address: '#H824', type: 'Array(2)', value: '[20, 20]', highlight: true }
      ],
      console: '',
      pointer: { fromId: 'stack-arr', toId: 'heap-H824' }
    },
    {
      line: 5,
      explanation: "The cached value in `temp` (10) is copied into index 1 of the heap array. The array is now [20, 10].",
      stack: [
        { name: 'arr', value: 'pointer → #H824', address: '#S001' },
        { name: 'temp', value: '10', address: '#S002' }
      ],
      heap: [
        { address: '#H824', type: 'Array(2)', value: '[20, 10]', highlight: true }
      ],
      console: '',
      pointer: { fromId: 'stack-arr', toId: 'heap-H824' }
    },
    {
      line: 6,
      explanation: "`console.log` dereferences `arr` to read the heap array and prints the reversed values [20, 10] to the console.",
      stack: [
        { name: 'arr', value: 'pointer → #H824', address: '#S001' },
        { name: 'temp', value: '10', address: '#S002' }
      ],
      heap: [
        { address: '#H824', type: 'Array(2)', value: '[20, 10]' }
      ],
      console: '> [20, 10]\n> Program terminated successfully.',
      pointer: { fromId: 'stack-arr', toId: 'heap-H824' }
    }
  ];

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % (steps.length + 1));
    }, 2800);

    return () => clearInterval(timer);
  }, [isPlaying, steps.length]);

  const activeStep = currentStep < steps.length ? steps[currentStep] : null;

  const codeLines = [
    { num: 1, text: '// In-place Swapping Algorithm' },
    { num: 2, text: 'let arr = [10, 20];' },
    { num: 3, text: 'let temp = arr[0];' },
    { num: 4, text: 'arr[0] = arr[1];' },
    { num: 5, text: 'arr[1] = temp;' },
    { num: 6, text: 'console.log(arr);' }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl glass-panel border border-slate-800 shadow-2xl overflow-hidden animate-float">
      
      {/* Top Bar / Window Controls */}
      <div className="h-10 bg-slate-950/60 border-b border-slate-900 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
          <span className="text-[11px] font-mono text-slate-500 ml-4">interactive_memory_tracer.js</span>
        </div>
        
        {/* Playback Actions */}
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center space-x-1 px-2.5 py-0.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            <Play size={10} className={isPlaying ? 'animate-pulse' : ''} />
            <span>{isPlaying ? 'Live' : 'Paused'}</span>
          </button>
          <button 
            onClick={() => setCurrentStep(0)}
            className="p-1 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded transition-all"
            title="Reset Simulation"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px] bg-slate-950/20">
        
        {/* Code Editor Panel (5 cols) */}
        <div className="md:col-span-5 border-r border-slate-900 p-5 flex flex-col justify-between bg-slate-950/30">
          <div>
            <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-4">
              <Cpu size={12} className="text-blue-500" />
              <span>AST Stack Tracer</span>
            </div>
            
            {/* Editor Lines */}
            <div className="font-mono text-xs md:text-sm space-y-2 relative">
              {codeLines.map((line) => {
                const isActive = activeStep && activeStep.line === line.num;
                return (
                  <div 
                    key={line.num} 
                    className={`flex items-center px-2.5 py-1 rounded transition-all duration-300 ${
                      isActive 
                        ? 'bg-blue-500/10 border-l-2 border-blue-500 text-blue-300 font-semibold shadow-inner' 
                        : 'text-slate-400 border-l-2 border-transparent'
                    }`}
                  >
                    <span className="w-5 text-slate-600 select-none text-right mr-3 text-[10px]">{line.num}</span>
                    <span className="whitespace-pre">{line.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Explanation Sub-Panel */}
          <div className="mt-6 p-3.5 bg-blue-950/20 border border-blue-900/30 rounded-xl flex items-start space-x-2.5">
            <Sparkles size={16} className="text-blue-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block mb-1">AI Tutor Prompt</span>
              <p className="text-xs text-slate-300 leading-relaxed min-h-[48px] transition-all duration-500">
                {activeStep ? activeStep.explanation : "Execution finished. Rewinding step-by-step trace..."}
              </p>
            </div>
          </div>
        </div>

        {/* Visual Memory Model Canvas (7 cols) */}
        <div className="md:col-span-7 p-5 flex flex-col justify-between min-h-[300px] relative">
          
          {/* Header */}
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-4 border-b border-slate-900 pb-2">
            <div className="flex items-center space-x-1.5">
              <Layers size={12} className="text-emerald-500" />
              <span>Interactive Memory Map</span>
            </div>
            <span className="text-[9px] font-mono text-slate-600">Runtime Address Resolution</span>
          </div>

          {/* Memory Columns Container */}
          <div className="flex-1 grid grid-cols-2 gap-4 relative py-2">
            
            {/* SVG Connecting Pointers */}
            {activeStep && activeStep.pointer && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#3B82F6" />
                  </marker>
                </defs>
                {/* Simulated pointer arrow from stack column to heap column */}
                <path
                  d="M 125,55 C 160,55 190,55 220,55"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2"
                  markerEnd="url(#arrow)"
                  className="animate-draw-pointer"
                />
              </svg>
            )}

            {/* Stack Segment */}
            <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3 font-mono text-center border-b border-slate-850/60 pb-1.5">
                Stack Call Frame
              </span>
              
              <div className="flex-1 flex flex-col justify-start space-y-2.5">
                {activeStep && activeStep.stack.map((item, idx) => (
                  <div 
                    key={idx}
                    id={`stack-${item.name}`}
                    className="p-2 bg-slate-950 border border-slate-850/80 hover:border-blue-500/40 rounded-lg flex items-center justify-between text-xs transition-all duration-300 relative group overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                    <div className="pl-1">
                      <span className="font-mono text-slate-500 text-[9px] block uppercase leading-none mb-0.5">{item.address}</span>
                      <span className="font-bold text-slate-200 font-mono">{item.name}</span>
                    </div>
                    <span className="font-mono text-[10px] bg-slate-900 px-2 py-1 rounded text-blue-400 border border-slate-800">
                      {item.value}
                    </span>
                  </div>
                ))}
                
                {(!activeStep || activeStep.stack.length === 0) && (
                  <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800/80 rounded-lg p-4">
                    <span className="text-[10px] text-slate-600 font-mono">Frame Empty</span>
                  </div>
                )}
              </div>
            </div>

            {/* Heap Segment */}
            <div className="bg-slate-900/40 border border-slate-850 rounded-xl p-3 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3 font-mono text-center border-b border-slate-850/60 pb-1.5">
                Heap Objects
              </span>
              
              <div className="flex-1 flex flex-col justify-start space-y-2.5">
                {activeStep && activeStep.heap.map((item, idx) => (
                  <div 
                    key={idx}
                    id={`heap-${item.address.replace('#', '')}`}
                    className={`p-2 bg-slate-950 border rounded-lg flex flex-col justify-between text-xs transition-all duration-300 relative group overflow-hidden ${
                      item.highlight ? 'border-emerald-500 bg-emerald-950/5 ring-1 ring-emerald-500/20' : 'border-slate-850/80'
                    }`}
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full ${item.highlight ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                    <div className="pl-1 flex justify-between items-center mb-1">
                      <span className="font-mono text-[10px] font-bold text-emerald-400">{item.address}</span>
                      <span className="text-[8px] font-mono text-slate-500 uppercase bg-slate-900 px-1 rounded">{item.type}</span>
                    </div>
                    <span className="font-mono font-bold text-center text-sm py-1 text-slate-100 bg-slate-950 rounded tracking-widest border border-slate-900/60">
                      {item.value}
                    </span>
                  </div>
                ))}

                {(!activeStep || activeStep.heap.length === 0) && (
                  <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800/80 rounded-lg p-4">
                    <span className="text-[10px] text-slate-600 font-mono">No Heap Allocations</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Console Output Panel */}
          <div className="mt-4 bg-slate-950 border border-slate-900 rounded-xl overflow-hidden shrink-0 shadow-lg">
            <div className="px-3.5 py-1.5 bg-slate-950/80 border-b border-slate-900 flex items-center justify-between text-slate-400">
              <div className="flex items-center space-x-1.5">
                <Terminal size={11} className="text-emerald-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Console Terminal</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            
            <pre className="p-3 font-mono text-[10px] text-emerald-400 min-h-[48px] bg-slate-950/90 leading-relaxed overflow-y-auto">
              {activeStep && activeStep.console ? activeStep.console : '> Waiting for stdout print...'}
            </pre>
          </div>

        </div>

      </div>

    </div>
  );
}
