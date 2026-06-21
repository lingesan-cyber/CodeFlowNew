'use client';

import React, { useState, useEffect } from 'react';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { useAIExplanation } from '../../hooks/useAI';
import { Sparkles, HelpCircle, ArrowUpRight, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { ExecutionContext } from '../../ai/types';

export default function AIPanel() {
  const {
    code,
    language,
    steps,
    currentStepIndex,
    executionError
  } = useCodeFlowStore();

  const { response, loading, error, fetchExplanation, clear } = useAIExplanation();
  const [activeTab, setActiveTab] = useState<'explain' | 'hint' | 'quiz'>('explain');
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [quizChecked, setQuizChecked] = useState(false);

  // Re-fetch explain when step changes and user has "auto-explain" toggled or has already requested
  const handleFetch = async (feature: 'explain_step' | 'explain_error' | 'hint' | 'quiz') => {
    setSelectedQuizOption(null);
    setQuizChecked(false);
    
    // Create execution context
    const currentStep = steps[currentStepIndex];
    if (!currentStep && !executionError) return;

    const context: ExecutionContext = {
      code,
      lineNumber: currentStep ? currentStep.lineNumber : (executionError?.line || 1),
      operation: currentStep ? currentStep.operation : 'error',
      variables: currentStep ? currentStep.variables : [],
      callStack: currentStep ? currentStep.callStack : [],
      stdout: currentStep ? currentStep.stdout : '',
      error: executionError || undefined
    };

    await fetchExplanation(context, language, feature);
  };

  useEffect(() => {
    clear();
  }, [currentStepIndex, language, clear]);

  // Clean quiz display helper
  const parseQuiz = (rawText: string) => {
    // If it's a quiz, standard Ollama/OpenAI prompt will return plain text format:
    // Question: What is ... ?
    // A) ...
    // B) ...
    // C) ...
    // D) ...
    // Correct Answer: A
    // Let's parse it safely
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const questionLines: string[] = [];
    const options: string[] = [];
    let correctAnswer = '';

    lines.forEach(line => {
      if (line.startsWith('Question:') || line.toLowerCase().includes('what will') || line.endsWith('?')) {
        questionLines.push(line.replace('Question:', '').trim());
      } else if (/^[A-D]\)/i.test(line) || /^[A-D]\./i.test(line)) {
        options.push(line);
      } else if (line.toLowerCase().startsWith('correct answer:') || line.toLowerCase().startsWith('answer:')) {
        correctAnswer = line.replace(/correct answer:/i, '').replace(/answer:/i, '').trim();
      } else if (options.length === 0) {
        questionLines.push(line);
      }
    });

    // Default options if parsing fails
    const finalOptions = options.length > 0 ? options : [
      'A) It updates correctly',
      'B) Syntax error',
      'C) Loop runs infinitely',
      'D) Stays unchanged'
    ];

    return {
      question: questionLines.join(' ') || 'What will be the state of variables in the next step?',
      options: finalOptions,
      answer: correctAnswer || 'A'
    };
  };

  const renderQuizContent = () => {
    if (!response) return null;
    const { question, options, answer } = parseQuiz(response.explanation);

    const handleOptionSelect = (idx: number) => {
      if (quizChecked) return;
      setSelectedQuizOption(idx);
    };

    const handleCheck = () => {
      setQuizChecked(true);
    };

    // Deduce correct index (A -> 0, B -> 1, C -> 2, D -> 3)
    const match = answer.match(/[A-D]/i);
    const correctIdx = match ? match[0].toUpperCase().charCodeAt(0) - 65 : 0;

    return (
      <div className="flex flex-col space-y-4">
        <h4 className="text-sm font-medium text-slate-200 leading-snug">
          {question}
        </h4>

        <div className="flex flex-col space-y-2">
          {options.map((opt, idx) => {
            const isSelected = selectedQuizOption === idx;
            const isCorrect = idx === correctIdx;
            const isWrong = isSelected && !isCorrect;

            let optClass = 'bg-slate-800 border-slate-700/60 hover:bg-slate-750 text-slate-300';
            if (isSelected) optClass = 'bg-blue-600/20 border-blue-500 text-blue-300';
            if (quizChecked) {
              if (isCorrect) optClass = 'bg-green-600/20 border-green-500 text-green-300 font-medium';
              if (isWrong) optClass = 'bg-red-600/20 border-red-500 text-red-300';
            }

            return (
              <button
                key={idx}
                onClick={() => handleOptionSelect(idx)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-xs font-mono transition-all duration-200 cursor-pointer ${optClass}`}
              >
                <div className="flex items-center justify-between">
                  <span>{opt}</span>
                  {quizChecked && isCorrect && <CheckCircle2 size={14} className="text-green-400 shrink-0 ml-2" />}
                  {quizChecked && isWrong && <XCircle size={14} className="text-red-400 shrink-0 ml-2" />}
                </div>
              </button>
            );
          })}
        </div>

        {!quizChecked ? (
          <button
            onClick={handleCheck}
            disabled={selectedQuizOption === null}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 active:scale-95 text-white text-xs font-bold py-2 rounded-lg transition-all duration-200 shadow-md cursor-pointer"
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={() => handleFetch('quiz')}
            className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold py-2 rounded-lg transition-all duration-200 border border-slate-700 cursor-pointer"
          >
            Next Quiz Question
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-[340px] bg-[#1E293B] border-l border-slate-800 flex flex-col h-full overflow-hidden shrink-0 shadow-2xl">
      {/* Header bar */}
      <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center space-x-2 text-blue-400">
        <Sparkles size={18} className="animate-pulse" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
          AI Programming Tutor
        </h2>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-950/40 border-b border-slate-850 p-1">
        {(['explain', 'hint', 'quiz'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); clear(); }}
            className={`flex-1 py-2 text-center text-xs font-semibold rounded-md transition-all duration-200 capitalize cursor-pointer ${
              activeTab === tab
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tutor Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
        
        {/* Loading Spinner */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="text-blue-500 animate-spin" size={32} />
            <span className="text-xs text-slate-400 font-medium">Consulting AI model...</span>
          </div>
        ) : error ? (
          // Error Message fallback
          <div className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-2">
            <AlertCircle className="text-red-500" size={32} />
            <span className="text-xs font-semibold text-slate-300">AI Tutor Connection Failed</span>
            <span className="text-[11px] text-slate-500 leading-snug">{error}</span>
            <button
              onClick={() => handleFetch(activeTab === 'explain' ? 'explain_step' : activeTab === 'hint' ? 'hint' : 'quiz')}
              className="mt-2 px-3 py-1.5 bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg hover:bg-slate-750 transition-all cursor-pointer"
            >
              Retry Request
            </button>
          </div>
        ) : response ? (
          // Display Response Content
          <div className="flex-1 flex flex-col justify-between h-full">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 leading-relaxed text-slate-300 text-xs font-sans shadow-inner">
              {activeTab === 'quiz' ? (
                renderQuizContent()
              ) : (
                <p className="whitespace-pre-line leading-relaxed">{response.explanation}</p>
              )}
            </div>

            {/* Quick Action footer */}
            <div className="mt-4 pt-4 border-t border-slate-850 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>{response.provider.toUpperCase()} : {response.model}</span>
              <span>{response.latencyMs}ms latency</span>
            </div>
          </div>
        ) : (
          // Empty State Prompting
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-850 border border-slate-800 flex items-center justify-center text-slate-400">
              {activeTab === 'explain' ? <Sparkles size={22} /> : activeTab === 'hint' ? <HelpCircle size={22} /> : <ArrowUpRight size={22} />}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {activeTab === 'explain' ? 'Explain execution step' : activeTab === 'hint' ? 'Get a Hint' : 'Test Knowledge'}
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed max-w-[220px] mx-auto">
                {activeTab === 'explain' 
                  ? 'Request a concise description of the active variable allocations and stack step.' 
                  : activeTab === 'hint' 
                    ? 'Get a subtle push from the AI on what parameters to check or statement logic.' 
                    : 'Generate a short conceptual code verification multiple-choice question.'}
              </p>
            </div>

            {executionError && activeTab === 'explain' ? (
              <button
                onClick={() => handleFetch('explain_error')}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold rounded-lg shadow-md cursor-pointer transition-all"
              >
                Explain Compilation Error
              </button>
            ) : (
              <button
                onClick={() => handleFetch(activeTab === 'explain' ? 'explain_step' : activeTab === 'hint' ? 'hint' : 'quiz')}
                disabled={steps.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-md cursor-pointer transition-all"
              >
                Ask Tutor
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
