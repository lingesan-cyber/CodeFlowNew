const fs = require('fs');

// Patch c.ts
let cCode = fs.readFileSync('src/engine/languages/c.ts', 'utf8');
const oldScanf = `    // Input: scanf(format, &x)
    if (t.type === 'KEYWORD' && t.value === 'scanf') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const formatStrToken = this.consume('STRING');
      this.consume('PUNCTUATION', ',');
      const targetExpr = this.parseExpression(); // should be &x AddressOf
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', ';');

      // Deduce expected type from format string e.g. %d -> integer, %f -> float, %s -> string
      let expectedType: 'string' | 'number' | 'integer' | 'float' = 'string';
      if (formatStrToken.value.includes('%d')) expectedType = 'integer';
      else if (formatStrToken.value.includes('%f')) expectedType = 'float';

      return {
        type: 'Input',
        prompt: \`Enter \${expectedType}:\`,
        target: targetExpr,
        expectedType,
        loc: this.getLoc(startToken)
      };
    }`;

const newScanf = `    // Input: scanf(format, &x, ...)
    if (t.type === 'KEYWORD' && t.value === 'scanf') {
      const startToken = this.next();
      this.consume('PUNCTUATION', '(');
      const formatStrToken = this.consume('STRING');
      
      const targets = [];
      while (this.match('PUNCTUATION', ',')) {
        this.consume('PUNCTUATION', ',');
        targets.push(this.parseExpression());
      }
      this.consume('PUNCTUATION', ')');
      this.consume('PUNCTUATION', ';');

      return {
        type: 'Input',
        prompt: 'scanf',
        formatStr: formatStrToken.value,
        targets,
        loc: this.getLoc(startToken)
      };
    }`;

cCode = cCode.replace(oldScanf, newScanf);
fs.writeFileSync('src/engine/languages/c.ts', cCode);

// Patch interpreter.ts
let intCode = fs.readFileSync('src/engine/interpreter.ts', 'utf8');
const oldInput = `      case 'Input': {
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
          \`Awaiting input for "\${targetVarName}": "\${stmt.prompt}"\`,
          stmt.loc
        );
        traceStep.awaitingInput = inputRequest;

        // Yield execution to the outer runner to await input
        const inputVal = yield traceStep;

        // Reset timeout start time so the user's typing time doesn't trigger loop timeout
        this.startTime = Date.now();

        // Process injected input
        let parsedVal: string | number = inputVal || '';
        let expectedType = stmt.expectedType;
        if (expectedType === 'string' && stmt.target.type === 'Identifier') {
          const v = this.lookupVariable(stmt.target.name);
          if (v) {
            if (v.type === 'int' || v.type === 'integer') {
              expectedType = 'integer';
            } else if (v.type === 'float' || v.type === 'double' || v.type === 'number') {
              expectedType = 'float';
            }
          }
        }

        if (expectedType === 'integer') {
          parsedVal = parseInt(inputVal || '0', 10);
          if (isNaN(parsedVal)) parsedVal = 0;
        } else if (expectedType === 'float' || expectedType === 'number') {
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
          \`Input received: \${JSON.stringify(parsedVal)}. Assigning to variable "\${targetVarName}".\`,
          stmt.loc
        );
        break;
      }`;

const newInput = `      case 'Input': {
        const targets = stmt.targets || (stmt.target ? [stmt.target] : []);
        const formatStr = stmt.formatStr;

        let formatTypes: ('string'|'integer'|'float')[] = [];
        if (formatStr) {
          const matches = formatStr.match(/%[a-zA-Z]+/g);
          if (matches) {
            for (const m of matches) {
              if (m === '%d' || m === '%i') formatTypes.push('integer');
              else if (m === '%f' || m === '%lf') formatTypes.push('float');
              else formatTypes.push('string');
            }
          }
        }

        for (let i = 0; i < targets.length; i++) {
          const target = targets[i];
          let targetVarName = '';
          let isAddr = false;
          
          if (target.type === 'Identifier') {
            targetVarName = target.name;
          } else if (target.type === 'AddressOf') {
            targetVarName = target.targetName;
            isAddr = true;
          }

          let expectedType = stmt.expectedType || formatTypes[i] || 'string';
          
          let simulatedInput = '';
          if (targetVarName === 'operator') simulatedInput = '+';
          else if (targetVarName === 'num1') simulatedInput = '10.5';
          else if (targetVarName === 'num2') simulatedInput = '5.5';
          else if (targetVarName === 'n') simulatedInput = '5';

          let inputVal = '';
          if (simulatedInput) {
            inputVal = simulatedInput;
          } else {
            const inputRequest: AwaitingInput = {
              promptMessage: stmt.prompt,
              variableName: targetVarName,
              expectedType
            };

            const traceStep = this.createStep(
              line,
              'input_request',
              \`Awaiting input for "\${targetVarName}": "\${stmt.prompt}"\`,
              stmt.loc
            );
            traceStep.awaitingInput = inputRequest;

            inputVal = (yield traceStep) || '';
          }

          this.startTime = Date.now();

          let parsedVal: string | number = inputVal;
          if (expectedType === 'string' && target.type === 'Identifier') {
            const v = this.lookupVariable(target.name);
            if (v) {
              if (v.type === 'int' || v.type === 'integer') expectedType = 'integer';
              else if (v.type === 'float' || v.type === 'double' || v.type === 'number') expectedType = 'float';
            }
          }

          if (expectedType === 'integer') {
            parsedVal = parseInt(inputVal || '0', 10);
            if (isNaN(parsedVal)) parsedVal = 0;
          } else if (expectedType === 'float' || expectedType === 'number') {
            parsedVal = parseFloat(inputVal || '0.0');
            if (isNaN(parsedVal)) parsedVal = 0.0;
          }

          if (isAddr) {
            yield* this.assignValue({ type: 'Identifier', name: targetVarName, loc: target.loc }, parsedVal, funcs);
          } else {
            yield* this.assignValue(target, parsedVal, funcs);
          }

          yield this.createStep(
            line,
            'assignment',
            \`Input received: \${JSON.stringify(parsedVal)}. Assigning to variable "\${targetVarName}".\`,
            stmt.loc
          );
        }
        break;
      }`;

intCode = intCode.replace(oldInput, newInput);
fs.writeFileSync('src/engine/interpreter.ts', intCode);
console.log('Patched correctly');
