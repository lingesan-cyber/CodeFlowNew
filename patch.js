const fs = require('fs');
let code = fs.readFileSync('src/engine/interpreter.ts', 'utf8');

// 1. Add structs map to ASTInterpreter
code = code.replace(
  "private classes: Map<string, { name: string, methods: FunctionDeclarationNode[] }> = new Map();",
  "private classes: Map<string, { name: string, methods: FunctionDeclarationNode[] }> = new Map();\n  private structs: Map<string, Array<{ name: string; type: string }>> = new Map();"
);

// 2. Register StructDeclaration
code = code.replace(
  "registerFunctions(stmt.body);\n        } else if (stmt.type === 'Conditional') {",
  "registerFunctions(stmt.body);\n        } else if (stmt.type === 'StructDeclaration') {\n          this.structs.set(stmt.name, stmt.fields);\n        } else if (stmt.type === 'Conditional') {"
);

// 3. Skip StructDeclaration execution
code = code.replace(
  "if (this.isReturning || this.isBroken) return;",
  "if (stmt.type === 'StructDeclaration') return;\n    \n    if (this.isReturning || this.isBroken) return;"
);

// 4. Map struct fields during initialization
code = code.replace(
  "    if (isRef && typeof val === 'string') {\n      referencedId = val; // pointer address or heap id\n    }",
  "    if (isRef && typeof val === 'string') {\n      referencedId = val; // pointer address or heap id\n    }\n\n    // Handle struct brace initialization mapping from ArrayLiteral\n    if (typeof val === 'string' && this.heap.has(val)) {\n      const heapObj = this.heap.get(val)!;\n      if (heapObj.type === 'array') {\n        const cleanType = type.replace('struct ', '');\n        if (this.structs.has(cleanType)) {\n          const fields = this.structs.get(cleanType)!;\n          const dict: Record<string, unknown> = {};\n          const arr = heapObj.value as unknown[];\n          for (let i = 0; i < fields.length; i++) {\n            dict[fields[i].name] = arr[i] !== undefined ? arr[i] : null;\n          }\n          heapObj.type = cleanType;\n          heapObj.value = dict;\n        }\n      }\n    }"
);

// 5. Fix __str__ lookup
code = code.replace(
  "const hasStr = cls.methods.some(m => m.name === '__str__' || m.name === 'toString');",
  "const hasStr = cls.methods.some(m => m.name === `${cls.name}.__str__` || m.name === '__str__' || m.name === `${cls.name}.toString` || m.name === 'toString');"
);

// 6. Add << to BinaryOp
code = code.replace(
  "case '<=': return (left as number) <= (right as number);",
  "case '<<': {\n            if (typeof left === 'string' || typeof right === 'string') {\n              return String(left) + String(right);\n            }\n            return (left as number) << (right as number);\n          }\n          case '<=': return (left as number) <= (right as number);"
);

// 7. Add ListComprehension execution
const listComprehensionLogic = `
      case 'ListComprehension': {
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
          // Temporarily declare iterator variable
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
          
          // Restore previous value
          if (prevVar) {
            prevVar.value = prevVal;
          } else {
            // we should ideally remove it, but JS scoping is okay if we leave it for now
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
`;
code = code.replace(
  "case 'DictionaryLiteral': {",
  listComprehensionLogic.trim() + "\n\n      case 'DictionaryLiteral': {"
);

// 8. Add range function implementation
const rangeLogic = `
        // Built-in range()
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

`;
code = code.replace(
  "// Built-in str() / String()",
  rangeLogic + "        // Built-in str() / String()"
);

fs.writeFileSync('src/engine/interpreter.ts', code);
console.log('interpreter.ts updated');
