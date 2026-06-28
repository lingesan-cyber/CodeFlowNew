import { ASTInterpreter } from './src/engine/interpreter';

const code = `
class Student:
    def __init__(self, name, marks):
        self.name = name
        self.marks = marks
        
    def average(self):
        return sum(self.marks) / len(self.marks)

class Classroom:
    def __init__(self):
        self.students = []
        
    def add(self, student):
        self.students.append(student)

c = Classroom()
c.add(Student("Alice", [90, 100, 80])) # avg = 90
c.add(Student("Bob", [70, 70, 70]))    # avg = 70

print(sum(s.average() for s in c.students))
print(max(s.average() for s in c.students))
print(min(s.average() for s in c.students))
print(any(s.average() > 80 for s in c.students))
print(all(s.average() > 80 for s in c.students))
print(list(s.average() for s in c.students))
`;

const interpreter = new ASTInterpreter(code, 'python');
const generator = interpreter.run();
let result;
while (!(result = generator.next()).done) {
  // run to completion
}
console.log("Interpreter Output:");
console.log(interpreter['stdout']);
