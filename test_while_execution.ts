import { ASTInterpreter } from './src/engine/interpreter';

function runTestCase(code: string, language: 'python', label: string) {
  console.log(`\n--- Running [${label}] ---`);
  try {
    const interpreter = new ASTInterpreter(code, language);
    const gen = interpreter.run();
    let res = gen.next();
    const steps = [];
    while (!res.done) {
      steps.push(res.value);
      res = gen.next();
    }
    const finalSteps = res.value || steps;
    const lastStep = finalSteps[finalSteps.length - 1];
    
    console.log("Steps Count:", finalSteps.length);
    console.log("Stdout:", JSON.stringify(lastStep?.stdout || ''));
    if (lastStep?.error) {
      console.log("Error Encountered:", lastStep.error.message);
    } else {
      console.log("Completed Cleanly");
    }
  } catch (err: any) {
    console.log("Crash Encountered:", err.message);
  }
}

// 1. while True loop execution and infinite loop timeout/max steps check
runTestCase(`while True:
    print("Hello")`, 'python', 'while True loop');

// 2. while False loop execution skipping body check
runTestCase(`x = 10
while False:
    x = 20
print(x)`, 'python', 'while False loop');

// 3. while i < 3 loop execution looping check
runTestCase(`i = 0
while i < 3:
    print(i)
    i = i + 1`, 'python', 'while i < 3 loop');
