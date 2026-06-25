import { useCodeFlowStore } from './src/store/useCodeFlowStore';

const code = `name = input("Enter name: ")
print(name)`;

console.log("Setting code and language in store...");
useCodeFlowStore.setState({ code, language: 'python' });

console.log("\nCalling runCode()...");
useCodeFlowStore.getState().runCode();

const stateAfterRun = useCodeFlowStore.getState();
console.log("After runCode:");
console.log("  steps length:", stateAfterRun.steps.length);
console.log("  currentStepIndex:", stateAfterRun.currentStepIndex);
console.log("  playbackState:", stateAfterRun.playbackState);
console.log("  awaitingInput:", !!stateAfterRun.awaitingInput);
console.log("  editorStatus:", stateAfterRun.editorStatus);

if (stateAfterRun.awaitingInput) {
  console.log("\nCalling submitInput('Lingesan')...");
  useCodeFlowStore.getState().submitInput('Lingesan');

  const stateAfterSubmit = useCodeFlowStore.getState();
  console.log("After submitInput:");
  console.log("  steps length:", stateAfterSubmit.steps.length);
  console.log("  currentStepIndex:", stateAfterSubmit.currentStepIndex);
  console.log("  playbackState:", stateAfterSubmit.playbackState);
  console.log("  awaitingInput:", !!stateAfterSubmit.awaitingInput);
  console.log("  editorStatus:", stateAfterSubmit.editorStatus);
  console.log("  stdout:", JSON.stringify(stateAfterSubmit.stdout));
  console.log("  steps detail:");
  stateAfterSubmit.steps.forEach((s, idx) => {
    console.log(`    Step ${idx}: ${s.operation} - ${s.description}`);
  });
}
