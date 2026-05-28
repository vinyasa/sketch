export const createRecorderSlice = (set, get) => ({
  isRecording: false,
  recordedSteps: [],
  showRecorderPanel: false,

  setShowRecorderPanel: (v) => set({ showRecorderPanel: typeof v === 'function' ? v(get().showRecorderPanel) : v }),
  
  startRecording: () => set({ isRecording: true, recordedSteps: [] }),
  
  stopRecording: () => set({ isRecording: false }),
  
  clearRecordedSteps: () => set({ recordedSteps: [] }),
  
  addRecordedStep: (desc) => {
    const { isRecording, recordedSteps } = get();
    if (!isRecording) return;
    
    // Prevent duplicate consecutive steps from cluttering the logs
    if (recordedSteps.length > 0 && recordedSteps[recordedSteps.length - 1] === desc) return;

    // Detect if this is a consecutive keystroke update to the same numeric field
    if (recordedSteps.length > 0) {
      const lastStep = recordedSteps[recordedSteps.length - 1];
      const normalize = (str) => str.replace(/\d+(\.\d+)?/g, '#');
      if (normalize(lastStep) === normalize(desc)) {
        // Overwrite the last step with the updated value instead of appending
        const nextSteps = [...recordedSteps];
        nextSteps[nextSteps.length - 1] = desc;
        set({ recordedSteps: nextSteps });
        return;
      }
    }

    set({ recordedSteps: [...recordedSteps, desc] });
  }
});
