import React from 'react';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import MockIDEPreview from '../components/landing/MockIDEPreview';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex-1 flex flex-col bg-[#0b0f19] text-slate-100 overflow-y-auto relative bg-grid-pattern">
      <Navbar />

      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full -z-10 pointer-events-none animate-pulse-glow" style={{ transform: 'translate(-50%, -50%)' }} />
      <div className="absolute top-1/2 left-1/3 w-[450px] h-[450px] bg-indigo-600/10 rounded-full -z-10 pointer-events-none animate-pulse-glow" style={{ animationDelay: '-3s', transform: 'translate(-50%, -50%)' }} />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-emerald-600/10 rounded-full -z-10 pointer-events-none animate-pulse-glow" style={{ animationDelay: '-6s', transform: 'translate(-50%, -50%)' }} />

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center px-6 py-12 md:py-20 max-w-6xl mx-auto z-10 w-full">
        
        {/* Animated Badge */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-semibold mb-6 animate-fade-in select-none shadow-sm shadow-blue-500/5">
          <Sparkles size={12} className="animate-pulse text-blue-400" />
          <span>Interactive execution mapping is live</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight text-center max-w-4xl mb-6">
          See Your Code Run in{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-sm">
            Real Time
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-slate-400 max-w-2xl text-center leading-relaxed mb-10">
          CodeFlow is a visual programming environment that executes code step-by-step, maps stack memory pointers to heap addresses, and employs an AI tutor to explain every operation instantly.
        </p>

        {/* CTA Button */}
        <div className="flex justify-center mb-16 md:mb-20">
          <Link 
            href="/learn" 
            className="group relative inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-blue-900/30 transition-all duration-200 cursor-pointer overflow-hidden"
          >
            {/* Gloss shine effect on hover */}
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
            <span>Launch Visual IDE</span>
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Dynamic IDE Visualizer Simulation Section */}
        <div className="w-full flex flex-col items-center space-y-4">
          <div className="text-center mb-4">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Interactive Simulation</span>
            <h2 className="text-lg md:text-xl font-bold text-slate-200">How CodeFlow Maps Compiler Memory</h2>
          </div>
          
          <MockIDEPreview />
        </div>

      </main>

      {/* Mini CTA footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-[10px] text-slate-500 tracking-wider font-mono uppercase bg-[#0b0f19]/80 backdrop-blur-md">
        CodeFlow Project — Pair Programming Solution
      </footer>
    </div>
  );
}
