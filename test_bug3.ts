import { ASTInterpreter } from './src/engine/interpreter.ts';
const code = `
even_squares = [x*x for x in range(5) if x % 2 == 0]
print(f"Squares: {even_squares}")
`;
const interpreter = new ASTInterpreter(code, 'python');
const g = interpreter.run();
while(!g.next().done) {}
console.log("output", interpreter['stdout']);
