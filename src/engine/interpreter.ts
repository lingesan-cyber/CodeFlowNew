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
    
    // Find functions recursively and register them (hoisting)
    const functionRegistry = new Map<string, FunctionDeclarationNode>();
    const registerFunctions = (stmts: Statement[]) => {
      for (const stmt of stmts) {
        if (stmt.type === 'FunctionDeclaration') {
          functionRegistry.set(stmt.name, stmt);
          registerFunctions(stmt.body);
        } else if (stmt.type === 'Conditional') {
          registerFunctions(stmt.thenBody);
          if (stmt.elseBody) registerFunctions(stmt.elseBody);
        } else if (stmt.type === 'Loop') {
          registerFunctions(stmt.body);
        }
      }
    };
    registerFunctions(this.statements);

    // Set up initial global frame
    this.stack.push({
      functionName: this.lang === 'python' ? 'module' : 'global',
      line: this.statements[0]?.loc.line || 1,
      parameters: {},
      variables: []
    });

    try {
      // Execute the top level statements (including global variables)
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

      // If we are in C, C++, or Java, and a main function was defined, execute it now!
      const hasMain = functionRegistry.has('main');
      if (hasMain && (this.lang === 'c' || this.lang === 'cpp' || this.lang === 'java')) {
        const mainCall: Statement = {
          type: 'ExpressionStatement',
          expr: {
            type: 'FunctionCall',
            name: 'main',
            args: [],
            loc: { line: 1, columnStart: 1, columnEnd: 1 }
          },
          loc: { line: 1, columnStart: 1, columnEnd: 1 }
        };
        yield* this.executeStatement(mainCall, functionRegistry);
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

    const line = stmt.loc.line;

    switch (stmt.type) {
      case 'VarDeclaration': {
        const val = stmt.valueExpr ? yield* this.evaluateExpression(stmt.valueExpr, funcs) : undefined;
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
        const val = yield* this.evaluateExpression(stmt.valueExpr, funcs);
        yield* this.assignValue(stmt.target, val, funcs);

        yield this.createStep(
          line,
          'assignment',
          `Assign value to ${this.exprToString(stmt.target)}: ${JSON.stringify(val)}`,
          stmt.loc
        );
        break;
      }

      case 'Conditional': {
        const cond = yield* this.evaluateExpression(stmt.condition, funcs);
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
          const cond = yield* this.evaluateExpression(stmt.condition, funcs);
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
        const val = stmt.valueExpr ? yield* this.evaluateExpression(stmt.valueExpr, funcs) : null;
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
        const outputs = [];
        for (const e of stmt.exprs) {
          outputs.push(yield* this.evaluateExpression(e, funcs));
        }

        let outStr = '';
        const appendNewline = stmt.appendNewline !== false;

        if ((this.lang === 'c' || this.lang === 'cpp') && outputs.length > 0 && typeof outputs[0] === 'string') {
          outStr = this.formatPrintf(outputs[0], outputs.slice(1));
        } else {
          outStr = outputs.map(o => {
            if (o === null || o === undefined) return 'null';
            if (typeof o === 'string') return this.unescapeString(o);
            return String(o);
          }).join(' ');
        }

        if (appendNewline) {
          outStr += '\n';
        }

        this.stdout += outStr;

        yield this.createStep(
          line,
          'output',
          `Print output: ${outStr.replace(/\n$/, '').trim()}`,
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
          yield* this.assignValue({ type: 'Identifier', name: targetVarName, loc: stmt.target.loc }, parsedVal, funcs);
        } else {
          yield* this.assignValue(stmt.target, parsedVal, funcs);
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
        const addr = yield* this.evaluateExpression(stmt.expr, funcs);
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
        yield* this.evaluateExpression(stmt.expr, funcs);
        const expr = stmt.expr;
        const isAssignment = expr.type === 'BinaryOp' && [
          '=', '+=', '-=', '*=', '/=', '%=',
          '++_prefix', '--_prefix', '++_postfix', '--_postfix'
        ].includes(expr.operator);

        if (isAssignment) {
          yield this.createStep(
            line,
            'assignment',
            `Update variable: ${this.exprToString(expr)}`,
            stmt.loc
          );
        }
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

  private *assignValue(target: Expression, val: unknown, funcs: Map<string, FunctionDeclarationNode>): Generator<ExecutionStep, void, string | undefined> {
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
      const addr = yield* this.evaluateExpression(target.pointerExpr, funcs);
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
      const arr = yield* this.evaluateExpression(target.arrayExpr, funcs);
      const index = yield* this.evaluateExpression(target.indexExpr, funcs);
      if (typeof arr === 'string' && this.heap.has(arr)) {
        const heapObj = this.heap.get(arr)!;
        if (Array.isArray(heapObj.value)) {
          (heapObj.value as unknown[])[index as number] = val;
        }
      }
    } else if (target.type === 'MemberAccess') {
      const obj = yield* this.evaluateExpression(target.objectExpr, funcs);
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

  private *evaluateExpression(expr: Expression, funcs?: Map<string, FunctionDeclarationNode>): Generator<ExecutionStep, unknown, string | undefined> {
    const activeFuncs = funcs || new Map<string, FunctionDeclarationNode>();

    switch (expr.type) {
      case 'Literal':
        return expr.value;

      case 'Identifier': {
        const variable = this.lookupVariable(expr.name);
        return variable ? variable.value : null;
      }

      case 'BinaryOp': {
        const left = yield* this.evaluateExpression(expr.left, activeFuncs);
        const right = yield* this.evaluateExpression(expr.right, activeFuncs);
        
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
          case '===': return left === right;
          case '!==': return left !== right;
          case '<': return (left as number) < (right as number);
          case '>': return (left as number) > (right as number);
          case '<=': return (left as number) <= (right as number);
          case '>=': return (left as number) >= (right as number);
          case '&&': return (left as boolean) && (right as boolean);
          case '||': return (left as boolean) || (right as boolean);
          case '=': {
            yield* this.assignValue(expr.left, right, activeFuncs);
            return right;
          }
          case '+=': {
            const val = (typeof left === 'string' || typeof right === 'string')
              ? String(left) + String(right)
              : (left as number) + (right as number);
            yield* this.assignValue(expr.left, val, activeFuncs);
            return val;
          }
          case '-=': {
            const val = (left as number) - (right as number);
            yield* this.assignValue(expr.left, val, activeFuncs);
            return val;
          }
          case '*=': {
            const val = (left as number) * (right as number);
            yield* this.assignValue(expr.left, val, activeFuncs);
            return val;
          }
          case '/=': {
            const val = (right as number) !== 0 ? (left as number) / (right as number) : 0;
            yield* this.assignValue(expr.left, val, activeFuncs);
            return val;
          }
          case '%=': {
            const val = (left as number) % (right as number);
            yield* this.assignValue(expr.left, val, activeFuncs);
            return val;
          }
          case '++_prefix': {
            const val = Number(left) + 1;
            yield* this.assignValue(expr.left, val, activeFuncs);
            return val;
          }
          case '--_prefix': {
            const val = Number(left) - 1;
            yield* this.assignValue(expr.left, val, activeFuncs);
            return val;
          }
          case '++_postfix': {
            const val = Number(left) + 1;
            yield* this.assignValue(expr.left, val, activeFuncs);
            return left;
          }
          case '--_postfix': {
            const val = Number(left) - 1;
            yield* this.assignValue(expr.left, val, activeFuncs);
            return left;
          }
          default: return 0;
        }
      }

      case 'AddressOf': {
        const addr = this.varNameToAddr.get(expr.targetName);
        return addr || null;
      }

      case 'PointerDeref': {
        const addr = yield* this.evaluateExpression(expr.pointerExpr, activeFuncs);
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
        const els = [];
        for (const e of expr.elements) {
          els.push(yield* this.evaluateExpression(e, activeFuncs));
        }
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
          const size = yield* this.evaluateExpression(expr.args[0], activeFuncs);
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
        const arr = yield* this.evaluateExpression(expr.arrayExpr, activeFuncs);
        const index = yield* this.evaluateExpression(expr.indexExpr, activeFuncs);
        if (typeof arr === 'string' && this.heap.has(arr)) {
          const heapObj = this.heap.get(arr)!;
          return Array.isArray(heapObj.value) ? heapObj.value[index as number] : null;
        }
        return null;
      }

      case 'MemberAccess': {
        const obj = yield* this.evaluateExpression(expr.objectExpr, activeFuncs);
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
        if (activeFuncs.has(expr.name)) {
          const funcDecl = activeFuncs.get(expr.name)!;
          const args = [];
          for (const a of expr.args) {
            args.push(yield* this.evaluateExpression(a, activeFuncs));
          }

          yield* this.executeFunctionInline(funcDecl, args, activeFuncs);
          
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
  private *executeFunctionInline(
    funcDecl: FunctionDeclarationNode,
    args: unknown[],
    funcs: Map<string, FunctionDeclarationNode>
  ): Generator<ExecutionStep, void, string | undefined> {
    // Setup frame parameters
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

    // Yield a step for function entry
    yield this.createStep(
      funcDecl.loc.line,
      'call',
      `Call function "${funcDecl.name}" with arguments: ${args.map(a => JSON.stringify(a)).join(', ')}`,
      funcDecl.loc
    );

    const savedReturning = this.isReturning;
    this.isReturning = false;

    for (const stmt of funcDecl.body) {
      if (this.isReturning) break;
      yield* this.executeStatement(stmt, funcs);
    }

    this.stack.pop();
    this.isReturning = savedReturning;
  }

  private createStep(
    line: number,
    operation: ExecutionOperation,
    description: string,
    loc?: SourceLocation
  ): ExecutionStep {
    this.stepCount++;
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
      case 'BinaryOp': {
        if (expr.operator.endsWith('_prefix')) {
          return `${expr.operator.replace('_prefix', '')}${this.exprToString(expr.left)}`;
        }
        if (expr.operator.endsWith('_postfix')) {
          return `${this.exprToString(expr.left)}${expr.operator.replace('_postfix', '')}`;
        }
        return `${this.exprToString(expr.left)} ${expr.operator} ${this.exprToString(expr.right)}`;
      }
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

  private unescapeString(str: string): string {
    let result = '';
    let i = 0;
    while (i < str.length) {
      const char = str[i];
      if (char === '\\' && i + 1 < str.length) {
        const nextChar = str[i + 1];
        if (nextChar === 'n') result += '\n';
        else if (nextChar === 't') result += '\t';
        else if (nextChar === '\\') result += '\\';
        else if (nextChar === '"') result += '"';
        else if (nextChar === "'") result += "'";
        else result += '\\' + nextChar;
        i += 2;
      } else {
        result += char;
        i++;
      }
    }
    return result;
  }

  private formatPrintf(formatStr: string, args: unknown[]): string {
    let result = '';
    let argIndex = 0;
    let i = 0;
    while (i < formatStr.length) {
      const char = formatStr[i];
      if (char === '%' && i + 1 < formatStr.length) {
        let specifier = '';
        let nextIdx = i + 1;
        
        while (nextIdx < formatStr.length && /[0-9.-]/.test(formatStr[nextIdx])) {
          specifier += formatStr[nextIdx];
          nextIdx++;
        }
        
        if (nextIdx < formatStr.length) {
          const typeChar = formatStr[nextIdx];
          specifier += typeChar;
          nextIdx++;
          
          if (argIndex < args.length) {
            const val = args[argIndex++];
            if (typeChar === 'd' || typeChar === 'i') {
              result += String(Math.floor(Number(val)));
            } else if (typeChar === 'f') {
              if (specifier.startsWith('.')) {
                const precision = parseInt(specifier.substring(1, specifier.length - 1), 10);
                if (!isNaN(precision)) {
                  result += Number(val).toFixed(precision);
                } else {
                  result += String(Number(val));
                }
              } else {
                result += String(Number(val));
              }
            } else if (typeChar === 's') {
              result += val === null || val === undefined ? 'null' : String(val);
            } else if (typeChar === 'c') {
              result += typeof val === 'string' ? val[0] : String.fromCharCode(Number(val));
            } else {
              result += '%' + specifier;
            }
          } else {
            result += '%' + specifier;
          }
          i = nextIdx;
        } else {
          result += '%';
          i++;
        }
      } else if (char === '\\' && i + 1 < formatStr.length) {
        const nextChar = formatStr[i + 1];
        if (nextChar === 'n') result += '\n';
        else if (nextChar === 't') result += '\t';
        else if (nextChar === '\\') result += '\\';
        else if (nextChar === '"') result += '"';
        else result += '\\' + nextChar;
        i += 2;
      } else {
        result += char;
        i++;
      }
    }
    return result;
  }
}
