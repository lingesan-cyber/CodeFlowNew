import { PythonParser } from './src/engine/languages/python';

const code = `tasks = []
tasks.append("hello")`;

try {
  const parser = new PythonParser(code);
  const ast = parser.parse();
  console.dir(ast, { depth: null });
} catch (err: any) {
  console.error("Parser Error:", err.message);
}
