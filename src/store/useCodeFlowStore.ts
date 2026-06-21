import { create } from 'zustand';
import { ExecutionStep, SupportedLanguage, AwaitingInput, ExecutionError } from '../engine/types';
export type { SupportedLanguage };
import { ASTInterpreter } from '../engine/interpreter';

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'awaiting_input' | 'finished';
export type EditorStatus = 'ready' | 'running' | 'error' | 'finished';

interface CodeFlowState {
  // Code & Language Configuration
  code: string;
  language: SupportedLanguage;
  setCode: (code: string) => void;
  setLanguage: (lang: SupportedLanguage) => void;

  // Visualizer Execution Trace
  steps: ExecutionStep[];
  currentStepIndex: number;
  playbackState: PlaybackState;
  speed: number;
  stdout: string;
  awaitingInput: AwaitingInput | null;
  inputQueue: string[];
  breakpoints: number[];
  editorStatus: EditorStatus;
  executionError: ExecutionError | null;
  theme: 'light' | 'dark';

  // Actions
  toggleBreakpoint: (line: number) => void;
  setSpeed: (speed: number) => void;
  setPlaybackState: (state: PlaybackState) => void;
  toggleTheme: () => void;
  setCurrentStepIndex: (index: number) => void;
  queueInput: (val: string) => void;
  submitInput: (val: string) => void;

  // Run & Playback Control functions
  runCode: () => void;
  stopExecution: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
}

