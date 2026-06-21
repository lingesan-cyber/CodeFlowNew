import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { 
  Sparkles, Layers, ArrowRight, Cpu
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col bg-[#0F172A] text-slate-100 overflow-y-auto">
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-6 py-20 overflow-hidden max-w-5xl mx-auto z-10">
        
        {/* Glow decorative gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-[300px] h-[300px] bg-emerald-600/10 blur-[90px] rounded-full -z-10 pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-semibold mb-6 animate-fade-in select-none">
          <Sparkles size={12} className="animate-pulse" />
          <span>Interactive execution mapping is here</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent max-w-3xl mb-6">
          See Your Code Run in <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Real Time</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
          CodeFlow is a visual programming learning platform that executes Python, JavaScript, Java, C, and C++ step-by-step, maps stack memory pointers to heap addresses, and employs an AI tutor to explain every operation.
        </p>

        {/* Calls to Action */}
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <Link 
            href="/learn" 
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold px-8 py-4 rounded-xl shadow-xl shadow-blue-900/35 transition-all duration-200 cursor-pointer"
          >
            <span>Launch Visual IDE</span>
            <ArrowRight size={16} />
          </Link>
          <Link 
            href="/practice" 
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-850 hover:bg-slate-800 active:scale-95 text-slate-200 border border-slate-700/60 font-bold px-8 py-4 rounded-xl transition-all duration-200 cursor-pointer"
          >
            <span>Interactive Practice</span>
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-slate-950/40 border-t border-slate-900 py-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1 */}
          <div className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl flex flex-col space-y-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Cpu size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Common AST Execution
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Standardize syntax trees from five major programming languages. Step forward or backward through operations with Statement-level granularity.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl flex flex-col space-y-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Stack & Heap Pointer Maps
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Visualize dynamic stack call frames growing and shrinking. Draw pointers mapping variable cards on the stack directly to structural heap instances.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900/60 border border-slate-850 p-6 rounded-2xl flex flex-col space-y-3 shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles size={20} fill="currentColor" className="text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Unified AI Tutor
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Understand variable transformations instantly. Get hints, explanation tags, and conceptual multiple choice questions generated directly from code context.
            </p>
          </div>

        </div>
      </section>

      {/* Mini CTA footer */}
      <footer className="py-6 border-t border-slate-900/60 text-center text-[10px] text-slate-500 tracking-wider font-mono uppercase bg-slate-950">
        CodeFlow Project — Pair Programming Solution
      </footer>
    </div>
  );
}
