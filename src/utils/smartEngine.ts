import { ExecutionStep } from '../engine/types';

export function getSmartExplanation(step: ExecutionStep, prevStep?: ExecutionStep): string {
  if (!step) return '';

  const op = step.operation;
  const desc = step.description;

  switch (op) {
    case 'declaration': {
      // Matches e.g., 'Declare variable "x" of type int' or 'Declare variable "x" of type int and assign value 10'
      const match = desc.match(/Declare variable "([^"]+)" of type ([^\s]+)(?: and assign value (.+))?/);
      if (match) {
        const [, name, type, val] = match;
        if (val !== undefined) {
          return `A new variable "${name}" of type ${type} is created and initialized with the value ${val}.`;
        }
        return `A new variable "${name}" of type ${type} is created.`;
      }
      return `A new variable is declared.`;
    }

    case 'assignment': {
      // Matches e.g., 'Assign value to x: 10'
      const match = desc.match(/Assign value to ([a-zA-Z0-9_\[\].]+):\s*(.+)/);
      if (match) {
        const [, target, val] = match;
        if (prevStep) {
          const prevVar = prevStep.variables.find(v => v.name === target);
          if (prevVar && String(prevVar.value) !== String(val)) {
            return `The value of "${target}" changes from ${JSON.stringify(prevVar.value)} to ${val}.`;
          }
        }
        return `The variable "${target}" is assigned the value ${val}.`;
      }
      return desc || `A variable is assigned a new value.`;
    }

    case 'loop_start': {
      // Matches e.g., 'Evaluate loop condition: count <= 5 -> true'
      const match = desc.match(/loop condition:\s*(.+)\s*->\s*(true|false)/i);
      if (match) {
        const [, cond, res] = match;
        if (res.toLowerCase() === 'true') {
          return `The loop checks whether the condition is still true. Since "${cond}" is true, execution continues into the loop.`;
        } else {
          return `The loop checks whether the condition is still true. Since "${cond}" is false, the loop terminates.`;
        }
      }
      return `The loop checks the condition to decide if it should continue executing.`;
    }

    case 'loop_end': {
      return `The program reaches the end of the loop body and returns to evaluate the loop condition again.`;
    }

    case 'conditional': {
      // Matches e.g., 'Evaluate condition: x > 5 -> true'
      const match = desc.match(/Evaluate condition:\s*(.+)\s*->\s*(true|false)/i);
      if (match) {
        const [, cond, res] = match;
        return `The program evaluates the condition "${cond}", which is ${res}. It will branch accordingly.`;
      }
      return `The program evaluates a condition to decide which path to execute.`;
    }

    case 'call': {
      // Matches e.g., 'Call function "main" with arguments: ...'
      const match = desc.match(/Call function "([^"]+)"(?: with arguments: (.+))?/);
      if (match) {
        const [, name, args] = match;
        return `The program enters the function "${name}"${args ? ` with arguments (${args})` : ''} and creates a new stack frame.`;
      }
      return `The program enters the function and creates a new stack frame.`;
    }

    case 'return': {
      // Matches e.g., 'Return value: 10'
      const match = desc.match(/Return value:\s*(.+)/);
      if (match) {
        const [, val] = match;
        return `The function finishes and returns ${val === 'null' ? 'no value' : `the value ${val}`}.`;
      }
      return `The function finishes and returns a value.`;
    }

    case 'output': {
      // Matches e.g., 'Print output: hello'
      const match = desc.match(/Print output:\s*(.+)/);
      if (match) {
        const [, val] = match;
        return `The program prints "${val}" to the output console.`;
      }
      return `The program prints text to the output console.`;
    }

    case 'input_request': {
      return `The program pauses to request user input for "${step.awaitingInput?.variableName || 'input'}".`;
    }

    case 'error': {
      return `An error occurred: ${step.error?.message || desc}`;
    }

    default: {
      return desc;
    }
  }
}
