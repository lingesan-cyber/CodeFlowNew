
const fs = require('fs');
let content = fs.readFileSync('src/engine/interpreter.ts', 'utf8');

// 1. len() fix
content = content.replace(
          if (expr.name === 'len') {
          const target = expr.args[0];
          const v = yield* this.evaluateExpression(target, activeFuncs);
          if (typeof v === 'string') {
            return v.length;
          }
          if (Array.isArray(v)) {
            return v.length;
          }
          return 0;
        },
          if (expr.name === 'len') {
          const target = expr.args[0];
          const v = yield* this.evaluateExpression(target, activeFuncs);
          if (typeof v === 'string' && this.heap.has(v)) {
            const h = this.heap.get(v);
            if (Array.isArray(h.value)) return h.value.length;
            if (h.type === 'dict' && h.value && typeof h.value === 'object') return Object.keys(h.value).length;
            if (typeof h.value === 'string') return h.value.length;
          }
          if (typeof v === 'string') return v.length;
          if (Array.isArray(v)) return v.length;
          return 0;
        }
);

// 2. tuple unpacking loop fix
content = content.replace(
            for (const item of items) {
            this.updateVariable(stmt.iteratorVar, item, 'any');,
            for (const item of items) {
            if (stmt.iteratorVar.includes(',')) {
              const vars = stmt.iteratorVar.split(',').map(v => v.trim());
              if (typeof item === 'string' && this.heap.has(item)) {
                const h = this.heap.get(item);
                if (Array.isArray(h.value)) {
                  for (let i = 0; i < vars.length; i++) this.updateVariable(vars[i], h.value[i], 'any');
                }
              } else if (Array.isArray(item)) {
                for (let i = 0; i < vars.length; i++) this.updateVariable(vars[i], item[i], 'any');
              } else {
                this.updateVariable(vars[0], item, 'any');
              }
            } else {
              this.updateVariable(stmt.iteratorVar, item, 'any');
            }
);

// 3. __str__
content = content.replace(
    private *stringifyValueAsync(val: unknown, activeFuncs: Map<string, any>): Generator<any, string, any> {
    if (typeof val === 'string' && this.heap.has(val)) {
      const heapObj = this.heap.get(val)!;,
    private *stringifyValueAsync(val: unknown, activeFuncs: Map<string, any>): Generator<any, string, any> {
    if (typeof val === 'string' && this.heap.has(val)) {
      const heapObj = this.heap.get(val)!;
      if (heapObj.value && typeof heapObj.value === 'object' && !Array.isArray(heapObj.value) && heapObj.type !== 'dict') {
        const typeName = heapObj.type;
        const cls = this.classes.get(typeName) || this.classes.get(typeName.replace('struct ', ''));
        if (cls) {
          const hasStr = cls.methods.some(m => m.name === '__str__' || m.name === 'toString');
          if (hasStr) {
            const methodName = this.lang === 'python' ? '__str__' : 'toString';
            const fakeCall = {
              type: 'FunctionCall',
              name: methodName,
              args: [],
              objectExpr: { type: 'Literal', value: val, valueType: 'string', loc: { line: 0, columnStart: 0, columnEnd: 0 } },
              loc: { line: 0, columnStart: 0, columnEnd: 0 }
            };
            const res = yield* this.evaluateExpression(fakeCall as any, activeFuncs);
            if (res !== undefined) return String(res);
          }
        }
      }
);

fs.writeFileSync('src/engine/interpreter.ts', content);
console.log('Applied fast fixes.');

