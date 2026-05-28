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
    set({ recordedSteps: [...recordedSteps, desc] });
  }
});
