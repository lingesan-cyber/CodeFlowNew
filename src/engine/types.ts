export type ExecutionOperation = 
  | 'assignment' 
  | 'arithmetic' 
  | 'comparison' 
  | 'call' 
  | 'return' 
  | 'loop_start' 
  | 'loop_end' 
  | 'conditional' 
  | 'output' 
  | 'error'
  | 'input_request'
  | 'declaration'
  | 'system';

export interface Variable {
  name: string;
  value: unknown;
  type: string;
  scope: 'global' | 'local' | 'parameter';
  isReference: boolean;
  referencedId?: string; // if pointing to heap object
}

export interface StackFrame {
  functionName: string;
  line: number;
  parameters: Record<string, Variable>;
  variables: string[]; // names of variables local to this frame
}

export interface HeapObject {
  id: string;
  type: string;
  value: unknown;
  references?: string[];
}

export interface ExecutionError {
  message: string;
  line: number;
  column?: number;
}

export interface AwaitingInput {
  promptMessage: string;
  variableName: string;
  expectedType: 'string' | 'number' | 'integer' | 'float';
  inputReceived?: string;
}

export interface ExecutionStep {
  stepNumber: number;
  lineNumber: number;
  columnStart?: number;
  columnEnd?: number;
  operation: ExecutionOperation;
  description: string;
  variables: Variable[];
  callStack: StackFrame[];
  heap: HeapObject[];
  stdout: string;
  stderr?: string;
  error?: ExecutionError;
  awaitingInput?: AwaitingInput;
}

export type SupportedLanguage = 'python' | 'java' | 'c' | 'cpp' | 'javascript';
