require('ts-node/register');
const { CParser } = require('./src/engine/languages/c.ts');
const { ASTInterpreter } = require('./src/engine/interpreter.ts');

const code = `
  double num1, num2, result;
  num1 = 10.5;
  num2 = 5.5;
  result = num1 + num2;
  printf("%.2lf", result);
`;

const parser = new CParser(code);
const ast = parser.parse();
const interpreter = new ASTInterpreter(ast, 'c');
interpreter.onPrint = msg => console.log('PRINT: ' + msg);
interpreter.run().then(() => console.log('Done')).catch(console.error);
