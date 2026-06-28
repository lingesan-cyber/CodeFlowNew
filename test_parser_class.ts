import { PythonParser } from './src/engine/languages/python.ts';
const parser = new PythonParser(`
class Student:
    def __init__(self, name):
        self.name = name
`);
console.log(JSON.stringify(parser.parse(), null, 2));
