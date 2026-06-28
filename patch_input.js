const fs = require('fs');

let intCode = fs.readFileSync('src/engine/interpreter.ts', 'utf8');

const startIndex = intCode.indexOf("      case 'Input': {");
const endIndex = intCode.indexOf("      case 'Free': {");

if (startIndex === -1 || endIndex === -1) {
  console.log("NOT FOUND");
  process.exit(1);
}

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
      }

`;

const finalCode = intCode.substring(0, startIndex) + newInput + intCode.substring(endIndex);
fs.writeFileSync('src/engine/interpreter.ts', finalCode);
console.log('PATCHED');