// Default starter programs
export const DEFAULT_PROGRAMS: Record<SupportedLanguage, string> = {
  python: `def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

x = fib(5)
print("Fibonacci result:", x)
`,
  javascript: `function processArray() {
  let arr = [1, 2, 3];
  let doubled = [];
  
  for (let i = 0; i < arr.length; i++) {
    doubled[i] = arr[i] * 2;
  }
  
  console.log("Doubled array:", doubled);
}

processArray();
`,
  java: `public class Main {
    public static void main(String[] args) {
        int limit = 4;
        int sum = 0;
        for (int i = 1; i <= limit; i++) {
            sum += i;
            System.out.println("Sum at step " + i + ": " + sum);
        }
    }
}
`,
  c: `int main() {
    int x = 42;
    int *p = &x;
    *p = 100;
    
    printf("Value of x via pointer deref: %d\\n", *p);
    
    int *arr = malloc(3 * sizeof(int));
    arr[0] = 10;
    arr[1] = 20;
    
    free(arr);
    return 0;
}
`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Vector simulated iteration:" << endl;
    int items[3] = {10, 20, 30};
    int sum = 0;
    for (int i = 0; i < 3; i++) {
        sum += items[i];
        cout << "Item: " << items[i] << " | Sum: " << sum << endl;
    }
    return 0;
}
`
};

let activeInterpreter: ASTInterpreter | null = null;
let activeGenerator: Generator<ExecutionStep, ExecutionStep[], string | undefined> | null = null;

export const useCodeFlowStore = create<CodeFlowState>((set, get) => ({
  code: DEFAULT_PROGRAMS.python,
  language: 'python',
  steps: [],
  currentStepIndex: 0,
  playbackState: 'idle',
  speed: 1,
  stdout: '',
  awaitingInput: null,
  inputQueue: [],
  breakpoints: [],
  editorStatus: 'ready',
  executionError: null,
  theme: 'dark',

  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ 
    language, 
    code: DEFAULT_PROGRAMS[language],
    steps: [],
    currentStepIndex: 0,
    playbackState: 'idle',
    stdout: '',
    awaitingInput: null,
    editorStatus: 'ready',
    executionError: null
  }),

  toggleBreakpoint: (line) => set((state) => ({
    breakpoints: state.breakpoints.includes(line)
      ? state.breakpoints.filter((l) => l !== line)
      : [...state.breakpoints, line]
  })),

  setSpeed: (speed) => set({ speed }),
  setPlaybackState: (playbackState) => set({ playbackState }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  
  setCurrentStepIndex: (index) => {
    const { steps } = get();
    if (index >= 0 && index < steps.length) {
      set({ 
        currentStepIndex: index,
        stdout: steps[index].stdout
      });
    }
  },

  queueInput: (val) => set((state) => ({
    inputQueue: [...state.inputQueue, val]
  })),

  submitInput: (val) => {
    const { awaitingInput, playbackState } = get();
    if (!awaitingInput) return;

    set({ awaitingInput: null });

    // Resume generator execution with input value
    if (activeGenerator) {
      try {
        const nextStep = activeGenerator.next(val);
        const currentSteps = [...get().steps];
        
        if (nextStep.done) {
          set({ 
            playbackState: 'finished',
            editorStatus: 'finished'
          });
          activeGenerator = null;
          activeInterpreter = null;
        } else {
          const step: ExecutionStep = nextStep.value;
          currentSteps.push(step);
          set({ 
            steps: currentSteps, 
            currentStepIndex: currentSteps.length - 1,
            stdout: step.stdout
          });

          if (step.awaitingInput) {
            set({ 
              awaitingInput: step.awaitingInput, 
              playbackState: 'awaiting_input' 
            });
          } else {
            // Auto resume if it was playing
            set({ playbackState: playbackState === 'awaiting_input' ? 'playing' : playbackState });
          }
        }
      } catch (err) {
        set({ 
          playbackState: 'idle',
          editorStatus: 'error',
          executionError: { message: err instanceof Error ? err.message : 'Error during resume', line: 1 }
        });
      }
    }
  },

  runCode: () => {
    const { code, language } = get();
    set({
      steps: [],
      currentStepIndex: 0,
      playbackState: 'playing',
      editorStatus: 'running',
      stdout: '',
      awaitingInput: null,
      executionError: null
    });

    try {
      // Initialize interpreter and compiler
      activeInterpreter = new ASTInterpreter(code, language);
      activeGenerator = activeInterpreter.run();

      const initialSteps: ExecutionStep[] = [];
      
      // Let's run initial statements until finished, error, or awaiting input
      const runNext = () => {
        if (!activeGenerator) return;

        // Check preloaded input queue
        const nextInput = get().inputQueue.length > 0 ? get().inputQueue[0] : undefined;
        let dequeued = false;

        const result = activeGenerator.next(nextInput);
        if (!result.done && nextInput !== undefined && result.value.awaitingInput) {
          // Dequeue
          set((state) => ({ inputQueue: state.inputQueue.slice(1) }));
          dequeued = true;
        }

        if (result.done) {
          set({ 
            playbackState: 'finished',
            editorStatus: 'finished'
          });
          activeGenerator = null;
          activeInterpreter = null;
        } else {
          const step: ExecutionStep = result.value;
          initialSteps.push(step);
          
          set({ 
            steps: [...initialSteps],
            currentStepIndex: initialSteps.length - 1,
            stdout: step.stdout
          });

          // Check if breakpoint is hit (only pause if we are past first statement)
          const breakpoints = get().breakpoints;
          const hitBreakpoint = breakpoints.includes(step.lineNumber) && initialSteps.length > 1;

          if (step.awaitingInput && !dequeued) {
            set({ 
              awaitingInput: step.awaitingInput,
              playbackState: 'awaiting_input'
            });
          } else if (hitBreakpoint) {
            set({ playbackState: 'paused' });
          } else {
            // Schedule next execution step if playing
            if (get().playbackState === 'playing') {
              setTimeout(runNext, 50); // Small interval for background trace updates
            }
          }
        }
      };

      runNext();

    } catch (err) {
      set({
        playbackState: 'idle',
        editorStatus: 'error',
        executionError: { message: err instanceof Error ? err.message : 'Compilation/Syntax Error', line: 1 }
      });
    }
  },

  stopExecution: () => {
    activeGenerator = null;
    activeInterpreter = null;
    set({
      playbackState: 'idle',
      editorStatus: 'ready',
      awaitingInput: null,
      steps: [],
      currentStepIndex: 0,
      stdout: ''
    });
  },

  stepForward: () => {
    const { currentStepIndex, steps, playbackState } = get();
    if (playbackState === 'awaiting_input') return;

    if (currentStepIndex < steps.length - 1) {
      set({ 
        currentStepIndex: currentStepIndex + 1,
        stdout: steps[currentStepIndex + 1].stdout
      });
    } else if (activeGenerator) {
      // Generate next step on demand
      try {
        const nextStep = activeGenerator.next();
        if (nextStep.done) {
          set({ 
            playbackState: 'finished',
            editorStatus: 'finished'
          });
          activeGenerator = null;
          activeInterpreter = null;
        } else {
          const step: ExecutionStep = nextStep.value;
          const newSteps = [...steps, step];
          set({
            steps: newSteps,
            currentStepIndex: newSteps.length - 1,
            stdout: step.stdout
          });

          if (step.awaitingInput) {
            set({ 
              awaitingInput: step.awaitingInput,
              playbackState: 'awaiting_input'
            });
          }
        }
      } catch (err) {
        set({
          editorStatus: 'error',
          executionError: { message: err instanceof Error ? err.message : 'Execution error', line: 1 }
        });
      }
    }
  },

  stepBackward: () => {
    const { currentStepIndex, steps, playbackState } = get();
    if (playbackState === 'awaiting_input') return;

    if (currentStepIndex > 0) {
      set({ 
        currentStepIndex: currentStepIndex - 1,
        stdout: steps[currentStepIndex - 1].stdout
      });
    }
  },

  jumpToStart: () => {
    const { steps } = get();
    if (steps.length > 0) {
      set({ 
        currentStepIndex: 0,
        stdout: steps[0].stdout
      });
    }
  },

  jumpToEnd: () => {
    const { steps } = get();
    if (steps.length > 0) {
      set({ 
        currentStepIndex: steps.length - 1,
        stdout: steps[steps.length - 1].stdout
      });
    }
  }
}));
