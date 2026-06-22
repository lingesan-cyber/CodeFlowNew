'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { Sparkles, X, Code, Send, RefreshCw, MessageSquare } from 'lucide-react';

export default function AIPanel() {
  const {
    selectedItem,
    setSelectedItem,
    chatHistory,
    chatLoading,
    teachingMode,
    setTeachingMode,
    sendChatMessage,
    clearChat,
    reviewCode,
    setAiTutorOpen
  } = useCodeFlowStore();

  const [inputMessage, setInputMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Automatically scroll chat to bottom when message history changes or loader ticks
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !chatLoading) {
      sendChatMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const handleChipClick = (msg: string) => {
    if (!chatLoading) {
      sendChatMessage(msg);
    }
  };

  // Suggestion questions chips
  const suggestedQuestions = [
    'Explain this code',
    'Why did this happen?',
    'Explain recursion',
    'Find bugs',
    'Optimize code',
    'Explain stack vs heap',
    'What happens next?'
  ];

  return (
    <div className="w-[360px] bg-[#101622] border-l border-slate-800/80 flex flex-col h-full overflow-hidden shrink-0 shadow-2xl">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-850 flex items-center justify-between shrink-0 z-10 shadow-sm">
        <div className="flex items-center space-x-1.5 text-blue-400">
          <Sparkles size={16} className="animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">
            AI Programming Mentor
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Teaching Mode Dropdown */}
          <select
            value={teachingMode}
            onChange={(e) => setTeachingMode(e.target.value as typeof teachingMode)}
            title="Choose Teaching Mode"
            className="bg-slate-900 text-slate-300 border border-slate-800 rounded px-2 py-0.5 text-[10px] font-semibold focus:outline-none focus:border-blue-500 cursor-pointer capitalize"
          >
            <option value="beginner">Beginner Mode</option>
            <option value="intermediate">Intermediate Mode</option>
            <option value="advanced">Advanced Mode</option>
            <option value="interview">Interview Prep</option>
            <option value="debug">Debug Mode</option>
          </select>

          {/* Close Panel Button */}
          <button
            onClick={() => setAiTutorOpen(false)}
            title="Collapse AI Mentor Drawer"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Dismissible Selected Item Context Bar */}
      {selectedItem && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-slate-850/80 flex items-center justify-between text-[10px] shrink-0 z-10 animate-fade-in font-mono">
          <div className="flex items-center space-x-1.5 text-blue-400">
            <Code size={11} />
            <span className="font-bold capitalize">{selectedItem.type.replace('_', ' ')}:</span>
            <span className="text-slate-200 font-bold bg-slate-800/60 px-1 py-0.5 rounded">
              {selectedItem.name}
            </span>
          </div>
          <button 
            onClick={() => setSelectedItem(null)}
            title="Clear context selection"
            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded hover:bg-slate-800 cursor-pointer"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Chat Messages Log Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-4">
        {chatHistory.length === 0 ? (
          // Empty State Prompting
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-400 animate-float">
              <MessageSquare size={20} />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Ask your Programming Mentor
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-[240px] mx-auto">
                I am here to guide you conceptually, explain code execution states, recursion depth, and debug memory layout anomalies.
              </p>
            </div>

            <div className="pt-2 flex flex-col space-y-2 w-full max-w-[200px] mx-auto">
              <button
                onClick={() => reviewCode()}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs py-2 rounded-lg transition-all duration-200 shadow-md cursor-pointer flex items-center justify-center space-x-1.5 border border-blue-500/25"
              >
                <Sparkles size={11} />
                <span>Review My Code</span>
              </button>
            </div>
          </div>
        ) : (
          // Messages history list
          <div className="flex flex-col space-y-4">
            {chatHistory.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div 
                  key={index}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-scale-up`}
                >
                  <span className="text-[8px] font-bold text-slate-500 uppercase font-mono tracking-wider mb-1 px-1">
                    {isUser ? 'You' : `${teachingMode.toUpperCase()} MENTOR`}
                  </span>
                  <div 
                    className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm font-sans ${
                      isUser
                        ? 'bg-blue-600/10 border border-blue-500/25 text-slate-100 rounded-tr-none max-w-[85%] self-end'
                        : 'bg-slate-900 border border-slate-800/80 text-slate-300 rounded-tl-none max-w-[85%] self-start'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              );
            })}

            {/* Chat loading skeleton bubble */}
            {chatLoading && (
              <div className="flex flex-col items-start animate-pulse self-start max-w-[85%]">
                <span className="text-[8px] font-bold text-slate-500 uppercase font-mono tracking-wider mb-1 px-1">
                  Mentor is writing...
                </span>
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl rounded-tl-none px-4 py-3 flex items-center justify-center space-x-2">
                  <RefreshCw size={12} className="animate-spin text-slate-500" />
                  <span className="text-[10px] text-slate-500 font-mono">Formulating hint...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Suggested chips list (only when idle) */}
      <div className="px-3 pt-1.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto shrink-0 z-10 bg-slate-950/10">
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleChipClick(q)}
            disabled={chatLoading}
            className="text-[9px] text-slate-400 border border-slate-800/60 rounded-full px-2 py-0.5 hover:border-blue-500 hover:text-slate-200 transition-all cursor-pointer bg-slate-950/20 active:scale-95 shrink-0 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Message Footer form */}
      <div className="p-3 border-t border-slate-850 flex items-center space-x-2 shrink-0 z-10 bg-slate-950/30">
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={chatLoading}
            placeholder={
              selectedItem 
                ? `Ask about selected ${selectedItem.name}...`
                : "Ask about recursion, heap data, or type concept..."
            }
            className="flex-1 bg-slate-950 border border-slate-800/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25 transition-all font-sans placeholder-slate-600 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || chatLoading}
            title="Send message"
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/30 disabled:text-slate-500 text-white rounded-lg transition-colors cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
          >
            <Send size={12} />
          </button>
        </form>
        {chatHistory.length > 0 && (
          <button
            onClick={clearChat}
            title="Clear Conversation Logs"
            className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
