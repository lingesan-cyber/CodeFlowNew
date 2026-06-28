import { PythonParser } from './src/engine/languages/python.ts';
const parser = new PythonParser("print(f'{k}: {v}')");
console.log(JSON.stringify(parser.parse(), null, 2));
