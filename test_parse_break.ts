import { PythonParser } from './src/engine/languages/python';

const code = `while True:
    break`;

try {
  console.log("Parsing code...");
  const parser = new PythonParser(code);
  const ast = parser.parse();
  console.log("Generated AST:");
  console.dir(ast, { depth: null });
} catch (err: any) {
  console.error("Parser Error:", err.message);
}
