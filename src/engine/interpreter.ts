import { Statement, Expression, FunctionDeclarationNode, SourceLocation } from './ast';
import { JSParser } from './languages/javascript';
import { PythonParser } from './languages/python';
import { JavaParser } from './languages/java';
import { CParser } from './languages/c';
import { CPPParser } from './languages/cpp';
import { ExecutionStep, Variable, StackFrame, HeapObject, AwaitingInput, SupportedLanguage, ExecutionOperation } from './types';

export class ASTInterpreter {
  private code: string;
  private lang: SupportedLanguage;
  private statements: Statement[] = [];
  
  // Environment State
  private globals: Map<string, Variable> = new Map();
  private stack: StackFrame[] = [];
  private heap: Map<string, HeapObject> = new Map();
  private stdout = '';
  private returnVal: unknown = null;
  private isReturning = false;
  
  // Tracing State
  private steps: ExecutionStep[] = [];
  private stepCount = 0;
  private maxSteps = 1000;
  private startTime = 0;
  private timeoutMs = 5000;
  
  // Memory Addresses
  private nextStackAddr = 0x7ffe000;
  private nextHeapAddr = 0x1000;
  private addrToVarName: Map<string, string> = new Map();
  private varNameToAddr: Map<string, string> = new Map();

  constructor(code: string, lang: SupportedLanguage) {
    this.code = code;
    this.lang = lang;
    
    // Compile code to Common AST
    const parser = this.getParser(code, lang);
    this.statements = parser.parse();
  }

  private getParser(code: string, lang: SupportedLanguage) {
    switch (lang) {
      case 'javascript': return new JSParser(code);
      case 'python': return new PythonParser(code);
      case 'java': return new JavaParser(code);
      case 'c': return new CParser(code);
      case 'cpp': return new CPPParser(code);
      default: throw new Error(`Unsupported language: ${lang}`);
    }
  }

  private getNextStackAddress(): string {
    const addr = `0x${this.nextStackAddr.toString(16).toUpperCase()}`;
    this.nextStackAddr -= 4; // Decrement stack addresses
    return addr;
  }

  private getNextHeapAddress(): string {
    const addr = `0x${this.nextHeapAddr.toString(16).toUpperCase()}`;
    this.nextHeapAddr += 16; // Increment heap addresses
    return addr;
  }

  // Run interpreter generator
  public *run(): Generator<ExecutionStep, ExecutionStep[], string | undefined> {
    this.startTime = Date.now();
    this.steps = [];
    this.stepCount = 0;
    this.globals.clear();
    this.stack = [];
    this.heap.clear();
    this.stdout = '';
    this.addrToVarName.clear();
    this.varNameToAddr.clear();
    
    // Find functions in global scope and register them (hoisting)
    const functionRegistry = new Map<string, FunctionDeclarationNode>();
    for (const stmt of this.statements) {
      if (stmt.type === 'FunctionDeclaration') {
        functionRegistry.set(stmt.name, stmt);
      }
    }

    // Set up main frame
    this.stack.push({
      functionName: this.lang === 'python' ? 'module' : 'main',
      line: this.statements[0]?.loc.line || 1,
      parameters: {},
      variables: []
    });

    try {
      // Execute the top level statements
      for (const stmt of this.statements) {
        if (stmt.type === 'FunctionDeclaration') continue; // Hoisted
        
        yield* this.executeStatement(stmt, functionRegistry);
        
        if (Date.now() - this.startTime > this.timeoutMs) {
          throw new Error('Execution timeout: infinite loop detected');
        }
        if (this.stepCount >= this.maxSteps) {
          throw new Error('Maximum execution steps exceeded');
        }
      }

      // Finish execution step
      const finalStep = this.createStep(
        this.statements[this.statements.length - 1]?.loc.line || 1,
        'system',
        'Execution completed successfully.',
        this.statements[this.statements.length - 1]?.loc
      );
      this.steps.push(finalStep);
      return this.steps;
    } catch (err) {
      const line = this.peek()?.line || 1;
      const errorMsg = err instanceof Error ? err.message : 'Runtime error';
      const errorStep = this.createStep(
        line,
        'error',
        `Error: ${errorMsg}`
      );
      errorStep.error = { message: errorMsg, line };
      this.steps.push(errorStep);
      return this.steps;
    }
  }

