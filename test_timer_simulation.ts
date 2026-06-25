import { useCodeFlowStore } from './src/store/useCodeFlowStore';

const code = `name = input("Enter name: ")
print(name)`;

console.log("Setting code and language in store...");
useCodeFlowStore.setState({ code, language: 'python' });

// Simulate React useEffect for playback
let timer: NodeJS.Timeout | null = null;

function setupPlaybackTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  const { playbackState, awaitingInput, speed } = useCodeFlowStore.getState();
  console.log(`[Timer Setup] playbackState=${playbackState}, awaitingInput=${!!awaitingInput}`);
  
  if (playbackState !== 'playing' || awaitingInput) return;

  const intervalTime = 1000 / speed;
  console.log(`[Timer Start] interval=${intervalTime}ms`);
  
  timer = setInterval(() => {
    const { currentStepIndex, steps, stepForward, setPlaybackState } = useCodeFlowStore.getState();
    console.log(`[Timer Tick] currentStepIndex=${currentStepIndex}, steps.length=${steps.length}`);
    
    if (currentStepIndex < steps.length - 1) {
      console.log(`[Timer Tick] Calling stepForward()`);
      stepForward();
      
      // Check if stepForward shifted us into awaiting_input
      const newState = useCodeFlowStore.getState();
      if (newState.awaitingInput) {
        console.log(`[Timer Tick] Hit another input request, stopping timer`);
        setupPlaybackTimer();
      }
    } else {
      console.log(`[Timer Tick] Reached end of steps. Setting playbackState to finished`);
      setPlaybackState('finished');
      setupPlaybackTimer();
    }
  }, intervalTime);
}

// Subscribe to store changes to simulate React re-renders triggering useEffect updates
useCodeFlowStore.subscribe((state, prevState) => {
  if (
    state.playbackState !== prevState.playbackState ||
    state.awaitingInput !== prevState.awaitingInput ||
    state.speed !== prevState.speed
  ) {
    console.log(`[Store Update Trigger] playbackState: ${prevState.playbackState} -> ${state.playbackState}, awaitingInput: ${!!prevState.awaitingInput} -> ${!!state.awaitingInput}`);
    setupPlaybackTimer();
  }
});

console.log("\nCalling runCode()...");
useCodeFlowStore.getState().runCode();

// Initially runCode should transition to awaiting_input.
// We wait 1.5 seconds, then submit input.
setTimeout(() => {
  const state = useCodeFlowStore.getState();
  if (state.awaitingInput) {
    console.log("\nSimulating user submitting input: 'Lingesan'...");
    useCodeFlowStore.getState().submitInput('Lingesan');
  }
}, 1500);

// Keep process alive long enough to see the playback ticks
setTimeout(() => {
  console.log("\nSimulation finished. Final State:");
  const state = useCodeFlowStore.getState();
  console.log("  steps length:", state.steps.length);
  console.log("  currentStepIndex:", state.currentStepIndex);
  console.log("  playbackState:", state.playbackState);
  console.log("  stdout:", JSON.stringify(state.stdout));
  process.exit(0);
}, 6000);
