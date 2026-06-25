import { ASTInterpreter } from './src/engine/interpreter';

const code = `name = input("Enter name: ")
print(name)`;

console.log("Initializing interpreter...");
const interpreter = new ASTInterpreter(code, 'python');
const gen = interpreter.run();

console.log("Calling gen.next() (initial run)...");
let res = gen.next();
console.log("res.done:", res.done);
console.log("res.value description:", res.value && !Array.isArray(res.value) ? res.value.description : "array or null");
console.log("res.value.awaitingInput:", res.value && !Array.isArray(res.value) ? !!res.value.awaitingInput : "N/A");

if (res.value && !Array.isArray(res.value) && res.value.awaitingInput) {
  console.log("\nResuming gen.next('Lingesan')...");
  res = gen.next('Lingesan');
  console.log("res.done:", res.done);
  console.log("res.value description:", res.value && !Array.isArray(res.value) ? res.value.description : "array or null");

  while (!res.done) {
    console.log("\nResuming gen.next()...");
    res = gen.next();
    console.log("res.done:", res.done);
    if (!res.done && res.value && !Array.isArray(res.value)) {
      console.log("res.value description:", res.value.description);
      console.log("res.value stdout:", JSON.stringify(res.value.stdout));
    } else {
      console.log("Returned final value:", Array.isArray(res.value) ? `${res.value.length} steps` : typeof res.value);
    }
  }
}