  private peek() {
    return this.statements[0]?.loc;
  }

  private *executeStatement(stmt: Statement, funcs: Map<string, FunctionDeclarationNode>): Generator<ExecutionStep, void, string | undefined> {
    if (this.isReturning) return;

    if (Date.now() - this.startTime > this.timeoutMs) {
      throw new Error('Execution timeout: infinite loop detected');
    }
    if (this.stepCount >= this.maxSteps) {
      throw new Error('Maximum execution steps exceeded');
    }

    this.stepCount++;
    const line = stmt.loc.line;

    switch (stmt.type) {
      case 'VarDeclaration': {
        const val = stmt.valueExpr ? this.evaluateExpression(stmt.valueExpr) : undefined;
        const type = stmt.varType;
        this.declareVariable(stmt.name, val, type);

        yield this.createStep(
          line,
          'declaration',
          `Declare variable "${stmt.name}" of type ${type}${val !== undefined ? ` and assign value ${JSON.stringify(val)}` : ''}`,
          stmt.loc
        );
        break;
      }

      case 'Assignment': {
        const val = this.evaluateExpression(stmt.valueExpr);
        this.assignValue(stmt.target, val);

        yield this.createStep(
          line,
          'assignment',
          `Assign value to ${this.exprToString(stmt.target)}: ${JSON.stringify(val)}`,
          stmt.loc
        );
        break;
      }

      case 'Conditional': {
        const cond = this.evaluateExpression(stmt.condition);
        yield this.createStep(
          line,
          'conditional',
          `Evaluate condition: ${this.exprToString(stmt.condition)} -> ${cond}`,
          stmt.loc
        );

        if (cond) {
          for (const subStmt of stmt.thenBody) {
            yield* this.executeStatement(subStmt, funcs);
            if (this.isReturning) break;
          }
        } else if (stmt.elseBody) {
          for (const subStmt of stmt.elseBody) {
            yield* this.executeStatement(subStmt, funcs);
            if (this.isReturning) break;
          }
        }
        break;
      }

      case 'Loop': {
        if (stmt.init) {
          yield* this.executeStatement(stmt.init, funcs);
        }

        while (true) {
          const cond = this.evaluateExpression(stmt.condition);
          yield this.createStep(
            line,
            'loop_start',
            `Evaluate loop condition: ${this.exprToString(stmt.condition)} -> ${cond}`,
            stmt.loc
          );

          if (!cond) break;

          for (const subStmt of stmt.body) {
            yield* this.executeStatement(subStmt, funcs);
            if (this.isReturning) break;
          }

          if (this.isReturning) break;

          if (stmt.update) {
            yield* this.executeStatement(stmt.update, funcs);
          }
        }
        break;
      }

      case 'ReturnStatement': {
        const val = stmt.valueExpr ? this.evaluateExpression(stmt.valueExpr) : null;
        this.returnVal = val;
        this.isReturning = true;

        yield this.createStep(
          line,
          'return',
          `Return value: ${JSON.stringify(val)}`,
          stmt.loc
        );
        break;
      }

      case 'Output': {
        const outputs = stmt.exprs.map(e => this.evaluateExpression(e));
        const outStr = outputs.map(o => (o === null || o === undefined ? 'null' : String(o))).join(' ') + '\n';
        this.stdout += outStr;

        yield this.createStep(
          line,
          'output',
          `Print output: ${outStr.trim()}`,
          stmt.loc
        );
        break;
      }

      case 'Input': {
        // Pausing execution for Input!
        // We yield a step that has the awaitingInput state.
        // The generator's resume value (a string) will be injected as the input response.
        let targetVarName = '';
        let isAddr = false;
        
        if (stmt.target.type === 'Identifier') {
          targetVarName = stmt.target.name;
        } else if (stmt.target.type === 'AddressOf') {
          targetVarName = stmt.target.targetName;
          isAddr = true;
        }

        const inputRequest: AwaitingInput = {
          promptMessage: stmt.prompt,
          variableName: targetVarName,
          expectedType: stmt.expectedType
        };

        const traceStep = this.createStep(
          line,
          'input_request',
          `Awaiting input for "${targetVarName}": "${stmt.prompt}"`,
          stmt.loc
        );
        traceStep.awaitingInput = inputRequest;

        // Yield execution to the outer runner to await input
        const inputVal = yield traceStep;

        // Process injected input
        let parsedVal: string | number = inputVal || '';
        if (stmt.expectedType === 'integer') {
          parsedVal = parseInt(inputVal || '0', 10);
          if (isNaN(parsedVal)) parsedVal = 0;
        } else if (stmt.expectedType === 'float' || stmt.expectedType === 'number') {
          parsedVal = parseFloat(inputVal || '0.0');
          if (isNaN(parsedVal)) parsedVal = 0.0;
        }

        if (isAddr) {
          // pointer target
          this.assignValue({ type: 'Identifier', name: targetVarName, loc: stmt.target.loc }, parsedVal);
        } else {
          this.assignValue(stmt.target, parsedVal);
        }

        yield this.createStep(
          line,
          'assignment',
          `Input received: ${JSON.stringify(parsedVal)}. Assigning to variable "${targetVarName}".`,
          stmt.loc
        );
        break;
      }

      case 'Free': {
        const addr = this.evaluateExpression(stmt.expr);
        if (typeof addr === 'string' && this.heap.has(addr)) {
          this.heap.delete(addr);
        }

        yield this.createStep(
          line,
          'assignment',
          `Free heap memory at address: ${addr}`,
          stmt.loc
        );
        break;
      }

      case 'ExpressionStatement': {
        this.evaluateExpression(stmt.expr, funcs);
        break;
      }
    }
  }

