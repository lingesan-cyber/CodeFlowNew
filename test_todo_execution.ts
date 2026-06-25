import { ASTInterpreter } from './src/engine/interpreter';

const code = `
tasks = []

print("=== Welcome to the To-Do List ===")

while True:
    print("\\nOptions:")
    print("1. Add a task")
    print("2. View tasks")
    print("3. Quit")
    
    choice = input("Choose an option (1, 2, or 3): ")
    
    if choice == '1':
        new_task = input("Enter the task: ")
        tasks.append(new_task)
        print("Task added!")
        
    elif choice == '2':
        print("\\n--- Your Tasks ---")
        if len(tasks) == 0:
            print("Your list is empty.")
        else:
            index = 0
            while index < len(tasks):
                print(str(index + 1) + ". " + tasks[index])
                index += 1
                
    elif choice == '3':
        print("Goodbye! Thanks for using the To-Do List.")
        break
        
    else:
        print("Invalid choice, please type 1, 2, or 3.")
`;

async function testTodo() {
  console.log("=== STARTING TO-DO LIST TEST ===");
  const interpreter = new ASTInterpreter(code, 'python');
  const gen = interpreter.run();

  const mockInputs = [
    '1',          // Option 1: Add a task
    'Buy milk',   // Task description
    '2',          // Option 2: View tasks
    '3'           // Option 3: Quit
  ];

  let inputIndex = 0;
  let step = gen.next();

  while (!step.done) {
    const val = step.value;
    // If the step is waiting for input
    if (val.awaitingInput) {
      const prompt = val.awaitingInput.promptMessage;
      const varName = val.awaitingInput.variableName;
      const injectedVal = mockInputs[inputIndex++];
      console.log(`[INPUT REQUESTED] Var: ${varName}, Prompt: "${prompt}" -> Injecting: "${injectedVal}"`);
      step = gen.next(injectedVal);
    } else {
      step = gen.next();
    }
  }

  const finalSteps = step.value;
  const lastStep = finalSteps[finalSteps.length - 1];

  console.log("=== EXECUTION FINISHED ===");
  console.log("Total Steps:", finalSteps.length);
  if (lastStep.error) {
    console.error("Execution failed with error:", lastStep.error.message);
    process.exit(1);
  } else {
    console.log("Execution completed successfully!");
  }

  console.log("\nStdout output:\n" + lastStep.stdout);

  // Assert expected outputs are present
  const stdout = lastStep.stdout;
  const assertions = [
    "=== Welcome to the To-Do List ===",
    "Options:",
    "1. Add a task",
    "Task added!",
    "--- Your Tasks ---",
    "1. Buy milk",
    "Goodbye! Thanks for using the To-Do List."
  ];

  let passed = true;
  for (const assertion of assertions) {
    if (stdout.includes(assertion)) {
      console.log(`✅ Asserted presence of: "${assertion}"`);
    } else {
      console.error(`❌ FAILED assertion of: "${assertion}"`);
      passed = false;
    }
  }

  if (passed) {
    console.log("\n🎉 ALL ASSERTIONS PASSED!");
  } else {
    process.exit(1);
  }
}

testTodo().catch(err => {
  console.error(err);
  process.exit(1);
});
