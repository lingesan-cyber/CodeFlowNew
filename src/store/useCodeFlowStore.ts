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

  // AI Preloaded Explanations
  explanations: Record<number, string>;
  explanationsLoading: boolean;
  explanationsError: string | null;
  fetchBatchExplanations: () => Promise<void>;

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

  // Conversational AI Tutor & Selection Context
  selectedItem: { name: string; type: 'variable' | 'array_element' | 'frame'; details?: string } | null;
  chatHistory: { role: 'user' | 'assistant'; content: string }[];
  teachingMode: 'beginner' | 'intermediate' | 'advanced' | 'interview' | 'debug';
  chatLoading: boolean;
  setSelectedItem: (item: { name: string; type: 'variable' | 'array_element' | 'frame'; details?: string } | null) => void;
  setTeachingMode: (mode: 'beginner' | 'intermediate' | 'advanced' | 'interview' | 'debug') => void;
  clearChat: () => void;
  sendChatMessage: (msg: string) => Promise<void>;
  reviewCode: () => Promise<void>;

  // AI Tutor Panel Drawer State
  aiTutorOpen: boolean;
  toggleAiTutor: () => void;
  setAiTutorOpen: (open: boolean) => void;
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

const logStepTransition = (oldIdx: number, newIdx: number, speed: number) => {
  const delay = 1000 / speed;
  console.log(`[Playback Engine] Selected Speed: ${speed}x | Calculated Delay: ${delay}ms | Step Transition: ${oldIdx} -> ${newIdx} | Timestamp: ${new Date().toISOString()}`);
};

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

  explanations: {},
  explanationsLoading: false,
  explanationsError: null,

  selectedItem: null,
  chatHistory: [],
  teachingMode: 'beginner',
  chatLoading: false,
  aiTutorOpen: false,

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
    executionError: null,
    explanations: {},
    explanationsLoading: false,
    explanationsError: null,
    selectedItem: null,
    chatHistory: [],
    chatLoading: false
  }),

  fetchBatchExplanations: async () => {
    const { steps, code, language, explanationsLoading } = get();
    if (steps.length === 0 || explanationsLoading) return;

    set({ explanationsLoading: true, explanationsError: null });

    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'explain_batch',
          language,
          context: {
            code,
            lineNumber: 1,
            operation: 'system',
            variables: [],
            callStack: [],
            stdout: ''
          },
          trace: steps
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch batch explanations');
      }

      const data = await response.json();
      let parsedExplanations: string[] = [];
      try {
        parsedExplanations = JSON.parse(data.explanation);
      } catch {
        const cleaned = data.explanation.replace(/```json/g, '').replace(/```/g, '').trim();
        parsedExplanations = JSON.parse(cleaned);
      }

      const explanationsMap: Record<number, string> = {};
      parsedExplanations.forEach((exp: string, idx: number) => {
        explanationsMap[idx] = exp;
      });

      console.log("=== PROCESSED EXPLANATIONS ===");
      console.log(explanationsMap);
      console.log("==============================");

      set({
        explanations: explanationsMap,
        explanationsLoading: false
      });
    } catch (err) {
      console.error(err);
      set({
        explanationsError: err instanceof Error ? err.message : 'Failed to preload explanations',
        explanationsLoading: false
      });
    }
  },

  toggleBreakpoint: (line) => set((state) => ({
    breakpoints: state.breakpoints.includes(line)
      ? state.breakpoints.filter((l) => l !== line)
      : [...state.breakpoints, line]
  })),

  setSpeed: (speed) => set({ speed }),
  setPlaybackState: (playbackState) => set({ playbackState }),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
  
  setCurrentStepIndex: (index) => {
    const { steps, currentStepIndex, speed } = get();
    if (index >= 0 && index < steps.length) {
      logStepTransition(currentStepIndex, index, speed);
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
    const { awaitingInput, steps } = get();
    if (!awaitingInput) return;

    set({ awaitingInput: null });

    // Resume generator execution with input value
    if (activeGenerator) {
      try {
        let currentInputQueue = [...get().inputQueue];
        let result = activeGenerator.next(val);
        const newSteps = [...steps];
        
        while (!result.done) {
          const step = result.value;
          newSteps.push(step);
          
          if (step.awaitingInput) {
            if (currentInputQueue.length > 0) {
              const nextInputVal = currentInputQueue[0];
              currentInputQueue = currentInputQueue.slice(1);
              set({ inputQueue: currentInputQueue });
              result = activeGenerator.next(nextInputVal);
              continue;
            } else {
              break;
            }
          }
          result = activeGenerator.next();
        }

        set({ 
          steps: newSteps,
          playbackState: 'playing'
        });

        if (result.done) {
          set({ 
            editorStatus: 'finished'
          });
          activeGenerator = null;
          activeInterpreter = null;
          get().fetchBatchExplanations();
        }

        get().stepForward();

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
      executionError: null,
      explanations: {},
      explanationsLoading: false,
      explanationsError: null,
      selectedItem: null,
      chatHistory: [],
      chatLoading: false
    });

    try {
      // Initialize interpreter and compiler
      activeInterpreter = new ASTInterpreter(code, language);
      activeGenerator = activeInterpreter.run();

      const generatedSteps: ExecutionStep[] = [];
      let currentInputQueue = [...get().inputQueue];
      let result = activeGenerator.next();
      
      while (!result.done) {
        const step = result.value;
        generatedSteps.push(step);
        
        if (step.awaitingInput) {
          if (currentInputQueue.length > 0) {
            const nextInputVal = currentInputQueue[0];
            currentInputQueue = currentInputQueue.slice(1);
            set({ inputQueue: currentInputQueue });
            result = activeGenerator.next(nextInputVal);
            continue;
          } else {
            break;
          }
        }
        result = activeGenerator.next();
      }

      if (generatedSteps.length === 0) {
        throw new Error("No steps generated.");
      }

      const firstStep = generatedSteps[0];
      const isFirstAwaiting = firstStep.awaitingInput !== undefined && firstStep.awaitingInput !== null;

      set({
        steps: generatedSteps,
        currentStepIndex: 0,
        playbackState: isFirstAwaiting ? 'awaiting_input' : 'playing',
        awaitingInput: firstStep.awaitingInput || null,
        stdout: firstStep.stdout || ''
      });

      if (result.done) {
        set({ 
          editorStatus: 'finished'
        });
        activeGenerator = null;
        activeInterpreter = null;
        get().fetchBatchExplanations();
      }

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
      stdout: '',
      explanations: {},
      explanationsLoading: false,
      explanationsError: null,
      selectedItem: null,
      chatHistory: [],
      chatLoading: false
    });
  },

  stepForward: () => {
    const { currentStepIndex, steps, playbackState, speed } = get();
    if (playbackState === 'awaiting_input') return;

    if (currentStepIndex < steps.length - 1) {
      const nextIndex = currentStepIndex + 1;
      const nextStep = steps[nextIndex];
      logStepTransition(currentStepIndex, nextIndex, speed);
      
      set({ 
        currentStepIndex: nextIndex,
        stdout: nextStep.stdout
      });

      if (nextStep.awaitingInput) {
        set({
          awaitingInput: nextStep.awaitingInput,
          playbackState: 'awaiting_input'
        });
      }
    }
  },

  stepBackward: () => {
    const { currentStepIndex, steps, playbackState, speed } = get();
    if (playbackState === 'awaiting_input') return;

    if (currentStepIndex > 0) {
      const nextIndex = currentStepIndex - 1;
      logStepTransition(currentStepIndex, nextIndex, speed);
      set({ 
        currentStepIndex: nextIndex,
        stdout: steps[nextIndex].stdout
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
  },

  setSelectedItem: (selectedItem) => set({ selectedItem }),
  setTeachingMode: (teachingMode) => set({ teachingMode }),
  clearChat: () => set({ chatHistory: [] }),
  sendChatMessage: async (msg) => {
    const { chatHistory, code, language, steps, currentStepIndex, executionError, selectedItem, teachingMode } = get();
    
    // Add user message to history immediately
    const updatedHistory = [...chatHistory, { role: 'user' as const, content: msg }];
    set({ chatHistory: updatedHistory, chatLoading: true });

    try {
      const currentStep = steps[currentStepIndex];
      const context = {
        code,
        lineNumber: currentStep ? currentStep.lineNumber : (executionError?.line || 1),
        operation: currentStep ? currentStep.operation : 'system',
        variables: currentStep ? currentStep.variables : [],
        callStack: currentStep ? currentStep.callStack : [],
        stdout: currentStep ? currentStep.stdout : '',
        error: executionError || undefined
      };

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'chat',
          context,
          language,
          chatHistory: updatedHistory,
          selectedItem,
          teachingMode,
          userMessage: msg
        })
      });

      if (!response.ok) {
        throw new Error('AI Tutor unavailable at the moment');
      }

      const data = await response.json();
      set({
        chatHistory: [...updatedHistory, { role: 'assistant' as const, content: data.explanation }],
        chatLoading: false
      });
    } catch (err) {
      set({
        chatHistory: [...updatedHistory, { role: 'assistant' as const, content: `Error: ${err instanceof Error ? err.message : 'Could not reach mentor.'}` }],
        chatLoading: false
      });
    }
  },
  reviewCode: async () => {
    const msg = 'Please review my code for bugs, edge cases, performance issues, and potential improvements.';
    await get().sendChatMessage(msg);
  },
  toggleAiTutor: () => set((state) => ({ aiTutorOpen: !state.aiTutorOpen })),
  setAiTutorOpen: (open: boolean) => set({ aiTutorOpen: open })
}));