  private declareVariable(name: string, val: unknown, type: string) {
    const frame = this.stack[this.stack.length - 1];
    const isGlobal = this.stack.length === 1;

    // Check if variable already exists (or shadow it)
    const addr = this.getNextStackAddress();
    this.addrToVarName.set(addr, name);
    this.varNameToAddr.set(name, addr);

    const isRef = type.includes('*') || type === 'vector' || type.includes('[]');
    let referencedId: string | undefined;
    if (isRef && typeof val === 'string') {
      referencedId = val; // pointer address or heap id
    }

    const newVar: Variable = {
      name,
      value: val === undefined ? null : val,
      type,
      scope: isGlobal ? 'global' : 'local',
      isReference: isRef,
      referencedId
    };

    if (isGlobal) {
      this.globals.set(name, newVar);
    } else {
      frame.variables.push(name);
      // Place in frame parameter values or variables registry
      frame.parameters[name] = newVar;
    }
  }

  private assignValue(target: Expression, val: unknown) {
    if (target.type === 'Identifier') {
      const name = target.name;
      const variable = this.lookupVariable(name);
      if (variable) {
        variable.value = val;
        if (variable.isReference && typeof val === 'string') {
          variable.referencedId = val;
        }
      } else {
        // Declare implicitly (python style)
        this.declareVariable(name, val, 'any');
      }
    } else if (target.type === 'PointerDeref') {
      // Write memory address
      const addr = this.evaluateExpression(target.pointerExpr);
      if (typeof addr === 'string') {
        const stackVarName = this.addrToVarName.get(addr);
        if (stackVarName) {
          const variable = this.lookupVariable(stackVarName);
          if (variable) variable.value = val;
        } else if (this.heap.has(addr)) {
          const heapObj = this.heap.get(addr)!;
          heapObj.value = val;
        }
      }
    } else if (target.type === 'ArrayAccess') {
      const arr = this.evaluateExpression(target.arrayExpr);
      const index = this.evaluateExpression(target.indexExpr);
      if (typeof arr === 'string' && this.heap.has(arr)) {
        const heapObj = this.heap.get(arr)!;
        if (Array.isArray(heapObj.value)) {
          (heapObj.value as unknown[])[index as number] = val;
        }
      }
    } else if (target.type === 'MemberAccess') {
      const obj = this.evaluateExpression(target.objectExpr);
      if (typeof obj === 'string' && this.heap.has(obj)) {
        const heapObj = this.heap.get(obj)!;
        if (heapObj.value && typeof heapObj.value === 'object') {
          (heapObj.value as Record<string, unknown>)[target.property] = val;
        }
      }
    }
  }

