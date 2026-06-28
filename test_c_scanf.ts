import { ASTInterpreter } from './src/engine/interpreter';

const code = `
#include <stdio.h>

int main() {
    char operator;
    double num1, num2, result;

    printf("=== Simple Calculator ===\\n");
    
    printf("Enter an operator (+, -, *, /): \\n");
    scanf("%c", &operator);
    
    printf("Enter two numbers (separated by a space): \\n");
    scanf("%lf %lf", &num1, &num2);

    result = num1 + num2;

    printf("%.2lf + %.2lf = %.2lf\\n", num1, num2, result);

    return 0;
}
`;

const interpreter = new ASTInterpreter(code, 'c');
const gen = interpreter.run();
let val = gen.next();
let finalOut = '';
while (!val.done) {
  const step = val.value;
  if (step.stdout) {
    finalOut = step.stdout;
  }
  val = gen.next();
}
// Fix \\n just for terminal display simulation
console.log(finalOut.replace(/\\n/g, '\\n'));
