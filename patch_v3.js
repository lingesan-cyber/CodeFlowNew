const fs = require('fs');
let code = fs.readFileSync('src/engine/interpreter.ts', 'utf8');

function replaceStr(findStr, replStr) {
  if (code.includes(findStr)) {
    code = code.replace(findStr, replStr);
    console.log("REPLACED:", findStr.substring(0, 30));
  } else {
    console.log("NOT FOUND:", findStr.substring(0, 30));
  }
}

// 1. Add structs map to ASTInterpreter
replaceStr(
  "private classes: Map<string, { name: string, methods: FunctionDeclarationNode[] }> = new Map();",
  "private classes: Map<string, { name: string, methods: FunctionDeclarationNode[] }> = new Map();\n  private structs: Map<string, Array<{ name: string; type: string }>> = new Map();"
);

// 2. Register StructDeclaration
replaceStr(
  "        } else if (stmt.type === 'Conditional') {\n          registerFunctions(stmt.thenBody);",
  "        } else if (stmt.type === 'StructDeclaration') {\n          this.structs.set(stmt.name, stmt.fields);\n        } else if (stmt.type === 'Conditional') {\n          registerFunctions(stmt.thenBody);"
);

// 3. Skip StructDeclaration execution
replaceStr(
  "  private *executeStatement(stmt: Statement, funcs: Map<string, FunctionDeclarationNode>): Generator<ExecutionStep, void, string | undefined> {\n    if (this.isReturning || this.isBroken) return;",
  "  private *executeStatement(stmt: Statement, funcs: Map<string, FunctionDeclarationNode>): Generator<ExecutionStep, void, string | undefined> {\n    if (stmt.type === 'StructDeclaration') return;\n\n    if (this.isReturning || this.isBroken) return;"
);

// 4. Map struct fields during initialization
replaceStr(
  "    if (isRef && typeof val === 'string') {\n      referencedId = val; // pointer address or heap id\n    }\n\n    const newVar: Variable = {",
  "    if (isRef && typeof val === 'string') {\n      referencedId = val; // pointer address or heap id\n    }\n\n    // Handle struct brace initialization mapping from ArrayLiteral\n    if (typeof val === 'string' && this.heap.has(val)) {\n      const heapObj = this.heap.get(val)!;\n      if (heapObj.type === 'array') {\n        const cleanType = type.replace('struct ', '');\n        if (this.structs.has(cleanType)) {\n          const fields = this.structs.get(cleanType)!;\n          const dict: Record<string, unknown> = {};\n          const arr = heapObj.value as unknown[];\n          for (let i = 0; i < fields.length; i++) {\n            dict[fields[i].name] = arr[i] !== undefined ? arr[i] : null;\n          }\n          heapObj.type = cleanType;\n          heapObj.value = dict;\n        }\n      }\n    }\n\n    const newVar: Variable = {"
);

// 5. Fix __str__ lookup
replaceStr(
  "            const hasStr = cls.methods.some(m => m.name === '__str__' || m.name === 'toString');\n            if (hasStr) {\n              const strMethod = cls.methods.find(m => m.name === '__str__' || m.name === 'toString')!;",
  "            const hasStr = cls.methods.some(m => m.name === `${cls.name}.__str__` || m.name === '__str__' || m.name === `${cls.name}.toString` || m.name === 'toString');\n            if (hasStr) {\n              const strMethod = cls.methods.find(m => m.name === `${cls.name}.__str__` || m.name === '__str__' || m.name === `${cls.name}.toString` || m.name === 'toString')!;"
);

// 6. Add << to BinaryOp
replaceStr(
  "          case '<=': return (left as number) <= (right as number);",
  "          case '<<': {\n            if (typeof left === 'string' || typeof right === 'string') {\n              return String(left) + String(right);\n            }\n            return (left as number) << (right as number);\n          }\n          case '<=': return (left as number) <= (right as number);"
);

// 7. Add ListComprehension execution
replaceStr(
  "      case 'DictionaryLiteral': {",
  `      case 'ListComprehension': {
        const iterableAddr = yield* this.evaluateExpression(expr.iterable, activeFuncs);
        let items: any[] = [];
        if (typeof iterableAddr === 'string' && this.heap.has(iterableAddr)) {
          const heapObj = this.heap.get(iterableAddr)!;
          if (Array.isArray(heapObj.value)) {
            items = heapObj.value;
          } else if (heapObj.type === 'dict' && heapObj.value) {
            items = Object.keys(heapObj.value);
          }
        } else if (Array.isArray(iterableAddr)) {
          items = iterableAddr;
        }

        const resultList = [];
        for (const item of items) {
          const prevVar = this.lookupVariable(expr.iteratorVar);
          const prevVal = prevVar ? prevVar.value : undefined;
          this.declareVariable(expr.iteratorVar, item, 'any');
          
          let conditionPassed = true;
          if (expr.condition) {
            conditionPassed = Boolean(yield* this.evaluateExpression(expr.condition, activeFuncs));
          }
          
          if (conditionPassed) {
            resultList.push(yield* this.evaluateExpression(expr.expression, activeFuncs));
          }
          
          if (prevVar) {
            prevVar.value = prevVal;
          }
        }
        
        const heapId = this.getNextHeapAddress();
        this.heap.set(heapId, {
          id: heapId,
          type: 'array',
          value: resultList
        });
        return heapId;
      }

      case 'DictionaryLiteral': {`
);

// 8. Add range function implementation
replaceStr(
  "        // Built-in str() / String()",
  `        // Built-in range()
        if (expr.name === 'range') {
          const arg0 = yield* this.evaluateExpression(expr.args[0], activeFuncs);
          let start = 0, stop = 0, step = 1;
          if (expr.args.length === 1) {
            stop = Number(arg0);
          } else if (expr.args.length >= 2) {
            start = Number(arg0);
            stop = Number(yield* this.evaluateExpression(expr.args[1], activeFuncs));
            if (expr.args.length === 3) {
              step = Number(yield* this.evaluateExpression(expr.args[2], activeFuncs));
            }
          }
          const arr = [];
          if (step > 0) {
            for (let i = start; i < stop; i += step) arr.push(i);
          } else if (step < 0) {
            for (let i = start; i > stop; i += step) arr.push(i);
          }
          const rangeId = this.getNextHeapAddress();
          this.heap.set(rangeId, { id: rangeId, type: 'array', value: arr });
          return rangeId;
        }

        // Built-in str() / String()`
);

fs.writeFileSync('src/engine/interpreter.ts', code);
console.log('interpreter.ts updated securely.');