  private lookupVariable(name: string): Variable | undefined {
    // Traverse stack frames from inner to outer
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const frame = this.stack[i];
      if (frame.parameters[name]) {
        return frame.parameters[name];
      }
    }
    return this.globals.get(name);
  }

  private evaluateExpression(expr: Expression, funcs?: Map<string, FunctionDeclarationNode>): unknown {
    switch (expr.type) {
      case 'Literal':
        return expr.value;

      case 'Identifier': {
        const variable = this.lookupVariable(expr.name);
        return variable ? variable.value : null;
      }

      case 'BinaryOp': {
        const left = this.evaluateExpression(expr.left, funcs);
        const right = this.evaluateExpression(expr.right, funcs);
        
        switch (expr.operator) {
          case '+': {
            if (typeof left === 'string' || typeof right === 'string') {
              return String(left) + String(right);
            }
            return (left as number) + (right as number);
          }
          case '-': return (left as number) - (right as number);
          case '*': return (left as number) * (right as number);
          case '/': return (right as number) !== 0 ? (left as number) / (right as number) : 0;
          case '%': return (left as number) % (right as number);
          case '==': return left == right;
          case '!=': return left != right;
          case '<': return (left as number) < (right as number);
          case '>': return (left as number) > (right as number);
          case '<=': return (left as number) <= (right as number);
          case '>=': return (left as number) >= (right as number);
          case '&&': return (left as boolean) && (right as boolean);
          case '||': return (left as boolean) || (right as boolean);
          case '=': return right;
          case '+=': {
            if (typeof left === 'string' || typeof right === 'string') {
              return String(left) + String(right);
            }
            return (left as number) + (right as number);
          }
          case '-=': return (left as number) - (right as number);
          default: return 0;
        }
      }

      case 'AddressOf': {
        const addr = this.varNameToAddr.get(expr.targetName);
        return addr || null;
      }

      case 'PointerDeref': {
        const addr = this.evaluateExpression(expr.pointerExpr, funcs);
        if (typeof addr === 'string') {
          const varName = this.addrToVarName.get(addr);
          if (varName) {
            const v = this.lookupVariable(varName);
            return v ? v.value : null;
          }
          if (this.heap.has(addr)) {
            return this.heap.get(addr)!.value;
          }
        }
        return null;
      }

      case 'ArrayLiteral': {
        const els = expr.elements.map(e => this.evaluateExpression(e, funcs));
        const heapId = this.getNextHeapAddress();
        this.heap.set(heapId, {
          id: heapId,
          type: 'array',
          value: els
        });
        return heapId;
      }

      case 'NewInstance': {
        // Java array new int[5]
        if (expr.className.endsWith('[]')) {
          const size = this.evaluateExpression(expr.args[0], funcs);
          const els = new Array(size as number).fill(0);
          const heapId = this.getNextHeapAddress();
          this.heap.set(heapId, {
            id: heapId,
            type: expr.className,
            value: els
          });
          return heapId;
        }
        
        // Java constructor MyClass(1, 2)
        const heapId = this.getNextHeapAddress();
        this.heap.set(heapId, {
          id: heapId,
          type: expr.className,
          value: {}
        });
        return heapId;
      }

      case 'ArrayAccess': {
        const arr = this.evaluateExpression(expr.arrayExpr, funcs);
        const index = this.evaluateExpression(expr.indexExpr, funcs);
        if (typeof arr === 'string' && this.heap.has(arr)) {
          const heapObj = this.heap.get(arr)!;
          return Array.isArray(heapObj.value) ? heapObj.value[index as number] : null;
        }
        return null;
      }

      case 'MemberAccess': {
        const obj = this.evaluateExpression(expr.objectExpr, funcs);
        if (typeof obj === 'string' && this.heap.has(obj)) {
          const heapObj = this.heap.get(obj)!;
          return heapObj.value && typeof heapObj.value === 'object'
            ? (heapObj.value as Record<string, unknown>)[expr.property]
            : null;
        }
        return null;
      }

      case 'FunctionCall': {
        // C memory allocation: malloc(size)
        if (expr.name === 'malloc' || expr.name === 'realloc') {
          const heapId = this.getNextHeapAddress();
          this.heap.set(heapId, {
            id: heapId,
            type: 'void*',
            value: new Array(5).fill(0) // Default contiguous allocation block of size 5
          });
          return heapId;
        }

        // Look up functions
        if (funcs && funcs.has(expr.name)) {
          const funcDecl = funcs.get(expr.name)!;
          const args = expr.args.map(a => this.evaluateExpression(a, funcs));

          // Set up function frame parameters
          const paramsObj: Record<string, Variable> = {};
          const localNames: string[] = [];
          
          funcDecl.params.forEach((p, idx) => {
            const val = args[idx] !== undefined ? args[idx] : null;
            const paramVar: Variable = {
              name: p.name,
              value: val,
              type: p.type,
              scope: 'parameter',
              isReference: p.type.includes('*') || p.type.includes('[]')
            };
            paramsObj[p.name] = paramVar;
            localNames.push(p.name);
          });

          // Push new frame
          const newFrame: StackFrame = {
            functionName: expr.name,
            line: funcDecl.loc.line,
            parameters: paramsObj,
            variables: localNames
          };
          this.stack.push(newFrame);

          // Fallback: If we evaluate this as an expression in a statement, we execute function statements:
          this.executeFunctionInline(funcDecl, args, funcs);
          
          const result = this.returnVal;
          this.returnVal = null;
          this.isReturning = false;
          
          return result;
        }
        return null;
      }
    }
    return null;
  }

  // Executes function calls statement-by-statement inside the main generator
  private executeFunctionInline(funcDecl: FunctionDeclarationNode, args: unknown[], funcs: Map<string, FunctionDeclarationNode>) {
    // Setup frame
    const paramsObj: Record<string, Variable> = {};
    const localNames: string[] = [];
    
    funcDecl.params.forEach((p, idx) => {
      const val = args[idx] !== undefined ? args[idx] : null;
      const paramVar: Variable = {
        name: p.name,
        value: val,
        type: p.type,
        scope: 'parameter',
        isReference: p.type.includes('*') || p.type.includes('[]')
      };
      paramsObj[p.name] = paramVar;
      localNames.push(p.name);
    });

    const frame: StackFrame = {
      functionName: funcDecl.name,
      line: funcDecl.loc.line,
      parameters: paramsObj,
      variables: localNames
    };
    
    this.stack.push(frame);

    // Create a new runner just for the statements in this block, but run them in this interpreter context
    // This allows function tracing!
    // Since we're executing inline inside evaluateExpression, we walk the function block statements.
    // If statements yield traces, we can call a sub-runner or run them.
    // Let's walk the block statements:
    const savedReturning = this.isReturning;
    this.isReturning = false;

    // To keep it simple, we run the statements sequentially. If we find nested calls, they also execute.
    // This executes synchronously inside evaluateExpression.
    // Note: since statements will yield, but we are inside evaluateExpression (synchronous), 
    // we can execute statements by running their logic.
    for (const stmt of funcDecl.body) {
      if (this.isReturning) break;
      this.executeStatementSync(stmt, funcs);
    }

    this.stack.pop();
    this.isReturning = savedReturning;
  }

  // Synchronous statement runner helper for function calls
  private executeStatementSync(stmt: Statement, funcs: Map<string, FunctionDeclarationNode>) {
    switch (stmt.type) {
      case 'VarDeclaration': {
        const val = stmt.valueExpr ? this.evaluateExpression(stmt.valueExpr, funcs) : undefined;
        this.declareVariable(stmt.name, val, stmt.varType);
        break;
      }
      case 'Assignment': {
        const val = this.evaluateExpression(stmt.valueExpr, funcs);
        this.assignValue(stmt.target, val);
        break;
      }
      case 'Conditional': {
        const cond = this.evaluateExpression(stmt.condition, funcs);
        if (cond) {
          for (const s of stmt.thenBody) {
            this.executeStatementSync(s, funcs);
            if (this.isReturning) break;
          }
        } else if (stmt.elseBody) {
          for (const s of stmt.elseBody) {
            this.executeStatementSync(s, funcs);
            if (this.isReturning) break;
          }
        }
        break;
      }
      case 'Loop': {
        if (stmt.init) this.executeStatementSync(stmt.init, funcs);
        while (true) {
          const cond = this.evaluateExpression(stmt.condition, funcs);
          if (!cond) break;
          for (const s of stmt.body) {
            this.executeStatementSync(s, funcs);
            if (this.isReturning) break;
          }
          if (this.isReturning) break;
          if (stmt.update) this.executeStatementSync(stmt.update, funcs);
        }
        break;
      }
      case 'ReturnStatement': {
        const val = stmt.valueExpr ? this.evaluateExpression(stmt.valueExpr, funcs) : null;
        this.returnVal = val;
        this.isReturning = true;
        break;
      }
      case 'Output': {
        const outputs = stmt.exprs.map(e => this.evaluateExpression(e, funcs));
        this.stdout += outputs.map(o => (o === null || o === undefined ? 'null' : String(o))).join(' ') + '\n';
        break;
      }
      case 'Free': {
        const addr = this.evaluateExpression(stmt.expr, funcs);
        if (typeof addr === 'string') this.heap.delete(addr);
        break;
      }
      case 'ExpressionStatement': {
        this.evaluateExpression(stmt.expr, funcs);
        break;
      }
    }
  }

  private createStep(
    line: number,
    operation: ExecutionOperation,
    description: string,
    loc?: SourceLocation
  ): ExecutionStep {
    // Perform deep clones of active state to prevent references mutating past steps
    const clonedGlobals: Variable[] = Array.from(this.globals.values()).map(v => ({ ...v }));
    const clonedStack: StackFrame[] = this.stack.map(f => {
      const clonedParams: Record<string, Variable> = {};
      for (const k of Object.keys(f.parameters)) {
        clonedParams[k] = { ...f.parameters[k] };
      }
      return {
        functionName: f.functionName,
        line: f.line,
        parameters: clonedParams,
        variables: [...f.variables]
      };
    });
    const clonedHeap: HeapObject[] = Array.from(this.heap.values()).map(h => ({
      id: h.id,
      type: h.type,
      value: Array.isArray(h.value) ? [...h.value] : (h.value && typeof h.value === 'object' ? { ...h.value } : h.value)
    }));

    // Gather all active frame parameters + globals into variables array for visualizer variables panel
    const currentFrame = clonedStack[clonedStack.length - 1];
    const variables: Variable[] = [];

    // Add globals
    clonedGlobals.forEach(g => variables.push(g));
    
    // Add local variables of current frame
    if (currentFrame) {
      for (const k of Object.keys(currentFrame.parameters)) {
        variables.push(currentFrame.parameters[k]);
      }
    }

    return {
      stepNumber: this.stepCount,
      lineNumber: line,
      columnStart: loc?.columnStart,
      columnEnd: loc?.columnEnd,
      operation,
      description,
      variables,
      callStack: clonedStack,
      heap: clonedHeap,
      stdout: this.stdout
    };
  }

  private exprToString(expr: Expression): string {
    switch (expr.type) {
      case 'Literal': return JSON.stringify(expr.value);
      case 'Identifier': return expr.name;
      case 'BinaryOp': return `${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)}`;
      case 'AddressOf': return `&${expr.targetName}`;
      case 'PointerDeref': return `*${this.exprToString(expr.pointerExpr)}`;
      case 'ArrayAccess': return `${this.exprToString(expr.arrayExpr)}[${this.exprToString(expr.indexExpr)}]`;
      case 'MemberAccess': return `${this.exprToString(expr.objectExpr)}.${expr.property}`;
      case 'FunctionCall': return `${expr.name}(...)`;
      case 'ArrayLiteral': return `[...]`;
      case 'NewInstance': return `new ${expr.className}(...)`;
      default: return '';
    }
  }
}
