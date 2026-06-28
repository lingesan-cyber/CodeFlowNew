import { PythonParser } from './src/engine/languages/python.ts';
const parser = new PythonParser(`class Student:
    def __init__(self, name, marks):
        self.name = name
        self.marks = marks
    def __str__(self):
        return f"{self.name} | Avg: {sum(self.marks) / len(self.marks)} | Grade: A"

s = Student('Alice', [95, 88, 92])
print(s)`);
console.log(JSON.stringify(parser.parse(), null, 2));
