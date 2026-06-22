'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Terminal, Activity, GraduationCap, Sparkles } from 'lucide-react';
import { useCodeFlowStore } from '../store/useCodeFlowStore';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { aiTutorOpen, toggleAiTutor, setAiTutorOpen } = useCodeFlowStore();
  const [aiStatus, setAiStatus] = useState<{ available: boolean; provider: string; model: string } | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/ai/health');
        if (res.ok) {
          const data = await res.json();
          setAiStatus(data);
        }
      } catch {
        setAiStatus({ available: false, provider: 'none', model: 'none' });
      }
    };
    checkHealth();
    // Check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 relative z-10">
      
      {/* Brand Logo */}
      <Link href="/" className="flex items-center space-x-2 text-white hover:opacity-90 transition-opacity">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Terminal size={18} className="text-white" />
        </div>
        <div>
          <span className="font-bold text-sm tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            CodeFlow
          </span>
          <span className="text-[9px] text-blue-400 font-bold block -mt-1 tracking-widest uppercase">
            Visual Learning IDE
          </span>
        </div>
      </Link>

      {/* Navigation items */}
      <nav className="flex items-center space-x-1" aria-label="Main Navigation">
        <Link 
          href="/learn" 
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
            pathname === '/learn' && !aiTutorOpen
              ? 'bg-blue-600/10 text-blue-400'
              : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
          }`}
        >
          <GraduationCap size={15} />
          <span>Learn IDE</span>
        </Link>
        <button 
          onClick={() => {
            if (pathname !== '/learn') {
              setAiTutorOpen(true);
              router.push('/learn');
            } else {
              toggleAiTutor();
            }
          }}
          className={`flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
            pathname === '/learn' && aiTutorOpen
              ? 'bg-blue-600/10 text-blue-400'
              : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
          }`}
        >
          <Sparkles size={14} className={aiTutorOpen ? 'text-blue-400' : 'text-slate-400'} />
          <span>AI Mentor</span>
        </button>
      </nav>

      {/* AI Health Badge */}
      <div className="flex items-center space-x-4">
        {aiStatus && (
          <div 
            className={`flex items-center space-x-1.5 px-2.5 py-1 border rounded-full text-[10px] font-medium tracking-wide transition-all ${
              aiStatus.available
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
            title={`Active Provider: ${aiStatus.provider} | Model: ${aiStatus.model}`}
          >
            <Activity size={10} className={aiStatus.available ? 'animate-pulse' : ''} />
            <span className="uppercase">{aiStatus.available ? 'AI Tutor Online' : 'AI Offline'}</span>
          </div>
        )}
      </div>

    </header>
  );
}
