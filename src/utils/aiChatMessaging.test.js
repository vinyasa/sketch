import { describe, expect, it } from 'vitest';
import {
  appendAiMessage,
  replaceThinkingWithAiError,
  replaceThinkingWithAiMessage,
  showAiThinking,
} from './aiChatMessaging';

function createRecorder(initial = []) {
  let state = initial;
  const setChatMessages = (updater) => {
    state = typeof updater === 'function' ? updater(state) : updater;
  };
  return {
    setChatMessages,
    getState: () => state,
  };
}

describe('aiChatMessaging', () => {
  it('appends a plain AI message', () => {
    const recorder = createRecorder([]);
    appendAiMessage(recorder.setChatMessages, 'Hello');
    expect(recorder.getState()).toEqual([{ role: 'ai', text: 'Hello' }]);
  });

  it('appends a thinking message', () => {
    const recorder = createRecorder([]);
    showAiThinking(recorder.setChatMessages);
    expect(recorder.getState()).toEqual([
      { role: 'ai', text: 'Thinking...', isThinking: true },
    ]);
  });

  it('replaces any thinking messages with a final AI reply', () => {
    const recorder = createRecorder([
      { role: 'user', text: 'hi' },
      { role: 'ai', text: 'Thinking...', isThinking: true },
    ]);
    replaceThinkingWithAiMessage(recorder.setChatMessages, 'Done');
    expect(recorder.getState()).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'ai', text: 'Done' },
    ]);
  });

  it('replaces thinking messages with an error reply', () => {
    const recorder = createRecorder([{ role: 'ai', text: 'Thinking...', isThinking: true }]);
    replaceThinkingWithAiError(recorder.setChatMessages, new Error('boom'));
    expect(recorder.getState()).toEqual([{ role: 'ai', text: 'Error: boom' }]);
  });
});
