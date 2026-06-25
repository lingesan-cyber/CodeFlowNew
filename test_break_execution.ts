import { PythonParser } from './src/engine/languages/python';
import { ASTInterpreter } from './src/engine/interpreter';

function runTestCase(code: string, label: string) {
  console.log(`\n========================================`);
  console.log(`RUNNING CASE: ${label}`);
  console.log(`========================================`);
  console.log("Code:\n" + code + "\n");
  
  try {
    const parser = new PythonParser(code);
    const statements = parser.parse();
    
    console.log("GENERATED AST:");
    console.dir(statements, { depth: null });
    
    const interpreter = new ASTInterpreter(code, 'python');
    const gen = interpreter.run();
    
    console.log("\nEXECUTION TRACE:");
    let res = gen.next();
    const trace = [];
    while (!res.done) {
      const step = res.value;
      trace.push(step);
      console.log(`Line ${step.lineNumber}: ${step.operation} - ${step.description}`);
      res = gen.next();
    }
    const finalSteps = res.value || trace;
    const lastStep = finalSteps[finalSteps.length - 1];
    
    console.log(`\nTrace steps generated: ${finalSteps.length}`);
    console.log(`Stdout: ${JSON.stringify(lastStep?.stdout || '')}`);
  } catch (err: any) {
    console.error("Error/Crash:", err.message);
  }
}

// Case 1: while True: break
runTestCase(`while True:
    break`, "while True: break");

// Case 2: while True: print("HELLO"); break
runTestCase(`while True:
    print("HELLO")
    break`, "while True: print('HELLO'); break");

// Case 3: i = 0; while i < 3: print(i); i += 1
runTestCase(`i = 0
while i < 3:
    print(i)
    i += 1`, "while loop counting");
