'use client';

import React, { useEffect } from 'react';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { 
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight 
} from 'lucide-react';

export default function PlaybackControls() {
  const {
    steps,
    currentStepIndex,
    playbackState,
    speed,
    awaitingInput,
    setCurrentStepIndex,
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
        // Speeds 1-5 keys
        case 'Digit1': setSpeed(0.25); break;
        case 'Digit2': setSpeed(0.5); break;
        case 'Digit3': setSpeed(1); break;
        case 'Digit4': setSpeed(2); break;
        case 'Digit5': setSpeed(4); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playbackState, stepBackward, stepForward, jumpToStart, jumpToEnd, setSpeed, setPlaybackState]);

  const totalSteps = steps.length;

  const speeds = [0.25, 0.5, 1, 2, 4, 8, 16];

  const handlePlayPause = () => {
    if (playbackState === 'playing') {
      setPlaybackState('paused');
    } else {
      if (playbackState === 'finished' || steps.length === 0) {
        useCodeFlowStore.getState().runCode();
      } else {
        setPlaybackState('playing');
      }
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    setCurrentStepIndex(idx);
  };

  const isControlsDisabled = awaitingInput !== null || steps.length === 0;

  return (
    <div className="h-[80px] bg-slate-900 border-t border-slate-800 px-6 py-2.5 flex items-center justify-between select-none relative z-10">
      
      {/* Playback Control Buttons */}
      <div className="flex items-center space-x-2">
        <button
          onClick={jumpToStart}
          disabled={isControlsDisabled}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all cursor-pointer"
          title="Jump to Start (Home)"
        >
          <SkipBack size={18} fill="currentColor" />
        </button>

        <button
          onClick={stepBackward}
          disabled={isControlsDisabled}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all cursor-pointer"
          title="Step Backward (Left Arrow)"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          onClick={handlePlayPause}
          disabled={awaitingInput !== null}
          className={`p-3 rounded-full text-white transition-all shadow-lg active:scale-95 cursor-pointer ${
            awaitingInput 
              ? 'bg-slate-700 opacity-60 shadow-none'
              : playbackState === 'playing'
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/35'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/35'
          }`}
          title={playbackState === 'playing' ? 'Pause (Space)' : 'Play (Space)'}
        >
          {awaitingInput ? (
            <span className="text-[10px] font-bold tracking-wider px-1">WAITING</span>
          ) : playbackState === 'playing' ? (
            <Pause size={18} fill="white" />
          ) : (
            <Play size={18} fill="white" />
          )}
        </button>

        <button
          onClick={stepForward}
          disabled={isControlsDisabled}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all cursor-pointer"
          title="Step Forward (Right Arrow)"
        >
          <ChevronRight size={18} />
        </button>

        <button
          onClick={jumpToEnd}
          disabled={isControlsDisabled}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all cursor-pointer"
          title="Jump to End (End)"
        >
          <SkipForward size={18} fill="currentColor" />
        </button>
      </div>

      {/* Scrubber Progress Bar */}
      <div className="flex-1 max-w-xl mx-8 flex flex-col space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Step {totalSteps > 0 ? currentStepIndex + 1 : 0} of {totalSteps}</span>
          <span className="truncate max-w-[280px]">
            {totalSteps > 0 && steps[currentStepIndex]
              ? `Line ${steps[currentStepIndex].lineNumber}: ${steps[currentStepIndex].description}`
              : 'Compile and Run code to start visual tracing'}
          </span>
        </div>

        <div className="relative flex items-center">
          <input
            type="range"
            min={0}
            max={totalSteps > 0 ? totalSteps - 1 : 0}
            value={currentStepIndex}
            onChange={handleProgressChange}
            disabled={totalSteps === 0 || awaitingInput !== null}
            className="w-full h-1.5 bg-slate-850 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Speed Slider Configuration */}
      <div className="flex items-center space-x-2">
        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Speed:</span>
        <div className="flex items-center space-x-0.5 bg-slate-850 border border-slate-800 rounded-lg p-0.5">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              disabled={awaitingInput !== null}
              className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-colors cursor-pointer ${
                speed === s
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
