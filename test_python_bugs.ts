import { ASTInterpreter } from './src/engine/interpreter';

const code = `
class Student:
    def __init__(self, name, marks):
        self.name = name
        self.marks = marks
        
    def __str__(self):
        return f"{self.name} | Avg: {sum(self.marks) / len(self.marks)} | Grade: A"

s = Student("Alice", [95, 88, 92])
print(s)
`;

async function test() {
  const interp = new ASTInterpreter(code, 'python');
  for (const step of interp.run()) {
    console.log(step.operation, step.description);
  }
  // console.log('Error:', interp.error);
}
test().catch(e => console.error('ERROR', e));
