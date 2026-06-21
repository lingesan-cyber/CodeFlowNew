import { ASTInterpreter } from './interpreter';
import { ExecutionStep } from './types';

interface CustomWorkerGlobalScope {
  activeRunner?: Generator<ExecutionStep, ExecutionStep[], string | undefined> | null;
  accumulatedSteps?: ExecutionStep[];
}

const worker = self as unknown as CustomWorkerGlobalScope & typeof globalThis;

// Web worker onmessage listener
self.onmessage = function (e: MessageEvent) {
  const { type, code, language, inputVal } = e.data;

  if (type === 'START') {
    try {
      const interpreter = new ASTInterpreter(code, language);
      const runner = interpreter.run();
      
      // Store the active generator context on the worker self object
      worker.activeRunner = runner;
      worker.accumulatedSteps = [];

      runGeneratorStep();
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Compilation/Parsing failed'
      });
    }
  } else if (type === 'INPUT_RESPONSE') {
    const runner = worker.activeRunner;
    if (runner) {
      // Resume the generator with the user input value
      runGeneratorStep(inputVal);
    }
  }
};

function runGeneratorStep(resumeVal?: string) {
  const runner = worker.activeRunner;
  if (!runner) return;

  try {
    const result = runner.next(resumeVal);
    
    if (result.done) {
      // Completed execution, return all accumulated steps
      const finalSteps = result.value || worker.accumulatedSteps;
      self.postMessage({
        type: 'FINISHED',
        steps: finalSteps
      });
      worker.activeRunner = null;
    } else {
      const step: ExecutionStep = result.value;
      worker.accumulatedSteps?.push(step);

      // Check if this step is waiting for input
      if (step.awaitingInput) {
        self.postMessage({
          type: 'AWAITING_INPUT',
          step,
          steps: worker.accumulatedSteps
        });
      } else {
        // Stream trace chunks
        self.postMessage({
          type: 'STEP_STREAM',
          step,
          stepsCount: worker.accumulatedSteps?.length || 0
        });
        
        // Schedule next step execution
        setTimeout(() => {
          runGeneratorStep();
        }, 10); // Executing statement chunks every 10ms for smooth background throughput
      }
    }
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : 'Runtime execution crashed'
    });
    worker.activeRunner = null;
  }
}
