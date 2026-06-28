import { ASTInterpreter } from './src/engine/interpreter';
const code = `
class Student:
    def __init__(self, name):
        self.name = name
    def __str__(self):
        return f"{self.name} is a student"
s = Student("Alice")
print(s)
`;
const interp = new ASTInterpreter(code, 'python');
for (const step of interp.run()) {
    console.log(step.operation, step.description);
}
console.log('DONE');
