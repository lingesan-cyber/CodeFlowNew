import { create } from 'zustand';
import { ExecutionStep, SupportedLanguage, AwaitingInput, ExecutionError } from '../engine/types';
export type { SupportedLanguage };
import { ASTInterpreter } from '../engine/interpreter';
import { getSmartExplanation } from '../utils/smartEngine';

export interface ExplanationState {
  text: string;
  source: 'ai' | 'engine';
}

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
  explanations: Record<number, ExplanationState>;
  explanationsLoading: boolean;
  explanationsError: string | null;
  fetchingSteps: Record<number, boolean>;
  fetchStepExplanation: (index: number) => Promise<void>;
  triggerExplanationFetch: (index: number) => void;

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

// AbortController map: one controller per step index so stale fetches can be cancelled cleanly
const abortControllers = new Map<number, AbortController>();

const cancelOtherExplanationRequests = (keepIndex: number) => {
  for (const [idx, controller] of abortControllers.entries()) {
    if (idx !== keepIndex) {
      controller.abort();
      abortControllers.delete(idx);
    }
  }
};

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
  fetchingSteps: {},

  selectedItem: null,
  chatHistory: [],
  teachingMode: 'beginner',
  chatLoading: false,
  aiTutorOpen: false,

  setCode: (code) => set((state) => ({ 
    code,
    executionError: null,
    editorStatus: state.editorStatus === 'error' ? 'ready' : state.editorStatus
  })),
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
    fetchingSteps: {},
    selectedItem: null,
    chatHistory: [],
    chatLoading: false
  }),

  fetchStepExplanation: async (index: number) => {
    const { steps, code, language, explanations, fetchingSteps } = get();
    if (steps.length === 0 || index < 0 || index >= steps.length) return;
    
    // Cache check: Avoid duplicate requests or overriding an already resolved AI explanation
    if (fetchingSteps[index] || (explanations[index] && explanations[index].source === 'ai')) {
      return;
    }

    // Cancel other active requests to avoid overloading Ollama
    cancelOtherExplanationRequests(index);

    // Cancel any previous in-flight request for this same step index
    const existing = abortControllers.get(index);
    if (existing) {
      existing.abort();
    }
    const controller = new AbortController();
    abortControllers.set(index, controller);

    set((state) => ({
      fetchingSteps: { ...state.fetchingSteps, [index]: true }
    }));

    try {
      const step = steps[index];
      const context = {
        code,
        lineNumber: step.lineNumber,
        operation: step.operation,
        variables: step.variables,
        callStack: step.callStack,
        stdout: step.stdout,
        error: step.error || undefined
      };

      console.log('=== FETCH START ===');
      console.log(`Step ${index} | feature: explain_step | lang: ${language}`);

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'explain_step',
          language,
          context
        }),
        signal: controller.signal   // ← tied to AbortController
      });

      console.log('=== ROUTE RECEIVED ===', response.status, response.statusText);

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errBody || response.statusText}`);
      }

      const data = await response.json();
      const explanationText = data.explanation;

      console.log('=== PARSED AI RESPONSE ===');
      console.log(`Step ${index}:`, explanationText);
      console.log('==========================');

      // Only upgrade if the AI returned a valid explanation and not the unavailable fallback
      if (explanationText && explanationText !== '[AI unavailable]') {
        console.log('=== STORE UPDATE ===');
        console.log(`Step ${index}:`, explanationText);
        console.log('====================');

        set((state) => ({
          explanations: {
            ...state.explanations,
            [index]: {
              text: explanationText,
              source: 'ai'
            }
          }
        }));
      } else {
        // Fallback explanation if AI is unavailable or timeout occurred
        set((state) => ({
          explanations: {
            ...state.explanations,
            [index]: {
              text: "This step executes the current statement.",
              source: 'ai'
            }
          }
        }));
      }
    } catch (err) {
      // AbortError is expected during fast playback — not a real failure, swallow silently
      if (err instanceof Error && err.name === 'AbortError') {
        console.log(`fetchStepExplanation: step ${index} fetch cancelled (AbortError — expected during fast playback)`);
        return;
      }
      console.error(`fetchStepExplanation error for step ${index}:`, err);
      
      // Fallback explanation on network error or fetch crash
      set((state) => ({
        explanations: {
          ...state.explanations,
          [index]: {
            text: "This step executes the current statement.",
            source: 'ai'
          }
        }
      }));
    } finally {
      abortControllers.delete(index);
      set((state) => ({
        fetchingSteps: { ...state.fetchingSteps, [index]: false }
      }));
    }
  },

  triggerExplanationFetch: (index: number) => {
    const { steps } = get();
    if (steps.length === 0) return;

    // Only fetch explanation for visible/current step. Do NOT request explanations for all steps simultaneously.
    get().fetchStepExplanation(index);
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
      cancelOtherExplanationRequests(index);
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

        if (result.done && Array.isArray(result.value)) {
          newSteps.push(...result.value);
        }

        const explanationsMap = { ...get().explanations };
        newSteps.forEach((step, idx) => {
          if (!explanationsMap[idx]) {
            explanationsMap[idx] = {
              text: getSmartExplanation(step, idx > 0 ? newSteps[idx - 1] : undefined),
              source: 'engine'
            };
          }
        });

        set({ 
          steps: newSteps,
          playbackState: 'playing',
          explanations: explanationsMap
        });

        if (result.done) {
          const lastStep = newSteps[newSteps.length - 1];
          const isError = lastStep && (lastStep.operation === 'error' || !!lastStep.error);
          set({ 
            editorStatus: isError ? 'error' : 'finished'
          });
          activeGenerator = null;
          activeInterpreter = null;
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
      fetchingSteps: {},
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

      if (result.done && Array.isArray(result.value)) {
        generatedSteps.push(...result.value);
      }

      if (generatedSteps.length === 0) {
        throw new Error("No steps generated.");
      }

      const firstStep = generatedSteps[0];
      const isFirstAwaiting = firstStep.awaitingInput !== undefined && firstStep.awaitingInput !== null;
      const isFirstError = firstStep.operation === 'error' || !!firstStep.error;

      // Pre-populate Smart Engine explanations immediately for all steps
      const explanationsMap: Record<number, ExplanationState> = {};
      generatedSteps.forEach((step, idx) => {
        explanationsMap[idx] = {
          text: getSmartExplanation(step, idx > 0 ? generatedSteps[idx - 1] : undefined),
          source: 'engine'
        };
      });

      set({
        steps: generatedSteps,
        currentStepIndex: 0,
        playbackState: isFirstError ? 'paused' : (isFirstAwaiting ? 'awaiting_input' : 'playing'),
        awaitingInput: firstStep.awaitingInput || null,
        stdout: firstStep.stdout || '',
        explanations: explanationsMap,
        executionError: isFirstError ? (firstStep.error || { message: firstStep.description, line: firstStep.lineNumber }) : null,
        editorStatus: isFirstError ? 'error' : 'running'
      });

      if (result.done) {
        const lastStep = generatedSteps[generatedSteps.length - 1];
        const isError = lastStep && (lastStep.operation === 'error' || !!lastStep.error);
        set({ 
          editorStatus: isError ? 'error' : 'finished'
        });
        activeGenerator = null;
        activeInterpreter = null;
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
    // Cancel all in-flight AI explanation fetches
    abortControllers.forEach((ctrl) => ctrl.abort());
    abortControllers.clear();

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
      fetchingSteps: {},
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
      
      cancelOtherExplanationRequests(nextIndex);
      const isError = nextStep.operation === 'error' || !!nextStep.error;

      set({ 
        currentStepIndex: nextIndex,
        stdout: nextStep.stdout
      });

      if (isError) {
        set({
          executionError: nextStep.error || { message: nextStep.description, line: nextStep.lineNumber },
          editorStatus: 'error',
          playbackState: 'paused'
        });
      } else if (nextStep.awaitingInput) {
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
      cancelOtherExplanationRequests(nextIndex);
      set({ 
        currentStepIndex: nextIndex,
        stdout: steps[nextIndex].stdout,
        executionError: null,
        editorStatus: 'running'
      });
    }
  },

  jumpToStart: () => {
    const { steps } = get();
    if (steps.length > 0) {
      cancelOtherExplanationRequests(0);
      set({ 
        currentStepIndex: 0,
        stdout: steps[0].stdout
      });
    }
  },

  jumpToEnd: () => {
    const { steps } = get();
    if (steps.length > 0) {
      const lastIndex = steps.length - 1;
      cancelOtherExplanationRequests(lastIndex);
      set({ 
        currentStepIndex: lastIndex,
        stdout: steps[lastIndex].stdout
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
